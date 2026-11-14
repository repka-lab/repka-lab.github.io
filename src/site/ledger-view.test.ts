import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { emptyLedger } from '../ledger.ts';
import { formatChange, formatUtc, renderLedgerTable, renderReasoning, renderScoreboard } from './ledger-view.ts';
import { sampleLedger } from './test-fixtures.ts';

// A row and, in the ledger, the details row that follows it.
function rowOf(html: string, id: string): string {
  const parts = html.split('<tr');
  const at = parts.findIndex((part) => part.includes(`>${id}<`));
  assert.ok(at >= 0, `no row for ${id}`);
  const next = parts[at + 1] ?? '';
  return next.startsWith(' class="more"') ? `${parts[at]}<tr${next}` : (parts[at] ?? '');
}

describe('formatUtc', () => {
  test('leaves a plain day as it is', () => {
    assert.equal(formatUtc('2026-11-01'), '2026-11-01');
  });

  test('shows a moment in UTC to the minute', () => {
    assert.equal(formatUtc('2026-10-25T10:00:00.000Z'), '2026-10-25 10:00 UTC');
    assert.equal(formatUtc('2026-10-25T10:00:00+03:00'), '2026-10-25 07:00 UTC');
  });
});

describe('formatChange', () => {
  test('always shows the sign and two decimals', () => {
    assert.equal(formatChange(1.5), '+1.50%');
    assert.equal(formatChange(-0.2), '−0.20%');
    assert.equal(formatChange(0), '0.00%');
  });
});

describe('renderScoreboard', () => {
  test('lists every model with dashes before anything is checked', () => {
    const html = renderScoreboard(emptyLedger());

    for (const name of ['ChatGPT', 'Claude', 'Gemini', 'Grok Bot']) assert.match(html, new RegExp(`>${name}<`));
    assert.match(rowOf(html, 'Claude'), /—/);
  });

  test('sets the hit rate against the average confidence', () => {
    const claude = rowOf(renderScoreboard(sampleLedger()), 'Claude');

    assert.match(claude, />100%</); // hit rate: 1 of 1
    assert.match(claude, />70%</); // average confidence of checked forecasts
  });

  test('counts a pending forecast without judging it', () => {
    const grok = rowOf(renderScoreboard(sampleLedger()), 'Grok Bot');
    const cells = [...grok.matchAll(/<td[^>]*>([^<]*)</g)].map((m) => m[1]);

    assert.deepEqual(cells, ['1', '0', '1', '0', '0', '—', '—']);
  });
});

describe('renderLedgerTable', () => {
  test('explains an empty ledger instead of showing an empty table', () => {
    const html = renderLedgerTable(emptyLedger());

    assert.doesNotMatch(html, /<table/);
    assert.match(html, /No forecasts recorded yet/);
  });

  test('shows the newest forecast first', () => {
    const html = renderLedgerTable(sampleLedger());

    assert.ok(html.indexOf('>P0002<') < html.indexOf('>P0001<'));
  });

  test('marks a hit with a sign and a word, not color alone', () => {
    const row = rowOf(renderLedgerTable(sampleLedger()), 'P0001');

    assert.match(row, /✓ Hit/);
    assert.match(row, /\+1\.50%/);
    assert.match(row, /test feed/);
  });

  test('marks an unchecked forecast as pending', () => {
    assert.match(rowOf(renderLedgerTable(sampleLedger()), 'P0002'), /Pending/);
  });

  test('names the call and the outcome as higher or lower', () => {
    const html = renderLedgerTable(sampleLedger());

    assert.match(rowOf(html, 'P0001'), /Higher, \+1\.50%/);
    assert.match(rowOf(html, 'P0002'), /<td>Lower<\/td>/);
  });

  test('escapes the model reasoning', () => {
    const row = rowOf(renderLedgerTable(sampleLedger()), 'P0001');

    assert.match(row, /BTC &lt;b&gt;looks&lt;\/b&gt; firm &amp; steady\./);
  });

  test('shows the full prompt hash', () => {
    assert.match(rowOf(renderLedgerTable(sampleLedger()), 'P0001'), new RegExp('a'.repeat(64)));
  });

  test('puts the details on their own full-width row', () => {
    const row = rowOf(renderLedgerTable(sampleLedger()), 'P0001');

    assert.match(row, /<tr class="more"><td colspan="7"><details>/);
  });

  test('shows the model version only when it differs from the name', () => {
    const ledger = sampleLedger();
    const named = { ...ledger, predictions: ledger.predictions.map((p) => ({ ...p, model_version: p.model === 'grok' ? 'Grok Bot' : p.model_version })) };

    assert.match(rowOf(renderLedgerTable(ledger), 'P0001'), /<small>claude-test-1<\/small>/);
    assert.doesNotMatch(rowOf(renderLedgerTable(named), 'P0002'), /Grok Bot<br>/);
  });
});

describe('renderReasoning', () => {
  test('turns bold, code, links and bullet lists into markup', () => {
    const html = renderReasoning('**DOWN** at `55%`.\n\n- one [source](https://example.com/a)\n- two');

    assert.equal(
      html,
      '<p><strong>DOWN</strong> at <code>55%</code>.</p><ul><li>one <a href="https://example.com/a" rel="nofollow noopener noreferrer">source</a></li><li>two</li></ul>',
    );
  });

  test('keeps single line breaks inside a paragraph', () => {
    assert.equal(renderReasoning('first\nsecond'), '<p>first<br>second</p>');
  });

  test('escapes raw HTML and links only http(s)', () => {
    const html = renderReasoning('<img src=x onerror=alert(1)> [x](javascript:alert(1))');

    assert.doesNotMatch(html, /<img|<a /);
    assert.match(html, /&lt;img/);
  });
});
