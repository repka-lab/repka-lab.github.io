// The page frame every site page shares: head tags, header with navigation, and the footer
// that carries the disclaimer and the host note word for word.

export const DISCLAIMER =
  'This is an experiment and documentation, not financial advice. I do not recommend buying or selling anything.';
export const HOST_NOTE = 'The host is an animated AI character, not a real person.';

const SITE_NAME = 'Repka';

export type Section = 'home' | 'ledger' | 'articles';

export interface PageOptions {
  readonly title: string;
  readonly description: string;
  readonly root: string; // relative path from this page to the site root: '' or '../'
  readonly section: Section;
  readonly body: string; // ready HTML
}

const NAV: readonly { readonly section: Section; readonly href: string; readonly label: string }[] = [
  { section: 'home', href: 'index.html', label: 'Forecasts' },
  { section: 'ledger', href: 'ledger.html', label: 'Ledger' },
  { section: 'articles', href: 'index.html#articles', label: 'Articles' },
];

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export function page(options: PageOptions): string {
  const { root } = options;
  const title = escapeHtml(`${options.title} · ${SITE_NAME}`);
  const description = escapeHtml(options.description);
  const nav = NAV.map((item) => {
    const current = item.section === options.section ? ' aria-current="page"' : '';
    return `<a href="${root}${item.href}"${current}>${item.label}</a>`;
  }).join('\n        ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="${root}avatar.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${root}style.css">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="${root}index.html">
        <img src="${root}avatar.svg" alt="" width="28" height="28">
        <span>${SITE_NAME}<small>AI Prediction Lab</small></span>
      </a>
      <nav aria-label="Site">
        ${nav}
      </nav>
    </div>
  </header>
  <main class="wrap">
${options.body}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p><strong>${DISCLAIMER}</strong></p>
      <p>${HOST_NOTE}</p>
      <p>The full record is public: <a href="${root}data/ledger.json">ledger.json</a>.</p>
    </div>
  </footer>
</body>
</html>
`;
}
