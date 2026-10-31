import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { type Candle, CandleError } from './candles.ts';
import { binanceRange, defaultOut, fetchKlines, klinesToCandles, klinesUrl, sourceOf } from './fetch-binance-candles.ts';
import { mergeSeries, STEP_SECONDS } from './fetch-candles.ts';

const STEP_MS = STEP_SECONDS * 1000;
const FROM = Date.parse('2026-10-26T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

// A Binance kline: open time, prices as strings, volume, close time and five fields the charts skip.
function kline(ms: number, price: number): readonly unknown[] {
  return [ms, String(price), String(price + 10), String(price - 10), String(price + 1), '12.5', ms + STEP_MS - 1, '1000.0', 42, '6.1', '500.0', '0'];
}

describe('klinesUrl', () => {
  test('asks the public feed for 4-hour candles that open in the range', () => {
    const url = new URL(klinesUrl('BNBUSDT', FROM, FROM + 2 * STEP_MS));

    assert.equal(url.origin + url.pathname, 'https://api.binance.com/api/v3/klines');
    assert.equal(url.searchParams.get('symbol'), 'BNBUSDT');
    assert.equal(url.searchParams.get('interval'), '4h');
    assert.equal(url.searchParams.get('startTime'), String(FROM));
    assert.equal(url.searchParams.get('endTime'), String(FROM + 2 * STEP_MS - 1));
    assert.equal(url.searchParams.get('limit'), '1000');
  });
});

describe('klinesToCandles', () => {
  test('turns the rows into stored candles with numeric prices', () => {
    assert.deepEqual(klinesToCandles([kline(FROM, 1100.5)], FROM + STEP_MS), [
      { time: '2026-10-26T00:00:00.000Z', open: 1100.5, high: 1110.5, low: 1090.5, close: 1101.5 },
    ]);
  });

  test('leaves out a candle still open at the end of the range', () => {
    const candles = klinesToCandles([kline(FROM, 100), kline(FROM + STEP_MS, 101)], FROM + STEP_MS + 1);

    assert.deepEqual(candles.map((c) => c.time), [iso(FROM)]);
  });

  test('refuses an answer that is not a list of rows', () => {
    assert.throws(() => klinesToCandles({ code: -1121, msg: 'Invalid symbol.' }, FROM), /Invalid symbol/);
  });

  test('names the row that is not an open time and four prices', () => {
    assert.throws(() => klinesToCandles([kline(FROM, 100), [FROM, 'x', '1', '1', '1', ...kline(FROM, 1).slice(5)]], FROM), /row 2/);
    assert.throws(() => klinesToCandles([[FROM, '1', '1', '1', '1']], FROM), /row 1/);
  });
});

describe('fetchKlines', () => {
  test('asks once and returns the closed candles, oldest first', async () => {
    const urls: string[] = [];
    const to = FROM + 3 * STEP_MS + 1;
    const feed = async (url: string): Promise<unknown> => {
      urls.push(url);
      return [0, 1, 2, 3].map((i) => kline(FROM + i * STEP_MS, 100 + i));
    };

    const candles = await fetchKlines('BNBUSDT', FROM, to, feed);

    assert.equal(urls.length, 1);
    assert.deepEqual(candles.map((c) => c.time), [iso(FROM), iso(FROM + STEP_MS), iso(FROM + 2 * STEP_MS)]);
  });

  test('asks nothing when no candle closes in the range', async () => {
    const urls: string[] = [];

    assert.deepEqual(await fetchKlines('BNBUSDT', FROM, FROM + 1, async (url) => urls.push(url)), []);
    assert.deepEqual(urls, []);
  });

  test('refuses a range longer than one request returns', async () => {
    await assert.rejects(fetchKlines('BNBUSDT', FROM, FROM + 1001 * STEP_MS, async () => []), /1001 candles/);
  });
});

describe('binanceRange', () => {
  const NOW = Date.parse('2026-10-31T09:30:00Z');

  test('reads the dates given as UTC days and never runs past now', () => {
    assert.deepEqual(binanceRange('2026-10-19', '2026-10-26', NOW), [Date.parse('2026-10-19T00:00:00Z'), FROM]);
    assert.deepEqual(binanceRange('2026-10-26', '2026-11-09', NOW), [FROM, NOW]);
  });

  test('needs a start, since there is no stored feed to continue', () => {
    assert.throws(() => binanceRange(undefined, undefined, NOW), /--from/);
  });

  test('refuses a start that is not before the end', () => {
    assert.throws(() => binanceRange('2026-11-02', undefined, NOW), /--from 2026-11-02/);
    assert.throws(() => binanceRange('26.10.2026', undefined, NOW), CandleError);
  });
});

describe('the stored file', () => {
  const candle = (time: string): Candle => ({ time, open: 1, high: 2, low: 0.5, close: 1.5 });

  test('is named after the pair and its feed', () => {
    assert.equal(defaultOut('BNBUSDT'), 'data/bnb-usdt-4h.json');
    assert.equal(sourceOf('BNBUSDT'), 'Binance BNBUSDT');
  });

  test('keeps the candles of its own feed and refuses the BTC file', () => {
    const stored = { source: 'Binance BNBUSDT', granularity_seconds: STEP_SECONDS, candles: [candle(iso(FROM))] };
    const btc = { ...stored, source: 'Coinbase Exchange BTC-USD' };

    assert.equal(mergeSeries(stored, [candle(iso(FROM + STEP_MS))], 'Binance BNBUSDT').candles.length, 2);
    assert.throws(() => mergeSeries(btc, [], 'Binance BNBUSDT'), /Coinbase Exchange BTC-USD/);
  });
});
