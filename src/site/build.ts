// Builds the static site.
//
//   node src/site/build.ts                               public build into docs/ (GitHub Pages)
//   node src/site/build.ts --drafts --out .preview/site  local preview with draft articles
//
// Everything is rendered in memory first, so a bad ledger or article stops the build before
// the output folder is touched. Drafts never go into docs/.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { loadLedger } from '../ledger.ts';
import { loadArticles, SiteError } from './articles.ts';
import { renderArticle, renderIndex, renderLedgerPage } from './pages.ts';

export const MARKER = '.repka-site';

const MARKER_TEXT = 'Built by src/site/build.ts, which deletes and rewrites this folder. Edit the sources instead.\n';
const ASSETS = ['style.css', 'avatar.svg'] as const;
const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const PUBLIC_DIR = join(PROJECT_ROOT, 'docs');

export interface BuildOptions {
  readonly ledgerPath: string;
  readonly articlesDir: string;
  readonly outDir: string;
  readonly includeDrafts: boolean;
}

interface OutputFile {
  readonly path: string; // relative to the output folder, with forward slashes
  readonly content: string | Uint8Array;
}

// Returns the written files, relative to outDir and sorted.
export function buildSite(options: BuildOptions): readonly string[] {
  const ledger = loadLedger(options.ledgerPath);
  const articles = loadArticles(options.articlesDir, { includeDrafts: options.includeDrafts });
  const files: readonly OutputFile[] = [
    { path: 'index.html', content: renderIndex(ledger, articles) },
    { path: 'ledger.html', content: renderLedgerPage(ledger) },
    ...articles.map((article) => ({ path: `articles/${article.slug}.html`, content: renderArticle(article) })),
    ...ASSETS.map((name) => ({ path: name, content: readFileSync(join(import.meta.dirname, name)) })),
    { path: 'data/ledger.json', content: readFileSync(options.ledgerPath) }, // byte for byte, as committed
    { path: '.nojekyll', content: '' }, // serve the files as they are, without Jekyll
    { path: MARKER, content: MARKER_TEXT },
  ];

  clearOutput(options.outDir);
  for (const file of files) {
    const target = join(options.outDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
  }
  return files.map((file) => file.path).toSorted();
}

// Removes an earlier build. A folder with anything else in it is left alone, so a wrong --out can't wipe it.
function clearOutput(dir: string): void {
  if (existsSync(dir)) {
    const entries = readdirSync(dir);
    if (entries.length > 0 && !entries.includes(MARKER)) {
      throw new SiteError(`${dir} is not empty and holds no ${MARKER} file; refusing to delete it`);
    }
    rmSync(dir, { recursive: true });
  }
  mkdirSync(dir, { recursive: true });
}

function main(): void {
  const { values } = parseArgs({
    options: { drafts: { type: 'boolean', default: false }, out: { type: 'string' } },
    strict: true,
  });
  const outDir = values.out === undefined ? PUBLIC_DIR : resolve(values.out);
  if (values.drafts && outDir === PUBLIC_DIR) {
    throw new SiteError('drafts never go into docs/; pass --out with a preview folder');
  }

  const written = buildSite({
    ledgerPath: join(PROJECT_ROOT, 'data', 'ledger.json'),
    articlesDir: join(PROJECT_ROOT, 'content', 'articles'),
    outDir,
    includeDrafts: values.drafts,
  });
  const drafts = values.drafts ? ', drafts included' : '';
  process.stdout.write(`Built ${written.length} files into ${outDir}${drafts}\n`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Site build failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
