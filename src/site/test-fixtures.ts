// Shared test data for the site tests.

import { addPrediction, emptyLedger, verifyPrediction } from '../ledger.ts';
import type { Ledger, NewPrediction } from '../ledger.ts';

const RECORDED = new Date('2026-10-25T10:00:00Z');
const CHECKED = new Date('2026-11-01T12:00:00Z');

function forecast(overrides: Partial<NewPrediction>): NewPrediction {
  return {
    model: 'claude',
    model_version: 'claude-test-1',
    direction: 'up',
    confidence: 70,
    reasoning: 'Test reasoning.',
    prompt_hash: 'a'.repeat(64),
    verify_date: '2026-11-01',
    ...overrides,
  };
}

// P0001: Claude, up, checked as a hit (+1.5%). P0002: Grok, down, still pending.
export function sampleLedger(): Ledger {
  const recorded = [
    forecast({ reasoning: 'BTC <b>looks</b> firm & steady.' }),
    forecast({ model: 'grok', model_version: 'grok-test-1', direction: 'down', confidence: 55 }),
  ].reduce((ledger, input) => addPrediction(ledger, input, RECORDED), emptyLedger());
  const prices = { prediction_id: 'P0001', price_source: 'test feed', price_start: 100, price_end: 101.5 };
  return verifyPrediction(recorded, prices, CHECKED);
}

export const WEEK = '2026-11-02'; // a Monday
const WEEK_RECORDED = new Date('2026-11-02T09:00:00Z');
const WEEK_CHECKED = new Date('2026-11-06T20:00:00Z');
// Claude gives no factors; Grok's all pull one way.
const WEEK_CALLS: readonly Partial<NewPrediction>[] = [
  {
    model: 'chatgpt',
    model_version: 'chatgpt-test-1',
    direction: 'up',
    confidence: 64,
    factors: [
      { text: 'Five higher daily closes in a row.', pulls: 'up' },
      { text: 'Funding rates & fees are cooling.', pulls: 'down' },
      { text: 'Last week closed near the top of its range.', pulls: 'up' },
    ],
  },
  { model: 'claude', direction: 'up', confidence: 58 },
  {
    model: 'gemini',
    model_version: 'gemini-test-1',
    direction: 'down',
    confidence: 55,
    factors: [
      { text: 'A pullback after a strong run is common.', pulls: 'down' },
      { text: 'The trend is still mildly upward.', pulls: 'up' },
    ],
  },
  {
    model: 'grok',
    model_version: 'grok-test-1',
    direction: 'up',
    confidence: 71,
    factors: [
      { text: 'Momentum points higher.', pulls: 'up' },
      { text: 'Last week closed higher.', pulls: 'up' },
    ],
  },
];

// The four calls of the week of WEEK (P0001-P0004), not checked yet.
export function weekCalls(): Ledger {
  return WEEK_CALLS.map((call) => forecast({ ...call, verify_date: WEEK_CHECKED.toISOString() })).reduce(
    (ledger, input) => addPrediction(ledger, input, WEEK_RECORDED),
    emptyLedger(),
  );
}

// The same week, checked: BTC rose 2.48%, so Gemini missed and the other three hit.
export function weekChecked(): Ledger {
  const calls = weekCalls();
  return calls.predictions.reduce(
    (ledger, p) =>
      verifyPrediction(
        ledger,
        { prediction_id: p.id, price_source: 'feed <x>', price_start: 100000, price_end: 102480 },
        WEEK_CHECKED,
      ),
    calls,
  );
}

export const NEXT_WEEK = '2026-11-09'; // the Monday after WEEK
const NEXT_RECORDED = new Date('2026-11-09T09:00:00Z');
const NEXT_CHECKED = new Date('2026-11-13T20:00:00Z');
const NEXT_CALLS: readonly Partial<NewPrediction>[] = [
  { model: 'chatgpt', model_version: 'chatgpt-test-1', direction: 'down', confidence: 60 },
  { model: 'claude', direction: 'up', confidence: 55 },
  { model: 'gemini', model_version: 'gemini-test-1', direction: 'down', confidence: 62 },
  { model: 'grok', model_version: 'grok-test-1', direction: 'up', confidence: 66 },
];

// The checked week of WEEK, then the week of NEXT_WEEK (P0005-P0008), when BTC fell:
// ChatGPT and Gemini hit, Claude missed, and Grok's call is not checked yet.
export function twoWeeks(): Ledger {
  const recorded = NEXT_CALLS.map((call) => forecast({ ...call, verify_date: NEXT_CHECKED.toISOString() })).reduce(
    (ledger, input) => addPrediction(ledger, input, NEXT_RECORDED),
    weekChecked(),
  );
  return recorded.predictions
    .filter((p) => p.date === NEXT_RECORDED.toISOString() && p.model !== 'grok')
    .reduce(
      (ledger, p) =>
        verifyPrediction(
          ledger,
          { prediction_id: p.id, price_source: 'feed', price_start: 102480, price_end: 101250 },
          NEXT_CHECKED,
        ),
      recorded,
    );
}
