// The figures a news article draws for itself. Their numbers come from the chart block, not from the ledger, so each
// one sits in the article next to the source it is taken from.
//
// The first line names the chart and gives its caption. Each line after it is one row, its fields split by "|",
// and a line that starts with "note:" is the note under the chart:
//
//   ```chart
//   chains Stolen by chain, according to TRM Labs
//   Ethereum | 3790 | 200,630 ETH and 185 tokens
//   note: At prices on the day of the hack.
//   ```
//
//   stats <caption>                  shape | tone | value | label        a big number beside a shape, per row
//   chains <caption>                 name | $M | detail                  a bar per chain, as long as its amount
//   counts <caption>                 name | count | detail               the same bars, for whole numbers of things
//   dots <caption>                   name | number | shown | detail      a dot per row, between the lowest and highest
//   timeline <caption>               when | tone | what | detail         events top to bottom, each on a diamond
//   split <caption>                  label | $M | tone                   one bar cut into the parts of a whole
//   analysts <caption>               name | https link | total | finding    a card per firm, linked to its report
//   wallets <caption>                name | address | role | detail      Ethereum wallets in the order money moved
//   market <coin> <time> <caption>   the event's name, on one row        candles two days either side of the event
//
// Shapes are hex, circle, triangle, square and diamond; tones are accent, hit, miss, btc and muted. Amounts are in
// millions of US dollars. Every mark has its word or number beside it, so nothing depends on color or shape alone.

import type { Candle, PriceSeries } from '../candles.ts';
import { candlePlot } from './candle-chart.ts';
import { ChartError, figure } from './chart-figure.ts';
import { escapeHtml } from './html.ts';
import { formatChange, formatUtc } from './ledger-view.ts';

// Price series by coin, keyed in lower case, like btc.
export type Markets = Readonly<Record<string, PriceSeries | undefined>>;

const STORY_KINDS = ['stats', 'chains', 'counts', 'dots', 'timeline', 'split', 'analysts', 'wallets', 'market'] as const;
type StoryKind = (typeof STORY_KINDS)[number];

interface Story {
  readonly kind: StoryKind;
  readonly args: readonly string[]; // the words after the name on the first line
  readonly rows: readonly string[];
  readonly note: string; // escaped, or empty without a note
}

interface Part {
  readonly label: string;
  readonly millions: number;
  readonly tone: string;
}

interface Market {
  readonly coin: string; // as the chart block names it, upper case
  readonly series: PriceSeries;
  readonly event: Candle; // the candle the event happened in
  readonly name: string; // escaped
}

const NOTE = 'note:';
const SHAPES: Readonly<Record<string, string>> = {
  hex: '<polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  triangle: '<polygon points="12,3 22,20 2,20"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  diamond: '<polygon points="12,2 22,12 12,22 2,12"/>',
};
const TONES: readonly string[] = ['accent', 'hit', 'miss', 'btc', 'muted'];
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const WHOLE = /^\d+$/;
const EXPLORER = 'https://etherscan.io/address/';
const EXAMPLE_TIME = '2026-10-29T20:00:00Z';
const MS_PER_SECOND = 1000;
const SPAN_MS = 2 * 24 * 60 * 60 * 1000; // candles this long either side of the event
const MILLIONS_PER_BILLION = 1000;
const BILLIONS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const MILLIONS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const PRICE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COUNT = new Intl.NumberFormat('en-US');

export function isStoryKind(kind: string): kind is StoryKind {
  return (STORY_KINDS as readonly string[]).includes(kind);
}

export function renderStoryChart(spec: string, markets: Markets): string {
  const story = readStory(spec);
  switch (story.kind) {
    case 'stats':
      return renderStats(story);
    case 'chains':
      return renderBars(story, (text) => amount(story.kind, text), usd);
    case 'counts':
      return renderBars(story, (text) => count(story.kind, text), (n) => COUNT.format(n));
    case 'dots':
      return renderDots(story);
    case 'timeline':
      return renderTimeline(story);
    case 'split':
      return renderSplit(story);
    case 'analysts':
      return renderAnalysts(story);
    case 'wallets':
      return renderWallets(story);
    case 'market':
      return renderMarket(story, markets);
  }
}

function renderStats(story: Story): string {
  const tiles = story.rows.map((row) => {
    const [shape = '', toneName = '', value = '', label = ''] = fields(story.kind, row, 4);
    const glyph = SHAPES[shape];
    if (glyph === undefined) throw new ChartError(`chart "stats" has no shape "${shape}"; use ${Object.keys(SHAPES).join(', ')}`);
    return `<li class="stat tone-${toneOf(story.kind, toneName)}"><svg class="stat-shape" viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg>` +
      `<span class="stat-value">${escapeHtml(value)}</span><span class="stat-label">${escapeHtml(label)}</span></li>`;
  });
  return figure('stats', captionOf(story), `${list('ul', 'stat-list', tiles)}${noteOf(story)}`);
}

// One color for every bar: they all measure the same thing, and the name beside each says which row it is.
function renderBars(story: Story, read: (text: string) => number, show: (value: number) => string): string {
  const rows = story.rows.map((row) => {
    const [name = '', value = '', detail = ''] = fields(story.kind, row, 3);
    return { name, value: read(value), detail };
  });
  const most = Math.max(...rows.map((r) => r.value));
  const bars = rows.map(
    (r) => `<li><span class="chain-name">${escapeHtml(r.name)}</span>` +
      `<span class="chain-track" aria-hidden="true"><span class="chain-fill" style="width: ${share(r.value, most)}%"></span></span>` +
      `<span class="chain-value">${show(r.value)}</span><span class="chain-detail">${escapeHtml(r.detail)}</span></li>`,
  );
  return figure(story.kind, captionOf(story), `${list('ul', 'chain-list', bars)}${noteOf(story)}`);
}

// Where each number sits between the lowest and the highest. The line does not start at zero, and the chart says so,
// because numbers this close together would make bars of the same length.
function renderDots(story: Story): string {
  const rows = story.rows.map((row) => {
    const [name = '', value = '', shown = '', detail = ''] = fields(story.kind, row, 4);
    return { name, value: numberIn(story.kind, value), shown, detail };
  });
  const low = rows.reduce((a, b) => (b.value < a.value ? b : a));
  const high = rows.reduce((a, b) => (b.value > a.value ? b : a));
  const span = high.value - low.value;
  const marks = rows.map(
    (r) => `<li><span class="dots-name">${escapeHtml(r.name)}</span>` +
      `<span class="dots-track" aria-hidden="true"><span class="dots-mark" style="left: ${span === 0 ? 50 : share(r.value - low.value, span)}%"></span></span>` +
      `<span class="dots-value">${escapeHtml(r.shown)}</span><span class="dots-detail">${escapeHtml(r.detail)}</span></li>`,
  );
  const range = `<p class="chart-status">The line runs from the lowest to the highest, not from zero: ${escapeHtml(low.shown)} to ${escapeHtml(high.shown)}</p>`;
  return figure('dots', captionOf(story), `${range}\n  ${list('ul', 'dots-list', marks)}${noteOf(story)}`);
}

function renderTimeline(story: Story): string {
  const events = story.rows.map((row) => {
    const [when = '', toneName = '', what = '', detail = ''] = fields(story.kind, row, 4);
    return `<li class="tone-${toneOf(story.kind, toneName)}"><span class="timeline-when">${escapeHtml(when)}</span>` +
      `<span class="timeline-mark" aria-hidden="true"></span>` +
      `<p class="timeline-what"><strong>${escapeHtml(what)}</strong> <span>${escapeHtml(detail)}</span></p></li>`;
  });
  return figure('timeline', captionOf(story), `${list('ol', 'timeline-list', events)}${noteOf(story)}`);
}

// The bar only repeats the legend, which names each part with its amount and share, so it is hidden from screen readers.
function renderSplit(story: Story): string {
  const parts: readonly Part[] = story.rows.map((row) => {
    const [label = '', millions = '', toneName = ''] = fields(story.kind, row, 3);
    return { label, millions: amount(story.kind, millions), tone: toneOf(story.kind, toneName) };
  });
  const whole = parts.reduce((sum, p) => sum + p.millions, 0);
  if (whole === 0) throw new ChartError('chart "split" needs at least one amount above zero');
  const bar = parts.map((p) => `<span class="tone-${p.tone}" style="flex-grow: ${p.millions}"></span>`);
  const legend = parts.map(
    (p) => `<li class="tone-${p.tone}"><span class="split-key" aria-hidden="true"></span><span class="split-label">${escapeHtml(p.label)}</span>` +
      `<strong>${usd(p.millions)}</strong><span class="split-share">${Math.round(share(p.millions, whole))}%</span></li>`,
  );
  return figure('split', captionOf(story), `<p class="chart-status">In all: ${usd(whole)}</p>
  <div class="split-bar" aria-hidden="true">${bar.join('')}</div>
  ${list('ul', 'split-legend', legend)}${noteOf(story)}`);
}

function renderAnalysts(story: Story): string {
  const cards = story.rows.map((row) => {
    const [name = '', link = '', total = '', finding = ''] = fields(story.kind, row, 4);
    return `<li class="analyst"><a class="analyst-name" href="${httpsLink(story.kind, link)}">${escapeHtml(name)}</a>` +
      `<span class="analyst-total">${escapeHtml(total)}</span><p class="analyst-finding">${escapeHtml(finding)}</p></li>`;
  });
  return figure('analysts', captionOf(story), `${list('ul', 'analyst-list', cards)}${noteOf(story)}`);
}

// The address is shown whole, never cut short, so a reader can check it letter by letter on the explorer.
function renderWallets(story: Story): string {
  const cards = story.rows.map((row) => {
    const [name = '', address = '', role = '', detail = ''] = fields(story.kind, row, 4);
    if (!ADDRESS.test(address)) throw new ChartError(`chart "wallets" needs an address of 0x and 40 hex digits, got "${address}"`);
    return `<li class="wallet"><p class="wallet-head"><strong>${escapeHtml(name)}</strong> <span class="wallet-role">${escapeHtml(role)}</span></p>` +
      `<a class="wallet-address" href="${EXPLORER}${address}">${address}</a><p class="wallet-detail">${escapeHtml(detail)}</p></li>`;
  });
  return figure('wallets', captionOf(story), `${list('ol', 'wallet-list', cards)}${noteOf(story)}`);
}

// The coin from two days before the event to two days after, or to its last candle if that comes first, with the
// lowest price from the event on and how far that is below where the event's candle opened.
function renderMarket(story: Story, markets: Markets): string {
  const { coin, series, event, name } = readMarket(story, markets);
  const stepMs = series.granularity_seconds * MS_PER_SECOND;
  const at = Date.parse(event.time);
  const last = series.candles.at(-1) ?? event;
  const to = Math.min(at + SPAN_MS, Date.parse(last.time) + stepMs);
  const lowest = series.candles
    .filter((c) => Date.parse(c.time) >= at && Date.parse(c.time) + stepMs <= to)
    .reduce((low, c) => (c.low < low.low ? c : low), event);
  const plot = candlePlot(series, { from: at - SPAN_MS, to, label: coin, marks: [{ kind: 'candles-event', name, at }], low: lowest.low });
  if (plot === undefined) throw new ChartError(`no ${coin} candles around ${formatUtc(event.time)}`);
  const what = name.toLowerCase();
  const change = formatChange(((lowest.low - event.open) / event.open) * 100);
  return figure('market', captionOf(story, 2), `<p class="chart-status">${coin} at its lowest after the ${what}: <strong>$${PRICE.format(lowest.low)}</strong> ` +
    `in the candle from ${formatUtc(lowest.time)}, <strong>${change}</strong> from $${PRICE.format(event.open)}, where the ${what} candle opened</p>
  ${plot.html}
  <p class="chart-note">${plot.note} The solid line marks the ${what}, the dashed line the lowest price after it.${story.note === '' ? '' : ` ${story.note}`}</p>`);
}

function readMarket(story: Story, markets: Markets): Market {
  const [coin = '', time = ''] = story.args;
  const series = markets[coin.toLowerCase()];
  if (series === undefined) throw new ChartError(`chart "market" has no price series for "${coin}"`);
  const at = Date.parse(time);
  const event = series.candles.find((c) => Date.parse(c.time) === at);
  if (event === undefined) throw new ChartError(`chart "market" needs the time a ${coin} candle starts, like: market ${coin} ${EXAMPLE_TIME}`);
  const [name = '', ...extra] = story.rows;
  if (extra.length > 0) throw new ChartError('chart "market" takes one row: the name of the event');
  return { coin: escapeHtml(coin.toUpperCase()), series, event, name: escapeHtml(name) };
}

function readStory(spec: string): Story {
  const [head = '', ...lines] = spec.trim().split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const [kind = '', ...args] = head.split(/\s+/);
  if (!isStoryKind(kind)) throw new ChartError(`unknown story chart "${kind}"`);
  const rows = lines.filter((line) => !line.startsWith(NOTE));
  if (rows.length === 0) throw new ChartError(`chart "${kind}" needs at least one row on the lines below its name`);
  const note = lines.filter((line) => line.startsWith(NOTE)).map((line) => escapeHtml(line.slice(NOTE.length).trim()));
  return { kind, args, rows, note: note.join(' ') };
}

// The words on the first line after the chart's name, and for a market chart after the coin and the time too.
function captionOf(story: Story, skip = 0): string {
  const caption = story.args.slice(skip).join(' ');
  if (caption === '') throw new ChartError(`chart "${story.kind}" needs a caption on its first line`);
  return escapeHtml(caption);
}

function noteOf(story: Story): string {
  return story.note === '' ? '' : `\n  <p class="chart-note">${story.note}</p>`;
}

function fields(kind: string, row: string, count: number): readonly string[] {
  const parts = row.split('|').map((part) => part.trim());
  if (parts.length !== count || parts.includes('')) {
    throw new ChartError(`each row of chart "${kind}" needs ${count} fields split by "|", got "${row}"`);
  }
  return parts;
}

function amount(kind: string, text: string): number {
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) throw new ChartError(`chart "${kind}" needs amounts in millions of US dollars, got "${text}"`);
  return value;
}

function count(kind: string, text: string): number {
  if (!WHOLE.test(text)) throw new ChartError(`chart "${kind}" needs whole numbers of zero or more, got "${text}"`);
  return Number(text);
}

function numberIn(kind: string, text: string): number {
  const value = Number(text);
  if (!Number.isFinite(value)) throw new ChartError(`chart "${kind}" needs a number in the second field of each row, got "${text}"`);
  return value;
}

function toneOf(kind: string, text: string): string {
  if (!TONES.includes(text)) throw new ChartError(`chart "${kind}" has no tone "${text}"; use ${TONES.join(', ')}`);
  return text;
}

function httpsLink(kind: string, text: string): string {
  const url = URL.canParse(text) ? new URL(text) : undefined;
  if (url?.protocol !== 'https:') throw new ChartError(`chart "${kind}" needs an https link, got "${text}"`);
  return escapeHtml(url.href);
}

function usd(millions: number): string {
  return millions >= MILLIONS_PER_BILLION ? `$${BILLIONS.format(millions / MILLIONS_PER_BILLION)}B` : `$${MILLIONS.format(millions)}M`;
}

// In percent, to two decimals; nothing of nothing is none.
function share(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 10000) / 100;
}

function list(tag: 'ul' | 'ol', kind: string, items: readonly string[]): string {
  return `<${tag} class="${kind}">
    ${items.join('\n    ')}
  </${tag}>`;
}
