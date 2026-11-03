import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import {
  checkDateOf,
  countWords,
  forbiddenWords,
  ideasOf,
  parseAnswer,
  readCalls,
  reasonProblems,
  toPrediction,
  writeEvent,
  writeWeek,
} from './answers.ts';
import type { EventSchedule, WeekCall } from './answers.ts';
import { addPrediction, emptyLedger, loadLedger, saveLedger } from './ledger.ts';
import type { Factor } from './ledger.ts';

const WEEK = '2026-11-02';
const CHECK_DATE = '2026-11-06T23:59:59.000Z';
const BEFORE_WEEK = new Date('2026-11-01T20:00:00Z');
const WEEK_OPENS = new Date('2026-11-02T00:00:00Z');
const HASH = 'a'.repeat(64);
const ANSWER_ERROR = { name: 'AnswerError' };
const WITH_CALL: Factor[] = [
  { text: 'ETF inflows', pulls: 'up' },
  { text: 'Funding is hot', pulls: 'down' },
];
const LONG_REASON = 'Rally is running out of steam as ETF demand fades fast'; // 11 words, a card fits 10
const EVENT = 'anthropic-ipo';
const IPO_CLOSE = '2026-11-17T21:00:00.000Z'; // a made-up first day's close
const SCHEDULE: EventSchedule = { verifyDate: '2026-11-17T21:00:00Z', cutoff: '2026-11-16T22:00:00Z' };
const BEFORE_PRICING = new Date('2026-11-12T12:00:00Z');

const PLAIN_ANSWER = [
  'Spot ETF inflows stayed positive all week, while funding ran hot.',
  '',
  'CALL: UP',
  'CONFIDENCE: 62',
  'REASON: ETF inflows keep coming',
  'FACTORS:',
  '- ETF inflows | pulls UP',
  '- Funding is hot | pulls DOWN',
].join('\n');

// The same block as a chat reply formats it: bold labels, a numbered list, quotes and trailing text.
const MARKDOWN_ANSWER = [
  'CALL: UP was my first read, but the daily chart says otherwise.',
  '',
  '**CALL:** DOWN',
  '**CONFIDENCE:** 70 (fairly sure)',
  '**REASON:** "Rally running out of steam."',
  '**FACTORS:**',
  '1. Lower highs on the daily | pulls: DOWN',
  '',
  '2. Strong dollar | DOWN.',
  '',
  'This is not financial advice.',
].join('\r\n');

function call(overrides: Partial<WeekCall> = {}): WeekCall {
  return {
    model: 'claude',
    modelVersion: 'claude-opus-5-5',
    direction: 'up',
    confidence: 60,
    reason: 'ETF inflows keep coming',
    factors: WITH_CALL,
    answer: PLAIN_ANSWER,
    words: 100,
    ...overrides,
  };
}

function block(lines: Record<string, string>): string {
  const base = { call: 'CALL: UP', confidence: 'CONFIDENCE: 62', reason: 'REASON: ETF inflows keep coming' };
  const factors = 'FACTORS:\n- ETF inflows | UP\n- Funding is hot | DOWN';
  return Object.values({ ...base, factors, ...lines }).filter((line) => line !== '').join('\n');
}

describe('parseAnswer', () => {
  test('reads the block an answer ends with', () => {
    assert.deepEqual(parseAnswer('claude', PLAIN_ANSWER), {
      direction: 'up',
      confidence: 62,
      reason: 'ETF inflows keep coming',
      factors: WITH_CALL,
    });
  });

  test('reads the block through markdown, quotes, CRLF and a numbered list, and takes the last CALL line', () => {
    assert.deepEqual(parseAnswer('gemini', MARKDOWN_ANSWER), {
      direction: 'down',
      confidence: 70,
      reason: 'Rally running out of steam',
      factors: [
        { text: 'Lower highs on the daily', pulls: 'down' },
        { text: 'Strong dollar', pulls: 'down' },
      ],
    });
  });

  test('reads a first factor written on the FACTORS line', () => {
    const answer = block({ factors: 'FACTORS: ETF inflows | UP\nFunding is hot | DOWN\nRisk stays high | DOWN' });
    assert.deepEqual(parseAnswer('grok', answer).factors, [...WITH_CALL, { text: 'Risk stays high', pulls: 'down' }]);
  });

  const broken: [string, Record<string, string>, RegExp][] = [
    ['no CALL line', { call: 'CALL: SIDEWAYS' }, /^grok: no "CALL: UP"/],
    ['no CONFIDENCE line', { confidence: '' }, /^grok: no CONFIDENCE line/],
    ['confidence below 50', { confidence: 'CONFIDENCE: 49' }, /^grok: CONFIDENCE must be a whole number from 50 to 100/],
    ['confidence above 100', { confidence: 'CONFIDENCE: 101' }, /CONFIDENCE must be/],
    ['a decimal confidence', { confidence: 'CONFIDENCE: 62.5' }, /got "62.5"/],
    ['a decimal whose first digits would pass', { confidence: 'CONFIDENCE: 500.5' }, /got "500.5"/],
    ['a word for confidence', { confidence: 'CONFIDENCE: high' }, /got "high"/],
    ['an empty reason', { reason: 'REASON: ""' }, /^grok: REASON is empty/],
    ['no FACTORS line', { factors: '' }, /^grok: no FACTORS line/],
    ['one factor', { factors: 'FACTORS:\n- ETF inflows | UP' }, /found 1$/],
    ['four factors', { factors: 'FACTORS:\n- a | UP\n- b | UP\n- c | DOWN\n- d | DOWN' }, /found 4$/],
    ['a factor without a pull', { factors: 'FACTORS:\n- ETF inflows\n- Funding is hot | DOWN' }, /found 0$/],
  ];
  for (const [name, lines, message] of broken) {
    test(`rejects ${name}, naming the model`, () => {
      assert.throws(() => parseAnswer('grok', block(lines)), { ...ANSWER_ERROR, message });
    });
  }
});

describe('countWords and forbiddenWords', () => {
  test('counts only tokens with a letter or a digit', () => {
    assert.equal(countWords('  ETF inflows — keep coming, 2 weeks \n'), 6);
    assert.equal(countWords(''), 0);
  });

  test('lists each forbidden word once, lower case, whole words only', () => {
    assert.deepEqual(forbiddenWords('You should not BUY. Buy low? It will go up, should it'), ['should', 'buy', 'will go up']);
    assert.deepEqual(forbiddenWords('Buyers keep investing'), []);
  });
});

describe('checkDateOf', () => {
  test('is the last second of Friday, UTC', () => {
    assert.equal(checkDateOf(WEEK), CHECK_DATE);
  });

  const bad: [string, RegExp][] = [
    ['2026-11-01', /2026-11-01 is not one/],
    ['2026-11-2', /like 2026-11-02/],
    ['2026-02-30', /like 2026-11-02/],
    ['next week', /like 2026-11-02/],
  ];
  for (const [week, message] of bad) {
    test(`rejects ${week}`, () => {
      assert.throws(() => checkDateOf(week), { ...ANSWER_ERROR, message });
    });
  }
});

describe('toPrediction', () => {
  test('makes a prediction the ledger accepts, with the whole answer as the reasoning', () => {
    const ledger = addPrediction(emptyLedger(), toPrediction(call(), HASH, CHECK_DATE), BEFORE_WEEK);
    assert.deepEqual(ledger.predictions[0], {
      id: 'P0001',
      date: BEFORE_WEEK.toISOString(),
      model: 'claude',
      model_version: 'claude-opus-5-5',
      direction: 'up',
      confidence: 60,
      reasoning: PLAIN_ANSWER,
      factors: WITH_CALL,
      prompt_hash: HASH,
      verify_date: CHECK_DATE,
    });
  });

  test('names the event an event call is about', () => {
    assert.equal(toPrediction(call(), HASH, IPO_CLOSE, EVENT).subject, EVENT);
  });
});

describe('reasonProblems', () => {
  test('passes a reason a card can show as written', () => {
    assert.deepEqual(reasonProblems([call()]), []);
  });

  test('flags a reason over ten words or with a forbidden word', () => {
    const calls = [call({ model: 'chatgpt', reason: LONG_REASON }), call({ reason: 'Traders should wait' })];
    assert.deepEqual(reasonProblems(calls), [
      'chatgpt: reason has 11 words, a card fits 10',
      'claude: reason uses "should"',
    ]);
  });
});

describe('ideasOf', () => {
  test('lists the calls in model order, each card named as models.json names it', () => {
    const calls = [call({ model: 'grok', modelVersion: 'Grok Bot', direction: 'down', confidence: 75 }), call({ model: 'chatgpt', modelVersion: 'ChatGPT' })];
    assert.deepEqual(ideasOf(WEEK, calls, ['P0001', 'P0002']), {
      note: 'Calls for the week of 2026-11-02 as logged in data/ledger.json (P0001, P0002). Names from data/answers/2026-11-02/models.json.',
      ideas: [
        { model: 'ChatGPT', name: 'ChatGPT', call: 'up', confidence: 60, reason: 'ETF inflows keep coming' },
        { model: 'Grok', name: 'Grok Bot', call: 'down', confidence: 75, reason: 'ETF inflows keep coming' },
      ],
    });
  });
});

describe('readCalls, writeWeek and writeEvent', () => {
  const root = mkdtempSync(join(tmpdir(), 'answers-test-'));
  after(() => rmSync(root, { recursive: true, force: true }));

  function answersDir(files: Record<string, string>): string {
    const dir = mkdtempSync(join(root, 'week-'));
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    return dir;
  }

  function ledgerFiles(): { ledger: string; ideas: string } {
    const dir = mkdtempSync(join(root, 'out-'));
    const files = { ledger: join(dir, 'ledger.json'), ideas: join(dir, 'ideas.json') };
    saveLedger(files.ledger, emptyLedger());
    return files;
  }

  const MODELS_JSON = JSON.stringify({ claude: ' claude-opus-5-5 ', chatgpt: 'gpt-5.5' });
  const pair = (): WeekCall[] => [call({ model: 'chatgpt', modelVersion: 'gpt-5.5' }), call()];

  test('reads each answer with its model id, in model order, CRLF turned into LF', () => {
    const dir = answersDir({
      'models.json': MODELS_JSON,
      'claude.md': `\n${PLAIN_ANSWER}\n`,
      'chatgpt.md': MARKDOWN_ANSWER,
    });
    const calls = readCalls(dir);
    assert.deepEqual(calls.map((c) => [c.model, c.modelVersion, c.direction]), [
      ['chatgpt', 'gpt-5.5', 'down'],
      ['claude', 'claude-opus-5-5', 'up'],
    ]);
    assert.equal(calls[0]?.answer, MARKDOWN_ANSWER.replaceAll('\r\n', '\n'));
    assert.equal(calls[1]?.answer, PLAIN_ANSWER);
    assert.equal(calls[1]?.words, countWords(PLAIN_ANSWER));
  });

  const broken: [string, Record<string, string>, RegExp][] = [
    ['no models.json', { 'claude.md': PLAIN_ANSWER }, /no models\.json/],
    ['an answer for an unknown model', { 'models.json': '{}', 'llama.md': PLAIN_ANSWER }, /unknown answer files: llama/],
    ['a listed model with no answer', { 'models.json': MODELS_JSON, 'claude.md': PLAIN_ANSWER }, /lists chatgpt, claude, the answers are claude/],
    ['an empty model id', { 'models.json': '{"claude": " "}', 'claude.md': PLAIN_ANSWER }, /bad entries for claude/],
    ['models.json as a list', { 'models.json': '["claude"]', 'claude.md': PLAIN_ANSWER }, /must map each model/],
    ['no answers at all', { 'models.json': '{}' }, /no answers in/],
  ];
  for (const [name, files, message] of broken) {
    test(`rejects ${name}`, () => {
      assert.throws(() => readCalls(answersDir(files)), { ...ANSWER_ERROR, message });
    });
  }

  test('appends the calls and writes the ideas file with their ledger ids', () => {
    const files = ledgerFiles();
    assert.deepEqual(writeWeek(WEEK, pair(), HASH, files, BEFORE_WEEK), [files.ledger, files.ideas]);
    const { predictions } = loadLedger(files.ledger);
    assert.deepEqual(predictions.map((p) => [p.id, p.model, p.date, p.verify_date]), [
      ['P0001', 'chatgpt', BEFORE_WEEK.toISOString(), CHECK_DATE],
      ['P0002', 'claude', BEFORE_WEEK.toISOString(), CHECK_DATE],
    ]);
    const ideas = JSON.parse(readFileSync(files.ideas, 'utf8'));
    assert.match(ideas.note, /\(P0001, P0002\)/);
    assert.deepEqual(ideas.ideas.map((idea: { model: string }) => idea.model), ['ChatGPT', 'Claude']);
  });

  test('logs the calls but writes no ideas file when a reason cannot go on a card', () => {
    const files = ledgerFiles();
    const calls = [call({ model: 'chatgpt', reason: LONG_REASON }), call()];
    assert.deepEqual(writeWeek(WEEK, calls, HASH, files, BEFORE_WEEK), [files.ledger]);
    assert.equal(loadLedger(files.ledger).predictions.length, 2);
    assert.equal(existsSync(files.ideas), false);
  });

  test('refuses once the week has opened and leaves the ledger as it was', () => {
    const files = ledgerFiles();
    const before = readFileSync(files.ledger, 'utf8');
    assert.throws(() => writeWeek(WEEK, pair(), HASH, files, WEEK_OPENS), { ...ANSWER_ERROR, message: /already opened/ });
    assert.equal(readFileSync(files.ledger, 'utf8'), before);
  });

  test('refuses to log the same week twice', () => {
    const files = ledgerFiles();
    writeWeek(WEEK, pair(), HASH, files, BEFORE_WEEK);
    assert.throws(() => writeWeek(WEEK, pair(), HASH, files, BEFORE_WEEK), { name: 'LedgerError', message: /P0001 already holds chatgpt/ });
    assert.equal(loadLedger(files.ledger).predictions.length, 2);
  });

  test('appends an event call beside the BTC call of the same model, and writes no ideas file', () => {
    const files = ledgerFiles();
    writeWeek(WEEK, pair(), HASH, files, BEFORE_WEEK);
    assert.deepEqual(writeEvent(EVENT, pair(), HASH, files.ledger, SCHEDULE, BEFORE_PRICING), [files.ledger]);
    const { predictions } = loadLedger(files.ledger);
    assert.deepEqual(predictions.map((p) => [p.id, p.model, p.subject, p.verify_date]), [
      ['P0001', 'chatgpt', undefined, CHECK_DATE],
      ['P0002', 'claude', undefined, CHECK_DATE],
      ['P0003', 'chatgpt', EVENT, IPO_CLOSE],
      ['P0004', 'claude', EVENT, IPO_CLOSE],
    ]);
  });

  test('refuses an event call at or after the cutoff and leaves the ledger as it was', () => {
    const files = ledgerFiles();
    const before = readFileSync(files.ledger, 'utf8');
    for (const now of [new Date(SCHEDULE.cutoff), new Date(IPO_CLOSE)]) {
      assert.throws(() => writeEvent(EVENT, pair(), HASH, files.ledger, SCHEDULE, now), {
        ...ANSWER_ERROR,
        message: /calls on anthropic-ipo closed at 2026-11-16T22:00:00\.000Z/,
      });
    }
    assert.equal(readFileSync(files.ledger, 'utf8'), before);
  });

  const badSchedules: [string, EventSchedule, RegExp][] = [
    ['a cutoff at the verify date', { verifyDate: IPO_CLOSE, cutoff: IPO_CLOSE }, /cutoff .* must come before the verify date/],
    ['a cutoff after the verify date', { ...SCHEDULE, cutoff: '2026-11-18T00:00:00Z' }, /must come before the verify date/],
    ['a date without a time', { ...SCHEDULE, verifyDate: '2026-11-17' }, /verify date must be a UTC time/],
    ['a time in another zone', { ...SCHEDULE, cutoff: '2026-11-16T17:00:00-05:00' }, /cutoff must be a UTC time/],
    ['a day that does not exist', { ...SCHEDULE, verifyDate: '2026-11-31T21:00:00Z' }, /verify date must be a UTC time/],
  ];
  for (const [name, schedule, message] of badSchedules) {
    test(`rejects ${name}`, () => {
      const files = ledgerFiles();
      assert.throws(() => writeEvent(EVENT, pair(), HASH, files.ledger, schedule, BEFORE_PRICING), { ...ANSWER_ERROR, message });
      assert.equal(loadLedger(files.ledger).predictions.length, 0);
    });
  }

  test('rejects an event that is not a slug', () => {
    const files = ledgerFiles();
    assert.throws(() => writeEvent('Anthropic IPO', pair(), HASH, files.ledger, SCHEDULE, BEFORE_PRICING), {
      name: 'LedgerError',
      message: /lowercase slug/,
    });
  });

  test('refuses to log the same event twice', () => {
    const files = ledgerFiles();
    writeEvent(EVENT, pair(), HASH, files.ledger, SCHEDULE, BEFORE_PRICING);
    assert.throws(() => writeEvent(EVENT, pair(), HASH, files.ledger, SCHEDULE, BEFORE_PRICING), {
      name: 'LedgerError',
      message: /P0001 already holds chatgpt on anthropic-ipo/,
    });
    assert.equal(loadLedger(files.ledger).predictions.length, 2);
  });
});
