import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DISCLAIMER, escapeHtml, HOST_NOTE, page } from './html.ts';

const OPTIONS = { title: 'Ledger', description: 'All forecasts.', root: '../', section: 'ledger', body: '<p>x</p>' } as const;

describe('escapeHtml', () => {
  test('escapes every character that could break out of text or an attribute', () => {
    assert.equal(escapeHtml(`<a href="x">Tom & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  });
});

describe('page', () => {
  test('carries the disclaimer and the host note word for word', () => {
    const html = page(OPTIONS);

    assert.ok(html.includes(DISCLAIMER));
    assert.ok(html.includes(HOST_NOTE));
    assert.equal(DISCLAIMER, 'This is an experiment and documentation, not financial advice. I do not recommend buying or selling anything.');
    assert.equal(HOST_NOTE, 'The host is an animated AI character, not a real person.');
  });

  test('links everything relative to the site root it is given', () => {
    const html = page(OPTIONS);

    assert.match(html, /href="\.\.\/style\.css"/);
    assert.match(html, /href="\.\.\/index\.html"/);
    assert.doesNotMatch(html, /(href|src)="\//);
  });

  test('marks the current section in the navigation', () => {
    assert.match(page(OPTIONS), /<a href="\.\.\/ledger\.html" aria-current="page">/);
  });

  test('escapes the title and description', () => {
    const html = page({ ...OPTIONS, title: 'A <b> & "c"', description: '"quoted"' });

    assert.match(html, /<title>A &lt;b&gt; &amp; &quot;c&quot; · Repka<\/title>/);
    assert.match(html, /content="&quot;quoted&quot;"/);
  });
});
