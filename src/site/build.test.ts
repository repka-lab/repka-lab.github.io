import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { after, describe, test } from 'node:test';

import { SiteError } from './articles.ts';
import { buildSite, MARKER } from './build.ts';
import { DISCLAIMER, HOST_NOTE } from './html.ts';
import { sampleLedger } from './test-fixtures.ts';

// Words the public copy never uses. The disclaimer's "buying or selling" is allowed: only whole words count.
const FORBIDDEN = /\b(buy|sell|should|invest|guaranteed|will go up|will go down)\b/i;

const work = mkdtempSync(join(tmpdir(), 'repka-site-'));
after(() => rmSync(work, { recursive: true, force: true }));

const ledgerPath = join(work, 'ledger.json');
const articlesDir = join(work, 'articles');
writeFileSync(ledgerPath, `${JSON.stringify(sampleLedger(), null, 2)}\n`);
mkdirSync(articlesDir);
writeFileSync(join(articlesDir, 'week-one.md'), article('Week <one>', 'published', 'See [the ledger](../ledger.html).'));
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
      'style.css',
    ]);
    assert.deepEqual(written, filesIn(out));
    assert.equal(readFileSync(join(out, 'data/ledger.json'), 'utf8'), readFileSync(ledgerPath, 'utf8'));
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
});
