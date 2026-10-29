// The site's pages: the front page, the ledger page and one page per article.
// Wording here is public copy, so it follows the content rules: no advice, no promises about prices.

import { DEFAULT_FLAT_THRESHOLD_PCT } from '../ledger.ts';
import type { Ledger } from '../ledger.ts';
import type { Article } from './articles.ts';
import { escapeHtml, page } from './html.ts';
import { renderLedgerTable, renderScoreboard } from './ledger-view.ts';

const DRAFT_TAG = '<span class="tag">Draft</span>';

export function renderIndex(ledger: Ledger, articles: readonly Article[]): string {
  const body = `<section class="hero">
  <h1>Four AI models make market calls. Every call is logged before anyone sees it.</h1>
  <p class="lede">ChatGPT, Claude, Gemini and Grok each call whether gold, silver, the S&amp;P 500 and the NASDAQ end higher, lower or about flat by a set date. The call goes into a public ledger first; only then does a video or post about it go out. Misses stay on the record next to the hits.</p>
</section>

<section class="host">
  <img src="turnip.svg" alt="" width="56" height="56">
  <div>
    <h2>Who is Repka?</h2>
    <p>Repka is the grandpa who hosts the videos: an animated AI character, not a real person. The name is Russian for &ldquo;little turnip&rdquo;, from the folk tale known in English as <i>The Enormous Turnip</i>.</p>
  </div>
</section>

<section>
  <h2>Scoreboard</h2>
  ${renderScoreboard(ledger)}
  <p class="note">Hit rate is the share of checked calls that came true. Average confidence is how sure the model said it was on those same calls. The gap between the two shows how well a model knows its own limits.</p>
  <p><a href="ledger.html">Every call, with reasoning and prices</a> · <a href="data/ledger.json">Raw data (JSON)</a></p>
</section>

<section id="articles">
  <h2>Articles</h2>
  ${articleList(articles)}
</section>`;

  return page({
    title: 'AI Prediction Lab',
    description: 'Four AI models make dated market calls. Every call is logged in a public ledger before anyone sees it, misses included.',
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
    <li><strong>What a call holds.</strong> The model and its exact version, the asset, the direction (up, down or flat), a confidence from 0 to 100%, the check date and the model&rsquo;s own reasoning.</li>
    <li><strong>Flat band.</strong> A move smaller than &plusmn;${DEFAULT_FLAT_THRESHOLD_PCT}% counts as flat. The band is stored with each call, so it cannot be moved afterwards.</li>
    <li><strong>Prompt hash.</strong> The SHA-256 hash of the exact prompt text the model received. Anyone holding the prompt can recompute it, so the prompt cannot be quietly changed later.</li>
    <li><strong>Times</strong> are in UTC.</li>
  </ul>
  <p><a href="data/ledger.json">Download the raw ledger (JSON)</a></p>
</section>

<section>
  <h2>All calls</h2>
  ${renderLedgerTable(ledger)}
</section>`;

  return page({
    title: 'Ledger',
    description: 'The full, append-only record of every AI market call: reasoning, prompt hash, prices and result.',
    root: '',
    section: 'ledger',
    body,
  });
}

export function renderArticle(article: Article): string {
  const banner = article.isDraft
    ? '<p class="draft-banner"><strong>Draft.</strong> Local preview only; this article is not published.</p>'
    : '';
  const body = `<article>
  <p class="back"><a href="../index.html#articles">&larr; All articles</a></p>
  ${banner}
  <h1>${escapeHtml(article.title)}</h1>
  <p class="meta"><time datetime="${article.date}">${article.date}</time></p>
  <div class="prose">
${article.html}
  </div>
</article>`;

  return page({ title: article.title, description: article.summary, root: '../', section: 'articles', body });
}

function articleList(articles: readonly Article[]): string {
  if (articles.length === 0) return '<p class="empty">No articles yet.</p>';
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
