import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { PriceSeries } from '../candles.ts';
import { emptyLedger } from '../ledger.ts';
import { renderChart } from './charts.ts';
import { isStoryKind, renderStoryChart } from './story-charts.ts';

const STEP_MS = 4 * 60 * 60 * 1000;
const FIRST_CANDLE = Date.parse('2026-10-27T00:00:00Z');
const CANDLE_COUNT = 34; // to 2026-11-01 08:00, past the two days after the event
const EVENT = '2026-10-29T20:00:00Z';
// A lower low before the event, the low after it, and an even lower one past the two days the chart shows.
const LOWS: Readonly<Record<string, number>> = {
  '2026-10-28T08:00:00.000Z': 70000,
  '2026-10-30T08:00:00.000Z': 76000,
  '2026-11-01T00:00:00.000Z': 60000,
};

function marketPrices(): PriceSeries {
  const candles = Array.from({ length: CANDLE_COUNT }, (_, i) => {
    const time = new Date(FIRST_CANDLE + i * STEP_MS).toISOString();
    return { time, open: 80000, high: 80400, low: LOWS[time] ?? 79800, close: 80000 };
  });
  return { source: 'Test <Feed>', granularity_seconds: STEP_MS / 1000, candles };
}

function story(spec: string): string {
  return renderStoryChart(spec, { btc: marketPrices() });
}

// The piece of a chart that belongs to one row: from its <li to the next.
function rowOf(html: string, text: string): string {
  const row = html.split('<li').find((piece) => piece.includes(text));
  assert.ok(row, `no row with ${text}`);
  return row;
}

function chartError(message: RegExp): { name: string; message: RegExp } {
  return { name: 'ChartError', message };
}

describe('isStoryKind', () => {
  test('knows the story charts and nothing else', () => {
    for (const kind of ['stats', 'chains', 'timeline', 'split', 'analysts', 'wallets', 'market']) assert.ok(isStoryKind(kind), kind);
    for (const kind of ['score', 'calls', 'Stats', '']) assert.ok(!isStoryKind(kind), kind);
  });
});

describe('stats', () => {
  test('draws a tile per row with its shape, tone, number and label', () => {
    const html = story('stats The hack in numbers\nhex | btc | $6.36B | stolen, <according> to analysts\ncircle | hit | 44% | frozen');

    assert.match(html, /<figure class="chart stats">\s*<figcaption>The hack in numbers<\/figcaption>/);
    assert.match(rowOf(html, '$6.36B'), /class="stat tone-btc"><svg class="stat-shape" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 21,7/);
    assert.match(rowOf(html, '$6.36B'), /<span class="stat-label">stolen, &lt;according&gt; to analysts<\/span>/);
    assert.match(rowOf(html, '44%'), /class="stat tone-hit"><svg [^>]+><circle /);
  });

  test('names the shapes and tones it knows when a row uses another', () => {
    assert.throws(() => story('stats Numbers\nstar | hit | 1 | one'), chartError(/no shape "star"; use hex, circle, triangle, square, diamond/));
    assert.throws(() => story('stats Numbers\nhex | red | 1 | one'), chartError(/no tone "red"; use accent, hit, miss, btc, muted/));
  });
});

describe('chains', () => {
  test('draws each bar as long as its share of the largest, with the amount in dollars beside it', () => {
    const html = story('chains Stolen by chain\nEthereum | 3790 | 200,630 ETH\nBitcoin | 1470 | 18,270 BTC\nTron | 628 | USDT & TRX\nnote: At prices <then>.');

    assert.match(rowOf(html, 'Ethereum'), /style="width: 100%".*<span class="chain-value">\$3\.79B<\/span>/);
    assert.match(rowOf(html, 'Bitcoin'), /style="width: 38\.79%".*\$1\.47B/);
    assert.match(rowOf(html, 'Tron'), /\$628M<\/span><span class="chain-detail">USDT &amp; TRX</);
    assert.match(html, /<p class="chart-note">At prices &lt;then&gt;\.<\/p>/);
  });

  test('needs amounts that are numbers of zero or more', () => {
    assert.throws(() => story('chains Stolen\nEthereum | lots | ETH'), chartError(/amounts in millions of US dollars, got "lots"/));
    assert.throws(() => story('chains Stolen\nEthereum | -5 | ETH'), chartError(/got "-5"/));
  });
});

describe('timeline', () => {
  test('lists the events in order, each with its time, tone and words', () => {
    const html = story('timeline What happened\nOct 29, 20:20 | miss | 18,270 BTC sent | in <one> transaction\nOct 29, 21:01 | hit | Tether freezes | first freeze');

    assert.match(html, /<ol class="timeline-list">/);
    assert.ok(html.indexOf('18,270 BTC sent') < html.indexOf('Tether freezes'));
    assert.match(rowOf(html, 'Tether'), /class="tone-hit"><span class="timeline-when">Oct 29, 21:01<\/span><span class="timeline-mark" aria-hidden="true">/);
    assert.match(rowOf(html, '18,270'), /<strong>18,270 BTC sent<\/strong> <span>in &lt;one&gt; transaction<\/span>/);
  });
});

describe('split', () => {
  test('cuts one bar into the parts and names each with its amount and share of the whole', () => {
    const html = story('split Frozen or not\nFrozen | 2850 | hit\nNot frozen | 3580 | miss');

    assert.match(html, /<p class="chart-status">In all: \$6\.43B<\/p>/);
    assert.match(html, /<div class="split-bar" aria-hidden="true"><span class="tone-hit" style="flex-grow: 2850"><\/span><span class="tone-miss" style="flex-grow: 3580">/);
    assert.match(rowOf(html, 'Frozen<'), /\$2\.85B<\/strong><span class="split-share">44%<\/span>/);
    assert.match(rowOf(html, 'Not frozen'), /\$3\.58B<\/strong><span class="split-share">56%<\/span>/);
  });

  test('needs something to split', () => {
    assert.throws(() => story('split Nothing\nFrozen | 0 | hit'), chartError(/at least one amount above zero/));
  });
});

describe('analysts', () => {
  test('links each firm to its report', () => {
    const html = story('analysts What the analysts found\nTRM Labs | https://www.trmlabs.com/blog?a=1&b=2 | $6.36B | ten <chains>');

    assert.match(html, /<a class="analyst-name" href="https:\/\/www\.trmlabs\.com\/blog\?a=1&amp;b=2">TRM Labs<\/a><span class="analyst-total">\$6\.36B<\/span>/);
    assert.match(html, /<p class="analyst-finding">ten &lt;chains&gt;<\/p>/);
  });

  test('takes only https links', () => {
    assert.throws(() => story('analysts Firms\nTRM | http://trmlabs.com | 1 | one'), chartError(/needs an https link, got "http:\/\/trmlabs.com"/));
    assert.throws(() => story('analysts Firms\nTRM | javascript:alert(1) | 1 | one'), chartError(/https link/));
    assert.throws(() => story('analysts Firms\nTRM | trmlabs.com | 1 | one'), chartError(/https link/));
  });
});

describe('wallets', () => {
  const ADDRESS = '0x28C6c06298d514Db089934071355E5743bf21d60';

  test('shows each address whole, linked to the explorer', () => {
    const html = story(`wallets Where the ether went\nBinance 14 | ${ADDRESS} | victim | sent <all>`);

    assert.match(html, /<ol class="wallet-list">/);
    assert.match(html, new RegExp(`<a class="wallet-address" href="https://etherscan.io/address/${ADDRESS}">${ADDRESS}</a>`));
    assert.match(html, /<strong>Binance 14<\/strong> <span class="wallet-role">victim<\/span>/);
    assert.match(html, /<p class="wallet-detail">sent &lt;all&gt;<\/p>/);
  });

  test('takes only an Ethereum address', () => {
    assert.throws(() => story('wallets Wallets\nShort | 0x28C6 | victim | x'), chartError(/0x and 40 hex digits, got "0x28C6"/));
    assert.throws(() => story(`wallets Wallets\nOdd | ${ADDRESS.replace('0x', '0y')} | victim | x`), chartError(/40 hex digits/));
  });
});

describe('market', () => {
  test('finds the lowest price in the two days after the event and how far it fell from the open', () => {
    const html = story(`market btc ${EVENT} Bitcoin around the hack\nHack`);

    assert.match(html, /<figure class="chart market">\s*<figcaption>Bitcoin around the hack<\/figcaption>/);
    assert.match(html, /BTC at its lowest after the hack: <strong>\$76,000\.00<\/strong> in the candle from 2026-10-30 08:00 UTC, <strong>−5\.00%<\/strong> from \$80,000\.00, where the hack candle opened/);
    assert.match(html, /aria-label="BTC/);
    assert.match(html, /<line class="candles-event" x1="[\d.]+"/);
    assert.match(html, /<line class="candles-low" x1="0"/);
    assert.match(html, /<p class="chart-note">Candles: Test &lt;Feed&gt;, 4-hour .*The solid line marks the hack, the dashed line the lowest price after it\.<\/p>/);
  });

  test('escapes the name of the event', () => {
    const html = story(`market btc ${EVENT} Around it\n<b>Hack</b>`);

    assert.match(html, /<span style="left: [\d.]+%">&lt;b&gt;Hack&lt;\/b&gt;<\/span>/);
    assert.doesNotMatch(html, /<b>Hack/);
  });

  test('needs a price series for the coin, the start of one of its candles, and one row', () => {
    assert.throws(() => story(`market eth ${EVENT} Ether\nHack`), chartError(/no price series for "eth"/));
    assert.throws(() => story('market btc 2026-10-29T21:00:00Z Bitcoin\nHack'), chartError(/the time a btc candle starts, like: market btc 2026-10-29T20:00:00Z/));
    assert.throws(() => story(`market btc ${EVENT} Bitcoin\nHack\nFreeze`), chartError(/takes one row: the name of the event/));
  });

  test('is drawn from the Bitcoin series when the article asks renderChart for it', () => {
    const html = renderChart(`market btc ${EVENT} Bitcoin\nHack`, emptyLedger(), marketPrices());

    assert.match(html, /<figure class="chart market">/);
  });
});

describe('every story chart', () => {
  test('needs a caption and at least one row', () => {
    assert.throws(() => story('chains\nEthereum | 1 | ETH'), chartError(/chart "chains" needs a caption on its first line/));
    assert.throws(() => story(`market btc ${EVENT}\nHack`), chartError(/chart "market" needs a caption/));
    assert.throws(() => story('chains Stolen\nnote: only a note'), chartError(/at least one row on the lines below its name/));
  });

  test('needs each row to have all its fields, none of them empty', () => {
    assert.throws(() => story('chains Stolen\nEthereum | 1'), chartError(/each row of chart "chains" needs 3 fields split by "\|", got "Ethereum \| 1"/));
    assert.throws(() => story('chains Stolen\nEthereum | 1 | ETH | more'), chartError(/needs 3 fields/));
    assert.throws(() => story('chains Stolen\nEthereum |  | ETH'), chartError(/needs 3 fields/));
  });

  test('is reached through renderChart like any other chart', () => {
    const html = renderChart('chains Stolen\nEthereum | 1 | ETH', emptyLedger(), undefined, {});

    assert.match(html, /<figure class="chart chains">/);
  });
});
