// The site's pages: the front page, the ledger page, the Forecasts and News pages and one page per article.
// Wording here is public copy, so it follows the content rules: no advice, no promises about prices.

import type { Ledger } from '../ledger.ts';
import type { Article, ArticleSection } from './articles.ts';
import { renderScoreChart } from './charts.ts';
import { escapeHtml, page } from './html.ts';
import { renderLedgerTable, renderScoreboard } from './ledger-view.ts';

// The sections with a page of their own; the front page shows the newest few of each.
export type ListSection = 'forecasts' | 'news';

interface ListPage {
  readonly title: string;
  readonly lede: string;
  readonly description: string;
  readonly empty: string;
}

const DRAFT_TAG = '<span class="tag">Draft</span>';
const HOME_STORIES = 3; // the newest stories of a list section on the front page; the rest are on its own page
const BACK: Readonly<Record<ArticleSection, { readonly href: string; readonly label: string }>> = {
  forecasts: { href: 'forecasts.html', label: 'All forecasts' },
  news: { href: 'news.html', label: 'All news' },
  articles: { href: 'index.html#articles', label: 'All articles' },
};
const LIST_PAGES: Readonly<Record<ListSection, ListPage>> = {
  forecasts: {
    title: 'Forecasts',
    lede: 'Every week, four AIs call Bitcoin up or down. Here are their calls, the reasons in their own words, and the check when the week ends.',
    description: 'The weekly BTC calls from ChatGPT, Claude, Gemini and Grok Bot, with their reasons and the check at the end of each week.',
    empty: 'No forecasts yet.',
  },
  news: {
    title: 'News',
    lede: 'Crypto stories from the weekly videos, told with charts, on-chain data and a link to every source.',
    description: 'Crypto stories from the Repka videos, with charts, on-chain data and every source linked.',
    empty: 'No news yet.',
  },
};

export function renderIndex(ledger: Ledger, articles: readonly Article[]): string {
  const body = `<section class="hero">
  <h1>Four AI models call Bitcoin every week. Every call is logged before anyone sees it.</h1>
  <p class="lede">On Monday, ChatGPT, Claude, Gemini and Grok each answer one question: does BTC end the week higher or lower than it started? The call goes into a public ledger first; only then does a video or post about it go out. On Friday it is checked, and misses stay on the record next to the hits.</p>
</section>

<section class="host">
  <img src="avatar.svg" alt="" width="56" height="56">
  <div>
    <h2>Who is Repka?</h2>
    <p>Repka is the grandpa who hosts the weekly videos: an animated AI character, not a real person.</p>
  </div>
</section>

<section>
  <h2>Scoreboard</h2>
  ${renderScoreChart(ledger)}
  <details class="table-toggle">
    <summary>Show as a table</summary>
    ${renderScoreboard(ledger)}
  </details>
  <p class="note">Hit rate is the share of checked calls that came true. A coin flip is right about half the time, so the bar is 50% over many weeks. Average confidence is how sure the model said it was on those same calls; the gap between the two shows how well a model knows its own limits.</p>
  <p><a href="ledger.html">Every call, with reasoning and prices</a> · <a href="data/ledger.json">Raw data (JSON)</a></p>
</section>

${homeList(articles, 'forecasts')}

${homeList(articles, 'news')}

<section id="articles">
  <h2>Articles</h2>
  ${articleList(inSection(articles, 'articles'), 'No articles yet.')}
</section>`;

  return page({
    title: 'AI Prediction Lab',
    description: 'Four AI models call whether Bitcoin ends each week higher or lower. Every call is logged in a public ledger before anyone sees it, misses included.',
    root: '',
    section: 'home',
    body,
  });
}

export function renderLedgerPage(ledger: Ledger): string {
  const body = `<section class="hero">
  <h1>The ledger</h1>
  <p class="lede">Every call the models have made, newest first. Nothing is edited or removed once it is recorded.</p>
</section>

<section>
  <h2>How a call is recorded</h2>
  <ul class="rules">
    <li><strong>Ledger first.</strong> A call is written here before any video or post about it goes out.</li>
    <li><strong>Append-only.</strong> Entries are never edited or deleted. A check is added as a new entry next to its call, and misses stay.</li>
    <li><strong>What a call holds.</strong> The model and its exact version, the direction (higher or lower), a confidence from 0 to 100%, the check date and the model&rsquo;s own reasoning.</li>
    <li><strong>Higher or lower.</strong> The BTC price at the end of the week is compared with the price at the start. Higher means the end price is above the start price; anything else, an unchanged price included, counts as lower.</li>
    <li><strong>Prompt hash.</strong> The SHA-256 hash of the exact prompt text the model received. Anyone holding the prompt can recompute it, so the prompt cannot be quietly changed later.</li>
    <li><strong>Times</strong> are in UTC.</li>
    <li><strong>Still open.</strong> The exact start and end times of the week in UTC, and which public BTC price source is used for the check. Both are written here before the first call is recorded.</li>
  </ul>
  <p><a href="data/ledger.json">Download the raw ledger (JSON)</a></p>
</section>

<section>
  <h2>All calls</h2>
  ${renderLedgerTable(ledger)}
</section>`;

  return page({
    title: 'Ledger',
    description: 'The full, append-only record of every weekly AI call on BTC: reasoning, prompt hash, prices and result.',
    root: '',
    section: 'ledger',
    body,
  });
}

export function renderListPage(articles: readonly Article[], section: ListSection): string {
  const list = LIST_PAGES[section];
  const body = `<section class="hero">
  <h1>${list.title}</h1>
  <p class="lede">${list.lede}</p>
</section>

<section>
  ${articleList(inSection(articles, section), list.empty)}
</section>`;

  return page({ title: list.title, description: list.description, root: '', section, body });
}

export function renderArticle(article: Article): string {
  const banner = article.isDraft
    ? '<p class="draft-banner"><strong>Draft.</strong> Local preview only; this article is not published.</p>'
    : '';
  const back = BACK[article.section];
  const body = `<article>
  <p class="back"><a href="../${back.href}">&larr; ${back.label}</a></p>
  ${banner}
  <h1>${escapeHtml(article.title)}</h1>
  <p class="meta"><time datetime="${article.date}">${article.date}</time></p>
  <div class="prose">
${article.html}
  </div>
</article>`;

  return page({ title: article.title, description: article.summary, root: '../', section: article.section, body });
}

function inSection(articles: readonly Article[], section: ArticleSection): readonly Article[] {
  return articles.filter((article) => article.section === section);
}

// A front-page block: the newest stories of a section, and a link to its page when there are more.
function homeList(articles: readonly Article[], section: ListSection): string {
  const list = LIST_PAGES[section];
  const stories = inSection(articles, section);
  const more = stories.length > HOME_STORIES ? `\n  <p><a href="${BACK[section].href}">${BACK[section].label}</a></p>` : '';
  return `<section id="${section}">
  <h2>${list.title}</h2>
  ${articleList(stories.slice(0, HOME_STORIES), list.empty)}${more}
</section>`;
}

function articleList(articles: readonly Article[], empty: string): string {
  if (articles.length === 0) return `<p class="empty">${empty}</p>`;
  const items = articles.map(
    (a) => `<li>
      <time datetime="${a.date}">${a.date}</time>${a.isDraft ? ` ${DRAFT_TAG}` : ''}
      <a href="articles/${a.slug}.html">${escapeHtml(a.title)}</a>
      <p>${escapeHtml(a.summary)}</p>
    </li>`,
  );
  return `<ul class="article-list">
    ${items.join('\n    ')}
  </ul>`;
}
