// Charts for the site, drawn as plain HTML when the site is built: the pages run no scripts.
// Every mark has its word or number beside it, so a chart never depends on color or shape alone.
//
// In an article, a chart is a fenced block with the chart's name and, for a weekly chart, the Monday of the week:
//
//   ```chart
//   check 2026-11-02
//   ```
//
//   calls <Monday>         what each model called that week and how sure it was
//   factors <Monday>       what each model weighed that week, each factor on the side it pulls
//   check <Monday>         the price move of that week and which calls came true
//   score [<Monday>]       hit rate per model against a coin flip; with a Monday, only the weeks up to that one
//   score-change <Monday>  hit rate per model before that week and after it
//   flow                   the four steps of a week
//   example-call           one made-up call taken apart, with what each part means

import { createHash } from 'node:crypto';
import { getStats, MODELS } from '../ledger.ts';
import type { Direction, Factor, Ledger, ModelStats, Prediction, Verification } from '../ledger.ts';
import { escapeHtml } from './html.ts';
import { DIRECTION_NAMES, formatChange, formatUtc, MODEL_NAMES, resultLabel } from './ledger-view.ts';

export class ChartError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ChartError';
  }
}

interface Week {
  readonly day: string; // the Monday, YYYY-MM-DD
  readonly monday: Date;
  readonly calls: readonly Prediction[]; // in model order
  readonly verdicts: ReadonlyMap<string, Verification>;
}

interface Checked {
  readonly call: Prediction;
  readonly verdict: Verification;
}

const SIGNS: Readonly<Record<Direction, string>> = { up: '▲', down: '▼' };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONDAY = 1; // as Date.getUTCDay() counts
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EXAMPLE_MONDAY = '2026-11-02';
const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const PRICE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SCORE_AXIS = `<div class="bar-row bar-axis" aria-hidden="true"><span class="axis"><span>0%</span><span class="axis-mid">50% · coin flip</span><span>100%</span></span></div>`;
const NO_CHECKS = '<span class="bar-none">No checked calls yet</span>';
const CHANGE_NOTE = `<p class="chart-note"><span class="dot before" aria-hidden="true"></span> Before the week, <span class="dot after" aria-hidden="true"></span> after it. The line in the middle is 50%: a coin flip.</p>`;

const PULL_NAMES: Readonly<Record<Direction, string>> = { up: 'Pulls higher', down: 'Pulls lower' };
const PULLS_HEAD = `<div class="pulls pulls-head" aria-hidden="true"><span class="down"><span class="sign">${SIGNS.down}</span> ${PULL_NAMES.down}</span><span class="up">${PULL_NAMES.up} <span class="sign">${SIGNS.up}</span></span></div>`;

const FLOW_STEPS: readonly (readonly [when: string, what: string, detail: string])[] = [
  ['Monday', 'Four AIs make a call', 'Each says whether BTC ends the week higher or lower, and how sure it is.'],
  ['Before any post', 'The calls go into the ledger', 'The open ledger records them first. Nothing in it is edited later.'],
  ['Friday', 'The price is checked', 'End price against start price: each call becomes a hit or a miss.'],
  ['Every week', 'The scoreboard adds up', 'A coin flip is right about half the time, so 50% is the bar to beat.'],
];

// The example call is fixed here rather than read from the ledger, so it stays the same and never passes for a real one.
// The check time is not settled yet, so it shows the day only.
const CHECK_DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT_HASH = 16; // hex digits of the prompt hash shown in the example
const EXAMPLE_CALL: Prediction = {
  id: 'example',
  date: '2026-11-02T09:00:00Z',
  model: 'chatgpt',
  model_version: 'chatgpt-example',
  direction: 'up',
  confidence: 64,
  reasoning:
    'Each of the past five daily closes was above the one before, and last week closed near the top of its range. Short runs like this often fade, so the confidence is moderate.',
  factors: [
    { text: 'Five higher daily closes in a row.', pulls: 'up' },
    { text: 'Last week closed near the top of its range.', pulls: 'up' },
    { text: 'Short runs like this often fade.', pulls: 'down' },
  ],
  prompt_hash: createHash('sha256').update('EXAMPLE PROMPT, not the real one').digest('hex'),
  verify_date: '2026-11-06T20:00:00Z',
};

export function renderChart(spec: string, ledger: Ledger): string {
  const [kind = '', ...args] = spec.trim().split(/\s+/);
  switch (kind) {
    case 'calls':
      return renderCalls(readWeek(kind, args, ledger));
    case 'factors':
      return renderFactors(readWeek(kind, args, ledger));
    case 'check':
      return renderCheck(readWeek(kind, args, ledger));
    case 'score':
      return args.length === 0 ? renderScoreChart(ledger) : renderScoreThrough(readMonday(kind, args), ledger);
    case 'score-change':
      return renderScoreChange(readWeek(kind, args, ledger), ledger);
    case 'flow':
      readNothing(kind, args);
      return renderFlow();
    case 'example-call':
      readNothing(kind, args);
      return renderExampleCall();
    default:
      throw new ChartError(`unknown chart "${kind}"; use calls, factors, check, score, score-change, flow or example-call`);
  }
}

// The front page scoreboard: hit rate per model over every checked call.
export function renderScoreChart(ledger: Ledger): string {
  return scoreFigure(ledger, 'Hit rate per model, all weeks so far');
}

function renderScoreThrough(monday: Date, ledger: Ledger): string {
  const caption = `Hit rate per model, through the week of ${LONG_DATE.format(monday)}`;
  return scoreFigure(ledgerBefore(ledger, monday.getTime() + WEEK_MS), caption);
}

function scoreFigure(ledger: Ledger, caption: string): string {
  const stats = getStats(ledger);
  const rows = MODELS.map((model) => scoreRow(MODEL_NAMES[model], stats[model]));
  const hasBars = MODELS.some((model) => stats[model].hit_rate !== null);
  return figure('score', caption, `<div class="bars">
    ${[...rows, ...(hasBars ? [SCORE_AXIS] : [])].join('\n    ')}
  </div>`);
}

function scoreRow(name: string, stats: ModelStats): string {
  if (stats.hit_rate === null) return barRow(name, NO_CHECKS);
  const rate = percent(stats.hit_rate);
  const bar = `<span class="bar" aria-hidden="true"><span class="bar-fill" style="width: ${rate}%"></span></span>`;
  return barRow(name, `${bar}<span class="bar-value">${rate}% · ${stats.hits} of ${stats.verified}</span>`);
}

// The hit rate from the earlier weeks against the hit rate once the week's calls are checked.
function renderScoreChange(week: Week, ledger: Ledger): string {
  const start = week.monday.getTime();
  const before = getStats(ledgerBefore(ledger, start));
  const after = getStats(ledgerBefore(ledger, start + WEEK_MS));
  const rows = MODELS.map((model) => changeRow(MODEL_NAMES[model], before[model], after[model]));
  const hasDots = MODELS.some((model) => after[model].hit_rate !== null);
  const caption = `Hit rate per model, before and after the week of ${LONG_DATE.format(week.monday)}`;
  return figure('score-change', caption, `<div class="bars">
    ${[...rows, ...(hasDots ? [SCORE_AXIS] : [])].join('\n    ')}
  </div>${hasDots ? `\n  ${CHANGE_NOTE}` : ''}`);
}

// A filled dot for the rate after the week. When the week added checks to an earlier rate,
// a hollow dot for that rate too, joined to the filled one by a line.
function changeRow(name: string, before: ModelStats, after: ModelStats): string {
  if (after.hit_rate === null) return barRow(name, NO_CHECKS);
  const to = percent(after.hit_rate);
  const count = `${after.hits} of ${after.verified}`;
  const dot = (when: string, at: number): string => `<span class="dot ${when}" style="left: ${at}%"></span>`;
  const row = (marks: string, value: string): string =>
    barRow(name, `<span class="dumbbell" aria-hidden="true">${marks}</span><span class="bar-value">${value}</span>`);
  if (before.hit_rate === null) return row(dot('after', to), `First check: ${to}% · ${count}`);
  if (after.verified === before.verified) return row(dot('after', to), `${to}% · no new check`);
  const from = percent(before.hit_rate);
  const line = `<span class="dumbbell-line" style="left: ${Math.min(from, to)}%; width: ${Math.abs(to - from)}%"></span>`;
  return row(`${line}${dot('before', from)}${dot('after', to)}`, `${from}% → ${to}% · ${count}`);
}

function barRow(name: string, content: string): string {
  return `<div class="bar-row"><span class="bar-model">${name}</span>${content}</div>`;
}

function percent(rate: number): number {
  return Math.round(rate * 100);
}

// The ledger as it stood for the calls recorded before a time: those calls and their checks.
function ledgerBefore(ledger: Ledger, time: number): Ledger {
  const predictions = ledger.predictions.filter((p) => Date.parse(p.date) < time);
  const ids = new Set(predictions.map((p) => p.id));
  const verifications = ledger.verifications.filter((v) => ids.has(v.prediction_id));
  return { ...ledger, predictions, verifications };
}

function renderCalls(week: Week): string {
  const tiles = week.calls.map((p) =>
    tile(p, '', `${meter(p.confidence)}
      <span class="tile-note">Confidence ${p.confidence}%</span>`),
  );
  return figure('calls', `The calls for the week of ${LONG_DATE.format(week.monday)}`, `${tileList(tiles)}
  <p class="chart-note">The bar shows how sure each model said it was. The mark in the middle is 50%: no surer than a coin flip.</p>`);
}

// Each model's call with the factors it named, split by the way each one pulls: lower on the left, higher on the right.
function renderFactors(week: Week): string {
  return figure('factors', `What each model weighed, week of ${LONG_DATE.format(week.monday)}`, `${PULLS_HEAD}
  ${week.calls.map(reasonBlock).join('\n  ')}
  <p class="chart-note">In each model's own words, recorded in the ledger with its call.</p>`);
}

function reasonBlock(p: Prediction): string {
  const factors = p.factors ?? [];
  const body =
    factors.length === 0
      ? '<p class="reason-none">No factors recorded</p>'
      : `<div class="pulls">${pullList(factors, 'down')}${pullList(factors, 'up')}</div>`;
  return `<div class="reason ${p.direction}">
    <p class="reason-head"><span class="tile-model">${MODEL_NAMES[p.model]}</span> <span class="reason-call">${callLabel(p.direction)} · ${p.confidence}%</span></p>
    ${body}
  </div>`;
}

function pullList(factors: readonly Factor[], pulls: Direction): string {
  const items = factors.filter((f) => f.pulls === pulls).map((f) => `<li>${escapeHtml(f.text)}</li>`);
  const shown = items.length > 0 ? items : ['<li class="pull-none">None given</li>'];
  return `<ul class="pull ${pulls}" aria-label="${PULL_NAMES[pulls]}">${shown.join('')}</ul>`;
}

function renderCheck(week: Week): string {
  const caption = `The check for the week of ${LONG_DATE.format(week.monday)}`;
  const tiles = tileList(week.calls.map((p) => checkTile(p, week.verdicts.get(p.id))));
  const checked = week.calls.flatMap((call) => {
    const verdict = week.verdicts.get(call.id);
    return verdict ? [{ call, verdict }] : [];
  });
  const [first] = checked;
  if (first === undefined) {
    return figure('check', caption, `<p class="chart-status">Not checked yet. The check is due ${formatUtc(lastCheckDate(week.calls))}.</p>
  ${tiles}`);
  }

  checkOnePrice(checked, week.day);
  const sources = [...new Set(checked.map(({ verdict }) => verdict.price_source))].map(escapeHtml).join('; ');
  return figure('check', caption, `${movePanel(first)}
  <p class="chart-tally">${tally(checked, week.calls.length)}</p>
  ${tiles}
  <p class="chart-note">Prices: ${sources}. Higher means the end price is above the start price.</p>`);
}

function checkTile(p: Prediction, verdict: Verification | undefined): string {
  const state = verdict === undefined ? 'pending' : verdict.hit ? 'hit' : 'miss';
  return tile(p, state, resultLabel(verdict));
}

// One start price, one end price and the move between them; the arrow tilts the way the price went.
function movePanel({ call, verdict }: Checked): string {
  const point = (label: string, price: number, at: string): string =>
    `<p class="move-point"><span class="move-label">${label}</span><span class="move-price">${PRICE.format(price)}</span><span class="move-time">${formatUtc(at)}</span></p>`;
  return `<div class="move ${verdict.outcome}">
    ${point('Start price', verdict.price_start, call.date)}
    <p class="move-change"><span class="move-word">${callLabel(verdict.outcome)} <span class="move-pct">${formatChange(verdict.change_pct)}</span></span><span class="move-line" aria-hidden="true"></span></p>
    ${point('End price', verdict.price_end, call.verify_date)}
  </div>`;
}

// The chart shows one move for the whole week, so every checked call must use the same two prices.
function checkOnePrice(checked: readonly Checked[], day: string): void {
  const prices = new Set(checked.map(({ verdict }) => `${verdict.price_start} ${verdict.price_end}`));
  if (prices.size > 1) {
    throw new ChartError(`the calls of the week of ${day} were checked against different prices; this chart needs one start and one end price`);
  }
}

function tally(checked: readonly Checked[], total: number): string {
  const hits = checked.filter(({ verdict }) => verdict.hit).length;
  if (checked.length === total) return `${hits} of ${total} calls came true`;
  return `${hits} of ${checked.length} checked so far came true; ${total - checked.length} still pending`;
}

function lastCheckDate(calls: readonly Prediction[]): string {
  return calls.map((p) => p.verify_date).reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

function renderFlow(): string {
  const steps = FLOW_STEPS.map(
    ([when, what, detail]) => `<li><span class="step-when">${when}</span><strong>${what}</strong><span class="step-detail">${detail}</span></li>`,
  );
  return figure('flow', 'One week of the experiment', `<ol class="steps">
    ${steps.join('\n    ')}
  </ol>`);
}

// The parts of one call, top to bottom, each with a line on what it means.
function renderExampleCall(): string {
  const p = EXAMPLE_CALL;
  const factors = p.factors ?? [];
  const parts = [
    part('Model', `${MODEL_NAMES[p.model]} <code>${p.model_version}</code>`, 'Which AI made the call, and the exact version.'),
    part('Call', callLabel(p.direction), 'Where BTC ends the week: higher or lower.', p.direction),
    part('Confidence', `<span class="part-meter">${meter(p.confidence)}<span>${p.confidence}%</span></span>`, 'How sure it says it is. 50% is a coin flip.', p.direction),
    part('Factors', `${PULLS_HEAD}<div class="pulls">${pullList(factors, 'down')}${pullList(factors, 'up')}</div>`, 'Two or three things it weighed, each on the side it pulls.'),
    part('Reasoning', `<q>${escapeHtml(p.reasoning)}</q>`, 'Why, in its own words.'),
    part('Checked on', CHECK_DAY.format(new Date(p.verify_date)), 'The day the end price is compared with the start price.'),
    part('Prompt hash', `<code>${p.prompt_hash.slice(0, SHORT_HASH)}…</code>`, 'A fingerprint of the prompt it got. Change one letter and it changes.'),
  ];
  return figure('example-call', 'One call, part by part <span class="tag">Example</span>', `<dl class="parts">
    ${parts.join('\n    ')}
  </dl>
  <p class="chart-note">Made up to show the parts. Real calls are in the ledger.</p>`);
}

function part(label: string, value: string, note: string, direction?: Direction): string {
  return `<div class="${['part', direction].filter(Boolean).join(' ')}"><dt>${label}</dt><dd><div class="part-value">${value}</div><p class="part-note">${note}</p></dd></div>`;
}

function meter(confidence: number): string {
  return `<span class="meter" aria-hidden="true"><span class="meter-fill" style="width: ${confidence}%"></span></span>`;
}

function tile(p: Prediction, state: string, detail: string): string {
  return `<li class="tile ${[p.direction, state].filter(Boolean).join(' ')}">
      <span class="tile-model">${MODEL_NAMES[p.model]}</span>
      <span class="tile-call">${callLabel(p.direction)}</span>
      ${detail}
    </li>`;
}

function tileList(tiles: readonly string[]): string {
  return `<ul class="tiles">
    ${tiles.join('\n    ')}
  </ul>`;
}

function callLabel(direction: Direction): string {
  return `<span class="sign" aria-hidden="true">${SIGNS[direction]}</span> ${DIRECTION_NAMES[direction]}`;
}

function figure(kind: string, caption: string, content: string): string {
  return `<figure class="chart ${kind}">
  <figcaption>${caption}</figcaption>
  ${content}
</figure>`;
}

function readNothing(kind: string, args: readonly string[]): void {
  if (args.length > 0) throw new ChartError(`chart "${kind}" takes nothing after it`);
}

// The calls recorded from Monday 00:00 UTC up to the next Monday.
function readWeek(kind: string, args: readonly string[], ledger: Ledger): Week {
  const monday = readMonday(kind, args);
  const start = monday.getTime();
  const calls = ledger.predictions
    .filter((p) => Date.parse(p.date) >= start && Date.parse(p.date) < start + WEEK_MS)
    .toSorted((a, b) => MODELS.indexOf(a.model) - MODELS.indexOf(b.model));
  const day = args[0] ?? '';
  if (calls.length === 0) throw new ChartError(`no calls recorded in the week of ${day}`);
  return { day, monday, calls, verdicts: new Map(ledger.verifications.map((v) => [v.prediction_id, v])) };
}

function readMonday(kind: string, args: readonly string[]): Date {
  const [day = '', ...extra] = args;
  if (extra.length > 0) throw new ChartError(`chart "${kind}" takes one date, got "${args.join(' ')}"`);
  const time = Date.parse(`${day}T00:00:00Z`);
  const isRealDay = DAY.test(day) && !Number.isNaN(time) && new Date(time).toISOString().startsWith(day);
  if (!isRealDay) throw new ChartError(`chart "${kind}" needs the Monday of the week, like: ${kind} ${EXAMPLE_MONDAY}`);
  const monday = new Date(time);
  if (monday.getUTCDay() !== MONDAY) throw new ChartError(`${day} is not a Monday`);
  return monday;
}
