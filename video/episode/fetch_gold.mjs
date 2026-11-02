// Fetch daily gold candles for the gold explainer: XAUT on Bitfinex, a token backed by one troy ounce of gold.
// Usage: node episode/fetch_gold.mjs <out.json> [from=2025-01-01]
// Bitfinex is free and needs no key; spot XAU sources (Stooq, LBMA) refuse scripts, and PAXG is not used.
// Rows come as [MTS, OPEN, CLOSE, HIGH, LOW, VOLUME]: close before high. Only complete UTC days are kept.
import { writeFileSync } from 'node:fs';

const [out, fromArg = '2025-01-01'] = process.argv.slice(2);
if (!out) throw new Error('usage: node episode/fetch_gold.mjs <out.json> [from=YYYY-MM-DD]');
const from = Date.parse(`${fromArg}T00:00:00Z`);
if (!Number.isFinite(from)) throw new Error(`bad from date: ${fromArg}`);

const DAY = 86400000;
const url = `https://api-pub.bitfinex.com/v2/candles/trade:1D:tXAUT:USD/hist?start=${from}&limit=10000&sort=1`;
const response = await fetch(url, { headers: { 'User-Agent': 'repka-lab-video', Accept: 'application/json' } });
if (!response.ok) throw new Error(`Bitfinex answered ${response.status}`);
const rows = await response.json();
if (!Array.isArray(rows)) throw new Error('Bitfinex answered with no candle list');

const isRow = (row) => Array.isArray(row) && row.length >= 6 && row.every(Number.isFinite);
const today = Math.floor(Date.now() / DAY) * DAY;
const candles = rows
  .filter(isRow)
  .filter(([time]) => time < today)
  .map(([time, open, close, high, low, volume]) => ({
    time: time / 1000,
    day: new Date(time).toISOString().slice(0, 10),
    open, high, low, close, volume,
  }));
if (candles.length === 0) throw new Error('no complete gold days');
for (let i = 1; i < candles.length; i++) {
  if (candles[i].time - candles[i - 1].time !== DAY / 1000) throw new Error(`gap after ${candles[i - 1].day}`);
}

const data = {
  source: 'Bitfinex XAUT/USD daily candles (XAUT: a token backed by one troy ounce of gold)',
  url,
  fetchedAt: new Date().toISOString(),
  candles,
};
writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
const last = candles[candles.length - 1];
console.log(JSON.stringify({ out, days: candles.length, first: candles[0].day, last: last.day, close: last.close }));
