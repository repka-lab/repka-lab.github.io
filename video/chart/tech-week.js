// The tech-week chart video, 1080x1080 at 30 fps, voiced by grandpa. The story is the AIs' Bitcoin calls: three of
// them flipped DOWN -> UP -> DOWN and their Monday calls still hit, because only Monday's calls are scored. Bitcoin is
// the main line; Nasdaq and the chip index are context. The lines draw themselves over Mon 2 - Fri 6 Nov 2026, the
// calls land in a big table under the chart as each check-in comes, one AI's own words pop up at each flip, and the
// scored column closes it. Timing and words come from assets/data/tech-week-story.json (window.TECH_STORY), timed by
// chart/layout_tech.py from the voice lines; score.py reads the same file for the voice and music.
// Same page contract as the episodes: episodeReady, TOTAL_FRAMES, SCENES, renderFrame(f) and report.
(() => {
  const DATA = window.TECH_WEEK;
  const STORY = window.TECH_STORY;
  const T = STORY.timeline;
  const SVG = 'http://www.w3.org/2000/svg';
  const LOGOS = '../../src/site/logos/';

  // The plot: one axis, % change from each line's start of the week.
  const X0 = 92, X1 = 830, Y0 = 262, Y1 = 690, TOP = 4, BOTTOM = -18;
  const WEEK = 5 * 1440; // minutes, Mon 00:00 to Sat 00:00 UTC
  const GAP = 15; // minutes; a longer step between two points has no trading data and is drawn dotted
  const x = (m) => X0 + (m / WEEK) * (X1 - X0);
  const y = (p) => Y0 + ((TOP - p) / (TOP - BOTTOM)) * (Y1 - Y0);
  const at = (day, h, m = 0) => day * 1440 + h * 60 + m; // day 0 is Monday

  // Colours checked with the dataviz validator on #161412 and on the navy #13233a, all pairs: violet, aqua, orange.
  const SERIES = [
    { id: 'chips', label: 'Chip index', legend: 'Chip index (SOX)', color: '#199e70', width: 3, r: 6 },
    { id: 'nasdaq', label: 'Nasdaq', legend: 'Nasdaq', color: '#9085e9', width: 3, r: 6 },
    { id: 'btc', label: 'Bitcoin', legend: "Bitcoin (Coinbase), the AIs' call", color: '#d0780c', width: 5, r: 8, main: true },
  ];
  const AIS = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', grok: 'Grok Bot' };
  // Each AI's Bitcoin call on Monday and at the two check-ins (data/ledger.json P0001-P0004, data/answers).
  const ROWS = [
    { ais: ['chatgpt', 'claude', 'gemini'], calls: ['DOWN', 'UP', 'DOWN'] },
    { ais: ['grok'], calls: ['UP', 'UP', 'DOWN'] },
  ];

  const WED = at(2, 17, 2); // the Wednesday check-in had prices to 17:02 UTC
  const THU = at(3, 16, 13); // the Thursday one to 16:13 UTC
  const MINUTES = { MON: 0, WED, THU, THU_CLOSE: at(3, 21), WEEK };
  // [frame, minute] for the time cursor, linear in between.
  const KEYS = T.keys.map(([f, name]) => [f, MINUTES[name]]);
  const COLS = [T.cols.mon, T.cols.wed, T.cols.thu];
  const END_AT = T.end, TOTAL = T.total;
  const FADE = 6;

  function minuteAt(f) {
    for (let i = 1; i < KEYS.length; i++) {
      const [f0, m0] = KEYS[i - 1], [f1, m1] = KEYS[i];
      if (f <= f1) return f <= f0 ? m0 : m0 + ((m1 - m0) * (f - f0)) / (f1 - f0);
    }
    return WEEK;
  }

  // The numbers the captions quote, all from the data file; checks() finds each one in its caption.
  const byId = Object.fromEntries(DATA.series.map((s) => [s.id, s]));
  const points = (id) => {
    const pts = byId[id].sessions.flatMap((s) => s.points);
    return pts[0][0] === 0 ? pts : [[0, 0], ...pts]; // stocks start at Friday's close, the week's start
  };
  const dayMove = (id, day) => {
    const closes = Object.entries(byId[id].daily).sort();
    const i = closes.findIndex(([d]) => d === day);
    return (closes[i][1] / closes[i - 1][1] - 1) * 100;
  };
  const weekMove = (id) => (byId[id].end / byId[id].base - 1) * 100;
  const valueAt = (id, m) => points(id).reduce((best, p) => (Math.abs(p[0] - m) < Math.abs(best[0] - m) ? p : best))[1];
  const fmt = (p) => {
    const r = Number(p.toFixed(1));
    return r === 0 ? '0.0%' : `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}%`;
  };
  const NUMBERS = {
    btcAtWed: valueAt('btc', WED),
    btcAtThu: valueAt('btc', THU),
    thu: { nasdaq: dayMove('nasdaq', '2026-11-05'), chips: dayMove('chips', '2026-11-05') },
    week: { chips: weekMove('chips'), nasdaq: weekMove('nasdaq'), btc: weekMove('btc') },
  };
  const WEEK_DIR = NUMBERS.week.btc < 0 ? 'DOWN' : 'UP';
  const HITS = ROWS.reduce((n, r) => n + (r.calls[0] === WEEK_DIR ? r.ais.length : 0), 0);
  const FACTS = [
    ['wed', `about ${Math.round(NUMBERS.btcAtWed)}%`],
    ['close', `Chip index ${fmt(NUMBERS.thu.chips)}`],
    ['close', `Nasdaq ${fmt(NUMBERS.thu.nasdaq)}`],
    ['week', `Bitcoin ${fmt(NUMBERS.week.btc)}`],
    ['week', `${HITS} of 4`],
  ];

  const ARROW = { UP: '▲', DOWN: '▼' };
  const call = (dir) => `${ARROW[dir]}&nbsp;${dir}`;
  const arrows = (text) => text.replace(/▲ UP/g, `<b>${call('UP')}</b>`).replace(/▼ DOWN/g, `<b>${call('DOWN')}</b>`);
  const cue = (id) => STORY.voice.find((c) => c.id === id);
  const CAPTIONS = STORY.voice.filter((c) => c.id !== 'end' && c.id !== 'hook'); // the cover says the hook

  const el = (tag, attrs = {}, parent) => {
    const node = tag.startsWith('svg:') ? document.createElementNS(SVG, tag.slice(4)) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    if (parent) parent.appendChild(node);
    return node;
  };
  const tile = (id) => `<span class="tile"><img src="${LOGOS}${id}.svg" alt=""></span>`;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const fade = (f, from, to = Infinity) => clamp((f - from) / FADE) * clamp((to - f) / FADE);

  const svg = document.getElementById('plot');
  const labels = document.getElementById('labels');
  const caption = document.getElementById('caption');
  const view = { series: [], stems: [], quotes: [], table: { heads: [], cells: [], arrows: [], who: [] } };

  // The table under the chart: who, then MON -> WED -> THU, then what was scored.
  const TABLE = { headY: 846, rowY: [870, 928], whoX: 48, colX: [206, 408, 610], colW: 150, arrowX: [360, 562], arrowW: 44, scoreX: 820 };

  function build() {
    document.getElementById('title').innerHTML = STORY.title;
    const legend = document.getElementById('legend');
    const key = (s) => `<span><i class="swatch" style="background:${s.color};height:${s.width}px"></i>${s.legend}</span>`;
    legend.innerHTML = SERIES.filter((s) => s.main).map(key).join('') + '<span class="ctx">Context:</span>' + SERIES.filter((s) => !s.main).map(key).join('');

    for (const p of [4, 0, -4, -8, -12, -16]) {
      el('svg:line', { x1: X0, x2: X1, y1: y(p), y2: y(p), stroke: p === 0 ? 'var(--base)' : 'var(--grid)', 'stroke-width': p === 0 ? 1.5 : 1 }, svg);
      el('div', { class: 'abs axis t', style: `left:16px;width:${X0 - 28}px;text-align:right;top:${y(p) - 13}px`, text: p === 0 ? '0%' : fmt(p).replace('.0', '') }, document.body);
    }
    for (let d = 1; d < 5; d++) el('svg:line', { x1: x(at(d, 0)), x2: x(at(d, 0)), y1: Y0, y2: Y1, stroke: 'var(--grid)', 'stroke-width': 1 }, svg);
    ['MON 2', 'TUE 3', 'WED 4', 'THU 5', 'FRI 6'].forEach((name, d) => {
      const sub = d === 1 ? '<small>midterms</small>' : '';
      el('div', { class: 'abs day t', style: `left:${x(at(d, 12))}px;top:${Y1 + 12}px`, html: name + sub }, document.body);
    });

    // The check-in stems: WED's label ends at its stem, THU's starts at its own, so the two never meet.
    for (const [minute, from, text, side] of [[WED, T.cols.wed, 'Wed check-in', 'left'], [THU, T.cols.thu, 'Thu check-in', 'right']]) {
      const line = el('svg:line', { x1: x(minute), x2: x(minute), y1: Y0 - 4, y2: Y1, stroke: 'var(--base)', 'stroke-width': 1.5, 'stroke-dasharray': '4 5' }, svg);
      const tag = el('div', { class: 'abs stem-label t', text, style: `top:${Y0 - 28}px` }, document.body);
      tag.style.left = `${side === 'left' ? x(minute) - 6 - tag.offsetWidth : x(minute) + 6}px`;
      view.stems.push({ line, tag, from });
    }

    for (const s of SERIES) {
      const pts = points(s.id);
      const dotted = el('svg:path', { fill: 'none', stroke: s.color, 'stroke-width': s.width - 1, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round', opacity: 0.8 }, svg);
      const solid = el('svg:path', { fill: 'none', stroke: s.color, 'stroke-width': s.width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      view.series.push({ ...s, name: s.label, pts, dotted, solid }); // .label becomes the head label's node
    }
    for (const s of view.series) {
      s.dot = el('svg:circle', { r: s.r, fill: s.color, stroke: 'var(--bg)', 'stroke-width': 3 }, svg);
      s.label = el('div', { class: s.main ? 'abs head main' : 'abs head' }, labels);
    }

    for (const [day, name] of [['wed', 'Wednesday'], ['thu', 'Thursday']]) {
      const [ai, words] = STORY.quotes[day];
      const node = el('div', { class: 'abs quote t', html: `<div class="who">${tile(ai)}${AIS[ai]} · ${name} check-in</div><div class="said">“${words}”</div>` }, document.body);
      view.quotes.push({ node, span: T.quotes[day] });
    }

    const table = document.getElementById('tracker');
    const tb = view.table;
    const head = (text, left, width, from) => tb.heads.push({ from, node: el('div', { class: 'abs colhead t', text, style: `left:${left}px;width:${width}px;top:${TABLE.headY}px` }, table) });
    ['Monday call', 'Wed', 'Thu'].forEach((text, k) => head(text, TABLE.colX[k], TABLE.colW, COLS[k]));
    head('Scored', TABLE.scoreX, TABLE.colW, T.score);
    ROWS.forEach((row, r) => {
      const top = TABLE.rowY[r];
      tb.who.push(el('div', { class: 'abs who-cell', html: row.ais.map(tile).join(''), style: `left:${TABLE.whoX}px;top:${top}px` }, table));
      row.calls.forEach((dir, k) => {
        tb.cells.push({ col: k, at: COLS[k], node: el('div', { class: 'abs call t', html: call(dir), style: `left:${TABLE.colX[k]}px;width:${TABLE.colW}px;top:${top}px` }, table) });
      });
      TABLE.arrowX.forEach((left, k) => {
        tb.arrows.push({ col: k + 1, at: COLS[k + 1], node: el('div', { class: 'abs arrow', text: '→', style: `left:${left}px;width:${TABLE.arrowW}px;top:${top}px` }, table) });
      });
      const hit = row.calls[0] === WEEK_DIR;
      tb.cells.push({ col: 3, at: T.score + r * 8, node: el('div', { class: 'abs call score t', text: hit ? 'HIT' : 'MISS', style: `left:${TABLE.scoreX}px;width:${TABLE.colW}px;top:${top}px` }, table) });
    });

    document.getElementById('end').innerHTML = '<h2 class="t">AI Prediction Lab</h2><div class="site t">repka-lab.github.io</div>'
      + '<div class="what t">Four AIs make one Bitcoin call each week. Every call is logged before the week opens, and only those calls are scored.</div>'
      + `<div class="ask t">${cue('end').text}</div>`;

    // The cover, big words only, on a darker navy: the title, the week's Bitcoin and Nasdaq lines kept quiet on a faint grid
    // rising out of the dark behind them with a mark at each end, the three AIs that flipped, their calls, and
    // Monday's stamped with what it scored.
    const flipped = ROWS[0];
    const cover = document.getElementById('cover');
    cover.innerHTML = '<div class="push"></div>';
    const push = cover.firstChild;
    const art = el('svg:svg', { class: 'art', width: 1080, height: 1080, viewBox: '0 0 1080 1080' }, push);
    art.innerHTML = '<defs><linearGradient id="cover-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d0780c" stop-opacity="0.14"/>'
      + '<stop offset="1" stop-color="#d0780c" stop-opacity="0"/></linearGradient>'
      + '<filter id="cover-glow" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="8"/></filter></defs>';
    const drawn = ['nasdaq', 'btc'].map((id) => view.series.find((s) => s.id === id)); // Bitcoin on top
    const values = drawn.flatMap((s) => s.pts.map((p) => p[1]));
    const hi = Math.max(...values) + 0.6, lo = Math.min(...values) - 0.6;
    const CX0 = 30, CX1 = 790, CY0 = 370, CY1 = 680;
    const cx = (m) => CX0 + (m / WEEK) * (CX1 - CX0);
    const cy = (p) => CY0 + ((hi - p) / (hi - lo)) * (CY1 - CY0);
    // A faint grid, every 2% and at each midnight, so it reads as a real chart; the zero line a little brighter.
    for (let p = Math.ceil(lo / 2) * 2; p <= hi; p += 2) {
      el('svg:line', { x1: CX0, x2: CX1, y1: cy(p), y2: cy(p), stroke: p === 0 ? '#22375a' : '#152741', 'stroke-width': p === 0 ? 2 : 1.5 }, art);
    }
    for (let d = 1; d < 5; d++) el('svg:line', { x1: cx(at(d, 0)), x2: cx(at(d, 0)), y1: CY0 - 24, y2: CY1 + 24, stroke: '#152741', 'stroke-width': 1.5 }, art);
    // Each line's paths first, then drawn in layers so neither hides the other: Bitcoin's fill, both glows, the
    // dotted gaps, the solid lines (each on a dark casing so a crossing reads), the end dots.
    const lines = drawn.map((s) => {
      let solid = '', dotted = '';
      s.pts.forEach(([m, p], i) => {
        const pt = `${cx(m)},${cy(p)}`;
        if (i === 0) solid += `M${pt}`;
        else if (m - s.pts[i - 1][0] > GAP) { dotted += `M${cx(s.pts[i - 1][0])},${cy(s.pts[i - 1][1])}L${pt}`; solid += `M${pt}`; }
        else solid += `L${pt}`;
      });
      return { s, solid, dotted, w: s.main ? 8 : 6 };
    });
    const btc = lines.find((l) => l.s.main); // Bitcoin trades all week, so its line is one piece and can be filled under
    const first = btc.s.pts[0][0], last = btc.s.pts[btc.s.pts.length - 1][0];
    el('svg:path', { d: `${btc.solid}L${cx(last)},${CY1 + 24}L${cx(first)},${CY1 + 24}Z`, fill: 'url(#cover-fill)' }, art);
    for (const l of lines) el('svg:path', { d: l.solid, fill: 'none', stroke: l.s.color, 'stroke-width': l.w + 6, opacity: 0.22, filter: 'url(#cover-glow)' }, art);
    for (const l of lines) {
      el('svg:path', { d: l.dotted, fill: 'none', stroke: l.s.color, 'stroke-width': l.w - 3, 'stroke-dasharray': '3 12', 'stroke-linecap': 'round', opacity: 0.85 }, art);
    }
    for (const l of lines) {
      el('svg:path', { d: l.solid, fill: 'none', stroke: 'var(--cover)', 'stroke-width': l.w + 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, art);
      el('svg:path', { d: l.solid, fill: 'none', stroke: l.s.color, 'stroke-width': l.w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, art);
    }
    const ends = lines.map(({ s, w }) => {
      const [m, p] = s.pts[s.pts.length - 1];
      el('svg:circle', { cx: cx(m), cy: cy(p), r: w + 3, fill: s.color, stroke: 'var(--cover)', 'stroke-width': 4 }, art);
      return { id: s.id, y: cy(p) };
    });
    // Bitcoin's mark is its coin, drawn here; Nasdaq's says what it stands for here, stocks, in its line's colour. The two ends sit close, so
    // the marks are pushed apart around them.
    const COIN = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#f7931a"/><g transform="rotate(14 50 50)" fill="#fff">'
      + '<text x="50" y="71" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="60">B</text>'
      + '<rect x="39" y="16" width="7" height="14" rx="2"/><rect x="51" y="16" width="7" height="14" rx="2"/>'
      + '<rect x="39" y="68" width="7" height="14" rx="2"/><rect x="51" y="68" width="7" height="14" rx="2"/></g></svg>';
    const MARKS = { btc: COIN, nasdaq: '<span class="ndq">STOCKS</span>' };
    ends.sort((a, b) => a.y - b.y);
    const mid = (ends[0].y + ends[1].y) / 2, apart = Math.max(52, (ends[1].y - ends[0].y) / 2);
    ends.forEach((e, i) => el('div', { class: 'mark t', html: MARKS[e.id], style: `left:${CX1 + 30}px;top:${i === 0 ? mid - apart : mid + apart}px` }, push));
    el('h1', { class: 't', html: '3 AIs called<br>the <span class="fall">fall.</span>' }, push);
    el('div', { class: 'who', html: flipped.ais.map(tile).join('') }, push);
    el('div', { class: 'then t', text: 'then flipped twice:' }, push);
    el('div', { class: 'flips', html: flipped.calls.map((dir, k) => `<div class="pill t${k === 0 ? ' scored' : ''}">${call(dir)}</div>`).join('<div class="to">→</div>') }, push);
    el('div', { class: 'stamp t', text: flipped.calls[0] === WEEK_DIR ? 'HIT' : 'MISS' }, push);
  }

  // The line up to minute c: solid within a session, dotted across a gap once the next session opens.
  function trace(pts, c) {
    let solid = `M${x(pts[0][0])},${y(pts[0][1])}`, dotted = '', head = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const [m0, p0] = pts[i - 1], [m1, p1] = pts[i];
      if (m1 > c && m1 - m0 > GAP) break; // the market is shut: the head waits on the last price
      if (m1 > c) {
        head = [c, p0 + ((p1 - p0) * (c - m0)) / (m1 - m0)];
        solid += `L${x(c)},${y(head[1])}`;
        break;
      }
      if (m1 - m0 > GAP) {
        dotted += `M${x(m0)},${y(p0)}L${x(m1)},${y(p1)}`;
        solid += `M${x(m1)},${y(p1)}`;
      } else solid += `L${x(m1)},${y(p1)}`;
      head = pts[i];
    }
    return { solid, dotted, head };
  }

  // Head labels sit right of their dots; ones that would touch are pushed apart, top to bottom.
  function placeLabels(items) {
    const gap = 35;
    items.sort((a, b) => a.y - b.y);
    items.forEach((it, i) => { it.ly = i === 0 ? it.y : Math.max(it.y, items[i - 1].ly + gap); });
    const over = items[items.length - 1].ly - (Y1 + 10);
    if (over > 0) items.forEach((it) => { it.ly -= over; });
    for (const it of items) {
      it.s.label.style.left = `${it.x + 14}px`;
      it.s.label.style.top = `${it.ly}px`;
    }
  }

  // A call lands: in from 135% size over 7 frames, its border lit in Bitcoin's orange that cools over 20.
  function slam(node, f, from, dim = 1) {
    const k = clamp((f - from) / 7);
    node.style.opacity = clamp((f - from) / 3) * dim;
    node.style.transform = `scale(${1 + 0.35 * (1 - k) ** 2})`;
  }
  const glow = (node, share) => { node.style.borderColor = `color-mix(in srgb, var(--btc) ${Math.round(share * 100)}%, var(--line))`; };

  function render(f) {
    const m = minuteAt(f);
    const items = [];
    for (const s of view.series) {
      const { solid, dotted, head } = trace(s.pts, m);
      s.solid.setAttribute('d', solid);
      s.dotted.setAttribute('d', dotted);
      s.dot.setAttribute('cx', x(head[0]));
      s.dot.setAttribute('cy', y(head[1]));
      s.label.innerHTML = `${s.name} <b>${fmt(head[1])}</b>`;
      items.push({ s, x: x(head[0]), y: y(head[1]) });
    }
    placeLabels(items);

    for (const st of view.stems) {
      const o = fade(f, st.from - 4);
      st.line.setAttribute('opacity', o);
      st.tag.style.opacity = o;
    }

    for (const q of view.quotes) {
      const [from, to] = q.span;
      const k = clamp((f - from) / 6);
      q.node.style.opacity = k * clamp((to - f) / FADE);
      q.node.style.transform = `translateY(${(1 - k) * 12}px) scale(${0.92 + 0.08 * k})`;
    }

    // From the rule on, only Monday's column stays bright: WED and THU dim, Monday's calls keep their glow.
    const ruled = clamp((f - T.rule) / 10);
    const dimOf = (col) => (col === 1 || col === 2 ? 1 - 0.72 * ruled : 1);
    const tb = view.table;
    tb.who.forEach((n) => { n.style.opacity = clamp((f - 6) / FADE); });
    tb.heads.forEach((h, k) => { h.node.style.opacity = clamp((f - (k < 3 ? Math.min(h.from, 6 + k * 3) : h.from)) / FADE) * dimOf(k); });
    for (const c of tb.cells) {
      slam(c.node, f, c.at, dimOf(c.col));
      if (c.col < 3) glow(c.node, c.col === 0 && f >= T.rule ? ruled : clamp(1 - (f - c.at) / 20) * (f >= c.at ? 1 : 0));
    }
    for (const a of tb.arrows) a.node.style.opacity = clamp((f - a.at) / FADE) * dimOf(a.col);

    const c = CAPTIONS.find((k) => f >= k.from && f < k.to);
    if (c) {
      if (caption.dataset.id !== c.id) {
        caption.className = c.big ? 'abs t big' : 'abs t';
        caption.innerHTML = c.big ? c.text : `${c.lead ? `<span class="lead">${c.lead}</span> ` : ''}${arrows(c.text)}`;
        caption.dataset.id = c.id;
      }
      caption.style.opacity = fade(f, c.from, c.to);
    } else caption.style.opacity = 0;

    document.getElementById('end').style.opacity = clamp((f - END_AT) / 10);
    // The cover pushes in slowly so it never sits still, fades to the dark as the hook ends, and the chart comes up
    // out of the dark; the disclaimer gives way to it and comes back with the chart.
    const cover = document.getElementById('cover');
    const on = clamp((T.cover + 3 - f) / 6);
    cover.style.opacity = on;
    cover.firstChild.style.opacity = clamp((T.cover - 2 - f) / 10);
    document.getElementById('disclaimer').style.opacity = 1 - on;
    cover.firstChild.style.transform = `scale(${1 + 0.035 * clamp(f / T.cover)})`;
  }

  // The frames the sound marks: a click as Monday's calls and each quote and score land, a slam on each flip.
  const CLICKS = {
    lines: [T.cols.mon],
    cards: [T.quotes.wed[0], T.quotes.thu[0], T.score, T.score + 8],
    stamps: [T.cols.wed, T.cols.thu],
  };

  // Before rendering: text inside the frame, no two head labels touching or a label on a stem tag, a quote or a
  // day name, the quote in the plot's empty corner, the caption clear of the table, the table cells apart, every
  // number where its caption quotes it, and none of the words our own text never uses.
  function checks() {
    const problems = [];
    const box = (n) => n.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const shown = (n) => Number(n.style.opacity || getComputedStyle(n).opacity) > 0.01;
    const visible = (n) => shown(n) && n.offsetParent !== null;
    const corner = x(at(3, 14, 30)) - 8; // Thursday's open, where the chip index starts its fall
    for (let f = 0; f < TOTAL; f += 3) {
      render(f);
      const texts = [...document.querySelectorAll('.t, .head')].filter((n) => visible(n) && (!n.closest('.card') || shown(n.closest('.card'))));
      for (const n of texts) {
        const r = box(n);
        if (r.left < 16 || r.right > 1064 || r.bottom > 1072) problems.push(`f${f} outside: ${n.textContent.slice(0, 40)}`);
      }
      if (f < END_AT) {
        const heads = view.series.map((s) => box(s.label));
        heads.forEach((a, i) => heads.slice(i + 1).forEach((b) => { if (hit(a, b)) problems.push(`f${f} labels touch`); }));
        const others = [...view.stems.map((s) => s.tag), ...view.quotes.map((q) => q.node), ...document.querySelectorAll('.day')].filter(shown).map(box);
        heads.forEach((a) => { if (others.some((b) => hit(a, b))) problems.push(`f${f} a label touches a stem tag, quote or day`); });
        for (const q of view.quotes.filter((q) => shown(q.node))) {
          const r = box(q.node);
          if (r.right > corner || r.bottom > Y1 - 4) problems.push(`f${f} quote leaves the corner: ${Math.round(r.right)}, ${Math.round(r.bottom)}`);
        }
        if (shown(caption) && box(caption).bottom > TABLE.headY - 6) problems.push(`f${f} caption reaches the table: ${Math.round(box(caption).bottom)}`);
      }
    }
    const cells = [...document.querySelectorAll('#tracker > *')].map(box);
    cells.forEach((a, i) => cells.slice(i + 1).forEach((b) => { if (hit(a, b)) problems.push('table cells touch'); }));
    if (cells.some((r) => r.right > 1032 || r.bottom > 998)) problems.push('table leaves its area');
    if (ROWS[0].calls[0] !== WEEK_DIR) problems.push('the cover says "Still hit." but the flipped AIs missed');
    const missing = FACTS.filter(([id, s]) => !cue(id).text.includes(s)).map(([id, s]) => `${id}: ${s}`);
    const ours = [document.title, STORY.title, ...STORY.voice.flatMap((c) => [c.lead ?? '', c.text, c.say ?? '']),
      ...['legend', 'note', 'tracker', 'end', 'cover'].map((id) => document.getElementById(id).textContent), ...view.stems.map((s) => s.tag.textContent)].join(' ');
    const forbidden = ours.match(/\b(buy|sell|should|invest|guaranteed|will go up|will go down|won|trump|short|long|wrong|bubble|sell-off|selloff)\b/gi) ?? [];
    const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
    return { frames: TOTAL, seconds: +(TOTAL / 30).toFixed(1), monitorStart: 0, clicks: CLICKS, numbers: round(NUMBERS), hits: HITS, missing,
      problems: [...new Set(problems)].slice(0, 12), problemCount: problems.length, forbidden };
  }

  window.TOTAL_FRAMES = TOTAL;
  window.SCENES = { cover: [0, T.cover], chart: [T.cover, END_AT], end: [END_AT, TOTAL] };
  window.renderFrame = render;
  window.episodeReady = (async () => {
    await document.fonts.load('700 54px Kalam');
    await document.fonts.ready;
    build();
    await Promise.all([...document.images].map((img) => img.decode().catch(() => { throw new Error(`logo did not load: ${img.src}`); })));
    window.report = checks();
    render(0);
    return true;
  })();
})();
