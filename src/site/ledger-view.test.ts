import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { emptyLedger } from '../ledger.ts';
import { formatChange, formatUtc, renderLedgerTable, renderScoreboard } from './ledger-view.ts';
import { sampleLedger } from './test-fixtures.ts';

function rowOf(html: string, id: string): string {
  const row = html.split('<tr').find((part) => part.includes(`>${id}<`));
  assert.ok(row, `no row for ${id}`);
  return row;
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

    for (const name of ['ChatGPT', 'Claude', 'Gemini', 'Grok']) assert.match(html, new RegExp(`>${name}<`));
    assert.match(rowOf(html, 'Claude'), /—/);
  });

  test('sets the hit rate against the average confidence', () => {
    const claude = rowOf(renderScoreboard(sampleLedger()), 'Claude');

    assert.match(claude, />100%</); // hit rate: 1 of 1
    assert.match(claude, />70%</); // average confidence of checked forecasts
  });

  test('counts a pending forecast without judging it', () => {
    const grok = rowOf(renderScoreboard(sampleLedger()), 'Grok');
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

  test('escapes the model reasoning', () => {
    const row = rowOf(renderLedgerTable(sampleLedger()), 'P0001');

    assert.match(row, /Gold &lt;b&gt;looks&lt;\/b&gt; firm &amp; steady\./);
  });

  test('shows the full prompt hash', () => {
    assert.match(rowOf(renderLedgerTable(sampleLedger()), 'P0001'), new RegExp('a'.repeat(64)));
  });
});
