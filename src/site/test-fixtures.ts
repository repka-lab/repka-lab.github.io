// Shared test data for the site tests.

import { addPrediction, emptyLedger, verifyPrediction } from '../ledger.ts';
import type { Ledger, NewPrediction } from '../ledger.ts';

const RECORDED = new Date('2026-10-25T10:00:00Z');
const CHECKED = new Date('2026-11-01T12:00:00Z');

function forecast(overrides: Partial<NewPrediction>): NewPrediction {
  return {
    model: 'claude',
    model_version: 'claude-test-1',
    asset: 'gold',
    direction: 'up',
    confidence: 70,
    reasoning: 'Test reasoning.',
    prompt_hash: 'a'.repeat(64),
    verify_date: '2026-11-01',
    ...overrides,
  };
}

// P0001: Claude on gold, up, checked as a hit (+1.5%). P0002: Grok on NASDAQ, down, still pending.
export function sampleLedger(): Ledger {
  const recorded = [
    forecast({ reasoning: 'Gold <b>looks</b> firm & steady.' }),
    forecast({ model: 'grok', model_version: 'grok-test-1', asset: 'nasdaq', direction: 'down', confidence: 55 }),
  ].reduce((ledger, input) => addPrediction(ledger, input, RECORDED), emptyLedger());
  const prices = { prediction_id: 'P0001', price_source: 'test feed', price_start: 100, price_end: 101.5 };
  return verifyPrediction(recorded, prices, CHECKED);
}
