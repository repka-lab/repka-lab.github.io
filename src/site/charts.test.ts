import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addPrediction, emptyLedger, verifyPrediction } from '../ledger.ts';
import { ChartError, renderChart, renderScoreChart } from './charts.ts';
import { NEXT_WEEK, sampleLedger, twoWeeks, WEEK, weekCalls, weekChecked } from './test-fixtures.ts';

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
    assert.throws(() => renderChart('pie', ledger), chartError(/use calls, factors, check, score, score-change, flow or example-call$/));
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
  });

  test('rejects extra words', () => {
    assert.throws(() => renderChart(`calls ${WEEK} please`, ledger), ChartError);
    assert.throws(() => renderChart(`flow ${WEEK}`, ledger), chartError(/"flow" takes nothing after it/));
    assert.throws(() => renderChart(`example-call ${WEEK}`, ledger), chartError(/"example-call" takes nothing after it/));
  });
});
