/**
 * Fetch real BTC-USD daily candles for the monitor scene and save them as JSON.
 *
 *   node episode/fetch_btc.mjs assets/data/btc-daily.json [days=45 | YYYY-MM-DD]
 *
 * Source: Coinbase Exchange public market data, no key needed. Candles are UTC days.
 * Only complete days are kept: today's candle is still moving. A start date, not a day count, fetches
 * every day since it, a page at a time (gold-2025 uses it for the year against gold).
 */
import { writeFileSync } from 'node:fs';

const DAY = 86400;
const DEFAULT_DAYS = 45;
const PAGE = 300; // Coinbase sends at most 300 candles per request
const URL = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${DAY}`;

const [out, span = String(DEFAULT_DAYS)] = process.argv.slice(2);
if (!out) throw new Error('usage: node episode/fetch_btc.mjs <out.json> [days=45 | YYYY-MM-DD]');
const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
const from = /^\d{4}-\d{2}-\d{2}$/.test(span) ? Date.parse(`${span}T00:00:00Z`) / 1000 : today - Number(span) * DAY;
if (!(Number.isInteger(from) && from < today)) throw new Error(`bad span: ${span}`);
const days = (today - from) / DAY;

// Each row is [time, low, high, open, close, volume], newest first; start and end are both included.
const isCandle = (row) => Array.isArray(row) && row.length >= 6 && row.slice(0, 6).every(Number.isFinite);
async function fetchPage(start, end) {
  const iso = (time) => new Date(time * 1000).toISOString();
  const response = await fetch(`${URL}&start=${iso(start)}&end=${iso(end)}`, { headers: { 'User-Agent': 'repka-lab-video', Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Coinbase answered ${response.status} ${response.statusText}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.every(isCandle)) throw new Error('unexpected candle format from Coinbase');
  return rows;
}

const rows = [];
for (let start = from; start < today; start += PAGE * DAY) {
  rows.push(...(await fetchPage(start, Math.min(start + (PAGE - 1) * DAY, today - DAY))));
}
const candles = rows
  .filter(([time]) => time >= from && time < today)
  .sort(([a], [b]) => a - b)
  .map(([time, low, high, open, close, volume]) => ({
    time,
    day: new Date(time * 1000).toISOString().slice(0, 10),
    open,
    high,
    low,
    close,
    volume, // BTC traded that day
  }));
if (candles.length < days) throw new Error(`only ${candles.length} complete days, wanted ${days}`);
for (let i = 1; i < candles.length; i++) {
  if (candles[i].time - candles[i - 1].time !== DAY) throw new Error(`gap or repeat after ${candles[i - 1].day}`);
}

const data = { source: 'Coinbase Exchange, BTC-USD daily candles, UTC', url: URL, fetchedAt: new Date().toISOString(), candles };
writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
console.log(JSON.stringify({ out, first: candles[0].day, last: candles.at(-1).day, close: candles.at(-1).close }));
