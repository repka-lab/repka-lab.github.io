import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { after, describe, test } from 'node:test';

import { CandleError } from '../candles.ts';
import { MODELS } from '../ledger.ts';
import { SiteError } from './articles.ts';
import { buildSite, MARKER } from './build.ts';
import { DISCLAIMER, HOST_NOTE } from './html.ts';
import { sampleLedger, weekPrices } from './test-fixtures.ts';

// Words the public copy never uses. The disclaimer's "buying or selling" is allowed: only whole words count.
const FORBIDDEN = /\b(buy|sell|should|invest|guaranteed|will go up|will go down)\b/i;

const work = mkdtempSync(join(tmpdir(), 'repka-site-'));
after(() => rmSync(work, { recursive: true, force: true }));

const ledgerPath = join(work, 'ledger.json');
const articlesDir = join(work, 'articles');
writeFileSync(ledgerPath, `${JSON.stringify(sampleLedger(), null, 2)}\n`);
mkdirSync(articlesDir);
// Every chart kind, so the page checks below cover chart output too. The sample week starts on 2026-10-19.
const CHARTS = ['flow', 'calls 2026-10-19', 'check 2026-10-19', 'score 2026-10-19'].map((spec) => `\`\`\`chart\n${spec}\n\`\`\``);
writeFileSync(
  join(articlesDir, 'week-one.md'),
  article('Week <one>', 'published', ['See [the ledger](../ledger.html).', ...CHARTS].join('\n\n')),
);
writeFileSync(join(articlesDir, 'secret-plan.md'), article('Unfinished', 'draft', 'Not ready.'));

function article(title: string, status: string, body: string): string {
  return ['---', `title: ${title}`, 'date: 2026-10-25', 'summary: A short summary.', `status: ${status}`, '---', '', body, ''].join('\n');
}

function build(outDir: string, includeDrafts = false): readonly string[] {
  return buildSite({ ledgerPath, articlesDir, outDir, includeDrafts });
}

function filesIn(dir: string): readonly string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .toSorted();
}

describe('buildSite', () => {
  const out = join(work, 'site');
  const written = build(out);
  const pages = filesIn(out).filter((file) => file.endsWith('.html'));

  test('writes the pages, the assets and the raw ledger', () => {
    assert.deepEqual(filesIn(out), [
      '.nojekyll',
      MARKER,
      'articles/week-one.html',
      'avatar.svg',
      'data/ledger.json',
      'index.html',
      'ledger.html',
      'logos/LICENSE.txt',
      'logos/chatgpt.svg',
      'logos/claude.svg',
      'logos/gemini.svg',
      'logos/grok.svg',
      'style.css',
    ]);
    assert.deepEqual(written, filesIn(out));
    assert.equal(readFileSync(join(out, 'data/ledger.json'), 'utf8'), readFileSync(ledgerPath, 'utf8'));
  });

  test('ships each model logo in fixed colors, with the stylesheet putting it on the tile', () => {
    const css = readFileSync(join(out, 'style.css'), 'utf8');
    for (const model of MODELS) {
      const svg = readFileSync(join(out, `logos/${model}.svg`), 'utf8');
      assert.match(svg, /^<svg [^>]*viewBox="0 0 24 24"/, `${model} is not a 24px icon`);
      assert.doesNotMatch(svg, /<script|\son\w+=|href=/i, `${model} carries a script or a link`);
      // A background image has no text color to inherit, so currentColor would draw black.
      assert.doesNotMatch(svg, /currentColor/, `${model} depends on the text color`);
      assert.match(css, new RegExp(`\\.badge\\.${model} \\{[^}]*url\\(logos/${model}\\.svg\\)`), `no tile for ${model}`);
    }
    assert.match(readFileSync(join(out, 'logos/LICENSE.txt'), 'utf8'), /Copyright \(c\) 2023 LobeHub/);
  });

  test('puts every review result on a line of its own in a narrow chart, so the cards match', () => {
    const css = readFileSync(join(out, 'style.css'), 'utf8');
    const narrow = css.slice(css.indexOf('@container (max-width: 32rem)'));
    assert.match(narrow, /\.review-model \.result \{[^}]*flex-basis: 100%/);
  });

  test('drops the minor day labels in a narrow chart, so the days never run together', () => {
    const css = readFileSync(join(out, 'style.css'), 'utf8');
    const narrow = css.slice(css.indexOf('@container (max-width: 32rem)'));
    assert.match(narrow, /\.candles-days > \.minor \{[^}]*display: none/);
  });

  test('sets the month under its day in a narrow chart, so a month name never runs into the next day', () => {
    const css = readFileSync(join(out, 'style.css'), 'utf8');
    const narrow = css.slice(css.indexOf('@container (max-width: 32rem)'));
    assert.match(narrow, /\.candles-month \{[^}]*display: block/);
  });

  test('ends the name of a week line at its line, so the names frame the week and never run together', () => {
    const css = readFileSync(join(out, 'style.css'), 'utf8');
    assert.match(css, /\.candles-marks > span \{[^}]*translateX\(-100%\)/);
  });

  test('leaves drafts out of a public build', () => {
    assert.ok(!existsSync(join(out, 'articles/secret-plan.html')));
    assert.doesNotMatch(readFileSync(join(out, 'index.html'), 'utf8'), /secret-plan|Unfinished/);
  });

  test('puts the disclaimer and the host note on every page', () => {
    for (const file of pages) {
      const html = readFileSync(join(out, file), 'utf8');
      assert.ok(html.includes(DISCLAIMER), `${file} has no disclaimer`);
      assert.ok(html.includes(HOST_NOTE), `${file} has no host note`);
    }
  });

  test('keeps the forbidden words off every page', () => {
    for (const file of pages) {
      const html = readFileSync(join(out, file), 'utf8');
      assert.doesNotMatch(html, FORBIDDEN, `${file} uses a forbidden word`);
    }
  });

  test('has no broken local links', () => {
    for (const file of pages) {
      const html = readFileSync(join(out, file), 'utf8');
      for (const [, target = ''] of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
        if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
        const path = resolve(out, dirname(file), target.split('#')[0] ?? '');
        assert.ok(existsSync(path), `${file} links to missing ${target}`);
      }
    }
  });

  test('draws the chart blocks in articles from the ledger', () => {
    const html = readFileSync(join(out, 'articles/week-one.html'), 'utf8');

    assert.equal(html.match(/<figure class="chart/g)?.length, CHARTS.length);
    assert.doesNotMatch(html, /language-chart/);
  });

  test('leaves the candles out without a price file', () => {
    assert.ok(!existsSync(join(out, 'data/btc-usd-4h.json')));
    assert.doesNotMatch(readFileSync(join(out, 'articles/week-one.html'), 'utf8'), /class="candles"/);
  });

  test('draws the candles from a price file and ships the file as it is', () => {
    const withPrices = join(work, 'with-prices');
    const pricesPath = join(work, 'btc.json');
    writeFileSync(pricesPath, `${JSON.stringify(weekPrices(), null, 2)}\n`);

    const files = buildSite({ ledgerPath, articlesDir, outDir: withPrices, includeDrafts: false, pricesPath });

    assert.ok(files.includes('data/btc-usd-4h.json'));
    assert.equal(readFileSync(join(withPrices, 'data/btc-usd-4h.json'), 'utf8'), readFileSync(pricesPath, 'utf8'));
    assert.match(readFileSync(join(withPrices, 'articles/week-one.html'), 'utf8'), /class="candles"/);
  });

  test('draws the scoreboard as a chart, with the table one click away', () => {
    const html = readFileSync(join(out, 'index.html'), 'utf8');

    assert.match(html, /<figure class="chart score"/);
    assert.match(html, /<details[^>]*>\s*<summary>Show as a table<\/summary>[\s\S]*class="scoreboard"/);
  });

  test('escapes article titles in the article list', () => {
    assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /Week &lt;one&gt;/);
  });

  test('shows drafts, marked as drafts, in a preview build', () => {
    const preview = join(work, 'preview');
    build(preview, true);

    assert.match(readFileSync(join(preview, 'articles/secret-plan.html'), 'utf8'), /Draft/);
  });
});

describe('buildSite output folder', () => {
  test('replaces an earlier build, stale pages included', () => {
    const out = join(work, 'rebuilt');
    build(out, true);
    build(out);

    assert.ok(!existsSync(join(out, 'articles/secret-plan.html')));
  });

  test('refuses to wipe a folder it did not build', () => {
    const out = join(work, 'someone-elses');
    mkdirSync(out);
    writeFileSync(join(out, 'notes.txt'), 'keep me');

    assert.throws(() => build(out), SiteError);
    assert.equal(readFileSync(join(out, 'notes.txt'), 'utf8'), 'keep me');
  });

  test('touches nothing when the ledger is invalid', () => {
    const out = join(work, 'kept');
    build(out);
    const badLedger = join(work, 'bad-ledger.json');
    writeFileSync(badLedger, '{"schema_version": 1, "predictions": [{}], "verifications": []}');

    assert.throws(() => buildSite({ ledgerPath: badLedger, articlesDir, outDir: out, includeDrafts: false }));
    assert.ok(existsSync(join(out, 'index.html')));
  });

  test('touches nothing when the price file is invalid', () => {
    const out = join(work, 'kept-prices');
    build(out);
    const badPrices = join(work, 'bad-prices.json');
    writeFileSync(badPrices, '{"source": "x", "granularity_seconds": 14400, "candles": [{}]}');

    assert.throws(() => buildSite({ ledgerPath, articlesDir, outDir: out, includeDrafts: false, pricesPath: badPrices }), CandleError);
    assert.ok(existsSync(join(out, 'index.html')));
  });
});
