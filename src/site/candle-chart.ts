// BTC in candles for the weekly charts: one candle per time step, drawn as inline SVG with the price scale beside it.
// A candle that rose is hollow and one that fell is filled, so the two differ by shape as well as color.
// Time runs left to right at an even pace, so a step with no trades shows as a gap.

import type { Candle, PriceSeries } from '../candles.ts';
import { callArrows, fanRoom } from './candle-calls.ts';
import type { CandleCall, CallArrows, FanRoom, PlotPoint } from './candle-calls.ts';
import { escapeHtml } from './html.ts';
import { formatUtc } from './ledger-view.ts';

// The part of a series to draw: every candle that closes after `from` and no later than `until`, or `to` without it,
// on a time axis that runs on to `to`, in ms. `open` and `close` are where the week opens and closes, each a solid
// line named above the plot. `start` is the price the week opens at, a dashed line from `open` on; with `calls` and
// no `start`, the last close drawn stands in. `end` is the end price, a dot at the right edge.
// `calls` are arrows from that price at the open, one per AI.
export interface CandleWindow {
  readonly from: number;
  readonly to: number;
  readonly until?: number;
  readonly open?: number;
  readonly close?: number;
  readonly start?: number;
  readonly end?: number;
  readonly calls?: readonly CandleCall[];
}

interface WeekMark {
  readonly kind: string;
  readonly name: string;
  readonly x: number;
}

export interface CandlePlot {
  readonly html: string;
  readonly note: string; // names the feed and the step, and says which candle shape is which
}

const MS_PER_SECOND = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WIDTH = 1000; // viewBox units across; the plot is stretched to fit
const HEIGHT = 100; // viewBox units down, so a y is also a percent of the plot height
const BODY_SHARE = 0.6; // of one step, the rest is the space between candles
const MIN_BODY = 0.8; // viewBox units, so a candle that opened and closed at one price still shows
const PAD_SHARE = 0.05; // of the price range, above and below, so no wick touches the edge
const MIN_RANGE_SHARE = 0.01; // of the price, so a week that hardly moved still gets a scale
const TICK_TARGET = 4; // about this many prices on the scale
const DENSE_DAYS = 8; // more day labels than this run together in a narrow chart, so every other one drops there
const NICE_STEPS = [1, 2, 5, 10];
const STEP_UNITS: readonly (readonly [seconds: number, name: string])[] = [
  [86400, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
  [1, 'second'],
];

const PRICE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TICK = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

// Nothing to draw without a series, or when no candle falls in the window.
export function candlePlot(series: PriceSeries | undefined, window: CandleWindow): CandlePlot | undefined {
  if (series === undefined) return undefined;
  const stepMs = series.granularity_seconds * MS_PER_SECOND;
  const candles = series.candles.filter((c) => {
    const closes = Date.parse(c.time) + stepMs;
    return closes > window.from && closes <= (window.until ?? window.to);
  });
  const [first] = candles;
  if (first === undefined) return undefined;

  const step = stepName(series.granularity_seconds);
  const note = `Candles: ${escapeHtml(series.source)}, ${step} (hollow: rose, filled: fell).`;
  return { html: plotHtml(candles, stepMs, step, Date.parse(first.time), window), note };
}

interface Scale {
  readonly x: (ms: number) => number;
  readonly y: (price: number) => number;
  readonly stepWidth: number;
}

function plotHtml(candles: readonly Candle[], stepMs: number, step: string, from: number, window: CandleWindow): string {
  const calls = window.calls ?? [];
  const level = window.start ?? (calls.length === 0 ? undefined : candles.at(-1)?.close);
  const [low, high] = priceRange(candles, window, level);
  const scale: Scale = {
    x: (ms) => round(((ms - from) / (window.to - from)) * WIDTH),
    y: (price) => round(((high - price) / (high - low)) * HEIGHT),
    stepWidth: (stepMs / (window.to - from)) * WIDTH,
  };
  const ticks = priceTicks(low, high);
  const until = window.until ?? window.to;
  const label = `BTC in ${step} candles, ${formatUtc(new Date(from).toISOString())} to ${formatUtc(new Date(until).toISOString())}`;
  const grid = ticks.map((t) => hLine('candles-grid', scale.y(t)));
  const origin = level === undefined ? undefined : { x: scale.x(window.open ?? from), y: scale.y(level) };
  const start = origin === undefined ? [] : [startLine(origin)];
  const arrows = origin === undefined || calls.length === 0 ? undefined : callArrows(calls, origin, WIDTH);
  const marks = weekMarks(window, scale);
  const axis = ticks.map((t) => `<span style="top: ${scale.y(t)}%">${TICK.format(t)}</span>`);
  return `<div class="candles">
      ${markNames(marks)}
      <span class="candles-axis" aria-hidden="true">${axis.join('')}</span>
      <svg class="candles-plot" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}">
        ${[...grid, ...start, ...candles.map((c) => candleMark(c, stepMs, scale)), ...marks.map((m) => vLine(m.kind, m.x)), ...(arrows?.lines ?? [])].join('\n        ')}
      </svg>
      ${overPlot(window.end === undefined ? undefined : scale.y(window.end), arrows)}
      ${arrows?.tips ?? ''}
      ${days(from, window.to, scale)}
    </div>`;
}

// Every candle, the start and end prices, and room for the calls to fan out from `level` without leaving the plot.
function priceRange(candles: readonly Candle[], window: CandleWindow, level: number | undefined): readonly [number, number] {
  const marked = [window.start, window.end].filter((price) => price !== undefined);
  const prices = [...candles.flatMap((c) => [c.low, c.high]), ...marked];
  const range = padded(Math.min(...prices), Math.max(...prices));
  const calls = window.calls ?? [];
  return level === undefined || calls.length === 0 ? range : withRoom(range, level, fanRoom(calls));
}

function candleMark(c: Candle, stepMs: number, scale: Scale): string {
  const left = scale.x(Date.parse(c.time));
  const mid = round(left + scale.stepWidth / 2);
  const bodyWidth = round(scale.stepWidth * BODY_SHARE);
  const top = scale.y(Math.max(c.open, c.close));
  const bodyHeight = round(Math.max(MIN_BODY, scale.y(Math.min(c.open, c.close)) - top));
  const title = `${formatUtc(c.time)}: open ${PRICE.format(c.open)}, high ${PRICE.format(c.high)}, low ${PRICE.format(c.low)}, close ${PRICE.format(c.close)}`;
  return `<g class="candle ${c.close < c.open ? 'down' : 'up'}"><title>${title}</title>` +
    `<rect class="hit" x="${left}" y="0" width="${round(scale.stepWidth)}" height="${HEIGHT}"/>` +
    `<line class="wick" x1="${mid}" y1="${scale.y(c.high)}" x2="${mid}" y2="${scale.y(c.low)}" vector-effect="non-scaling-stroke"/>` +
    `<rect class="body" x="${round(mid - bodyWidth / 2)}" y="${top}" width="${bodyWidth}" height="${bodyHeight}" vector-effect="non-scaling-stroke"/></g>`;
}

function hLine(kind: string, y: number): string {
  return `<line class="${kind}" x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" vector-effect="non-scaling-stroke"/>`;
}

// The price the week opens at, dashed, from where it opens to the right edge.
function startLine({ x, y }: PlotPoint): string {
  return `<line class="candles-start" x1="${x}" y1="${y}" x2="${WIDTH}" y2="${y}" vector-effect="non-scaling-stroke"/>`;
}

function vLine(kind: string, x: number): string {
  return `<line class="${kind}" x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" vector-effect="non-scaling-stroke"/>`;
}

function weekMarks(window: CandleWindow, scale: Scale): readonly WeekMark[] {
  const marks = [
    { kind: 'candles-open', name: 'Week opens', at: window.open },
    { kind: 'candles-close', name: 'Week closes', at: window.close },
  ];
  return marks.flatMap(({ kind, name, at }) => (at === undefined ? [] : [{ kind, name, x: scale.x(at) }]));
}

// Each name ends at its line, above the plot; a line at the right edge has its name above the calls instead.
function markNames(marks: readonly WeekMark[]): string {
  const inside = marks.filter((m) => m.x < WIDTH).map((m) => `<span style="left: ${percentAcross(m.x)}%">${m.name}</span>`);
  const edge = marks.filter((m) => m.x >= WIDTH).map((m) => m.name);
  return [
    inside.length === 0 ? '' : `<p class="candles-marks" aria-hidden="true">${inside.join('')}</p>`,
    edge.length === 0 ? '' : `<span class="candles-edge" aria-hidden="true">${edge.join(' · ')}</span>`,
  ].join('');
}

// A layer the size of the plot for what the stretched svg would distort: the arrow heads, and the end price, a dot
// on the right edge over the line that closes the week, after the heads so it paints over any it meets.
function overPlot(end: number | undefined, arrows: CallArrows | undefined): string {
  const dot = end === undefined ? '' : `<span class="candles-end" style="top: ${end}%"></span>`;
  const heads = arrows?.heads ?? '';
  return dot === '' && heads === '' ? '' : `<span class="candles-over" aria-hidden="true">${heads}${dot}</span>`;
}

// One label per UTC day, at noon: the month with the first day and wherever it changes, in a span of its own
// for a narrow chart to set under the day. With many days,
// every other day counted from the last month name, and the day just before a month name, is marked
// minor, for the stylesheet to drop in a narrow chart.
function days(from: number, to: number, scale: Scale): string {
  const firstDay = Math.floor(from / DAY_MS) * DAY_MS;
  const noons = Array.from({ length: Math.ceil((to - firstDay) / DAY_MS) }, (_, i) => firstDay + i * DAY_MS + DAY_MS / 2)
    .filter((noon) => noon >= from && noon <= to);
  const dates = noons.map((noon) => new Date(noon));
  const isNewMonth = dates.map((date, i) => i === 0 || date.getUTCDate() === 1);
  const isDense = dates.length > DENSE_DAYS;
  const labels = dates.map((date, i) => {
    const sinceMonth = i - isNewMonth.lastIndexOf(true, i);
    const isMinor = isDense && !isNewMonth[i] && (sinceMonth % 2 === 1 || isNewMonth[i + 1] === true);
    const text = isNewMonth[i] ? `${date.getUTCDate()}<span class="candles-month"> ${MONTH.format(date)}</span>` : date.getUTCDate();
    return `<span${isMinor ? ' class="minor"' : ''} style="left: ${percentAcross(scale.x(date.getTime()))}%">${text}</span>`;
  });
  return `<p class="candles-days" aria-hidden="true">${labels.join('')}</p>`;
}

function padded(low: number, high: number): readonly [number, number] {
  const mid = (low + high) / 2;
  const half = (Math.max(high - low, mid * MIN_RANGE_SHARE) / 2) * (1 + 2 * PAD_SHARE);
  return [mid - half, mid + half];
}

// Widens a range, never narrows it, so `level` sits at least `above` percent of the height under the top and
// `below` percent over the bottom. The two add up to well under 100, so only one side can fall short.
function withRoom([low, high]: readonly [number, number], level: number, { above, below }: FanRoom): readonly [number, number] {
  const [upShare, downShare] = [above / HEIGHT, below / HEIGHT];
  const [up, down] = [high - level, level - low];
  const span = Math.max(up + down, down / (1 - upShare), up / (1 - downShare));
  return [level - Math.max(down, downShare * span), level + Math.max(up, upShare * span)];
}

// Round prices on a 1, 2 or 5 step, about TICK_TARGET of them between low and high.
function priceTicks(low: number, high: number): readonly number[] {
  const raw = (high - low) / TICK_TARGET;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const nice = NICE_STEPS.find((n) => n * magnitude >= raw) ?? 10;
  const step = nice * magnitude;
  const first = Math.ceil(low / step);
  return Array.from({ length: Math.floor(high / step) - first + 1 }, (_, i) => (first + i) * step);
}

function stepName(seconds: number): string {
  const [unit, name] = STEP_UNITS.find(([size]) => seconds % size === 0) ?? [1, 'second'];
  return `${seconds / unit}-${name}`;
}

function percentAcross(x: number): number {
  return round((x / WIDTH) * 100);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
