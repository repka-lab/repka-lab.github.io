// Append-only ledger of forecasts. Every prediction is written here BEFORE it is published,
// and the ledger only grows: existing predictions and verifications are never edited or removed.
//
// Every forecast is a call on BTC: does the price end higher or lower than it started?
// The recording time is taken from the clock, not from the caller, and the verify date is stored
// in the prediction itself, so neither can be chosen after the outcome is known.

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

export const MODELS = ['chatgpt', 'claude', 'gemini', 'grok'] as const;
export const DIRECTIONS = ['up', 'down'] as const;

export type Model = (typeof MODELS)[number];
export type Direction = (typeof DIRECTIONS)[number];

const SCHEMA_VERSION = 1;
const DECIMALS = 4;
const PROMPT_HASH = /^[0-9a-f]{64}$/; // sha256 of the exact prompt text, lowercase hex
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;

export interface Prediction {
  readonly id: string; // P0001, P0002, ... in recording order
  readonly date: string; // ISO 8601, when the forecast was recorded
  readonly model: Model;
  readonly model_version: string; // exact API model id the forecast came from
  readonly direction: Direction;
  readonly confidence: number; // 0-100
  readonly reasoning: string;
  readonly prompt_hash: string;
  readonly verify_date: string; // ISO 8601, when the outcome is checked
}

export interface Verification {
  readonly prediction_id: string;
  readonly verified_at: string; // ISO 8601
  readonly price_source: string;
  readonly price_start: number; // price at the prediction's recording time
  readonly price_end: number; // price at its verify_date
  readonly change_pct: number; // rounded to 4 decimals, for display
  readonly outcome: Direction; // read from the raw prices, so a rise too small for change_pct is still up
  readonly hit: boolean;
}

export interface Ledger {
  readonly schema_version: typeof SCHEMA_VERSION;
  readonly predictions: readonly Prediction[];
  readonly verifications: readonly Verification[];
}

export type NewPrediction = Omit<Prediction, 'id' | 'date'>;

export type NewVerification = Pick<
  Verification,
  'prediction_id' | 'price_source' | 'price_start' | 'price_end'
>;

export interface ModelStats {
  readonly predictions: number;
  readonly verified: number;
  readonly pending: number;
  readonly hits: number;
  readonly misses: number;
  readonly hit_rate: number | null; // hits / verified; null until something is verified
  readonly avg_confidence: number | null; // over verified predictions, to set against hit_rate
}

export interface Results {
  readonly schema_version: typeof SCHEMA_VERSION;
  readonly updated_at: string;
  readonly models: Readonly<Record<Model, ModelStats>>;
}

export class LedgerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LedgerError';
  }
}

export function emptyLedger(): Ledger {
  return { schema_version: SCHEMA_VERSION, predictions: [], verifications: [] };
}

export function addPrediction(ledger: Ledger, input: NewPrediction, now: Date = new Date()): Ledger {
  const where = 'new prediction';
  const fields = fieldsOf(input, where);
  const prediction: Prediction = {
    id: formatId(ledger.predictions.length + 1),
    date: now.toISOString(),
    ...readForecast(fields, where),
    verify_date: isoDate(fields, 'verify_date', where),
  };
  checkDates(prediction, where);
  const taken = ledger.predictions.find((p) => slotOf(p) === slotOf(prediction));
  if (taken) fail(where, `${taken.id} already holds ${prediction.model} for ${prediction.verify_date}`);
  return { ...ledger, predictions: [...ledger.predictions, prediction] };
}

export function verifyPrediction(ledger: Ledger, input: NewVerification, now: Date = new Date()): Ledger {
  const where = 'verification';
  const fields = fieldsOf(input, where);
  const id = text(fields, 'prediction_id', where);
  const prediction = ledger.predictions.find((p) => p.id === id);
  if (!prediction) fail(where, `there is no prediction ${id}`);
  if (ledger.verifications.some((v) => v.prediction_id === id)) fail(where, `${id} is already verified`);
  const verification = judge(prediction, readPrices(fields, where), now.toISOString(), where);
  return { ...ledger, verifications: [...ledger.verifications, verification] };
}

// Up means the end price is strictly above the start price; anything else, unchanged included, is down.
export function classifyMove(priceStart: number, priceEnd: number): Direction {
  return priceEnd > priceStart ? 'up' : 'down';
}

// Predictions whose verify date has passed but which have no verification yet.
// Every one of them gets verified, misses included.
export function dueForVerification(ledger: Ledger, now: Date = new Date()): readonly Prediction[] {
  const verified = new Set(ledger.verifications.map((v) => v.prediction_id));
  const at = now.toISOString();
  return ledger.predictions.filter((p) => !verified.has(p.id) && p.verify_date <= at);
}

export function getStats(ledger: Ledger): Readonly<Record<Model, ModelStats>> {
  const verdicts = new Map(ledger.verifications.map((v) => [v.prediction_id, v]));
  const entries = MODELS.map((model) => [
    model,
    statsFor(ledger.predictions.filter((p) => p.model === model), verdicts),
  ]);
  return Object.fromEntries(entries) as Record<Model, ModelStats>;
}

export function buildResults(ledger: Ledger, now: Date = new Date()): Results {
  return { schema_version: SCHEMA_VERSION, updated_at: now.toISOString(), models: getStats(ledger) };
}

export function parseLedger(value: unknown): Ledger {
  const fields = fieldsOf(value, 'ledger');
  if (fields.schema_version !== SCHEMA_VERSION) fail('ledger', `schema_version must be ${SCHEMA_VERSION}`);

  const predictions = list(fields, 'predictions').map(readPrediction);
  const sharedSlot = firstDuplicate(predictions.map(slotOf));
  if (sharedSlot) fail('ledger', `two predictions share one slot: ${sharedSlot}`);

  const byId = new Map(predictions.map((p) => [p.id, p]));
  const verifications = list(fields, 'verifications').map((v, i) => readVerification(v, i, byId));
  const twice = firstDuplicate(verifications.map((v) => v.prediction_id));
  if (twice) fail('ledger', `${twice} is verified twice`);

  return { schema_version: SCHEMA_VERSION, predictions, verifications };
}

export function assertAppendOnly(previous: Ledger, next: Ledger): void {
  if (!extendsList(previous.predictions, next.predictions)) {
    fail('ledger', 'existing predictions were changed or removed; the ledger is append-only');
  }
  if (!extendsList(previous.verifications, next.verifications)) {
    fail('ledger', 'existing verifications were changed or removed; the ledger is append-only');
  }
}

export function loadLedger(path: string): Ledger {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    throw new LedgerError(`Cannot read ledger ${path}: ${messageOf(error)}`, { cause: error });
  }
  return parseLedger(raw);
}

// Writes only a valid ledger that keeps every entry already on disk.
export function saveLedger(path: string, ledger: Ledger): void {
  const next = parseLedger(ledger);
  if (existsSync(path)) assertAppendOnly(loadLedger(path), next);
  writeJson(path, next);
}

export function saveResults(path: string, results: Results): void {
  writeJson(path, results);
}

type Fields = Readonly<Record<string, unknown>>;
type Prices = Pick<Verification, 'price_source' | 'price_start' | 'price_end'>;

function judge(prediction: Prediction, prices: Prices, verifiedAt: string, where: string): Verification {
  if (verifiedAt < prediction.verify_date) {
    fail(where, `${prediction.id} cannot be verified before ${prediction.verify_date}`);
  }
  const change_pct = round(((prices.price_end - prices.price_start) / prices.price_start) * 100);
  const outcome = classifyMove(prices.price_start, prices.price_end);
  return {
    prediction_id: prediction.id,
    verified_at: verifiedAt,
    ...prices,
    change_pct,
    outcome,
    hit: outcome === prediction.direction,
  };
}

function statsFor(predictions: readonly Prediction[], verdicts: ReadonlyMap<string, Verification>): ModelStats {
  const verified = predictions.filter((p) => verdicts.has(p.id));
  const hits = verified.filter((p) => verdicts.get(p.id)?.hit === true).length;
  const confidence = verified.reduce((sum, p) => sum + p.confidence, 0);
  return {
    predictions: predictions.length,
    verified: verified.length,
    pending: predictions.length - verified.length,
    hits,
    misses: verified.length - hits,
    hit_rate: verified.length > 0 ? round(hits / verified.length) : null,
    avg_confidence: verified.length > 0 ? round(confidence / verified.length) : null,
  };
}

function readForecast(fields: Fields, where: string): Omit<NewPrediction, 'verify_date'> {
  const prompt_hash = text(fields, 'prompt_hash', where);
  if (!PROMPT_HASH.test(prompt_hash)) fail(where, 'prompt_hash must be a lowercase sha256 hex string');
  return {
    model: choice(fields, 'model', MODELS, where),
    model_version: text(fields, 'model_version', where),
    direction: choice(fields, 'direction', DIRECTIONS, where),
    confidence: number(fields, 'confidence', where, 0, 100),
    reasoning: text(fields, 'reasoning', where),
    prompt_hash,
  };
}

function readPrediction(value: unknown, index: number): Prediction {
  const where = `predictions[${index}]`;
  const fields = fieldsOf(value, where);
  const id = text(fields, 'id', where);
  if (id !== formatId(index + 1)) fail(where, `id must be ${formatId(index + 1)}, got ${id}`);
  const prediction: Prediction = {
    id,
    date: timestamp(fields, 'date', where),
    ...readForecast(fields, where),
    verify_date: timestamp(fields, 'verify_date', where),
  };
  checkDates(prediction, where);
  return prediction;
}

// A stored verification must be exactly what verifyPrediction would compute from its prices.
function readVerification(value: unknown, index: number, predictions: ReadonlyMap<string, Prediction>): Verification {
  const where = `verifications[${index}]`;
  const fields = fieldsOf(value, where);
  const id = text(fields, 'prediction_id', where);
  const prediction = predictions.get(id);
  if (!prediction) fail(where, `there is no prediction ${id}`);
  const expected = judge(prediction, readPrices(fields, where), timestamp(fields, 'verified_at', where), where);
  if (fields.change_pct !== expected.change_pct || fields.outcome !== expected.outcome || fields.hit !== expected.hit) {
    fail(where, 'change_pct, outcome or hit do not match the prices');
  }
  return expected;
}

function readPrices(fields: Fields, where: string): Prices {
  return {
    price_source: text(fields, 'price_source', where),
    price_start: price(fields, 'price_start', where),
    price_end: price(fields, 'price_end', where),
  };
}

function checkDates(prediction: Prediction, where: string): void {
  if (prediction.verify_date <= prediction.date) {
    fail(where, `verify_date ${prediction.verify_date} must be after the recording time ${prediction.date}`);
  }
}

function extendsList(before: readonly object[], after: readonly object[]): boolean {
  return before.every((item, i) => {
    const kept = after[i];
    return kept !== undefined && canonical(item) === canonical(kept);
  });
}

// Records are flat, so sorting the top-level keys is enough to ignore key order.
function canonical(record: object): string {
  return JSON.stringify(record, Object.keys(record).sort());
}

function writeJson(path: string, data: unknown): void {
  const temp = `${path}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    renameSync(temp, path);
  } catch (error) {
    throw new LedgerError(`Cannot write ${path}: ${messageOf(error)}`, { cause: error });
  }
}

function fieldsOf(value: unknown, where: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(where, 'expected an object');
  return value as Fields;
}

function list(fields: Fields, key: string): readonly unknown[] {
  const value = fields[key];
  if (!Array.isArray(value)) fail('ledger', `${key} must be an array`);
  return value;
}

function text(fields: Fields, key: string, where: string): string {
  const value = fields[key];
  if (typeof value !== 'string' || value.trim() === '') fail(where, `${key} must be a non-empty string`);
  return value;
}

function choice<T extends string>(fields: Fields, key: string, allowed: readonly T[], where: string): T {
  const value = fields[key];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(where, `${key} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function number(fields: Fields, key: string, where: string, min: number, max: number): number {
  const value = fields[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(where, `${key} must be a number from ${min} to ${max}`);
  }
  return value;
}

function price(fields: Fields, key: string, where: string): number {
  const value = fields[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) fail(where, `${key} must be a positive number`);
  return value;
}

// Input dates: a calendar date (read as UTC midnight) or a date-time with an explicit zone.
function isoDate(fields: Fields, key: string, where: string): string {
  const value = fields[key];
  if (typeof value !== 'string' || !ISO_DATE.test(value) || !isCalendarDay(value) || Number.isNaN(Date.parse(value))) {
    fail(where, `${key} must be an ISO 8601 date such as 2026-11-02 or 2026-11-02T21:00:00Z`);
  }
  return new Date(value).toISOString();
}

// Date.parse rolls impossible days over (2026-02-30 becomes March 2), so check the day exists.
function isCalendarDay(value: string): boolean {
  const day = value.slice(0, 10);
  const midnight = Date.parse(`${day}T00:00:00Z`);
  return !Number.isNaN(midnight) && new Date(midnight).toISOString().startsWith(day);
}

// Stored dates are kept in the exact form toISOString() writes, so the file never gets rewritten.
function timestamp(fields: Fields, key: string, where: string): string {
  const value = isoDate(fields, key, where);
  if (value !== fields[key]) fail(where, `${key} must be stored as ${value}`);
  return value;
}

function slotOf(prediction: Pick<Prediction, 'model' | 'verify_date'>): string {
  return `${prediction.model} ${prediction.verify_date}`;
}

function firstDuplicate(keys: readonly string[]): string | undefined {
  return keys.find((key, i) => keys.indexOf(key) !== i);
}

function formatId(n: number): string {
  return `P${String(n).padStart(4, '0')}`;
}

function round(value: number): number {
  const scale = 10 ** DECIMALS;
  return Math.round(value * scale) / scale;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fail(where: string, problem: string): never {
  throw new LedgerError(`${where}: ${problem}`);
}
