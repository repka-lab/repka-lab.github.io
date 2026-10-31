// Fetches BTC price candles for the charts from the public Coinbase Exchange feed, which needs no key.
//
//   node src/fetch-candles.ts --from 2026-10-19 [--to 2026-11-02]   fetch these UTC days into data/btc-usd-4h.json
//   node src/fetch-candles.ts                                     continue after the last candle in the file
//   node src/fetch-candles.ts --from 2026-10-19 --out x.json      write somewhere else
//
// The range never runs past now, so a candle still open is left for a later run and a stored candle never
// changes. Candles already in the file are kept as they are, and the merged series passes the same checks
// as the site build before anything is written.
//
// The feed has no 4-hour candles, so each one is built from its four hourly candles: the first open, the
// last close, the highest high and the lowest low, the same candle the exchange would draw.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { type Candle, CandleError, loadCandles, parseCandles, PRICES_FILE, type PriceSeries } from './candles.ts';

export const SOURCE = 'Coinbase Exchange BTC-USD';
export const STEP_SECONDS = 4 * 60 * 60;

export type GetJson = (url: string) => Promise<unknown>;

const FEED = 'https://api.exchange.coinbase.com/products/BTC-USD/candles';
const USER_AGENT = 'ai-prediction-lab candle fetch';
const FEED_STEP_SECONDS = 60 * 60; // the feed offers 1, 5 and 15 minutes, 1 and 6 hours and 1 day
const MAX_CANDLES = 300; // per request; the feed refuses more
const TIMEOUT_MS = 15_000;
const ROW_LENGTH = 6;
const PREVIEW_CHARS = 200; // of an answer that holds no candles, quoted in the error
const MS_PER_SECOND = 1000;
const STEP_MS = STEP_SECONDS * MS_PER_SECOND;
const FEED_STEP_MS = FEED_STEP_SECONDS * MS_PER_SECOND;
const STEPS_PER_REQUEST = MAX_CANDLES / (STEP_SECONDS / FEED_STEP_SECONDS);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PROJECT_ROOT = resolve(import.meta.dirname, '..');

type Window = readonly [first: number, last: number]; // hour starts in ms, both included
type Row = readonly [seconds: number, low: number, high: number, open: number, close: number, volume: number];

// The hours of every step that starts at or after `from` and closes no later than `to`, in windows of at
// most MAX_CANDLES hours that hold whole steps.
export function requestWindows(from: number, to: number): readonly Window[] {
  const firstStep = Math.ceil(from / STEP_MS);
  const count = Math.floor(to / STEP_MS) - firstStep;
  if (count <= 0) return [];
  return Array.from({ length: Math.ceil(count / STEPS_PER_REQUEST) }, (_, i) => {
    const first = firstStep + i * STEPS_PER_REQUEST;
    const end = firstStep + Math.min(count, (i + 1) * STEPS_PER_REQUEST);
    return [first * STEP_MS, end * STEP_MS - FEED_STEP_MS] as const;
  });
}

export function candlesUrl(first: number, last: number): string {
  const params = new URLSearchParams({ granularity: String(FEED_STEP_SECONDS), start: iso(first), end: iso(last) });
  return `${FEED}?${params}`;
}

// Hourly candles, oldest first, as one candle per step that has any of them.
export function toSteps(hours: readonly Candle[]): readonly Candle[] {
  const groups = Map.groupBy(hours, (c) => Math.floor(Date.parse(c.time) / STEP_MS));
  return [...groups].map(([step, group]) => ({
    time: iso(step * STEP_MS),
    open: group[0]?.open ?? Number.NaN,
    high: Math.max(...group.map((c) => c.high)),
    low: Math.min(...group.map((c) => c.low)),
    close: group.at(-1)?.close ?? Number.NaN,
  }));
}

// The feed's rows, newest first, as stored candles, oldest first.
export function rowsToCandles(value: unknown): readonly Candle[] {
  if (!Array.isArray(value)) throw new CandleError(`Coinbase answered ${preview(value)}, not a list of candles`);
  return value.map((row: unknown, index) => toCandle(row, index)).toSorted(byTime);
}

// One request per window, one after another. Each answer is cut to its window, since the feed may add
// the hour after it, and the hours are then built into steps.
export async function fetchCandles(from: number, to: number, getJson: GetJson = getFromFeed): Promise<readonly Candle[]> {
  const pages: (readonly Candle[])[] = [];
  for (const [first, last] of requestWindows(from, to)) {
    const hours = rowsToCandles(await getJson(candlesUrl(first, last)));
    pages.push(hours.filter((c) => Date.parse(c.time) >= first && Date.parse(c.time) <= last));
  }
  return toSteps(pages.flat());
}

// The range to fetch in ms: from the start of the --from day, or else from the end of the last stored
// candle, to the start of the --to day or now, whichever comes first.
export function fetchRange(
  fromDay: string | undefined,
  toDay: string | undefined,
  stored: PriceSeries | undefined,
  now: number,
): readonly [number, number] {
  if (stored !== undefined) checkFeed(stored);
  const from = fromDay === undefined ? afterLast(stored) : utcDay(fromDay, '--from');
  const to = Math.min(toDay === undefined ? now : utcDay(toDay, '--to'), now);
  if (fromDay !== undefined && from >= to) throw new CandleError(`--from ${fromDay} must come before ${iso(to)}`);
  return [from, to];
}

// The stored candles as they are, and the fetched ones at times the file does not hold yet, oldest first.
export function mergeSeries(stored: PriceSeries | undefined, fetched: readonly Candle[], source = SOURCE): PriceSeries {
  if (stored !== undefined) checkFeed(stored, source);
  const kept = stored?.candles ?? [];
  const known = new Set(kept.map((c) => c.time));
  const candles = [...kept, ...fetched.filter((c) => !known.has(c.time))].toSorted(byTime);
  return { source, granularity_seconds: STEP_SECONDS, candles };
}

function toCandle(row: unknown, index: number): Candle {
  if (!isRow(row)) throw new CandleError(`Coinbase row ${index + 1}: expected six numbers, time, low, high, open, close and volume`);
  const [seconds, low, high, open, close] = row;
  return { time: iso(seconds * MS_PER_SECOND), open, high, low, close };
}

function isRow(value: unknown): value is Row {
  return Array.isArray(value) && value.length === ROW_LENGTH && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function afterLast(stored: PriceSeries | undefined): number {
  const last = stored?.candles.at(-1);
  if (last === undefined) throw new CandleError('there are no candles yet; pass --from with the first UTC day, like 2026-10-19');
  return Date.parse(last.time) + STEP_MS;
}

export function utcDay(text: string, flag: string): number {
  const ms = DAY.test(text) ? Date.parse(`${text}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(ms) || iso(ms).slice(0, 10) !== text) throw new CandleError(`${flag} must be a UTC day like 2026-10-19, not ${text}`);
  return ms;
}

// Candles from another feed or step never go into the same file.
function checkFeed(series: PriceSeries, source = SOURCE): void {
  if (series.source !== source || series.granularity_seconds !== STEP_SECONDS) {
    throw new CandleError(`the file holds ${series.source} every ${series.granularity_seconds} s, not ${source} every ${STEP_SECONDS} s`);
  }
}

function getFromFeed(url: string): Promise<unknown> {
  return getJsonFrom(FEED, url);
}

// One GET to a public feed, named in the error when it cannot be reached or refuses.
export async function getJsonFrom(feed: string, url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new CandleError(`Cannot reach ${feed}: ${reason(error)}`, { cause: error });
  }
  if (!response.ok) throw new CandleError(`${feed} answered ${response.status} ${response.statusText}`);
  return response.json();
}

function byTime(a: Candle, b: Candle): number {
  return Date.parse(a.time) - Date.parse(b.time);
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function preview(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}...` : text;
}

// fetch hides the network problem in the cause of a bare "fetch failed".
function reason(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error) return cause.message;
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { from: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' } },
    strict: true,
  });
  const outPath = values.out === undefined ? join(PROJECT_ROOT, PRICES_FILE) : resolve(values.out);
  const stored = existsSync(outPath) ? loadCandles(outPath) : undefined;
  const [from, to] = fetchRange(values.from, values.to, stored, Date.now());

  const fetched = await fetchCandles(from, to);
  const merged = parseCandles(mergeSeries(stored, fetched)); // the checks the site build runs
  const added = merged.candles.length - (stored?.candles.length ?? 0);
  if (added > 0) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`);
  }
  const file = relative(PROJECT_ROOT, outPath).replaceAll('\\', '/');
  const summary = { file, from: iso(from), to: iso(to), fetched: fetched.length, added, candles: merged.candles.length };
  process.stdout.write(`${JSON.stringify({ ...summary, last: merged.candles.at(-1)?.time ?? null })}\n`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`Candle fetch failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
