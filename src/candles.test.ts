import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import { loadCandles, parseCandles } from './candles.ts';
import type { Candle, PriceSeries } from './candles.ts';

const FOUR_HOURS = 14400;
const FIRST = '2026-10-26T00:00:00.000Z';
const CANDLE_ERROR = { name: 'CandleError' };

function candle(time: string, overrides: Partial<Candle> = {}): Candle {
  return { time, open: 100, high: 110, low: 95, close: 105, ...overrides };
}

// Three 4-hour candles with no trades at 08:00, so the third comes after a gap.
const SERIES: PriceSeries = {
  source: 'Coinbase Exchange BTC-USD',
  granularity_seconds: FOUR_HOURS,
  candles: [
    candle(FIRST),
    candle('2026-10-26T04:00:00.000Z', { open: 105, close: 98, low: 97 }),
    candle('2026-10-26T12:00:00.000Z'),
  ],
};

function withCandles(...candles: unknown[]): unknown {
  return { ...SERIES, candles };
}

describe('parseCandles', () => {
  test('reads a valid series, gaps included', () => {
    assert.deepEqual(parseCandles(JSON.parse(JSON.stringify(SERIES))), SERIES);
  });

  test('reads a series with no candles', () => {
    assert.deepEqual(parseCandles(withCandles()), { ...SERIES, candles: [] });
  });

  test('keeps only the fields it knows', () => {
    const parsed = parseCandles({ ...SERIES, note: 'extra', candles: [{ ...candle(FIRST), volume: 12.5 }] });

    assert.deepEqual(parsed, { ...SERIES, candles: [candle(FIRST)] });
  });

  const rejected: [string, unknown, RegExp][] = [
    ['a value that is not an object', [], /candles: expected an object/],
    ['a missing source', { ...SERIES, source: undefined }, /candles: source must be a non-empty string/],
    ['an empty source', { ...SERIES, source: '  ' }, /candles: source must be a non-empty string/],
    ['a zero step', { ...SERIES, granularity_seconds: 0 }, /candles: granularity_seconds must be a positive whole number/],
    ['a negative step', { ...SERIES, granularity_seconds: -FOUR_HOURS }, /granularity_seconds must be a positive whole number/],
    ['a fractional step', { ...SERIES, granularity_seconds: 1.5 }, /granularity_seconds must be a positive whole number/],
    ['candles that are not an array', { ...SERIES, candles: {} }, /candles: candles must be an array/],
    ['a candle that is not an object', withCandles(null), /candle 1: expected an object/],
    ['a zero price', withCandles(candle(FIRST, { low: 0 })), /candle 1: low must be a positive number/],
    ['a price that is not finite', withCandles(candle(FIRST, { high: Infinity })), /candle 1: high must be a positive number/],
    ['a price given as text', withCandles({ ...candle(FIRST), close: '105' }), /candle 1: close must be a positive number/],
    ['a high below the body', withCandles(candle(FIRST, { high: 104 })), /candle 1: high must be at least the open and the close/],
    ['a low above the body', withCandles(candle(FIRST, { low: 101 })), /candle 1: low must be at most the open and the close/],
    ['a time that is not a date', withCandles(candle('soon')), /candle 1: time must be an ISO date/],
    ['a time not in its stored form', withCandles(candle('2026-10-26T04:00:00Z')), /candle 1: time must be stored as 2026-10-26T04:00:00\.000Z/],
    ['a time off the step', withCandles(candle('2026-10-26T05:00:00.000Z')), /candle 1: time must fall on a 14400-second step/],
    ['a repeated time', withCandles(candle(FIRST), candle(FIRST)), /candle 2: time must come after 2026-10-26T00:00:00\.000Z/],
    [
      'times out of order',
      withCandles(candle('2026-10-26T04:00:00.000Z'), candle(FIRST)),
      /candle 2: time must come after 2026-10-26T04:00:00\.000Z/,
    ],
  ];
  for (const [what, value, message] of rejected) {
    test(`rejects ${what}`, () => {
      assert.throws(() => parseCandles(value), { ...CANDLE_ERROR, message });
    });
  }
});

describe('loadCandles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'candles-test-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  function fileWith(name: string, content: string): string {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  }

  test('reads a file saved with a byte order mark', () => {
    assert.deepEqual(loadCandles(fileWith('bom.json', `﻿${JSON.stringify(SERIES)}`)), SERIES);
  });

  test('names the file it cannot read', () => {
    assert.throws(() => loadCandles(join(dir, 'missing.json')), { ...CANDLE_ERROR, message: /Cannot read candles .*missing\.json/ });
  });

  test('names the file that is not JSON', () => {
    assert.throws(() => loadCandles(fileWith('broken.json', '{"source":')), {
      ...CANDLE_ERROR,
      message: /Cannot read candles .*broken\.json/,
    });
  });

  test('checks what it reads', () => {
    assert.throws(() => loadCandles(fileWith('list.json', '[]')), { ...CANDLE_ERROR, message: /candles: expected an object/ });
  });
});
