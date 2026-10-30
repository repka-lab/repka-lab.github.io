// BTC price candles for the charts: open, high, low and close on a fixed time step, from one public feed.
// The file is only drawn, never used to check a call: verdicts come from the ledger alone.
//
// Times are the start of each step, stored in the exact form toISOString() writes, oldest first.
// A step with no trades has no candle, so the series may have gaps.

import { readFileSync } from 'node:fs';

export interface Candle {
  readonly time: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

export interface PriceSeries {
  readonly source: string;
  readonly granularity_seconds: number;
  readonly candles: readonly Candle[];
}

export const PRICES_FILE = 'data/btc-usd-4h.json'; // relative to the project root

const MS_PER_SECOND = 1000;

export class CandleError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CandleError';
  }
}

export function loadCandles(path: string): PriceSeries {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    throw new CandleError(`Cannot read candles ${path}: ${messageOf(error)}`, { cause: error });
  }
  return parseCandles(raw);
}

export function parseCandles(value: unknown): PriceSeries {
  const fields = fieldsOf(value, 'candles');
  const source = text(fields, 'source', 'candles');
  const step = granularity(fields);
  const raw = fields['candles'];
  if (!Array.isArray(raw)) fail('candles', 'candles must be an array');
  const candles = raw.map((item, index) => parseCandle(item, `candle ${index + 1}`, step));
  candles.forEach((current, index) => {
    const previous = candles[index - 1];
    if (previous !== undefined && current.time <= previous.time) {
      fail(`candle ${index + 1}`, `time must come after ${previous.time}`);
    }
  });
  return { source, granularity_seconds: step, candles };
}

function parseCandle(value: unknown, where: string, step: number): Candle {
  const fields = fieldsOf(value, where);
  const time = stepTime(fields, where, step);
  const open = price(fields, 'open', where);
  const high = price(fields, 'high', where);
  const low = price(fields, 'low', where);
  const close = price(fields, 'close', where);
  if (high < Math.max(open, close)) fail(where, 'high must be at least the open and the close');
  if (low > Math.min(open, close)) fail(where, 'low must be at most the open and the close');
  return { time, open, high, low, close };
}

type Fields = Readonly<Record<string, unknown>>;

function fieldsOf(value: unknown, where: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(where, 'expected an object');
  return value as Fields;
}

function text(fields: Fields, key: string, where: string): string {
  const value = fields[key];
  if (typeof value !== 'string' || value.trim() === '') fail(where, `${key} must be a non-empty string`);
  return value;
}

function granularity(fields: Fields): number {
  const value = fields['granularity_seconds'];
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail('candles', 'granularity_seconds must be a positive whole number');
  }
  return value;
}

function price(fields: Fields, key: string, where: string): number {
  const value = fields[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) fail(where, `${key} must be a positive number`);
  return value;
}

// ISO time in its stored form, on the step grid counted from the Unix epoch.
function stepTime(fields: Fields, where: string, step: number): string {
  const value = fields['time'];
  const ms = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(ms)) fail(where, 'time must be an ISO date');
  const stored = new Date(ms).toISOString();
  if (value !== stored) fail(where, `time must be stored as ${stored}`);
  if (ms % (step * MS_PER_SECOND) !== 0) fail(where, `time must fall on a ${step}-second step`);
  return stored;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fail(where: string, problem: string): never {
  throw new CandleError(`${where}: ${problem}`);
}
