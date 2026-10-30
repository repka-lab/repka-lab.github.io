import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { type Candle, CandleError, type PriceSeries } from './candles.ts';
import {
  candlesUrl,
  fetchCandles,
  fetchRange,
  mergeSeries,
  requestWindows,
  rowsToCandles,
  SOURCE,
  STEP_SECONDS,
  toSteps,
} from './fetch-candles.ts';

const STEP_MS = STEP_SECONDS * 1000;
const HOUR_MS = 60 * 60 * 1000;
const FROM = Date.parse('2026-10-26T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function candle(time: string, price: number): Candle {
  return { time, open: price, high: price + 10, low: price - 10, close: price };
}

// A Coinbase row: [time in seconds, low, high, open, close, volume].
function row(ms: number, price: number): readonly number[] {
  return [ms / 1000, price - 10, price + 10, price, price, 1.5];
}

describe('requestWindows', () => {
  test('asks for a week in one request, from the first hour to the last hour of the last finished step', () => {
    const to = Date.parse('2026-11-02T00:00:00Z');

    assert.deepEqual(requestWindows(FROM, to), [[FROM, to - HOUR_MS]]);
  });

  test('splits a long range into requests of at most 300 hours, each holding whole steps', () => {
    const to = FROM + 100 * STEP_MS;

    assert.deepEqual(requestWindows(FROM, to), [
      [FROM, FROM + 75 * STEP_MS - HOUR_MS],
      [FROM + 75 * STEP_MS, to - HOUR_MS],
    ]);
  });

  test('starts at the next step and leaves out a step still open at the end', () => {
    const from = Date.parse('2026-10-26T01:00:00Z');
    const to = Date.parse('2026-10-27T03:00:00Z');

    assert.deepEqual(requestWindows(from, to), [[Date.parse('2026-10-26T04:00:00Z'), Date.parse('2026-10-26T23:00:00Z')]]);
  });

  test('asks for nothing when no step closes in the range', () => {
    assert.deepEqual(requestWindows(FROM, FROM + STEP_MS - 1), []);
  });
});

describe('candlesUrl', () => {
  test('asks the public BTC-USD feed for hourly candles between two times, since it has no 4-hour ones', () => {
    const url = new URL(candlesUrl(FROM, FROM + STEP_MS - HOUR_MS));

    assert.equal(url.origin + url.pathname, 'https://api.exchange.coinbase.com/products/BTC-USD/candles');
    assert.equal(url.searchParams.get('granularity'), '3600');
    assert.equal(url.searchParams.get('start'), '2026-10-26T00:00:00.000Z');
    assert.equal(url.searchParams.get('end'), '2026-10-26T03:00:00.000Z');
  });
});

describe('toSteps', () => {
  const hour = (h: number, open: number, high: number, low: number, close: number): Candle => ({
    time: iso(FROM + h * HOUR_MS),
    open,
    high,
    low,
    close,
  });

  test('builds each 4-hour candle from its hours: first open, last close, highest high, lowest low', () => {
    const hours = [hour(0, 100, 110, 95, 105), hour(1, 105, 130, 104, 120), hour(2, 120, 121, 90, 98), hour(3, 98, 101, 97, 99), hour(4, 99, 100, 98, 100)];

    assert.deepEqual(toSteps(hours), [
      { time: iso(FROM), open: 100, high: 130, low: 90, close: 99 },
      { time: iso(FROM + STEP_MS), open: 99, high: 100, low: 98, close: 100 },
    ]);
  });

  test('uses the hours that traded when an hour has no candle', () => {
    const hours = [hour(1, 105, 130, 104, 120), hour(3, 98, 101, 97, 99)];

    assert.deepEqual(toSteps(hours), [{ time: iso(FROM), open: 105, high: 130, low: 97, close: 99 }]);
  });

  test('builds nothing from no hours', () => {
    assert.deepEqual(toSteps([]), []);
  });
});

describe('rowsToCandles', () => {
  test('turns the newest-first rows into stored candles, oldest first', () => {
    const rows = [[FROM / 1000 + STEP_SECONDS, 99, 120, 100, 110, 3], [FROM / 1000, 95, 105, 101, 100, 2]];

    assert.deepEqual(rowsToCandles(rows), [
      { time: '2026-10-26T00:00:00.000Z', open: 101, high: 105, low: 95, close: 100 },
      { time: '2026-10-26T04:00:00.000Z', open: 100, high: 120, low: 99, close: 110 },
    ]);
  });

  test('refuses an answer that is not a list of rows', () => {
    assert.throws(() => rowsToCandles({ message: 'rate limited' }), CandleError);
  });

  test('names the row that is not six numbers', () => {
    assert.throws(() => rowsToCandles([row(FROM, 100), [FROM / 1000, 'x', 1, 1, 1, 1]]), /row 2/);
    assert.throws(() => rowsToCandles([[FROM / 1000, 1, 1, 1]]), /row 1/);
  });
});

describe('fetchCandles', () => {
  // A stand-in for the feed: every hour in the asked range, newest first, plus the hour after it,
  // priced at its hour count from FROM.
  function fakeFeed(urls: string[]) {
    return async (url: string): Promise<unknown> => {
      urls.push(url);
      const params = new URL(url).searchParams;
      const start = Date.parse(params.get('start') ?? '');
      const end = Date.parse(params.get('end') ?? '');
      const times = Array.from({ length: (end - start) / HOUR_MS + 2 }, (_, i) => start + i * HOUR_MS);
      return times.map((ms) => row(ms, 100 + (ms - FROM) / HOUR_MS)).toReversed();
    };
  }

  test('asks one window at a time and returns each finished 4-hour candle once, oldest first', async () => {
    const urls: string[] = [];
    const to = FROM + 100 * STEP_MS;

    const candles = await fetchCandles(FROM, to, fakeFeed(urls));

    assert.equal(urls.length, 2);
    assert.equal(candles.length, 100);
    assert.deepEqual(candles[0], { time: iso(FROM), open: 100, high: 113, low: 90, close: 103 });
    assert.equal(candles.at(-1)?.time, iso(to - STEP_MS));
    assert.ok(candles.every((c, i) => i === 0 || c.time > (candles[i - 1]?.time ?? '')));
  });

  test('asks nothing when no candle closes in the range', async () => {
    const urls: string[] = [];

    assert.deepEqual(await fetchCandles(FROM, FROM + 1, fakeFeed(urls)), []);
    assert.deepEqual(urls, []);
  });
});

describe('fetchRange', () => {
  const NOW = Date.parse('2026-10-30T13:30:00Z');
  const stored = (time: string): PriceSeries => ({ source: SOURCE, granularity_seconds: STEP_SECONDS, candles: [candle(time, 100)] });

  test('reads the dates given as UTC days', () => {
    assert.deepEqual(fetchRange('2026-10-19', '2026-10-26', undefined, NOW), [
      Date.parse('2026-10-19T00:00:00Z'),
      Date.parse('2026-10-26T00:00:00Z'),
    ]);
  });

  test('continues after the last stored candle and stops now', () => {
    assert.deepEqual(fetchRange(undefined, undefined, stored('2026-10-29T20:00:00.000Z'), NOW), [Date.parse('2026-10-30T00:00:00Z'), NOW]);
  });

  test('never asks past now, so a candle still open is never stored', () => {
    assert.deepEqual(fetchRange('2026-10-26', '2026-11-09', undefined, NOW), [FROM, NOW]);
  });

  test('needs a start when there is no file yet', () => {
    assert.throws(() => fetchRange(undefined, undefined, undefined, NOW), /--from/);
  });

  test('refuses a date it cannot read', () => {
    assert.throws(() => fetchRange('26.10.2026', undefined, undefined, NOW), CandleError);
    assert.throws(() => fetchRange('2026-02-30', undefined, undefined, NOW), /--from/);
    assert.throws(() => fetchRange('2026-10-26', '2026-10-26T12:00', undefined, NOW), /--to/);
  });

  test('refuses a start that is not before the end', () => {
    assert.throws(() => fetchRange('2026-10-26', '2026-10-19', undefined, NOW), /--from 2026-10-26/);
    assert.throws(() => fetchRange('2026-11-02', undefined, undefined, NOW), /--from 2026-11-02/);
  });

  test('refuses a file from another feed before asking anything', () => {
    const other = { ...stored('2026-10-29T20:00:00.000Z'), source: 'Other exchange' };

    assert.throws(() => fetchRange(undefined, undefined, other, NOW), /Other exchange/);
  });
});

describe('mergeSeries', () => {
  const a = candle('2026-10-26T00:00:00.000Z', 100);
  const b = candle('2026-10-26T04:00:00.000Z', 101);
  const c = candle('2026-10-26T08:00:00.000Z', 102);
  const series = (candles: readonly Candle[], source = SOURCE): PriceSeries => ({ source, granularity_seconds: STEP_SECONDS, candles });

  test('keeps the candles already in the file and adds the new times, oldest first', () => {
    assert.deepEqual(mergeSeries(series([a, b]), [c, candle(b.time, 999)]), series([a, b, c]));
  });

  test('starts a new series when there is no file yet', () => {
    assert.deepEqual(mergeSeries(undefined, [a]), series([a]));
  });

  test('refuses to mix in candles from another feed', () => {
    assert.throws(() => mergeSeries(series([a], 'Other exchange'), [b]), /Other exchange/);
  });
});
