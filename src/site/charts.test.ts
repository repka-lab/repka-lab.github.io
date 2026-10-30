import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addPrediction, emptyLedger, verifyPrediction } from '../ledger.ts';
import { ChartError, renderChart, renderScoreChart } from './charts.ts';
import { NEXT_WEEK, sampleLedger, twoWeeks, WEEK, weekCalls, weekChecked, weekPrices, weekReviewed } from './test-fixtures.ts';

// The piece of a chart that belongs to one model: from its name to the next item.
function partOf(html: string, name: string): string {
  const part = html.split(/<li|<div class="bar-row/).find((piece) => piece.includes(`>${name}<`));
  assert.ok(part, `nothing for ${name}`);
  return part;
}

// One model's block in the factors chart, factor lists included.
function reasonOf(html: string, name: string): string {
  const part = html.split('<div class="reason ').find((piece) => piece.includes(`>${name}<`));
  assert.ok(part, `no reasons for ${name}`);
  return part;
}

// One model's block in the review chart.
function reviewOf(html: string, name: string): string {
  const part = html.split('<div class="review-model ').find((piece) => piece.includes(`>${name}<`));
  assert.ok(part, `no review for ${name}`);
  return part;
}

interface Arrow {
  readonly call: string; // "model direction"
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

// The call arrows over the candles, in the order they are drawn.
function arrowsOf(html: string): Arrow[] {
  return [...html.matchAll(/<line class="candles-arrow (\w+) (up|down)" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map(
    ([, model, direction, x1, y1, x2, y2]) => ({ call: `${model} ${direction}`, x1: Number(x1), y1: Number(y1), x2: Number(x2), y2: Number(y2) }),
  );
}

// Where the dashed price line starts, and where the line that opens the week stands.
function levelOf(html: string): { x: number; y: number; open: number } {
  const [, x, y] = html.match(/<line class="candles-start" x1="([\d.]+)" y1="([\d.]+)"/) ?? [];
  const [, open] = html.match(/<line class="candles-open" x1="([\d.]+)"/) ?? [];
  return { x: Number(x), y: Number(y), open: Number(open) };
}

// One arrow per call, in call order, from where the dashed line starts at the open to the right edge:
// Higher points up and Lower down, no two tips on one spot, each named at its tip with logo, name and sign.
function assertCallArrows(html: string): void {
  const level = levelOf(html);
  const arrows = arrowsOf(html);

  assert.ok(level.x > 0 && level.x === level.open, `the line starts at ${level.x}, the week opens at ${level.open}`);
  assert.deepEqual(arrows.map((a) => a.call), ['chatgpt up', 'claude up', 'gemini down', 'grok up']);
  for (const a of arrows) {
    assert.deepEqual([a.x1, a.y1, a.x2], [level.x, level.y, 1000], `${a.call} starts or ends off the line`);
    assert.ok(a.call.endsWith('up') ? a.y2 < level.y : a.y2 > level.y, `${a.call} points the wrong way`);
    assert.match(html, new RegExp(`<span class="candles-tip ${a.call}" style="--y: ${a.y2}">`), `${a.call} is not named at its tip`);
  }
  assert.equal(new Set(arrows.map((a) => a.y2)).size, arrows.length);
  for (const [name, key] of BADGES) {
    assert.match(html, new RegExp(`<span class="candles-tip ${key} \\w+"[^>]*><span class="badge ${key}" aria-hidden="true"></span>${name} `));
  }
  assert.match(html, /▲<\/span><span class="candles-word"> Higher</);
  assert.match(html, /▼<\/span><span class="candles-word"> Lower</);
  assert.doesNotMatch(html, /candles-calls|candles-ai/);
}

// Each model's name and the key its logo tile is styled by.
const BADGES = [
  ['ChatGPT', 'chatgpt'],
  ['Claude', 'claude'],
  ['Gemini', 'gemini'],
  ['Grok', 'grok'],
] as const;

// The factors on one side of a model's block.
function sideOf(reason: string, pulls: 'up' | 'down'): string {
  const side = reason
    .split('<ul class="pull ')
    .slice(1)
    .find((piece) => piece.startsWith(`${pulls}"`));
  assert.ok(side, `no ${pulls} side`);
  return side;
}

function chartError(message: RegExp): { name: string; message: RegExp } {
  return { name: 'ChartError', message };
}

describe('renderScoreChart', () => {
  test('draws one bar per model against the 50% coin-flip line', () => {
    const html = renderScoreChart(weekChecked());

    for (const name of ['ChatGPT', 'Claude', 'Gemini', 'Grok']) assert.match(partOf(html, name), /class="bar"/);
    assert.match(html, /50% · coin flip/);
  });

  test('labels each bar with the hit rate and the count behind it', () => {
    const html = renderScoreChart(weekChecked());

    assert.match(partOf(html, 'Claude'), /style="width: 100%"/);
    assert.match(partOf(html, 'Claude'), /100% · 1 of 1/);
    assert.match(partOf(html, 'Gemini'), /style="width: 0%"/);
    assert.match(partOf(html, 'Gemini'), /0% · 0 of 1/);
  });

  test('says so when a model has nothing checked yet, instead of drawing a bar', () => {
    const grok = partOf(renderScoreChart(sampleLedger()), 'Grok');

    assert.match(grok, /No checked calls yet/);
    assert.doesNotMatch(grok, /class="bar"/);
  });
});

describe('renderChart: calls', () => {
  const html = renderChart(`calls ${WEEK}`, weekCalls());

  test('shows every call of the week in model order', () => {
    const order = ['ChatGPT', 'Claude', 'Gemini', 'Grok'].map((name) => html.indexOf(`>${name}<`));

    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > (order[i - 1] ?? 0))));
    assert.match(html, /week of 2 November 2026/);
  });

  test('names the direction with a sign and a word', () => {
    assert.match(partOf(html, 'ChatGPT'), /▲<\/span> Higher/);
    assert.match(partOf(html, 'Gemini'), /▼<\/span> Lower/);
  });

  test('draws the confidence as a meter with the number next to it', () => {
    const chatgpt = partOf(html, 'ChatGPT');

    assert.match(chatgpt, /style="width: 64%"/);
    assert.match(chatgpt, /Confidence 64%/);
  });

  test('says nothing about results, even after the check', () => {
    assert.doesNotMatch(renderChart(`calls ${WEEK}`, weekChecked()), /Hit|Miss|✓|✗/);
  });

  test('draws BTC in candles for the week up to the calls, and nothing after them', () => {
    const chart = renderChart(`calls ${WEEK}`, weekCalls(), weekPrices());

    // The calls are recorded at 09:00: the 04:00 candle closed before them, the 08:00 one had not.
    assert.match(chart, /<title>2026-10-26 08:00 UTC: /);
    assert.match(
      chart,
      /<title>2026-11-02 04:00 UTC: open 99,920\.00, high 100,450\.00, low 99,770\.00, close 100,300\.00<\/title>/,
    );
    assert.doesNotMatch(chart, /<title>2026-10-26 04:00 UTC/);
    assert.doesNotMatch(chart, /<title>2026-11-02 08:00 UTC/);
    assert.match(chart, /aria-label="BTC in 4-hour candles, 2026-10-26 08:00 UTC to 2026-11-02 09:00 UTC"/);
    assert.match(chart, /class="candles-open"/);
    assert.match(chart, />Week opens</);
    assert.doesNotMatch(chart, /class="candles-end"|After the call/);
    assert.match(chart, /Candles: candle feed &lt;y&gt;, 4-hour/);
  });

  test('runs the time on to the check, with the week ahead left open for the calls', () => {
    const chart = renderChart(`calls ${WEEK}`, weekCalls(), weekPrices());
    const minor = [...chart.matchAll(/<span class="minor" style="[^"]*">([^<]*)<\/span>/g)].map(([, day]) => day);

    assert.match(chart, /class="candles-close"/);
    assert.match(chart, />Week closes</);
    assert.deepEqual(minor, ['27', '29', '31', '2', '4', '6']);
  });

  test('draws each call as an arrow from the price the week opens at, in the color of its model', () => {
    const chart = renderChart(`calls ${WEEK}`, weekCalls(), weekPrices());

    // The last close before the calls is the 04:00 candle's; it rose, so its close is the top of its body.
    const [, lastClose] = chart.match(/<title>2026-11-02 04:00 UTC[^<]*<\/title>.*?<rect class="body" x="[\d.]+" y="([\d.]+)"/) ?? [];
    assertCallArrows(chart);
    assert.equal(levelOf(chart).y, Number(lastClose));
    assert.match(chart, /The dashed line is the last close before the calls;/);
  });

  test('draws no candles without prices', () => {
    assert.doesNotMatch(html, /class="candles"/);
    assert.doesNotMatch(html, /Candles:/);
  });
});

describe('renderChart: factors', () => {
  const html = renderChart(`factors ${WEEK}`, weekCalls());

  test('shows each model with its call and how sure it was, in model order', () => {
    const order = ['ChatGPT', 'Claude', 'Gemini', 'Grok'].map((name) => html.indexOf(`>${name}<`));

    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > (order[i - 1] ?? 0))));
    assert.match(html, /What each model weighed, week of 2 November 2026/);
    assert.match(reasonOf(html, 'ChatGPT'), /▲<\/span> Higher · 64%/);
    assert.match(reasonOf(html, 'Gemini'), /▼<\/span> Lower · 55%/);
  });

  test('puts a logo tile next to each model name', () => {
    for (const [name, model] of BADGES) {
      assert.match(reasonOf(html, name), new RegExp(`<span class="badge ${model}" aria-hidden="true"></span>`));
    }
  });

  test('puts each factor on the side it pulls, in the order given', () => {
    const chatgpt = reasonOf(html, 'ChatGPT');
    const higher = sideOf(chatgpt, 'up');
    const first = higher.indexOf('Five higher daily closes in a row.');
    const second = higher.indexOf('Last week closed near the top of its range.');

    assert.ok(first >= 0 && second > first);
    assert.match(sideOf(chatgpt, 'down'), /Funding rates/);
    assert.doesNotMatch(sideOf(chatgpt, 'down'), /Five higher/);
  });

  test('names both sides in words, not only by color', () => {
    const gemini = reasonOf(html, 'Gemini');

    assert.match(html, /Pulls lower/);
    assert.match(html, /Pulls higher/);
    assert.match(sideOf(gemini, 'down'), /^down" aria-label="Pulls lower"/);
    assert.match(sideOf(gemini, 'up'), /^up" aria-label="Pulls higher"/);
  });

  test('escapes the factor text', () => {
    assert.match(reasonOf(html, 'ChatGPT'), /Funding rates &amp; fees are cooling\./);
  });

  test('says so when a side has no factors', () => {
    assert.match(sideOf(reasonOf(html, 'Grok'), 'down'), /None given/);
  });

  test('says so when a model gave no factors, instead of drawing empty sides', () => {
    const claude = reasonOf(html, 'Claude');

    assert.match(claude, /No factors recorded/);
    assert.doesNotMatch(claude, /<ul/);
  });
});

describe('renderChart: check', () => {
  const html = renderChart(`check ${WEEK}`, weekChecked());

  test('shows the start and end price and the move between them', () => {
    assert.match(html, /100,000\.00/);
    assert.match(html, /102,480\.00/);
    assert.match(html, /2026-11-02 09:00 UTC/);
    assert.match(html, /2026-11-06 20:00 UTC/);
    assert.match(html, /▲<\/span> Higher/);
    assert.match(html, /\+2\.48%/);
  });

  test('names a lower week with a sign and a word', () => {
    const lower = verifyPrediction(
      weekCalls(),
      { prediction_id: 'P0001', price_source: 'feed', price_start: 100000, price_end: 93000 },
      new Date('2026-11-06T20:00:00Z'),
    );
    const chart = renderChart(`check ${WEEK}`, lower);

    assert.match(chart, /class="move-change">[^<]*<span class="sign"[^>]*>▼<\/span> Lower <span class="move-pct">−7\.00%/);
  });

  test('draws no candles without prices', () => {
    assert.doesNotMatch(html, /class="candles"/);
    assert.doesNotMatch(html, /dashed line/);
  });

  test('marks every call as a hit or a miss with a sign and a word', () => {
    assert.match(partOf(html, 'Claude'), /✓ Hit/);
    assert.match(partOf(html, 'Gemini'), /✗ Miss/);
  });

  test('counts the hits', () => {
    assert.match(html, /3 of 4 calls came true/);
  });

  test('escapes the price source', () => {
    assert.match(html, /feed &lt;x&gt;/);
  });

  test('shows a week that is not checked yet as pending', () => {
    const pending = renderChart(`check ${WEEK}`, weekCalls());

    assert.match(pending, /Not checked yet/);
    assert.match(pending, /2026-11-06 20:00 UTC/);
    assert.match(partOf(pending, 'Grok'), /Pending/);
    assert.doesNotMatch(pending, /✓|✗/);
  });

  test('rejects a week checked against different prices', () => {
    const first = verifyPrediction(
      weekCalls(),
      { prediction_id: 'P0001', price_source: 'feed', price_start: 100000, price_end: 101000 },
      new Date('2026-11-06T20:00:00Z'),
    );
    const mixed = verifyPrediction(
      first,
      { prediction_id: 'P0002', price_source: 'feed', price_start: 100500, price_end: 101000 },
      new Date('2026-11-06T20:00:00Z'),
    );

    assert.throws(() => renderChart(`check ${WEEK}`, mixed), chartError(/different prices/));
  });
});

describe('renderChart: check, in candles', () => {
  const html = renderChart(`check ${WEEK}`, weekChecked(), weekPrices());

  test('draws BTC from a week before the call to the check', () => {
    assert.match(html, /<title>2026-10-26 08:00 UTC: /);
    assert.match(html, /<title>2026-11-06 16:00 UTC: open 102,080\.00, high 102,610\.00, low 101,930\.00, close 102,460\.00<\/title>/);
    assert.doesNotMatch(html, /<title>2026-10-26 04:00 UTC/);
    assert.doesNotMatch(html, /<title>2026-11-06 20:00 UTC/);
    assert.match(html, /aria-label="BTC in 4-hour candles, 2026-10-26 08:00 UTC to 2026-11-06 20:00 UTC"/);
  });

  test('tells a candle that rose from one that fell by its shape, and says which is which', () => {
    assert.match(html, /<g class="candle up">/);
    assert.match(html, /<g class="candle down">/);
    assert.match(html, /hollow: rose, filled: fell/);
  });

  test('marks where the week opens and closes, and the start and end prices', () => {
    assert.match(html, /class="candles-open"/);
    assert.match(html, /class="candles-close"/);
    assert.match(html, />Week opens</);
    assert.match(html, />Week closes</);
    assert.match(html, /class="candles-start"/);
    assert.match(html, /class="candles-end"/);
    assert.doesNotMatch(html, /Before the call|After the call/);
    assert.match(html, /The dashed line is the start price, from where the week opens, and the dot the end price;/);
  });

  test('draws each call as an arrow from the start price at the open, in the color of its model', () => {
    assertCallArrows(html);
  });

  test('puts the end price dot above the start line when BTC rose', () => {
    const end = Number(html.match(/class="candles-end" style="top: ([\d.]+)%"/)?.[1]);

    assert.ok(end < levelOf(html).y, `end ${end} should sit above the start ${levelOf(html).y}`);
  });

  test('labels the price scale in dollars', () => {
    assert.match(html, />\$100K</);
  });

  test('marks every other day to drop in a narrow chart, never a month name or its neighbours', () => {
    const minor = [...html.matchAll(/<span class="minor" style="[^"]*">([^<]*)<\/span>/g)].map(([, day]) => day);

    // 26 Oct to 6 Nov: kept are 26 Oct, 28, 30, 1 Nov, 3 and 5.
    assert.deepEqual(minor, ['27', '29', '31', '2', '4', '6']);
  });

  test('names the candle feed apart from the check prices, escaped', () => {
    assert.match(html, /Prices: feed &lt;x&gt;\. Candles: candle feed &lt;y&gt;, 4-hour/);
  });

  test('keeps the prices and the calls when no candle falls in the week', () => {
    const chart = renderChart(`check ${WEEK}`, weekChecked(), { ...weekPrices(), candles: [] });

    assert.doesNotMatch(chart, /class="candles"/);
    assert.doesNotMatch(chart, /candles-arrow|candles-tip/);
    assert.match(chart, /102,480\.00/);
    assert.match(chart, /3 of 4 calls came true/);
  });

  test('draws no candles for a week that is not checked yet', () => {
    const pending = renderChart(`check ${WEEK}`, weekCalls(), weekPrices());

    assert.match(pending, /Not checked yet/);
    assert.doesNotMatch(pending, /class="candles"/);
  });
});

describe('renderChart: review', () => {
  const html = renderChart(`review ${WEEK}`, weekReviewed());

  test('shows each model with its call and its result, in model order', () => {
    const order = ['ChatGPT', 'Claude', 'Gemini', 'Grok'].map((name) => html.indexOf(`>${name}<`));

    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > (order[i - 1] ?? 0))));
    assert.match(html, /How each model looks back on its call, week of 2 November 2026/);
    assert.match(reviewOf(html, 'ChatGPT'), /▲<\/span> Higher · 64%/);
    assert.match(reviewOf(html, 'ChatGPT'), /✓ Hit/);
    assert.match(reviewOf(html, 'Gemini'), /▼<\/span> Lower · 55%/);
    assert.match(reviewOf(html, 'Gemini'), /✗ Miss/);
  });

  test('puts a logo tile next to each model name', () => {
    for (const [name, model] of BADGES) {
      assert.match(reviewOf(html, name), new RegExp(`<span class="badge ${model}" aria-hidden="true"></span>`));
    }
  });

  test('says how BTC actually moved that week, next to the coin mark', () => {
    assert.match(html, /<span class="btc-mark" aria-hidden="true">₿<\/span> BTC ended the week/);
    assert.match(html, /\+2\.48%/);
  });

  test('marks each factor as held or not, in the order of the call', () => {
    const items = reviewOf(html, 'ChatGPT').split('<li').slice(1);

    assert.equal(items.length, 3);
    assert.match(items[0] ?? '', /✓ Held.*Five higher daily closes in a row\./s);
    assert.match(items[1] ?? '', /✗ Did not hold.*Funding rates &amp; fees are cooling\./s);
    assert.match(items[2] ?? '', /✓ Held.*Last week closed near the top of its range\./s);
  });

  test('quotes the note in the model’s own words, escaped', () => {
    assert.match(
      reviewOf(html, 'ChatGPT'),
      /<q>The run kept going &amp; the top of the range gave way\. Cooling funding did not slow it\.<\/q>/,
    );
  });

  test('says so when a model gave no factors to look back on', () => {
    const claude = reviewOf(html, 'Claude');

    assert.match(claude, /✓ Hit/);
    assert.match(claude, /No factors recorded/);
    assert.doesNotMatch(claude, /<ul|<q>/);
  });

  test('says so when a checked call has no review yet', () => {
    const unreviewed = renderChart(`review ${WEEK}`, weekChecked());

    assert.match(reviewOf(unreviewed, 'ChatGPT'), /✓ Hit/);
    assert.match(reviewOf(unreviewed, 'ChatGPT'), /No review yet/);
    assert.doesNotMatch(unreviewed, /Held|Did not hold|<q>/);
  });

  test('shows a week that is not checked yet as pending', () => {
    const pending = renderChart(`review ${WEEK}`, weekCalls());

    assert.match(pending, /Not checked yet/);
    assert.match(pending, /2026-11-06 20:00 UTC/);
    assert.match(reviewOf(pending, 'Grok'), /Pending/);
    assert.match(reviewOf(pending, 'Grok'), /No review yet/);
    assert.doesNotMatch(pending, /✓|✗/);
  });

  test('says that one week is mostly noise', () => {
    assert.match(html, /One week is mostly noise/);
  });
});

describe('renderChart: score', () => {
  test('counts only the weeks up to the one named', () => {
    const later = addPrediction(
      weekChecked(),
      {
        model: 'claude',
        model_version: 'claude-test-1',
        direction: 'down',
        confidence: 60,
        reasoning: 'Next week.',
        prompt_hash: 'a'.repeat(64),
        verify_date: '2026-11-13T20:00:00Z',
      },
      new Date('2026-11-09T09:00:00Z'),
    );
    const html = renderChart(`score ${WEEK}`, later);

    assert.match(html, /through the week of 2 November 2026/);
    assert.match(partOf(html, 'Claude'), /100% · 1 of 1/);
  });
});

describe('renderChart: score-change', () => {
  const html = renderChart(`score-change ${NEXT_WEEK}`, twoWeeks());

  test('shows each hit rate before and after the week, with the count after it', () => {
    assert.match(html, /before and after the week of 9 November 2026/);
    assert.match(partOf(html, 'ChatGPT'), /100% → 100% · 2 of 2/);
    assert.match(partOf(html, 'Claude'), /100% → 50% · 1 of 2/);
    assert.match(partOf(html, 'Gemini'), /0% → 50% · 1 of 2/);
  });

  test('draws a hollow dot before, a filled dot after and a line between them, against the coin flip', () => {
    const claude = partOf(html, 'Claude');

    assert.match(claude, /class="dot before" style="left: 100%"/);
    assert.match(claude, /class="dot after" style="left: 50%"/);
    assert.match(claude, /class="dumbbell-line" style="left: 50%; width: 50%"/);
    assert.match(html, /50% · coin flip/);
  });

  test('says so when the week added no check for a model', () => {
    const grok = partOf(html, 'Grok');

    assert.match(grok, /100% · no new check/);
    assert.doesNotMatch(grok, /dot before/);
  });

  test('marks a model\'s first checked week as its first check, with one dot', () => {
    const chatgpt = partOf(renderChart(`score-change ${WEEK}`, twoWeeks()), 'ChatGPT');

    assert.match(chatgpt, /First check: 100% · 1 of 1/);
    assert.match(chatgpt, /class="dot after"/);
    assert.doesNotMatch(chatgpt, /dot before/);
  });

  test('says so when nothing is checked yet, with no dots and no axis', () => {
    const pending = renderChart(`score-change ${WEEK}`, weekCalls());

    assert.match(partOf(pending, 'Claude'), /No checked calls yet/);
    assert.doesNotMatch(pending, /class="dot|coin flip/);
  });
});

describe('renderChart: flow', () => {
  test('draws the four steps of a week', () => {
    const html = renderChart('flow', emptyLedger());

    assert.equal(html.match(/<li/g)?.length, 4);
    assert.match(html, /ledger/i);
    assert.match(html, /50%/);
  });
});

describe('renderChart: example-call', () => {
  const html = renderChart('example-call', emptyLedger());

  test('says it is an example', () => {
    assert.match(html, /<figure class="chart example-call">/);
    assert.match(html, /<figcaption>[^<]*<span class="tag">Example<\/span><\/figcaption>/);
    assert.match(html, /made up/i);
  });

  test('names every part of a call', () => {
    for (const part of ['Model', 'Call', 'Confidence', 'Factors', 'Reasoning', 'Checked on', 'Prompt hash']) {
      assert.match(html, new RegExp(`<dt>${part}</dt>`));
    }
    assert.match(html, /ChatGPT/);
    assert.match(html, /▲<\/span> Higher/);
    assert.match(html, /64%/);
    assert.match(html, /<code>[0-9a-f]{16}…<\/code>/);
  });

  test('puts each factor on the side it pulls', () => {
    assert.match(sideOf(html, 'up'), /Five higher daily closes/);
    assert.match(sideOf(html, 'down'), /often fade/);
    assert.doesNotMatch(sideOf(html, 'down'), /Five higher daily closes/);
  });

  test('gives the check day but no time, since the check time is not fixed yet', () => {
    assert.match(html, /Friday, 6 November 2026/);
    assert.doesNotMatch(html, /UTC/);
  });

  test('is the same whatever the ledger holds', () => {
    assert.equal(renderChart('example-call', weekChecked()), html);
  });
});

describe('renderChart: mistakes', () => {
  const ledger = weekChecked();

  test('rejects an unknown chart', () => {
    assert.throws(() => renderChart('pie', ledger), chartError(/unknown chart "pie"/));
    assert.throws(() => renderChart('', ledger), chartError(/unknown chart ""/));
    assert.throws(() => renderChart('pie', ledger), chartError(/use calls, factors, check, review, score, score-change, flow or example-call$/));
  });

  test('needs the Monday of the week for a weekly chart', () => {
    assert.throws(() => renderChart('calls', ledger), chartError(/needs the Monday/));
    assert.throws(() => renderChart('calls next-week', ledger), chartError(/needs the Monday/));
    assert.throws(() => renderChart('calls 2026-11-31', ledger), chartError(/needs the Monday/));
    assert.throws(() => renderChart('calls 2026-11-03', ledger), chartError(/2026-11-03 is not a Monday/));
  });

  test('rejects a week with no calls in the ledger', () => {
    assert.throws(() => renderChart('check 2026-11-09', ledger), chartError(/no calls recorded in the week of 2026-11-09/));
    assert.throws(() => renderChart('factors 2026-11-09', ledger), chartError(/no calls recorded/));
    assert.throws(() => renderChart('score-change 2026-11-09', ledger), chartError(/no calls recorded/));
    assert.throws(() => renderChart('review 2026-11-09', ledger), chartError(/no calls recorded/));
  });

  test('rejects extra words', () => {
    assert.throws(() => renderChart(`calls ${WEEK} please`, ledger), ChartError);
    assert.throws(() => renderChart(`flow ${WEEK}`, ledger), chartError(/"flow" takes nothing after it/));
    assert.throws(() => renderChart(`example-call ${WEEK}`, ledger), chartError(/"example-call" takes nothing after it/));
  });
});
