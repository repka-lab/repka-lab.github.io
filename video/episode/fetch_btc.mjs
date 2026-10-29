/**
 * Fetch real BTC-USD daily candles for the monitor scene and save them as JSON.
 *
 *   node episode/fetch_btc.mjs assets/data/btc-daily.json [days]
 *
 * Source: Coinbase Exchange public market data, no key needed. Candles are UTC days.
 * Only complete days are kept: today's candle is still moving.
 */
import { writeFileSync } from 'node:fs';

const DAY = 86400;
const DEFAULT_DAYS = 45;
const URL = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${DAY}`;

const [out, daysArg] = process.argv.slice(2);
if (!out) throw new Error('usage: node episode/fetch_btc.mjs <out.json> [days]');
const days = Number(daysArg ?? DEFAULT_DAYS);

const response = await fetch(URL, { headers: { 'User-Agent': 'repka-lab-video', Accept: 'application/json' } });
if (!response.ok) throw new Error(`Coinbase answered ${response.status} ${response.statusText}`);
const rows = await response.json();

// Each row is [time, low, high, open, close, volume], newest first.
const isCandle = (row) => Array.isArray(row) && row.length >= 6 && row.slice(0, 6).every(Number.isFinite);
if (!Array.isArray(rows) || !rows.every(isCandle)) throw new Error('unexpected candle format from Coinbase');

const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
const candles = rows
  .filter(([time]) => time < today)
  .slice(0, days)
  .reverse()
  .map(([time, low, high, open, close, volume]) => ({
    day: new Date(time * 1000).toISOString().slice(0, 10),
    open,
    high,
    low,
    close,
    volume, // BTC traded that day
  }));
if (candles.length < days) throw new Error(`only ${candles.length} complete days, wanted ${days}`);

const data = { source: 'Coinbase Exchange, BTC-USD daily candles, UTC', url: URL, fetchedAt: new Date().toISOString(), candles };
writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
console.log(JSON.stringify({ out, first: candles[0].day, last: candles.at(-1).day, close: candles.at(-1).close }));
