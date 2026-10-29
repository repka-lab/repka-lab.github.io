import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  addPrediction,
  buildResults,
  classifyMove,
  dueForVerification,
  emptyLedger,
  getStats,
  loadLedger,
  MODELS,
  parseLedger,
  saveLedger,
  saveResults,
  verifyPrediction,
} from './ledger.ts';
import type { Ledger, NewPrediction, NewVerification } from './ledger.ts';

const RECORDED = new Date('2026-10-26T12:00:00Z');
const VERIFY_DATE = '2026-11-02T21:00:00.000Z';
const AFTER_VERIFY = new Date('2026-11-02T22:00:00Z');
const EARLIER_VERIFY = '2026-10-30T21:00:00Z'; // also due by AFTER_VERIFY
const LATER_VERIFY = '2026-11-09T21:00:00Z'; // not yet due at AFTER_VERIFY
const HASH = 'a'.repeat(64);
const REPO_LEDGER = fileURLToPath(new URL('../data/ledger.json', import.meta.url));

type Json = Record<string, unknown>;

function forecast(overrides: Partial<NewPrediction> = {}): NewPrediction {
  return {
    model: 'claude',
    model_version: 'claude-opus-5-5',
    direction: 'up',
    confidence: 60,
    reasoning: 'Funding rates are cooling while spot volume holds up.',
    prompt_hash: HASH,
    verify_date: VERIFY_DATE,
    ...overrides,
  };
}

// Input a caller could send at runtime despite the types, e.g. parsed from a model reply.
function malformed(overrides: Json): NewPrediction {
  return { ...forecast(), ...overrides } as unknown as NewPrediction;
}

function prices(start: number, end: number, id = 'P0001'): NewVerification {
  return { prediction_id: id, price_source: 'exchange daily close', price_start: start, price_end: end };
}

function recorded(...inputs: NewPrediction[]): Ledger {
  return inputs.reduce((ledger, input) => addPrediction(ledger, input, RECORDED), emptyLedger());
}

function asJson(ledger: Ledger): { predictions: Json[]; verifications: Json[] } & Json {
  return JSON.parse(JSON.stringify(ledger));
}

const LEDGER_ERROR = { name: 'LedgerError' };

describe('addPrediction', () => {
  test('records forecasts with sequential ids and the clock time', () => {
    const ledger = recorded(forecast(), forecast({ verify_date: LATER_VERIFY }));

    assert.deepEqual(ledger.predictions.map((p) => p.id), ['P0001', 'P0002']);
    assert.equal(ledger.predictions[0]?.date, RECORDED.toISOString());
    assert.equal(ledger.predictions[0]?.verify_date, VERIFY_DATE);
  });

  test('ignores an id or date supplied by the caller, so a forecast cannot be backdated', () => {
    const ledger = addPrediction(emptyLedger(), malformed({ id: 'P0099', date: '2020-01-01' }), RECORDED);

    assert.equal(ledger.predictions[0]?.id, 'P0001');
    assert.equal(ledger.predictions[0]?.date, RECORDED.toISOString());
  });

  test('reads a calendar date verify_date as UTC midnight', () => {
    const ledger = recorded(forecast({ verify_date: '2026-11-02' }));

    assert.equal(ledger.predictions[0]?.verify_date, '2026-11-02T00:00:00.000Z');
  });

  test('returns a new ledger and leaves the original untouched', () => {
    const original = Object.freeze(emptyLedger());

    const next = addPrediction(original, forecast(), RECORDED);

    assert.equal(original.predictions.length, 0);
    assert.equal(next.predictions.length, 1);
  });

  const rejected: [string, Json, RegExp][] = [
    ['an unknown model', { model: 'llama' }, /model must be one of chatgpt, claude, gemini, grok/],
    ['an unknown direction', { direction: 'sideways' }, /direction must be one of up, down$/],
    ['a flat call', { direction: 'flat' }, /direction must be one of up, down$/],
    ['a confidence above 100', { confidence: 101 }, /confidence must be a number from 0 to 100/],
    ['a confidence that is not a number', { confidence: '60' }, /confidence must be a number/],
    ['a NaN confidence', { confidence: Number.NaN }, /confidence must be a number/],
    ['blank reasoning', { reasoning: '   ' }, /reasoning must be a non-empty string/],
    ['a missing model version', { model_version: undefined }, /model_version must be a non-empty string/],
    ['a prompt hash that is not sha256 hex', { prompt_hash: 'abc' }, /prompt_hash must be a lowercase sha256/],
    ['an uppercase prompt hash', { prompt_hash: 'A'.repeat(64) }, /prompt_hash must be a lowercase sha256/],
    ['a verify date that is not ISO 8601', { verify_date: '02.11.2026' }, /verify_date must be an ISO 8601 date/],
    ['a day that does not exist', { verify_date: '2026-02-30' }, /verify_date must be an ISO 8601 date/],
    ['a verify date without a time zone', { verify_date: '2026-11-02T21:00' }, /verify_date must be an ISO 8601/],
    ['a verify date in the past', { verify_date: '2026-10-20' }, /must be after the recording time/],
    ['a verify date equal to the recording time', { verify_date: RECORDED.toISOString() }, /must be after/],
  ];

  for (const [what, overrides, message] of rejected) {
    test(`rejects ${what}`, () => {
      assert.throws(() => addPrediction(emptyLedger(), malformed(overrides), RECORDED), { ...LEDGER_ERROR, message });
    });
  }

  test('rejects input that is not an object', () => {
    const notAnObject = null as unknown as NewPrediction;

    assert.throws(() => addPrediction(emptyLedger(), notAnObject, RECORDED), {
      ...LEDGER_ERROR,
      message: /new prediction: expected an object/,
    });
  });

  test('refuses a second forecast for the same model and verify date', () => {
    const ledger = recorded(forecast());

    assert.throws(() => addPrediction(ledger, forecast({ direction: 'down' }), RECORDED), {
      ...LEDGER_ERROR,
      message: /P0001 already holds claude for 2026-11-02T21:00:00.000Z/,
    });
  });

  test('lets every model make its own call for the same verify date', () => {
    const ledger = recorded(...MODELS.map((model) => forecast({ model, model_version: `${model}-test` })));

    assert.deepEqual(ledger.predictions.map((p) => p.model), [...MODELS]);
  });
});

describe('verifyPrediction', () => {
  const upCall = recorded(forecast({ direction: 'up' }));

  test('scores a rise as a hit for an up forecast', () => {
    const ledger = verifyPrediction(upCall, prices(2000, 2030), AFTER_VERIFY);

    assert.deepEqual(ledger.verifications, [
      {
        prediction_id: 'P0001',
        verified_at: AFTER_VERIFY.toISOString(),
        price_source: 'exchange daily close',
        price_start: 2000,
        price_end: 2030,
        change_pct: 1.5,
        outcome: 'up',
        hit: true,
      },
    ]);
  });

  test('scores a fall as a miss for an up forecast', () => {
    const verification = verifyPrediction(upCall, prices(2000, 1980), AFTER_VERIFY).verifications[0];

    assert.equal(verification?.change_pct, -1);
    assert.equal(verification?.outcome, 'down');
    assert.equal(verification?.hit, false);
  });

  test('counts an unchanged price as not higher, so a down forecast hits', () => {
    const downCall = recorded(forecast({ direction: 'down' }));

    const verification = verifyPrediction(downCall, prices(2000, 2000), AFTER_VERIFY).verifications[0];

    assert.equal(verification?.change_pct, 0);
    assert.equal(verification?.outcome, 'down');
    assert.equal(verification?.hit, true);
  });

  test('reads a rise too small to show in change_pct as up', () => {
    const verification = verifyPrediction(upCall, prices(60000, 60000.01), AFTER_VERIFY).verifications[0];

    assert.equal(verification?.change_pct, 0);
    assert.equal(verification?.outcome, 'up');
    assert.equal(verification?.hit, true);
  });

  test('allows verification exactly at the verify date', () => {
    const ledger = verifyPrediction(upCall, prices(2000, 2030), new Date(VERIFY_DATE));

    assert.equal(ledger.verifications.length, 1);
  });

  test('refuses to verify before the verify date', () => {
    assert.throws(() => verifyPrediction(upCall, prices(2000, 2030), RECORDED), {
      ...LEDGER_ERROR,
      message: /P0001 cannot be verified before 2026-11-02T21:00:00.000Z/,
    });
  });

  test('refuses an unknown prediction id', () => {
    assert.throws(() => verifyPrediction(upCall, prices(2000, 2030, 'P0042'), AFTER_VERIFY), {
      ...LEDGER_ERROR,
      message: /there is no prediction P0042/,
    });
  });

  test('refuses to verify the same prediction twice', () => {
    const once = verifyPrediction(upCall, prices(2000, 2030), AFTER_VERIFY);

    assert.throws(() => verifyPrediction(once, prices(2000, 1900), AFTER_VERIFY), {
      ...LEDGER_ERROR,
      message: /P0001 is already verified/,
    });
  });

  for (const bad of [0, -5, Number.POSITIVE_INFINITY, Number.NaN]) {
    test(`rejects a price of ${bad}`, () => {
      assert.throws(() => verifyPrediction(upCall, prices(bad, 2030), AFTER_VERIFY), {
        ...LEDGER_ERROR,
        message: /price_start must be a positive number/,
      });
    });
  }

  test('rejects a missing price source', () => {
    const input = { ...prices(2000, 2030), price_source: '' };

    assert.throws(() => verifyPrediction(upCall, input, AFTER_VERIFY), {
      ...LEDGER_ERROR,
      message: /price_source must be a non-empty string/,
    });
  });

  test('returns a new ledger and leaves the original untouched', () => {
    const next = verifyPrediction(upCall, prices(2000, 2030), AFTER_VERIFY);

    assert.equal(upCall.verifications.length, 0);
    assert.equal(next.verifications.length, 1);
  });
});

describe('classifyMove', () => {
  const cases: [number, number, string][] = [
    [100, 101, 'up'],
    [100, 99, 'down'],
    [100, 100, 'down'],
    [60000, 60000.01, 'up'],
  ];

  for (const [start, end, expected] of cases) {
    test(`reads a move from ${start} to ${end} as ${expected}`, () => {
      assert.equal(classifyMove(start, end), expected);
    });
  }
});

describe('dueForVerification', () => {
  test('lists only unverified forecasts whose verify date has passed', () => {
    const ledger = verifyPrediction(
      recorded(
        forecast(),
        forecast({ verify_date: LATER_VERIFY }),
        forecast({ verify_date: EARLIER_VERIFY }),
      ),
      prices(5000, 5100, 'P0003'),
      AFTER_VERIFY,
    );

    assert.deepEqual(dueForVerification(ledger, AFTER_VERIFY).map((p) => p.id), ['P0001']);
  });
});

describe('getStats', () => {
  test('reports all four models with zero counts on an empty ledger', () => {
    const stats = getStats(emptyLedger());

    assert.deepEqual(Object.keys(stats), [...MODELS]);
    for (const model of MODELS) {
      assert.deepEqual(stats[model], {
        predictions: 0,
        verified: 0,
        pending: 0,
        hits: 0,
        misses: 0,
        hit_rate: null,
        avg_confidence: null,
      });
    }
  });

  test('counts hits, misses and pending forecasts per model', () => {
    const steps: NewVerification[] = [prices(2000, 2030, 'P0001'), prices(30, 31, 'P0002'), prices(2000, 2040, 'P0004')];
    const ledger = steps.reduce(
      (current, step) => verifyPrediction(current, step, AFTER_VERIFY),
      recorded(
        forecast({ direction: 'up', confidence: 60 }),
        forecast({ verify_date: EARLIER_VERIFY, direction: 'down', confidence: 80 }),
        forecast({ verify_date: LATER_VERIFY, direction: 'up', confidence: 50 }),
        forecast({ model: 'grok', model_version: 'grok-5', direction: 'up', confidence: 70 }),
      ),
    );

    const stats = getStats(ledger);

    assert.deepEqual(stats.claude, {
      predictions: 3,
      verified: 2,
      pending: 1,
      hits: 1,
      misses: 1,
      hit_rate: 0.5,
      avg_confidence: 70,
    });
    assert.equal(stats.grok.hit_rate, 1);
    assert.equal(stats.chatgpt.predictions, 0);
  });
});

describe('buildResults', () => {
  test('stamps the stats with the schema version and update time', () => {
    const ledger = recorded(forecast());

    assert.deepEqual(buildResults(ledger, AFTER_VERIFY), {
      schema_version: 1,
      updated_at: AFTER_VERIFY.toISOString(),
      models: getStats(ledger),
    });
  });
});

describe('parseLedger', () => {
  const verified = verifyPrediction(recorded(forecast(), forecast({ verify_date: LATER_VERIFY })), prices(2000, 2030), AFTER_VERIFY);
  const stored = asJson(verified);
  const [first, second] = stored.predictions as [Json, Json];
  const [verdict] = stored.verifications as [Json];

  test('accepts the ledger file in the repository', () => {
    assert.equal(loadLedger(REPO_LEDGER).schema_version, 1);
  });

  test('round-trips a ledger through JSON unchanged', () => {
    assert.deepEqual(parseLedger(stored), verified);
  });

  const rejected: [string, unknown, RegExp][] = [
    ['a value that is not an object', [], /ledger: expected an object/],
    ['another schema version', { ...stored, schema_version: 2 }, /schema_version must be 1/],
    ['predictions that are not a list', { ...stored, predictions: {} }, /predictions must be an array/],
    ['ids out of sequence', { ...stored, predictions: [second, first] }, /id must be P0001, got P0002/],
    ['a date not in canonical form', { ...stored, predictions: [{ ...first, date: '2026-10-26T12:00:00Z' }, second] }, /date must be stored as 2026-10-26T12:00:00.000Z/],
    ['two forecasts in one slot', { ...stored, predictions: [first, { ...first, id: 'P0002' }] }, /two predictions share one slot/],
    ['a flipped hit', { ...stored, verifications: [{ ...verdict, hit: false }] }, /do not match the prices/],
    ['an edited closing price', { ...stored, verifications: [{ ...verdict, price_end: 1900 }] }, /do not match the prices/],
    ['a verification of an unknown forecast', { ...stored, verifications: [{ ...verdict, prediction_id: 'P0009' }] }, /there is no prediction P0009/],
    ['a forecast verified twice', { ...stored, verifications: [verdict, verdict] }, /P0001 is verified twice/],
    ['a verification before the verify date', { ...stored, verifications: [{ ...verdict, verified_at: RECORDED.toISOString() }] }, /cannot be verified before/],
  ];

  for (const [what, value, message] of rejected) {
    test(`rejects ${what}`, () => {
      assert.throws(() => parseLedger(value), { ...LEDGER_ERROR, message });
    });
  }
});

describe('saveLedger and loadLedger', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-test-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  let fileCount = 0;
  function freshPath(): string {
    fileCount += 1;
    return join(dir, `ledger-${fileCount}.json`);
  }

  const one = recorded(forecast());
  const two = addPrediction(one, forecast({ verify_date: LATER_VERIFY }), RECORDED);

  test('writes a ledger that loads back unchanged, as 2-space JSON with a final newline', () => {
    const path = freshPath();

    saveLedger(path, one);

    assert.deepEqual(loadLedger(path), one);
    assert.equal(readFileSync(path, 'utf8'), `${JSON.stringify(one, null, 2)}\n`);
  });

  test('appends new forecasts and verifications to the file on disk', () => {
    const path = freshPath();
    const three = verifyPrediction(two, prices(2000, 2030), AFTER_VERIFY);

    saveLedger(path, one);
    saveLedger(path, two);
    saveLedger(path, three);

    assert.deepEqual(loadLedger(path), three);
  });

  const rewrites: [string, Ledger][] = [
    ['dropping a forecast', one],
    ['editing a forecast', { ...two, predictions: [{ ...two.predictions[0]!, confidence: 99 }, two.predictions[1]!] }],
  ];

  for (const [what, rewrite] of rewrites) {
    test(`refuses ${what} and leaves the file as it was`, () => {
      const path = freshPath();
      saveLedger(path, two);
      const before = readFileSync(path, 'utf8');

      assert.throws(() => saveLedger(path, rewrite), { ...LEDGER_ERROR, message: /predictions were changed or removed/ });
      assert.equal(readFileSync(path, 'utf8'), before);
    });
  }

  test('refuses dropping a verification', () => {
    const path = freshPath();
    saveLedger(path, verifyPrediction(two, prices(2000, 2030), AFTER_VERIFY));

    assert.throws(() => saveLedger(path, two), { ...LEDGER_ERROR, message: /verifications were changed or removed/ });
  });

  test('refuses to save an invalid ledger', () => {
    const path = freshPath();
    const broken = { ...one, schema_version: 2 } as unknown as Ledger;

    assert.throws(() => saveLedger(path, broken), { ...LEDGER_ERROR, message: /schema_version must be 1/ });
  });

  test('reads a file that starts with a byte order mark', () => {
    const path = freshPath();
    writeFileSync(path, `﻿${JSON.stringify(one)}`, 'utf8');

    assert.deepEqual(loadLedger(path), one);
  });

  test('reports a missing file and refuses to overwrite one that is not JSON', () => {
    const path = freshPath();

    assert.throws(() => loadLedger(path), { ...LEDGER_ERROR, message: /Cannot read ledger/ });
    writeFileSync(path, 'not json', 'utf8');
    assert.throws(() => saveLedger(path, one), { ...LEDGER_ERROR, message: /Cannot read ledger/ });
    assert.equal(readFileSync(path, 'utf8'), 'not json');
  });

  test('writes results and reports a path it cannot write to', () => {
    const path = freshPath();
    const results = buildResults(one, AFTER_VERIFY);

    saveResults(path, results);

    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), results);
    assert.throws(() => saveResults(join(dir, 'missing', 'results.json'), results), {
      ...LEDGER_ERROR,
      message: /Cannot write/,
    });
  });
});
