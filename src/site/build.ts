// Builds the static site.
//
//   node src/site/build.ts                               public build into docs/ (GitHub Pages)
//   node src/site/build.ts --drafts --out .preview/site  local preview with draft articles
//
// Everything is rendered in memory first, so a bad ledger, price file or article stops the build before
// the output folder is touched. Drafts never go into docs/. With data/btc-usd-4h.json present the charts
// draw BTC in candles from it; without it they leave the candles out. With data/bnb-usdt-4h.json present
// the market charts can draw BNB as well.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { loadCandles, PRICES_FILE } from '../candles.ts';
import { DEFAULT_SYMBOL, defaultOut } from '../fetch-binance-candles.ts';
import { btcOnly, loadLedger } from '../ledger.ts';
import { loadArticles, SiteError } from './articles.ts';
import { renderArticle, renderIndex, renderLedgerPage, renderListPage } from './pages.ts';

export const MARKER = '.repka-site';

const MARKER_TEXT = 'Built by src/site/build.ts, which deletes and rewrites this folder. Edit the sources instead.\n';
const ASSETS = [
  'style.css',
  'avatar.svg',
  'logos/LICENSE.txt',
  'logos/chatgpt.svg',
  'logos/claude.svg',
  'logos/gemini.svg',
  'logos/grok.svg',
  'img/binance-hack-setup.jpg',
  'img/binance-hack-drain.jpg',
  'img/binance-hack-who.jpg',
  'img/binance-hack-launder.jpg',
  'img/binance-hack-video.jpg',
  'video/binance-hack.mp4',
  'img/btc-calls-2026-11-02-video.jpg',
  'img/btc-calls-2026-11-02-cards.jpg',
  'img/btc-calls-2026-11-02-tally.jpg',
  'video/btc-calls-2026-11-02.mp4',
  'img/gold-2025-video.jpg',
  'img/gold-2025-race.jpg',
  'img/gold-2025-why.jpg',
  'img/gold-2025-record.jpg',
  'video/gold-2025.mp4',
  'img/anthropic-ipo-video.jpg',
  'img/anthropic-ipo-facts.jpg',
  'img/anthropic-ipo-value.jpg',
  'img/anthropic-ipo-pop.jpg',
  'img/anthropic-ipo-cards.jpg',
  'img/anthropic-ipo-biased.jpg',
  'video/anthropic-ipo.mp4',
] as const;
const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const PUBLIC_DIR = join(PROJECT_ROOT, 'docs');

export interface BuildOptions {
  readonly ledgerPath: string;
  readonly articlesDir: string;
  readonly outDir: string;
  readonly includeDrafts: boolean;
  readonly pricesPath?: string; // BTC candles for the charts, shipped as they are
  readonly marketPaths?: Readonly<Record<string, string>>; // other coins' candles by coin, like bnb; shipped under data/
}

interface OutputFile {
  readonly path: string; // relative to the output folder, with forward slashes
  readonly content: string | Uint8Array;
}

// Returns the written files, relative to outDir and sorted.
export function buildSite(options: BuildOptions): readonly string[] {
  // The scoreboard, the charts and the ledger page count BTC calls only; event calls ship in the raw ledger.
  const ledger = btcOnly(loadLedger(options.ledgerPath));
  const { pricesPath } = options;
  const prices = pricesPath === undefined ? undefined : loadCandles(pricesPath);
  const marketPaths = Object.entries(options.marketPaths ?? {});
  const markets = Object.fromEntries(marketPaths.map(([coin, path]) => [coin, loadCandles(path)]));
  const articles = loadArticles(options.articlesDir, { includeDrafts: options.includeDrafts, ledger, prices, markets });
  const files: readonly OutputFile[] = [
    { path: 'index.html', content: renderIndex(ledger, articles) },
    { path: 'ledger.html', content: renderLedgerPage(ledger) },
    { path: 'forecasts.html', content: renderListPage(articles, 'forecasts') },
    { path: 'news.html', content: renderListPage(articles, 'news') },
    ...articles.map((article) => ({ path: `articles/${article.slug}.html`, content: renderArticle(article) })),
    ...ASSETS.map((name) => ({ path: name, content: readFileSync(join(import.meta.dirname, name)) })),
    { path: 'data/ledger.json', content: readFileSync(options.ledgerPath) }, // byte for byte, as committed
    ...(pricesPath === undefined ? [] : [{ path: PRICES_FILE, content: readFileSync(pricesPath) }]),
    ...marketPaths.map(([, path]) => ({ path: `data/${basename(path)}`, content: readFileSync(path) })),
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

  const pricesPath = join(PROJECT_ROOT, PRICES_FILE);
  const bnbPath = join(PROJECT_ROOT, defaultOut(DEFAULT_SYMBOL));
  const written = buildSite({
    ledgerPath: join(PROJECT_ROOT, 'data', 'ledger.json'),
    articlesDir: join(PROJECT_ROOT, 'content', 'articles'),
    outDir,
    includeDrafts: values.drafts,
    ...(existsSync(pricesPath) ? { pricesPath } : {}),
    ...(existsSync(bnbPath) ? { marketPaths: { bnb: bnbPath } } : {}),
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
