// Articles for the site: content/articles/<slug>.md, a short header block, then Markdown.
//
//   ---
//   title: How the experiment works
//   date: 2026-10-25
//   summary: One or two sentences for the article list and link previews.
//   status: draft
//   ---
//
// Every field is required and status is spelled out, so a typo can't publish an unfinished article.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { Marked } from 'marked';

export interface Article {
  readonly slug: string; // the file name without .md; also the page name
  readonly title: string;
  readonly date: string; // YYYY-MM-DD
  readonly summary: string;
  readonly isDraft: boolean;
  readonly html: string;
}

export interface LoadOptions {
  readonly includeDrafts: boolean;
}

export class SiteError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SiteError';
  }
}

const FIELDS = ['title', 'date', 'summary', 'status'] as const;
const STATUSES = ['draft', 'published'] as const;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HEADER = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/;
const HEADER_LINE = /^([a-z_]+):\s*(.*)$/;

type Field = (typeof FIELDS)[number];
type Header = Readonly<Record<Field, string>>;

const markdown = new Marked({ gfm: true });

export function parseArticle(fileName: string, source: string): Article {
  const slug = basename(fileName, '.md');
  if (!SLUG.test(slug)) fail(fileName, 'file name must be lowercase letters, digits and dashes, ending in .md');

  const text = source.replace(/^﻿/, '').replaceAll('\r\n', '\n');
  const parts = HEADER.exec(text);
  if (!parts) fail(fileName, 'no header; start the file with a --- block');
  const header = readHeader(parts[1] ?? '', fileName);
  const body = parts[2] ?? '';
  if (body.trim() === '') fail(fileName, 'the article body is empty');

  return {
    slug,
    title: header.title,
    date: checkDay(header.date, fileName),
    summary: header.summary,
    isDraft: checkStatus(header.status, fileName) === 'draft',
    html: markdown.parse(body, { async: false }),
  };
}

// Newest first; articles from the same day go in file-name order.
export function loadArticles(dir: string, options: LoadOptions): readonly Article[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => parseArticle(name, readFileSync(join(dir, name), 'utf8')))
    .filter((article) => options.includeDrafts || !article.isDraft)
    .toSorted((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

function readHeader(block: string, fileName: string): Header {
  const entries = new Map<string, string>();
  block.split('\n').forEach((line, i) => {
    if (line.trim() === '') return;
    const match = HEADER_LINE.exec(line);
    if (!match) fail(fileName, `cannot read header line ${i + 2}: "${line}"`);
    const [, key = '', value = ''] = match;
    if (!isField(key)) fail(fileName, `unknown field "${key}"; the fields are ${FIELDS.join(', ')}`);
    if (entries.has(key)) fail(fileName, `field "${key}" is set twice`);
    entries.set(key, value.trim());
  });

  const header = Object.fromEntries(
    FIELDS.map((field) => {
      const value = entries.get(field);
      if (value === undefined) fail(fileName, `missing field "${field}"`);
      if (value === '') fail(fileName, `field "${field}" is empty`);
      return [field, value];
    }),
  );
  return header as Header;
}

function isField(key: string): key is Field {
  return (FIELDS as readonly string[]).includes(key);
}

function checkDay(value: string, fileName: string): string {
  const time = Date.parse(`${value}T00:00:00Z`);
  const isRealDay = DAY.test(value) && !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
  if (!isRealDay) fail(fileName, `date must be a real calendar day as YYYY-MM-DD, got "${value}"`);
  return value;
}

function checkStatus(value: string, fileName: string): (typeof STATUSES)[number] {
  const status = STATUSES.find((s) => s === value);
  if (!status) fail(fileName, `status must be ${STATUSES.join(' or ')}, got "${value}"`);
  return status;
}

function fail(fileName: string, message: string): never {
  throw new SiteError(`${fileName}: ${message}`);
}
