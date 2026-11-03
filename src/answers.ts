// Logs one week of AI calls: reads each model's answer, appends the calls to data/ledger.json and
// writes the video's ideas file from them, so the cards hold exactly what the ledger holds.
//
// Each answer is saved verbatim as data/answers/<week>/<model>.md, next to models.json, which maps
// each model to the exact model id the answer came from. The prompt they answered is
// data/prompts/<week>.txt; its sha256 is stored with every call. An answer ends with the block the
// prompt asks for (CALL, CONFIDENCE, REASON, FACTORS); everything above it is kept as the reasoning.
// A card shows the name models.json gives the model and its REASON line, word for word.
//
// An event call works the same way under the event's slug: data/prompts/<event>.txt and
// data/answers/<event>/. It is logged before its cutoff, checked at its verify date, and has no cards.
//
// Usage:
//   node src/answers.ts --week 2026-11-02           dry run: print what would be logged, write nothing
//   node src/answers.ts --week 2026-11-02 --write   append the calls to the ledger and write
//                                                   video/assets/data/ideas-2026-11-02.json
//   node src/answers.ts --event anthropic-ipo --verify-date 2026-11-17T21:00:00Z --cutoff 2026-11-16T22:00:00Z [--write]
//                                                   the same for an event: the ledger only, no ideas file

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { addPrediction, FORBIDDEN_WORDS, loadLedger, MODELS, saveLedger, SUBJECT } from './ledger.ts';
import type { Direction, Factor, Ledger, Model, NewPrediction } from './ledger.ts';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const LEDGER_PATH = join(PROJECT_ROOT, 'data', 'ledger.json');
const ANSWERS_DIR = join(PROJECT_ROOT, 'data', 'answers');
const PROMPTS_DIR = join(PROJECT_ROOT, 'data', 'prompts');
const IDEAS_DIR = join(PROJECT_ROOT, 'video', 'assets', 'data');
const MODELS_FILE = 'models.json';
const ANSWER_EXT = '.md';
const WEEK_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
const DAY_MS = 86_400_000;
const CALL_DAYS = 5; // Monday 00:00 to Friday 23:59:59 UTC
const LAST_SECOND_MS = 1000;
const MONDAY = 1;
const MIN_CONFIDENCE = 50; // the prompt asks for 50-100: a call below 50 would be the other call
const MAX_CONFIDENCE = 100;
const MAX_REASON_WORDS = 10; // what a card fits; episode.js counts words the same way
const MIN_FACTORS = 2;
const MAX_FACTORS = 3;
// The keys episode.js picks each card's colour and logo by. The name on the card comes from models.json.
const CARD_KEYS: Readonly<Record<Model, string>> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', grok: 'Grok' };

const CALL_LINE = /^CALL\s*:\s*(UP|DOWN)\b/i;
const CONFIDENCE_LINE = /^CONFIDENCE\s*:\s*(.*)$/i;
const REASON_LINE = /^REASON\s*:\s*(.*)$/i;
const FACTORS_LINE = /^FACTORS\s*:?\s*(.*)$/i;
const FACTOR_LINE = /^(.+?)\s*\|\s*(?:pulls\s*:?\s*)?(UP|DOWN)\s*\.?$/i;
const WHOLE_NUMBER = /^(\d+)(?!\d|[.,]\d)/; // the first \d keeps 500.5 from passing as 50
const LIST_MARK = /^(?:[#>•-]+|\d+[.)])\s+/;
const MARKDOWN = /[*`]|(?<!\w)_|_(?!\w)/g;
const QUOTES = /^["'“”‘’]+|["'“”‘’]+$/g;
const WORD = /[\p{L}\p{N}]/u;

export class AnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnswerError';
  }
}

// The block an answer ends with.
export interface ParsedAnswer {
  readonly direction: Direction;
  readonly confidence: number;
  readonly reason: string;
  readonly factors: readonly Factor[];
}

export interface WeekCall extends ParsedAnswer {
  readonly model: Model;
  readonly modelVersion: string;
  readonly answer: string; // the whole answer, trimmed, LF line ends
  readonly words: number;
}

export interface Idea {
  readonly model: string; // picks the card's colour and logo
  readonly name: string; // what the card reads, from models.json
  readonly call: Direction;
  readonly confidence: number;
  readonly reason: string;
}

export interface IdeasFile {
  readonly note: string;
  readonly ideas: readonly Idea[];
}

export interface WeekFiles {
  readonly ledger: string;
  readonly ideas: string;
}

export interface EventSchedule {
  readonly verifyDate: string; // when the outcome is known, such as the first day's close
  readonly cutoff: string; // calls are logged before this, such as before the offer price is set
}

export function parseAnswer(model: Model, answer: string): ParsedAnswer {
  const lines = normalise(answer).split('\n').map(cleanLine);
  const callAt = lines.findLastIndex((line) => CALL_LINE.test(line));
  if (callAt < 0) throw new AnswerError(`${model}: no "CALL: UP" or "CALL: DOWN" line`);
  const direction = (CALL_LINE.exec(lines[callAt] ?? '')?.[1] ?? '').toLowerCase() as Direction;
  const block = lines.slice(callAt + 1);
  return {
    direction,
    confidence: readConfidence(model, field(model, block, CONFIDENCE_LINE, 'CONFIDENCE')),
    reason: readReason(model, field(model, block, REASON_LINE, 'REASON')),
    factors: readFactors(model, block),
  };
}

// Whitespace-separated tokens with at least one letter or digit, so a dash or a bullet is not a word.
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => WORD.test(token)).length;
}

export function forbiddenWords(text: string): readonly string[] {
  const all = new RegExp(FORBIDDEN_WORDS.source, 'gi');
  return [...new Set([...text.matchAll(all)].map((match) => match[0].toLowerCase()))];
}

export function weekStart(week: string): Date {
  const start = new Date(`${week}T00:00:00Z`);
  if (!WEEK_DATE.test(week) || Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== week) {
    throw new AnswerError(`week must be a date like 2026-11-02, got "${week}"`);
  }
  if (start.getUTCDay() !== MONDAY) throw new AnswerError(`week must start on a Monday, ${week} is not one`);
  return start;
}

// The last second of Friday, UTC: the moment the prompt asks about.
export function checkDateOf(week: string): string {
  return new Date(weekStart(week).getTime() + CALL_DAYS * DAY_MS - LAST_SECOND_MS).toISOString();
}

// An event call also names its event; a BTC call names none.
export function toPrediction(call: WeekCall, promptHash: string, verifyDate: string, subject?: string): NewPrediction {
  return {
    model: call.model,
    model_version: call.modelVersion,
    direction: call.direction,
    confidence: call.confidence,
    reasoning: call.answer,
    factors: call.factors,
    prompt_hash: promptHash,
    verify_date: verifyDate,
    ...(subject === undefined ? {} : { subject }),
  };
}

// Why a reason can't go on a card as written. The model's words are never shortened for it.
export function reasonProblems(calls: readonly WeekCall[]): readonly string[] {
  return calls.flatMap((call) => {
    const words = call.reason.trim().split(/\s+/).length;
    const forbidden = forbiddenWords(call.reason);
    return [
      ...(words > MAX_REASON_WORDS ? [`${call.model}: reason has ${words} words, a card fits ${MAX_REASON_WORDS}`] : []),
      ...(forbidden.length > 0 ? [`${call.model}: reason uses "${forbidden.join('", "')}"`] : []),
    ];
  });
}

export function ideasOf(week: string, calls: readonly WeekCall[], ids: readonly string[]): IdeasFile {
  return {
    note: `Calls for the week of ${week} as logged in data/ledger.json (${ids.join(', ')}). Names from data/answers/${week}/${MODELS_FILE}.`,
    ideas: inModelOrder(calls).map((call) => ({
      model: CARD_KEYS[call.model],
      name: call.modelVersion,
      call: call.direction,
      confidence: call.confidence,
      reason: call.reason,
    })),
  };
}

export function readCalls(dir: string): readonly WeekCall[] {
  const versions = readVersions(join(dir, MODELS_FILE));
  const answered = readdirSync(dir).filter((name) => name.endsWith(ANSWER_EXT)).map((name) => basename(name, ANSWER_EXT));
  const unknown = answered.filter((name) => !(MODELS as readonly string[]).includes(name));
  if (unknown.length > 0) throw new AnswerError(`unknown answer files: ${unknown.join(', ')} (models are ${MODELS.join(', ')})`);
  const listed = Object.keys(versions).toSorted().join(', ');
  if (answered.toSorted().join(', ') !== listed) {
    throw new AnswerError(`${MODELS_FILE} lists ${listed || 'no models'}, the answers are ${answered.join(', ') || 'none'}`);
  }
  if (answered.length === 0) throw new AnswerError(`no answers in ${dir}`);
  return inModelOrder(
    (answered as Model[]).map((model) => {
      const answer = normalise(readFileSync(join(dir, `${model}${ANSWER_EXT}`), 'utf8')).trim();
      return { ...parseAnswer(model, answer), model, modelVersion: versions[model] ?? '', answer, words: countWords(answer) };
    }),
  );
}

// Appends the calls in one save and writes the ideas file unless a reason can't go on a card.
// Refuses once the week has opened: a call logged after the start price is known isn't a call.
export function writeWeek(
  week: string,
  calls: readonly WeekCall[],
  promptHash: string,
  files: WeekFiles,
  now: Date = new Date(),
): readonly string[] {
  if (now.getTime() >= weekStart(week).getTime()) {
    throw new AnswerError(`the week of ${week} has already opened; calls are logged before Monday 00:00 UTC`);
  }
  const ledger = appendCalls(loadLedger(files.ledger), calls, promptHash, checkDateOf(week), now);
  saveLedger(files.ledger, ledger);
  if (reasonProblems(calls).length > 0) return [files.ledger];
  const ids = ledger.predictions.slice(-calls.length).map((p) => p.id);
  writeFileSync(files.ideas, `${JSON.stringify(ideasOf(week, calls, ids), null, 2)}\n`);
  return [files.ledger, files.ideas];
}

// Both times as toISOString() writes them. The calls close before the outcome can be known.
export function readSchedule(schedule: EventSchedule): EventSchedule {
  const verifyDate = utcTime('verify date', schedule.verifyDate);
  const cutoff = utcTime('cutoff', schedule.cutoff);
  if (cutoff >= verifyDate) throw new AnswerError(`the cutoff ${cutoff} must come before the verify date ${verifyDate}`);
  return { verifyDate, cutoff };
}

// Appends an event's calls in one save, each naming the event; an event has no ideas file.
// Refuses at the cutoff: a call logged once its start is known, such as the offer price, isn't a call.
export function writeEvent(
  event: string,
  calls: readonly WeekCall[],
  promptHash: string,
  ledgerPath: string,
  schedule: EventSchedule,
  now: Date = new Date(),
): readonly string[] {
  const { verifyDate, cutoff } = readSchedule(schedule);
  if (now.toISOString() >= cutoff) {
    throw new AnswerError(`the calls on ${event} closed at ${cutoff}; calls are logged before the cutoff`);
  }
  saveLedger(ledgerPath, appendCalls(loadLedger(ledgerPath), calls, promptHash, verifyDate, now, event));
  return [ledgerPath];
}

function main(): void {
  const { values } = parseArgs({
    options: {
      week: { type: 'string' },
      event: { type: 'string' },
      'verify-date': { type: 'string' },
      cutoff: { type: 'string' },
      write: { type: 'boolean', default: false },
    },
    strict: true,
  });
  const { week, event, cutoff, write } = values;
  const verifyDate = values['verify-date'];
  if (week !== undefined && event !== undefined) throw new AnswerError('pass --week or --event, not both');
  if (event !== undefined) {
    if (verifyDate === undefined || cutoff === undefined) {
      throw new AnswerError('--event needs --verify-date and --cutoff, UTC times such as 2026-11-17T21:00:00Z');
    }
    print(logEvent(event, { verifyDate, cutoff }, write));
    return;
  }
  if (week === undefined) throw new AnswerError('--week YYYY-MM-DD or --event <slug> is required');
  if (verifyDate !== undefined || cutoff !== undefined) throw new AnswerError('--verify-date and --cutoff go with --event');
  print(logWeek(week, write));
}

function logWeek(week: string, write: boolean): object {
  const verifyDate = checkDateOf(week);
  const { promptHash, calls } = readSaved(week);
  const files = { ledger: LEDGER_PATH, ideas: join(IDEAS_DIR, `ideas-${week}.json`) };
  const written = write ? writeWeek(week, calls, promptHash, files) : [];
  return {
    week,
    prompt_hash: promptHash,
    verify_date: verifyDate,
    ...callsSummary(calls),
    ideasBlocked: reasonProblems(calls),
    written: fromRoot(written),
  };
}

function logEvent(event: string, schedule: EventSchedule, write: boolean): object {
  if (!SUBJECT.test(event)) throw new AnswerError(`--event must be a lowercase slug such as anthropic-ipo, got "${event}"`);
  const { verifyDate, cutoff } = readSchedule(schedule);
  const { promptHash, calls } = readSaved(event);
  const written = write ? writeEvent(event, calls, promptHash, LEDGER_PATH, schedule) : [];
  return { event, prompt_hash: promptHash, verify_date: verifyDate, cutoff, ...callsSummary(calls), written: fromRoot(written) };
}

// A week's or an event's prompt is data/prompts/<name>.txt and its answers are in data/answers/<name>/.
function readSaved(name: string): { readonly promptHash: string; readonly calls: readonly WeekCall[] } {
  const promptPath = join(PROMPTS_DIR, `${name}.txt`);
  if (!existsSync(promptPath)) throw new AnswerError(`no prompt at data/prompts/${name}.txt`);
  const promptHash = createHash('sha256').update(readFileSync(promptPath)).digest('hex');
  return { promptHash, calls: readCalls(join(ANSWERS_DIR, name)) };
}

function callsSummary(calls: readonly WeekCall[]): object {
  return {
    calls: calls.map((c) => ({
      model: c.model,
      model_version: c.modelVersion,
      direction: c.direction,
      confidence: c.confidence,
      reason: c.reason,
      factors: c.factors,
      words: c.words,
    })),
    missing: MODELS.filter((model) => !calls.some((c) => c.model === model)),
    forbidden: Object.fromEntries(
      calls.map((c) => [c.model, forbiddenWords(c.answer)] as const).filter(([, words]) => words.length > 0),
    ),
  };
}

function fromRoot(paths: readonly string[]): readonly string[] {
  return paths.map((path) => path.slice(PROJECT_ROOT.length + 1));
}

function print(summary: object): void {
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

function appendCalls(
  ledger: Ledger,
  calls: readonly WeekCall[],
  promptHash: string,
  verifyDate: string,
  now: Date,
  subject?: string,
): Ledger {
  return calls.reduce<Ledger>((next, call) => addPrediction(next, toPrediction(call, promptHash, verifyDate, subject), now), ledger);
}

// A date-time ending in Z; Date would roll an impossible day like November 31 into the next month.
function utcTime(name: string, value: string): string {
  const time = new Date(value);
  if (!UTC_TIME.test(value) || Number.isNaN(time.getTime()) || time.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new AnswerError(`${name} must be a UTC time such as 2026-11-17T21:00:00Z, got "${value}"`);
  }
  return time.toISOString();
}

function normalise(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

// Drops the markdown a chat reply wraps the block in: bold, code, list marks, headings.
function cleanLine(line: string): string {
  return line.replace(MARKDOWN, '').trim().replace(LIST_MARK, '').trim();
}

function field(model: Model, block: readonly string[], pattern: RegExp, name: string): string {
  const line = block.find((candidate) => pattern.test(candidate));
  if (line === undefined) throw new AnswerError(`${model}: no ${name} line after the CALL line`);
  return pattern.exec(line)?.[1]?.trim() ?? '';
}

function readConfidence(model: Model, value: string): number {
  const whole = WHOLE_NUMBER.exec(value);
  const confidence = whole ? Number(whole[1]) : Number.NaN;
  if (!(confidence >= MIN_CONFIDENCE && confidence <= MAX_CONFIDENCE)) {
    throw new AnswerError(`${model}: CONFIDENCE must be a whole number from ${MIN_CONFIDENCE} to ${MAX_CONFIDENCE}, got "${value}"`);
  }
  return confidence;
}

function readReason(model: Model, value: string): string {
  const reason = value.replace(QUOTES, '').trim().replace(/\.$/, '').trim();
  if (reason === '') throw new AnswerError(`${model}: REASON is empty`);
  return reason;
}

// Factor lines follow the FACTORS line, blank lines aside, until the first line that isn't one.
function readFactors(model: Model, block: readonly string[]): readonly Factor[] {
  const at = block.findIndex((line) => FACTORS_LINE.test(line));
  if (at < 0) throw new AnswerError(`${model}: no FACTORS line after the CALL line`);
  const inline = FACTORS_LINE.exec(block[at] ?? '')?.[1] ?? '';
  const lines = [inline, ...block.slice(at + 1)].filter((line) => line !== '');
  const end = lines.findIndex((line) => !FACTOR_LINE.test(line));
  const factors = (end < 0 ? lines : lines.slice(0, end)).map((line) => {
    const [, text = '', pulls = ''] = FACTOR_LINE.exec(line) ?? [];
    return { text: text.trim(), pulls: pulls.toLowerCase() as Direction };
  });
  if (factors.length < MIN_FACTORS || factors.length > MAX_FACTORS) {
    throw new AnswerError(`${model}: needs ${MIN_FACTORS} to ${MAX_FACTORS} "factor | pulls UP or DOWN" lines, found ${factors.length}`);
  }
  return factors;
}

function readVersions(path: string): Readonly<Partial<Record<Model, string>>> {
  if (!existsSync(path)) throw new AnswerError(`no ${MODELS_FILE} next to the answers`);
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AnswerError(`${MODELS_FILE} must map each model to its exact model id`);
  }
  const entries = Object.entries(value);
  const bad = entries.filter(([model, id]) => !(MODELS as readonly string[]).includes(model) || typeof id !== 'string' || id.trim() === '');
  if (bad.length > 0) throw new AnswerError(`${MODELS_FILE}: bad entries for ${bad.map(([model]) => model).join(', ')}`);
  return Object.fromEntries(entries.map(([model, id]) => [model, (id as string).trim()]));
}

function inModelOrder<T extends { readonly model: Model }>(calls: readonly T[]): T[] {
  return calls.toSorted((a, b) => MODELS.indexOf(a.model) - MODELS.indexOf(b.model));
}

if (import.meta.main) {
  try {
    main();
  } catch (error: unknown) {
    process.stderr.write(`Logging answers failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
