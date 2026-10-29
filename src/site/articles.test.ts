import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import { loadArticles, parseArticle, SiteError } from './articles.ts';

const HEADER = ['---', 'title: How it works', 'date: 2026-10-25', 'summary: The short version.', 'status: published', '---'];

function source(header: readonly string[] = HEADER, body = 'Some **bold** text.'): string {
  return [...header, '', body, ''].join('\n');
}

function withField(key: string, value: string | null): readonly string[] {
  const kept = HEADER.filter((line) => !line.startsWith(`${key}:`));
  return value === null ? kept : [...kept.slice(0, -1), `${key}: ${value}`, '---'];
}

describe('parseArticle', () => {
  test('reads the header and renders the body as HTML', () => {
    const article = parseArticle('how-it-works.md', source());

    assert.equal(article.slug, 'how-it-works');
    assert.equal(article.title, 'How it works');
    assert.equal(article.date, '2026-10-25');
    assert.equal(article.summary, 'The short version.');
    assert.equal(article.isDraft, false);
    assert.equal(article.html.trim(), '<p>Some <strong>bold</strong> text.</p>');
  });

  test('accepts a byte order mark and Windows line endings', () => {
    const article = parseArticle('a.md', `﻿${source().replaceAll('\n', '\r\n')}`);

    assert.equal(article.title, 'How it works');
    assert.match(article.html, /<strong>bold<\/strong>/);
  });

  test('keeps colons inside a value', () => {
    const article = parseArticle('a.md', source(withField('title', 'Repka: week one')));

    assert.equal(article.title, 'Repka: week one');
  });

  test('marks a draft', () => {
    assert.equal(parseArticle('a.md', source(withField('status', 'draft'))).isDraft, true);
  });

  test('requires every header field', () => {
    for (const key of ['title', 'date', 'summary', 'status']) {
      assert.throws(() => parseArticle('a.md', source(withField(key, null))), new RegExp(`a\\.md.*${key}`));
    }
  });

  test('rejects an unknown status instead of publishing it', () => {
    assert.throws(() => parseArticle('a.md', source(withField('status', 'publshed'))), SiteError);
  });

  test('rejects unknown and repeated header fields', () => {
    assert.throws(() => parseArticle('a.md', source(withField('staus', 'draft'))), /unknown field "staus"/);
    assert.throws(() => parseArticle('a.md', source([...HEADER.slice(0, -1), 'title: Again', '---'])), /twice/);
  });

  test('rejects an impossible date', () => {
    assert.throws(() => parseArticle('a.md', source(withField('date', '2026-02-30'))), /date/);
    assert.throws(() => parseArticle('a.md', source(withField('date', '2026-13-01'))), /date/);
  });

  test('rejects a file without a header or without a body', () => {
    assert.throws(() => parseArticle('a.md', 'Just text.'), /header/);
    assert.throws(() => parseArticle('a.md', source(HEADER, '  ')), /empty/);
  });

  test('rejects a file name that is not a clean URL slug', () => {
    assert.throws(() => parseArticle('How It Works.md', source()), /file name/);
  });
});

describe('loadArticles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repka-articles-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  writeFileSync(join(dir, 'older.md'), source(withField('date', '2026-10-01')));
  writeFileSync(join(dir, 'newer.md'), source(withField('date', '2026-10-20')));
  writeFileSync(join(dir, 'unfinished.md'), source(withField('status', 'draft')));
  writeFileSync(join(dir, 'notes.txt'), 'not an article');

  test('returns published articles, newest first', () => {
    const slugs = loadArticles(dir, { includeDrafts: false }).map((a) => a.slug);

    assert.deepEqual(slugs, ['newer', 'older']);
  });

  test('includes drafts only when asked', () => {
    const slugs = loadArticles(dir, { includeDrafts: true }).map((a) => a.slug);

    assert.deepEqual(slugs, ['unfinished', 'newer', 'older']);
  });

  test('returns nothing for a missing folder', () => {
    assert.deepEqual(loadArticles(join(dir, 'missing'), { includeDrafts: true }), []);
  });
});
