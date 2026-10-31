// Fetches 4h candles of one Binance spot pair from the public Binance market feed, which needs no key.
// The episode monitor draws them next to the BTC candles, and the site's market charts draw the BNB file;
// the ledger never reads them.
//
//   node src/fetch-binance-candles.ts --from 2026-10-19 [--to 2026-11-02]   BNBUSDT into data/bnb-usdt-4h.json
//   node src/fetch-binance-candles.ts --from 2026-10-19 --symbol ETHUSDT    another USDT pair
//   node src/fetch-binance-candles.ts --from 2026-10-19 --out x.json        write somewhere else
//
// Binance draws 4-hour candles itself, on the same 00, 04, ... 20 UTC steps as the BTC file, so they are
// stored as they come. As with the BTC fetch, only candles closed by the end of the range are kept,
// candles already in the file stay as they are, and the series passes the site build's checks first.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { type Candle, CandleError, loadCandles, parseCandles } from './candles.ts';
import { type GetJson, getJsonFrom, mergeSeries, preview, STEP_SECONDS, utcDay } from './fetch-candles.ts';

export const DEFAULT_SYMBOL = 'BNBUSDT';

const FEED = 'https://api.binance.com/api/v3/klines';
const INTERVAL = '4h';
const MAX_CANDLES = 1000; // per request; the feed refuses more
const ROW_LENGTH = 12;
const PRICE = /^\d+(\.\d+)?$/; // the feed sends prices as decimal strings
const SYMBOL = /^[A-Z0-9]{2,15}USDT$/;
const STEP_MS = STEP_SECONDS * 1000;
const PROJECT_ROOT = resolve(import.meta.dirname, '..');

// [open time ms, open, high, low, close, volume, close time ms, and five more the charts do not use]
type Row = readonly [openMs: number, open: string, high: string, low: string, close: string, ...rest: unknown[]];

export function sourceOf(symbol: string): string {
  return `Binance ${symbol}`;
}

export function defaultOut(symbol: string): string {
  return `data/${symbol.replace(/USDT$/, '').toLowerCase()}-usdt-4h.json`;
}

// The feed filters on the open time, both ends included, so the end stops just before `to`.
export function klinesUrl(symbol: string, from: number, to: number): string {
  const params = new URLSearchParams({ symbol, interval: INTERVAL, startTime: String(from), endTime: String(to - 1), limit: String(MAX_CANDLES) });
  return `${FEED}?${params}`;
}

// The feed's rows, oldest first, as stored candles; a candle still open at `to` is left out.
export function klinesToCandles(value: unknown, to: number): readonly Candle[] {
  if (!Array.isArray(value)) throw new CandleError(`Binance answered ${preview(value)}, not a list of candles`);
  return value.map((row: unknown, index) => toCandle(row, index)).filter((c) => Date.parse(c.time) + STEP_MS <= to);
}

// One request: a range of more than MAX_CANDLES steps is refused rather than paged, since no chart needs one.
export async function fetchKlines(symbol: string, from: number, to: number, getJson: GetJson = getFromFeed): Promise<readonly Candle[]> {
  const steps = Math.floor(to / STEP_MS) - Math.ceil(from / STEP_MS);
  if (steps <= 0) return [];
  if (steps > MAX_CANDLES) throw new CandleError(`the range holds ${steps} candles, more than the ${MAX_CANDLES} one request returns`);
  return klinesToCandles(await getJson(klinesUrl(symbol, from, to)), to);
}

// From the start of the --from day to the start of the --to day or now, whichever comes first.
export function binanceRange(fromDay: string | undefined, toDay: string | undefined, now: number): readonly [number, number] {
  if (fromDay === undefined) throw new CandleError('pass --from with the first UTC day, like 2026-10-19');
  const from = utcDay(fromDay, '--from');
  const to = Math.min(toDay === undefined ? now : utcDay(toDay, '--to'), now);
  if (from >= to) throw new CandleError(`--from ${fromDay} must come before ${new Date(to).toISOString()}`);
  return [from, to];
}

function toCandle(row: unknown, index: number): Candle {
  if (!isRow(row)) throw new CandleError(`Binance row ${index + 1}: expected an open time and four prices, open, high, low and close`);
  const [openMs, open, high, low, close] = row;
  return { time: new Date(openMs).toISOString(), open: Number(open), high: Number(high), low: Number(low), close: Number(close) };
}

function isRow(value: unknown): value is Row {
  if (!Array.isArray(value) || value.length !== ROW_LENGTH || !Number.isInteger(value[0])) return false;
  return value.slice(1, 5).every((price) => typeof price === 'string' && PRICE.test(price));
}

function getFromFeed(url: string): Promise<unknown> {
  return getJsonFrom(FEED, url);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { from: { type: 'string' }, to: { type: 'string' }, symbol: { type: 'string' }, out: { type: 'string' } },
    strict: true,
  });
  const symbol = values.symbol ?? DEFAULT_SYMBOL;
  if (!SYMBOL.test(symbol)) throw new CandleError(`--symbol must be a USDT pair like ${DEFAULT_SYMBOL}, not ${symbol}`);
  const outPath = values.out === undefined ? join(PROJECT_ROOT, defaultOut(symbol)) : resolve(values.out);
  const stored = existsSync(outPath) ? loadCandles(outPath) : undefined;
  const [from, to] = binanceRange(values.from, values.to, Date.now());

  const fetched = await fetchKlines(symbol, from, to);
  const merged = parseCandles(mergeSeries(stored, fetched, sourceOf(symbol))); // the checks the site build runs
  const added = merged.candles.length - (stored?.candles.length ?? 0);
  if (added > 0) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`);
  }
  const file = relative(PROJECT_ROOT, outPath).replaceAll('\\', '/');
  const summary = { file, from: new Date(from).toISOString(), to: new Date(to).toISOString(), fetched: fetched.length, added };
  process.stdout.write(`${JSON.stringify({ ...summary, candles: merged.candles.length, last: merged.candles.at(-1)?.time ?? null })}\n`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`Candle fetch failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
