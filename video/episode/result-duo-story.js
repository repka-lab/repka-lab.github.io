/*
 * The week's result on two markets, Bitcoin and the Nasdaq Composite (assets/data/result-duo-2026-11-14.json).
 * Frame 0 is the thumbnail: how many AIs got both and both moves, over the four logos, each stamped with its
 * score, both calls as triangles under its name, while he holds his head. Then the Bitcoin calls pop in under
 * the logos; "Friday's close": the chart cuts in, the week's 4h candles sweep in from Monday's open and the
 * camera punches in on the week's figures. Then the Nasdaq calls, and its close the same way, the week's five
 * daily candles growing from Friday 6 November's close.
 * Then one card at a time whips in, big, with both calls: a stamp slams down on each, its score pops in, a
 * corner count goes up, and his jab, the end of his voice line, is slapped on under the card as a sticker.
 * Then the hero's answer replaces its card and its own words are marked as the camera eases in, and the tally
 * against a coin cuts in, with the logos under it and their scores coming down one after another.
 * No disclaimer in the frame: it goes in the post text (CLAUDE.md rule 4).
 * The outcome, the marks and the figures all come from the story's `result` and the calls; his voice lines
 * are checked against them, so a different price stops here until they are rewritten.
 * He speaks his own captions (the story's "voice" cues), so there is no subtitle layer. Every time comes from
 * the story's beats. Loads after episode.js and uses its helpers; an IIFE, because classic scripts share one
 * global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);
  const FILE = 'result-duo-2026-11-14.json';

  const BEAT = 1800 / STORY.music.bpm; // frames per beat at 30 fps
  const CALLS_AT = STORY.hookFrames - HOOK_DISSOLVE; // the monitor starts; every caption is gone by then

  // A beat as the story writes it; its start is in monitor frames, as score.py counts them.
  const beatOf = (id) => {
    const beat = STORY.beats.find((b) => b.id === id);
    if (!beat) throw new Error(`${FILE}: no beat "${id}"`);
    return beat;
  };
  const hookAt = (id) => CALLS_AT + beatOf(id).start;
  const VERDICT = beatOf('verdict'); // whose own words are marked, and his lead-in to them
  const VERDICT_AT = VERDICT.start; // monitor frames from here on
  const SAID_AT = VERDICT_AT + VERDICT.said;
  const SCORED_AT = beatOf('scored').start;
  // One answer's beat, named after its model: it whips in, a stamp slams down on each call, his jab lands.
  const cardBeat = (model) => {
    const { start, stamps, jab } = beatOf(model.toLowerCase());
    return { start, stampAts: stamps.map((at) => start + at), jabAt: start + jab.at, words: jab.text };
  };

  const UP_INK = '#2fc4b2';
  const DOWN_INK = '#ff6b66';
  const SPLIT_INK = '#f08a24';
  const MINUS = '−';
  const WEEK = { btcOpens: '2026-11-09T00', btcLastCandle: '2026-11-13T20', btcCloses: '2026-11-13T23:59:59.000Z', ndqBase: '2026-11-06', ndqLast: '2026-11-13' };
  const NDQ_BARS = 30; // the Nasdaq tile's daily candles, the last of them the week's Friday
  const PRICE_SLACK = 0.015; // the Nasdaq chart's Yahoo closes against the official ones, rounded to 2 dp

  // The two markets: its key in the ideas, its tile's ids, its candles, the week's two prices, the candle the
  // sweep starts from and where the dashed start line starts. A market's move is read the way classifyMove
  // in src/ledger.ts reads it.
  function market({ key, id, name, tag, beat, close, candles, first, lineFrom, sweep, price }) {
    const { start, end } = STORY.result[key];
    const went = end > start ? 'up' : 'down';
    const change = `${Math.abs((100 * (end - start)) / start).toFixed(1)}%`;
    const closeAt = hookAt(close);
    return {
      key, id, name, tag, candles, first, lineFrom, sweep, price, start, end, went, change,
      ink: went === 'up' ? UP_INK : DOWN_INK,
      signed: `${went === 'up' ? '+' : MINUS}${change}`,
      callsAt: hookAt(beat),
      closeAt,
      figuresAt: closeAt + sweep.from + (candles.length - 1 - first) * sweep.step + sweep.grow, // the last candle is up
    };
  }
  const BTC_CANDLES = JSON.parse(document.getElementById('candles-btc').textContent);
  const NDQ_CANDLES = JSON.parse(document.getElementById('data-nasdaq').textContent).candles.slice(-NDQ_BARS);
  const BTC_OPEN = BTC_CANDLES.findIndex(({ time }) => time.startsWith(WEEK.btcOpens));
  const NDQ_BASE = NDQ_CANDLES.findIndex(({ day }) => day === WEEK.ndqBase);
  if (BTC_OPEN < 0) throw new Error(`chart: no BTC candle at the week's open ${WEEK.btcOpens}`);
  if (NDQ_BASE < 0) throw new Error(`chart: no Nasdaq candle on ${WEEK.ndqBase}`);
  const usd = (price) => `$${Math.round(price).toLocaleString('en-US')}`;
  const points = (price) => Math.round(price).toLocaleString('en-US');
  const BTC = market({ key: 'btc', id: 'btc', name: 'Bitcoin', tag: 'BTC', beat: 'btc', close: 'btcclose', candles: BTC_CANDLES, first: BTC_OPEN, lineFrom: 'open', sweep: { from: 3, step: 2, grow: 4 }, price: usd });
  const NDQ = market({ key: 'nasdaq', id: 'ndq', name: 'Nasdaq', tag: 'NASDAQ', beat: 'nasdaq', close: 'ndqclose', candles: NDQ_CANDLES, first: NDQ_BASE + 1, lineFrom: 'base', sweep: { from: 3, step: 8, grow: 6 }, price: points });
  const MARKETS = [BTC, NDQ];
  const BTC_FINAL = STORY.result.btc.at >= WEEK.btcCloses;

  const markOf = (idea, m) => (idea[m.key].call === m.went ? 'hit' : 'miss');
  const scoreOf = (idea) => MARKETS.filter((m) => markOf(idea, m) === 'hit').length;
  const scoreWords = (idea) => `${scoreOf(idea)} of ${MARKETS.length}`;
  const SCORE_INK = [DOWN_INK, SPLIT_INK, UP_INK]; // 0, 1 or 2 of 2
  const countOf = (mark) => IDEAS.ideas.reduce((n, idea) => n + MARKETS.filter((m) => markOf(idea, m) === mark).length, 0);
  const callsOf = (m, call) => IDEAS.ideas.filter((idea) => idea[m.key].call === call);
  const nameOf = ({ model, name }) => name ?? model;

  const CAPTION_LINE = { x: 320, y: 56, size: 44, min: 34, maxWidth: 600, stroke: 7, lines: [48, 94] }; // one line at y, two at lines
  const THUMB_LINES = [{ y: 62, size: 64, min: 50, stroke: 10 }, { y: 104, size: 36, min: 28, stroke: 6 }]; // frame 0's two lines
  const HOOK_SLOT = { x: 500, scale: 0.85, floor: 328 };
  // His finger follows what each caption is about, screen px; out of reach, the arm points straight at it.
  const POINTS = [
    { at: 0, target: [270, 170] }, // the Bitcoin calls
    { at: BTC.closeAt, target: [340, 290] }, // its week's last candle
    { at: NDQ.callsAt, target: [270, 290] }, // the Nasdaq calls
    { at: NDQ.closeAt, target: [340, 240] }, // its week's last candle
  ];
  const POINT = { move: 6 };
  const NOD = { head: 1.5 };
  const LOOK = { eyes: 2.5, ramp: 4, hold: 16 }; // a glance at the screen as each caption lands
  const BROWS = { rest: 1, lift: 2.5, ramp: 4 };
  const GRAB = { reach: 6, shake: 5, shakeFrames: 10, left: [56, 52], right: [104, 52] }; // hands on his head
  // The four models in a row with one market's calls under their names; the calls pop in one after another.
  const LOGO_ROW = { x: 40, step: 128, y: 140, size: 88, nameY: 256, nameSize: 22, nameGap: 8, callY: 290, callSize: 24, right: 530, stagger: 4 };
  const LOGO_STAMP = { y: 202, size: 22, tilt: -10, padX: 6, padY: 1, rx: 4, spacing: 1, stroke: 2, width: 120 }; // its score over each logo
  // Both calls under each name as triangles centred on y, each over its market's tag.
  const PATH = { y: 288, width: 26, height: 22, gap: 30, tagY: 316, tagStyle: "font: 700 12px system-ui, 'Segoe UI', sans-serif", tagInk: '#c7d0dc' };
  const SCREEN_ROOM = { right: 530, top: 108, bottom: 328 }; // left of him and below the caption shade
  const TILE_PAD = 12;
  // The candles' pane in each chart tile; the week's candles grow from their opens, one after another.
  const CHART = { x: 34, width: 312, top: 210, bottom: 304 };
  // The camera punches in on the week's figures as they land, with a shake; they stay under the caption.
  const PUNCH = { centre: [376, 197], zoom: 1.3, frames: 4, shake: 8, shakeFrames: 8, top: 72 };
  const TITLE_IN = { start: 16, frames: 6 }; // after the hook is gone
  // Each answer's card, drawn at 0,0 and shown 1.7 times its size; it whips in and out over `whip` frames,
  // pushing the one before out, both running past their marks and settling.
  const SLOT = { x: 52, y: 80, scale: 1.7, whip: 8 };
  const RESULT_CARD = { x: 0, y: 0, width: 316, height: 126, rx: 8, bar: 5, barInset: 8, logo: [14, 12], logoScale: 1.5, nameX: 56, rowY: 37, edge: 14 };
  // A call per row: the market, its call and confidence, its stamp at the right.
  const CALL_ROW = { ys: [72, 110], marketX: 16, callX: 96, confGap: 10, stampX: 268, stampLift: 7, gap: 4 };
  const SCORE = { size: 22, pop: 4 }; // the card's score, top right, popping in after its last stamp
  // The hero's answer: its card with the sentence word for word, 4 lines at most.
  const QUOTE_CARD = { height: 140, kicker: 'Nasdaq answer', fade: 4 };
  const RESULT_REASON = { sizes: [19, 18, 17, 16], inset: 16, room: 32, lines: 4, first: 66, step: 22 };
  // The stamps slam down and stay.
  const STAMP = { words: { hit: 'HIT', miss: 'MISS' }, ink: { hit: UP_INK, miss: DOWN_INK }, size: 20, tilt: -6, padX: 8, padY: 1, rx: 5, spacing: 2, stroke: 3, inset: 2, slam: 5, from: 1.8 };
  const STAMP_SHAKE = { px: 7, frames: 5 };
  // The camera never holds still: each hook shot, each card, the hero's words and the tally drift in on their
  // subject, fast off the cut and slowing, until the next cut.
  const DRIFT = { hook: 1.06, card: 1.03, cardCentre: [320, 210], verdict: 1.025, scored: 1.025, scoredCentre: [320, 120], margin: 8 };
  const LOGO_FOCUS = [400, 220]; // right of the logo row's middle, so it stays left of him, where the hook's logo shots drift in
  const FIGURES_FOCUS = [376, 290]; // low on the week's figures, so their last line stays above the frame's edge
  const OVERSHOOT = 1.3; // how far a whip or a slam runs past its mark before it settles
  const FLASH = { opacity: 0.35, frames: 5, fill: '#ffffff' }; // a white flash as each week's figures land and on the tally
  const HOP = { px: 10, frames: 8 }; // a logo hops as its call pops in
  const JAB_WIGGLE = { deg: 2, period: 6, frames: 16 }; // the sticker wobbles once it is slapped on
  const SCORED_DROP = { from: -36, frames: 8, fade: 3 }; // the tally's logos drop in one after another, each score after its logo
  const REVEAL_SHAKE = { px: 4, frames: 6 }; // a knock as each part of the tally comes in
  // His jab, slapped on under the card in screen px; the last card's goes before the hero's words come in.
  const JAB = { centre: [400, 316], size: 26, tilt: -3, padX: 10, padY: 3, rx: 6, ink: '#0a1526', from: 1.4, slap: 4, right: 640, bottom: 358 };
  const COUNTER = { x: 16, y: 28, centre: [16, 22], fill: '#eef2f6', style: "font: 700 18px system-ui, 'Segoe UI', sans-serif" };
  // Its own words, marked as the camera eases in on its card, no closer than the card fits with `margin`
  // px on each side; `at` counts from the quoted line.
  const HERO_MARK = { at: 4, sweep: 8, opacity: 0.5, rx: 3, zoom: 1.6, margin: 12, frames: 8 };
  const TALLY_STYLE = "font: 900 44px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 6px; stroke-linejoin: round";
  const LEAD = { x: 320, y: 66, size: 34, min: 28, maxWidth: 600, stroke: 5 };
  // The tally against a coin, both lines at once over a scrim, the logos moved in under it and shifted to the middle.
  const SCORED = {
    lines: [{ x: 320, y: 70, size: 44, min: 34, maxWidth: 600, stroke: 6 }, { x: 320, y: 116, size: 40, min: 32, maxWidth: 600, stroke: 6 }],
    scrim: 0.92,
    shift: 44,
    shake: 8,
    shakeFrames: 8,
  };
  const END_ASK = { lines: [136, 176], maxWidth: 420, replyY: 210, ledgerY: 246, arrowDrop: 32 }; // one sentence a line
  const END_DRAW = 8;
  const END_NOD = { depth: 4, ramp: 6 };
  const ASK_POINT = [196, 140]; // the left end of the question, where his finger aims
  const SWAY = { frames: 45, head: 3, arm: 4 };

  const LEFT_ARM = armWith(HAND);
  const RIGHT = { shoulder: RIG.pivots['arm-right'], elbow: RIG.pivots['arm-right-forearm'], hand: RIG.hands.right };

  const noise = (f, i) => {
    const v = Math.sin(f * 12.9898 + i * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  // Mixes two sets of part angles; a part missing on one side is 0 there, its rest angle.
  const blend = (from, to, t) =>
    Object.fromEntries([...new Set([...Object.keys(from), ...Object.keys(to)])].map((part) => [part, lerp(from[part] ?? 0, to[part] ?? 0, t)]));
  // The view `zoom` times closer around a point, kept inside the frame.
  const around = ([x, y], zoom) => {
    const [width, height] = [640 / zoom, 360 / zoom];
    return [clamp(x - width / 2, 0, 640 - width), clamp(y - height / 2, 0, 360 - height), width, height];
  };
  const PUNCH_VIEW = around(PUNCH.centre, PUNCH.zoom);
  // The view `zoom` times closer about a point in it, which stays where it is on the screen.
  const zoomAbout = ([x, y, width, height], [cx, cy], zoom) => [cx - (cx - x) / zoom, cy - (cy - y) / zoom, width / zoom, height / zoom];
  const viewCentre = ([x, y, width, height]) => [x + width / 2, y + height / 2];
  // 0 to 1, running past 1 and settling back: a whip or a slam that overshoots.
  const overshoot = (t) => 1 + (OVERSHOOT + 1) * (t - 1) ** 3 + OVERSHOOT * (t - 1) ** 2;
  // A drift's zoom at frame f: fast off the cut at `from`, slowing to `zoom` at `to`.
  const drift = (f, from, to, zoom) => lerp(1, zoom, 1 - (1 - progress(f, from, to - from)) ** 2);
  const PUNCH_DRIFTED = zoomAbout(PUNCH_VIEW, FIGURES_FOCUS, DRIFT.hook); // the closest the hook gets to the figures
  const CARD_VIEW = zoomAbout(FULL_VIEW, DRIFT.cardCentre, DRIFT.card); // the closest it gets to a card
  // A box in a view's screen px.
  function screenBox(box, [vx, vy, vw]) {
    const s = 640 / vw;
    const [left, top] = [(box.x - vx) * s, (box.y - vy) * s];
    return { left, top, right: left + box.width * s, bottom: top + box.height * s };
  }
  // The strongest of `events` ([at, peak, frames]) at frame f, each dying out over its frames.
  const strongest = (f, events) => Math.max(0, ...events.map(([at, peak, frames]) => (f >= at ? peak * (1 - progress(f, at, frames)) : 0)));
  const toLocal = ([x, y], left, top, scale) => [(x - left) / scale, (y - top) / scale];
  const boxCentre = (node) => {
    const box = node.getBBox();
    return [box.x + box.width / 2, box.y + box.height / 2];
  };
  // 1 from `from` to `to`, easing in and out over `ramp` frames.
  const during = (h, from, to, ramp) => ease(progress(h, from, ramp)) * (1 - ease(progress(h, to - ramp, ramp)));
  // 0 before `at`, then easing to 1 over `frames`, already showing on `at` itself: a cut lands on its frame.
  const landing = (f, at, frames = BEAT_IN) => ease(progress(f + 1, at, frames));
  const squash = (node, mid, s) => node.setAttribute('transform', `translate(0 ${mid}) scale(1 ${s}) translate(0 ${-mid})`);
  // An overlay pinned to the frame while the view moves.
  const pin = (node, [x, y, width]) => node.setAttribute('transform', `translate(${x} ${y}) scale(${width / 640})`);
  const heroIdea = () => IDEAS.ideas.find(({ model }) => model === VERDICT.hero);
  const scoredWords = () => {
    const calls = IDEAS.ideas.length * MARKETS.length;
    return [`${countOf('hit')} of ${calls} hit. A coin averages ${calls / 2}.`, 'One week proves nothing.'];
  };
  const both = () => IDEAS.ideas.filter((idea) => scoreOf(idea) === MARKETS.length).length;
  const BOX = (box) => `x ${box.x.toFixed(0)}–${(box.x + box.width).toFixed(0)}, y ${box.y.toFixed(0)}–${(box.y + box.height).toFixed(0)}`;

  // The view shaken by the strongest of `events` ([at, px, frames]) at frame f, each dying out over its
  // frames; it shrinks by the shake, so the shake stays inside the view.
  function shaken([x, y, width, height], f, events) {
    const px = Math.max(0, ...events.map(([at, size, frames]) => (f >= at ? size * (1 - progress(f, at, frames)) : 0)));
    if (!px) return [x, y, width, height];
    const a = (px * width) / 640;
    const [w, h] = [width - (2 * a * 16) / 9, height - 2 * a];
    return [x + (width - w) / 2 + (noise(f, 0) - 0.5) * 2 * a, y + a + (noise(f, 1) - 0.5) * 2 * a, w, h];
  }

  // One line centred on x, shrunk to maxWidth if it has to be but never under min; its stroke shrinks with it.
  function bigLine(parent, parts, { x, y, size, min, maxWidth, stroke }, attrs) {
    const text = parent.appendChild(svgEl('text', { x, y, 'text-anchor': 'middle', ...attrs }));
    text.append(...parts.map(([words, ink]) => textEl(words, ink ? { fill: ink } : {}, 'tspan')));
    text.style.fontSize = `${size}px`;
    const fitted = size * Math.min(1, maxWidth / text.getComputedTextLength());
    if (fitted < min) throw new Error(`"${text.textContent}" needs ${fitted.toFixed(1)} px to fit ${maxWidth} px, under the ${min} px floor`);
    text.style.fontSize = `${fitted}px`;
    text.style.strokeWidth = `${(stroke * fitted) / size}px`;
    return text;
  }

  // ---------------------------------------------------------------- figure

  // Two-bone IK for the right arm, the mirror of armWith: the elbow bends down and out to the right.
  function reachRight(target) {
    const upperArm = dist(RIGHT.shoulder, RIGHT.elbow);
    const forearm = dist(RIGHT.elbow, RIGHT.hand);
    const upperRest = angle(RIGHT.shoulder, RIGHT.elbow);
    const forearmRest = angle(RIGHT.elbow, RIGHT.hand);
    const d = clamp(dist(RIGHT.shoulder, target), Math.abs(upperArm - forearm) + 0.01, upperArm + forearm - 0.01);
    const upper = angle(RIGHT.shoulder, target) + Math.acos((upperArm ** 2 + d ** 2 - forearm ** 2) / (2 * upperArm * d));
    const elbow = [RIGHT.shoulder[0] + upperArm * Math.cos(upper), RIGHT.shoulder[1] + upperArm * Math.sin(upper)];
    return {
      'arm-right': wrap(deg(upper - upperRest)),
      'arm-right-forearm': wrap(deg(angle(elbow, target) - upper)) - deg(forearmRest - upperRest),
    };
  }

  // ---------------------------------------------------------------- hook

  // The end card has no follow line: the question breaks into its sentences, one a line, and the reply,
  // its arrow and the ledger line move down under it.
  function restyleEnd() {
    if ($('s4', 'lead').textContent.trim()) throw new Error(`${FILE}: the end card has no follow line, so end.lead must be ""`);
    const ask = $('s4', 'ask');
    const lines = ask.textContent.split('. ').map((line, i, all) => (i < all.length - 1 ? `${line}.` : line));
    if (lines.length !== END_ASK.lines.length) throw new Error(`${FILE}: end.ask "${ask.textContent}" must be ${END_ASK.lines.length} sentences`);
    ask.textContent = '';
    lines.forEach((line, i) => {
      const span = ask.appendChild(textEl(line, { x: ask.getAttribute('x'), y: END_ASK.lines[i] }, 'tspan'));
      const width = span.getComputedTextLength();
      if (width > END_ASK.maxWidth) throw new Error(`end: "${line}" is ${width.toFixed(0)} px, the card fits ${END_ASK.maxWidth}`);
    });
    $('s4', 'reply').setAttribute('y', END_ASK.replyY);
    $('s4', 'ledger').setAttribute('y', END_ASK.ledgerY);
    const arrow = $('s4', 'arrow');
    arrow.parentNode.insertBefore(svgEl('g', { transform: `translate(0 ${END_ASK.arrowDrop})` }), arrow).appendChild(arrow);
  }

  // A market's calls as two caption lines: the larger side counted, the other named when it is one model
  // and counted when it is as many.
  function callLines(m) {
    const [major, minor] = ['up', 'down']
      .map((call) => ({ call, ideas: callsOf(m, call), ink: call === 'up' ? UP_INK : DOWN_INK }))
      .sort((a, b) => b.ideas.length - a.ideas.length);
    if (!minor.ideas.length) throw new Error(`ideas: every ${m.name} call is ${major.call}, the captions need both sides`);
    const many = minor.ideas.length > 1;
    const first = `${m.name}: ${major.ideas.length} ${many ? '' : 'AIs '}said `;
    const second = many ? `${minor.ideas.length} said ` : `${nameOf(minor.ideas[0])} said `;
    return [[[first], [major.call.toUpperCase(), major.ink], ['.']], [[second], [minor.call.toUpperCase(), minor.ink], ['.']]];
  }
  const closeLines = (m) => [[["Friday's close:"]], [[`${m.name} `], [`${m.went} ${m.change}`, m.ink], ['.']]];
  const bothLine = () => {
    const n = both();
    return n === 1 ? 'Only 1 AI got both.' : `${n} AIs got both.`;
  };

  // One caption at a time, each until the next starts; a caption is one or two lines of [words, ink] parts,
  // and the thumbnail's lines have their own sizes.
  const hookCaptions = () => [
    { start: 0, specs: THUMB_LINES, lines: [[[bothLine()]], [['Bitcoin '], [`${BTC.went} ${BTC.change}`, BTC.ink], ['. Nasdaq '], [`${NDQ.went} ${NDQ.change}`, NDQ.ink], ['.']]] },
    { start: BTC.callsAt, lines: callLines(BTC) },
    { start: BTC.closeAt, lines: closeLines(BTC) },
    { start: NDQ.callsAt, lines: callLines(NDQ) },
    { start: NDQ.closeAt, lines: closeLines(NDQ) },
  ];

  // The captions, 1.5 times the weekly size; each one he speaks is his voice line word for word. The
  // ideas are checked here, as the hook is planned first. No coin in this episode, and no disclaimer.
  function planResultHook() {
    checkResultIdeas();
    $('s0', 'coin').style.display = 'none';
    const shade = $('s0', 'root').querySelector('rect[fill="url(#s0-shade)"]');
    if (!shade) throw new Error('result-duo.html: the hook has no shade');
    const layer = $('s0', 'beats');
    const captions = hookCaptions().map(({ start, specs, lines }, i, all) => {
      const said = lines.map((parts) => parts.map(([words]) => words).join('')).join(' ');
      if (start > 0 && !STORY.voice.some(({ text }) => text === said)) throw new Error(`hook: "${said}" is not one of his voice lines`);
      const node = layer.appendChild(svgEl('g'));
      const ys = lines.length === 1 ? [CAPTION_LINE.y] : CAPTION_LINE.lines;
      lines.forEach((parts, n) => bigLine(node, parts, { ...CAPTION_LINE, y: ys[n], ...specs?.[n] }, { class: 'hook-title' }));
      return { node, start, end: all[i + 1]?.start ?? CALLS_AT, centre: boxCentre(node) };
    });
    restyleEnd();
    return { captions, shade };
  }

  // A caption pops in on its beat, the first is up from frame 0, and each cuts to the next.
  function showBeat({ node, start, end, centre }, h) {
    popIn(node, start > 0 ? landing(h, start) : 1, centre);
    if (h >= end) node.style.opacity = 0;
  }

  // Where his finger aims at hook frame h: each caption's target, eased in from the one before.
  function pointTarget(h) {
    const i = POINTS.findLastIndex(({ at }) => at <= h);
    const from = POINTS[Math.max(0, i - 1)].target;
    return mix(from, POINTS[i].target, ease(progress(h, POINTS[i].at, POINT.move)));
  }

  const hookY = (parts) => standOn(HOOK_SLOT.floor + SOLE_DROP, HOOK_SLOT.scale, parts, 'front');

  // He holds his head on the thumbnail, then points at the screen and nods on the beat; when Bitcoin's
  // figures land he grabs his head again, shaking it, until the Nasdaq calls.
  function hookParts(h) {
    const top = hookY(Rig.STANDING);
    const point = LEFT_ARM.reach(toLocal(pointTarget(h), HOOK_SLOT.x, top, HOOK_SLOT.scale));
    const grab = { ...LEFT_ARM.reach(GRAB.left), ...reachRight(GRAB.right) };
    const shaking = during(h, BTC.figuresAt, NDQ.callsAt, GRAB.reach);
    const grabbed = Math.max(1 - ease(progress(h, BTC.callsAt, GRAB.reach)), shaking);
    const arms = blend(point, grab, grabbed);
    const shake = GRAB.shake * Math.sin((2 * Math.PI * h) / GRAB.shakeFrames) * shaking;
    const nod = NOD.head * Math.sin((Math.PI * h) / BEAT) * (1 - grabbed);
    return { ...Rig.STANDING, ...arms, head: shake + nod };
  }

  // His eyes go to the screen as each caption lands, then back to the viewer.
  function hookEyes(captions, h) {
    const glance = Math.max(0, ...captions.filter(({ start }) => start > 0).map(({ start }) => during(h, start, start + LOOK.hold, LOOK.ramp)));
    return [-LOOK.eyes * glance, 0];
  }

  // His brows are up on the thumbnail and from Bitcoin's close on.
  const hookBrows = (h) =>
    BROWS.rest + BROWS.lift * Math.max(1 - progress(h, BTC.callsAt, BROWS.ramp), during(h, BTC.closeAt, CALLS_AT, BROWS.ramp));

  // He is on from the first frame and out on the beat the answers start.
  function renderHookFigure(captions, h) {
    const parts = hookParts(h);
    $('s0', 'place').style.opacity = h < CALLS_AT ? 1 : 0;
    poseFigure('s0', {
      x: HOOK_SLOT.x,
      y: hookY(parts),
      scale: HOOK_SLOT.scale,
      parts,
      eyes: hookEyes(captions, h),
      blink: blinkAt(h, 20),
      browLift: hookBrows(h),
      chalk: false,
    });
  }

  // The shade under the captions goes with them, so the first card lands clean.
  function renderResultHook({ captions, shade }, h) {
    shade.style.opacity = h < CALLS_AT ? 1 : 0;
    captions.forEach((caption) => showBeat(caption, h));
    renderHookFigure(captions, h);
  }

  // The logos hold the hook between the charts: stamped with their scores and both calls as triangles on the
  // thumbnail, then with one market's calls, popping in one after another, while that market's calls are up.
  function renderHookLogos({ layer, logos }, f) {
    layer.removeAttribute('transform');
    const shownFor = f < BTC.closeAt ? BTC : f >= NDQ.callsAt && f < NDQ.closeAt ? NDQ : null;
    layer.style.opacity = shownFor ? 1 : 0;
    const thumbnail = f < BTC.callsAt;
    logos.forEach(({ node, labels, stamp, path }, i) => {
      const at = shownFor ? shownFor.callsAt + i * LOGO_ROW.stagger : Infinity;
      const hop = thumbnail ? 0 : HOP.px * Math.sin(Math.PI * progress(f, at, HOP.frames));
      node.setAttribute('transform', `translate(0 ${-hop})`);
      node.style.opacity = 1;
      stamp.removeAttribute('transform');
      stamp.style.opacity = thumbnail ? 1 : 0;
      path.style.opacity = thumbnail ? 1 : 0;
      for (const m of MARKETS) {
        const { node: label, centre } = labels[m.key];
        popIn(label, !thumbnail && shownFor === m ? landing(f, m.callsAt + i * LOGO_ROW.stagger) : 0, centre);
      }
    });
  }

  // A chart tile cuts in with its market's close: the candles before the week, then the week's grow from
  // their opens left to right, and its figures pop in in the calls' place on the hit. Bitcoin's goes as the
  // Nasdaq calls come in.
  function renderChartTile(chart, f) {
    const { m } = chart;
    const until = m === BTC ? NDQ.callsAt : Infinity;
    popIn(chart.node, f < until ? landing(f, m.closeAt) : 0, chart.centre);
    chart.candles.forEach(({ node, open }, i) => {
      const t = i < m.first ? 1 : ease(progress(f, m.closeAt + m.sweep.from + (i - m.first) * m.sweep.step, m.sweep.grow));
      squash(node, open, t);
      node.style.opacity = t > 0 ? 1 : 0;
    });
    chart.calls.style.opacity = f < m.figuresAt ? 1 : 0;
    popIn(chart.figures, landing(f, m.figuresAt), chart.figuresCentre);
  }

  // The hook's shots after the thumbnail: the camera drifts in on the logos while a market's calls are up and
  // on its chart's figures from its close, each shot from its cut to the next.
  const hookShots = () => [
    { at: BTC.callsAt, centre: LOGO_FOCUS },
    { at: BTC.closeAt, centre: FIGURES_FOCUS },
    { at: NDQ.callsAt, centre: LOGO_FOCUS },
    { at: NDQ.closeAt, centre: FIGURES_FOCUS },
  ];

  // A white flash over the screen, pinned to the frame, on top of everything in it.
  function drawFlash() {
    const outer = $('s3', 'root').appendChild(svgEl('g'));
    outer.appendChild(svgEl('rect', { width: 640, height: 360, fill: FLASH.fill }));
    return outer;
  }
  function renderFlash(flash, view, f, ats) {
    pin(flash, view);
    flash.style.opacity = strongest(f, ats.map((at) => [at, FLASH.opacity, FLASH.frames]));
  }

  // The hook's screen: the logos, then each chart with the camera punching in on its week's figures, a flash
  // as they land. The header, the answers, the count and the leads wait for the monitor.
  function renderResultHookScreen(plan, f) {
    for (const node of [$('s3', 'title'), plan.top, plan.counter.outer, plan.verdict.lead.outer, plan.verdict.quote.outer]) node.style.opacity = 0;
    plan.slots.forEach(({ outer }) => (outer.style.opacity = 0));
    renderScored(plan.scored, -1);
    renderHookLogos(plan.logos, f);
    plan.charts.forEach((chart) => renderChartTile(chart, f));
    const live = f < NDQ.callsAt ? plan.charts[0] : plan.charts[1];
    const punched = f >= live.m.figuresAt ? ease(progress(f, live.m.figuresAt, PUNCH.frames)) : 0;
    const shots = hookShots();
    const i = shots.findLastIndex(({ at }) => at <= f);
    const zoom = i < 0 ? 1 : drift(f, shots[i].at, shots[i + 1]?.at ?? CALLS_AT, DRIFT.hook);
    const centre = i < 0 ? PUNCH.centre : shots[i].centre;
    const shakes = MARKETS.map(({ figuresAt }) => [figuresAt, PUNCH.shake, PUNCH.shakeFrames]);
    const view = shaken(zoomAbout(zoomBox(FULL_VIEW, PUNCH_VIEW, punched), centre, zoom), f, shakes);
    setViewBox('s3', view);
    renderFlash(plan.flash, view, f, MARKETS.map(({ figuresAt }) => figuresAt));
    // Punched in, the frame's edge would cut the chart's label, so it goes.
    for (const chart of plan.charts) chart.label.style.opacity = chart === live ? 1 - punched : 1;
  }

  // ---------------------------------------------------------------- hook's screen

  // A stamp centred on [cx, cy], tilted; the outer group's box is the tilted stamp's, for its checks.
  function drawStamp(parent, [cx, cy], words, ink, { size, tilt, padX, padY, rx, spacing, stroke }) {
    const outer = parent.appendChild(svgEl('g'));
    const stamp = outer.appendChild(svgEl('g', { transform: `rotate(${tilt} ${cx} ${cy})` }));
    const text = stamp.appendChild(textEl(words, { class: 'stamp-text', x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: ink, style: `font-size: ${size}px; letter-spacing: ${spacing}px` }));
    const box = text.getBBox();
    stamp.insertBefore(svgEl('rect', { class: 'stamp-box', x: box.x - padX, y: box.y - padY, width: box.width + 2 * padX, height: box.height + 2 * padY, rx, stroke: ink, style: `stroke-width: ${stroke}px` }), text);
    return { outer, stamp, centre: [cx, cy], box: outer.getBBox() };
  }

  // A model's two calls as triangles centred under its name, up ones green and pointing up, down ones red
  // and pointing down, each over its market's tag.
  function drawPath(parent, centre, idea) {
    const path = parent.appendChild(svgEl('g'));
    const left = centre - (MARKETS.length * PATH.width + (MARKETS.length - 1) * PATH.gap) / 2;
    MARKETS.forEach((m, n) => {
      const { call } = idea[m.key];
      const x = left + n * (PATH.width + PATH.gap);
      const [tip, base] = call === 'up' ? [PATH.y - PATH.height / 2, PATH.y + PATH.height / 2] : [PATH.y + PATH.height / 2, PATH.y - PATH.height / 2];
      const corners = [[x + PATH.width / 2, tip], [x, base], [x + PATH.width, base]];
      path.append(
        svgEl('polygon', { points: corners.join(' '), fill: call === 'up' ? UP_INK : DOWN_INK }),
        textEl(m.tag, { x: x + PATH.width / 2, y: PATH.tagY, 'text-anchor': 'middle', fill: PATH.tagInk, style: PATH.tagStyle }),
      );
    });
    const tags = [...path.querySelectorAll('text')].map((tag) => tag.getBBox());
    if (tags[0].x + tags[0].width + 4 > tags[1].x) throw new Error(`logos: ${idea.model}'s market tags touch`);
    return path;
  }

  // Each model's logo 88 px wide with its name and, one market at a time, its call under it, in the file's
  // order; its score stamped over the logo and both calls under it for the thumbnail and the tally.
  function drawLogos(ideas) {
    const layer = $('s3', 'logos');
    const tile = LOGO_ROW.size / CARD_LOGO.tile;
    const room = LOGO_ROW.step - LOGO_ROW.nameGap;
    const logos = ideas.map((idea, i) => {
      const { model } = idea;
      const x = LOGO_ROW.x + i * LOGO_ROW.step;
      const centre = x + LOGO_ROW.size / 2;
      const node = layer.appendChild(svgEl('g'));
      const mark = node.appendChild(svgEl('g', { transform: `translate(${x} ${LOGO_ROW.y}) scale(${tile})` }));
      mark.appendChild(modelLogo(model, [0, 0]));
      mark.querySelector('.card-logo').style.vectorEffect = 'non-scaling-stroke';
      const name = node.appendChild(textEl(nameOf(idea), { class: 'card-name', x: centre, y: LOGO_ROW.nameY, 'text-anchor': 'middle', style: `font-size: ${LOGO_ROW.nameSize}px` }));
      const labels = Object.fromEntries(MARKETS.map((m) => {
        const { call } = idea[m.key];
        const label = node.appendChild(textEl(CALL_LABELS[call], { class: `card-call card-${call}`, x: centre, y: LOGO_ROW.callY, 'text-anchor': 'middle', style: `font-size: ${LOGO_ROW.callSize}px` }));
        return [m.key, { node: label, centre: boxCentre(label) }];
      }));
      for (const line of [name, ...Object.values(labels).map(({ node: label }) => label)]) {
        const width = line.getComputedTextLength();
        if (width > room) throw new Error(`logos: ${model}'s "${line.textContent}" is ${width.toFixed(0)} px, the row fits ${room}`);
      }
      const score = scoreOf(idea);
      const stamp = drawStamp(node, [centre, LOGO_STAMP.y], `${score} OF ${MARKETS.length}`, SCORE_INK[score], LOGO_STAMP);
      if (stamp.box.width > LOGO_STAMP.width) throw new Error(`logos: ${model}'s stamp is ${stamp.box.width.toFixed(0)} px wide, the row fits ${LOGO_STAMP.width}`);
      const path = drawPath(node, centre, idea);
      const { width } = path.getBBox();
      if (width > room) throw new Error(`logos: ${model}'s calls are ${width.toFixed(0)} px, the row fits ${room}`);
      return { node, labels, stamp: stamp.outer, stampCentre: stamp.centre, path };
    });
    const box = layer.getBBox();
    if (box.x + box.width > LOGO_ROW.right) throw new Error(`logos: the row runs to x ${(box.x + box.width).toFixed(0)}, he stands from ${LOGO_ROW.right}`);
    if (box.y < SCREEN_ROOM.top || box.y + box.height > SCREEN_ROOM.bottom) throw new Error(`logos: y ${box.y.toFixed(0)}–${(box.y + box.height).toFixed(0)} leaves the screen's room`);
    const drifted = screenBox(box, zoomAbout(FULL_VIEW, LOGO_FOCUS, DRIFT.hook));
    if (drifted.right > LOGO_ROW.right || drifted.top < SCREEN_ROOM.top || drifted.bottom > SCREEN_ROOM.bottom) {
      throw new Error(`logos: drifted in on, the row runs x ${drifted.left.toFixed(0)}–${drifted.right.toFixed(0)}, y ${drifted.top.toFixed(0)}–${drifted.bottom.toFixed(0)}, out of the screen's room`);
    }
    return { layer, logos };
  }

  // Throws if a tile leaves the room left of him, or a line runs past its box.
  function checkTile(node) {
    const box = node.getBBox();
    if (box.x + box.width > SCREEN_ROOM.right || box.y < SCREEN_ROOM.top || box.y + box.height > SCREEN_ROOM.bottom) {
      throw new Error(`${node.id}: ${BOX(box)} leaves the screen's room`);
    }
    const rects = [...node.querySelectorAll(':scope > rect')];
    const right = Math.max(...rects.map((rect) => Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')))) - TILE_PAD;
    for (const text of node.querySelectorAll('text')) {
      const line = text.getBBox();
      if (line.x + line.width > right) throw new Error(`${node.id}: "${text.textContent}" runs to x ${(line.x + line.width).toFixed(0)}, past ${right}`);
    }
  }

  // Writes a market's figures in, from the story's two prices, after checking them against its candles:
  // Bitcoin's open is the Monday candle's and a closed week's end price lies in its last candle; the Nasdaq's
  // two prices are the official closes, which the chart's closes match to the cent.
  function fillFigures(m) {
    const { candles } = m;
    const last = candles.at(-1);
    if (m === BTC) {
      if (candles[m.first].open !== m.start) throw new Error(`chart: Bitcoin opens the week at ${candles[m.first].open}, the story says ${m.start}`);
      if (BTC_FINAL && (!last.time.startsWith(WEEK.btcLastCandle) || m.end < last.low || m.end > last.high)) {
        throw new Error(`chart: Bitcoin's end price ${m.end} is outside the week's last candle at ${last.time}, ${last.low}–${last.high}`);
      }
    } else {
      if (Math.abs(candles[m.first - 1].close - m.start) > PRICE_SLACK) throw new Error(`chart: the Nasdaq closed ${candles[m.first - 1].close} on ${WEEK.ndqBase}, the story says ${m.start}`);
      if (last.day !== WEEK.ndqLast || Math.abs(last.close - m.end) > PRICE_SLACK) throw new Error(`chart: the Nasdaq's last candle is ${last.day} at ${last.close}, the story says ${WEEK.ndqLast} at ${m.end}`);
      if (candles.length - m.first !== 5) throw new Error(`chart: the Nasdaq week has ${candles.length - m.first} sessions, not 5`);
    }
    const tally = $('s3', `${m.id}-tally`);
    ['up', 'down']
      .map((call) => ({ call, n: callsOf(m, call).length }))
      .sort((a, b) => b.n - a.n)
      .forEach(({ call, n }, i) => {
        tally.append(`${i ? ', ' : ''}${n} `, textEl(call, { fill: call === 'up' ? UP_INK : DOWN_INK, 'font-weight': 700 }, 'tspan'));
      });
    $('s3', `${m.id}-start-big`).textContent = m.price(m.start);
    $('s3', `${m.id}-from`).textContent = m.price(m.start);
    $('s3', `${m.id}-to`).textContent = m.price(m.end);
    for (const id of [`${m.id}-big`, `top-${m.id}`]) {
      $('s3', id).textContent = m.signed;
      $('s3', id).setAttribute('fill', m.ink);
    }
  }

  // A market's candles, with the week's start price dashed across the week. The tile must stay in the room
  // left of him and, punched and drifted all the way in on, the week's figures left of him and under the caption.
  function planChart(m) {
    fillFigures(m);
    const { candles } = m;
    const lo = Math.min(...candles.map((c) => c.low));
    const hi = Math.max(...candles.map((c) => c.high));
    const yOf = (price) => lerp(CHART.bottom, CHART.top, (price - lo) / (hi - lo));
    const slot = CHART.width / candles.length;
    const xOf = (i) => CHART.x + slot * (i + 0.5);
    const body = slot * BODY;
    const layer = $('s3', `${m.id}-candles`);
    const from = m.lineFrom === 'open' ? xOf(m.first) - slot / 2 : xOf(m.first - 1);
    layer.appendChild(svgEl('line', { class: 'open-line', x1: from, y1: yOf(m.start), x2: CHART.x + CHART.width, y2: yOf(m.start) }));
    const drawn = candles.map(({ open, high, low, close }, i) => {
      const node = layer.appendChild(svgEl('g', { class: toneOf(close >= open) }));
      const [top, base] = [yOf(Math.max(open, close)), yOf(Math.min(open, close))];
      node.append(
        svgEl('line', { class: 'candle-wick', x1: xOf(i), y1: yOf(high), x2: xOf(i), y2: yOf(low) }),
        svgEl('rect', { class: 'candle-body', x: xOf(i) - body / 2, y: top, width: body, height: Math.max(1, base - top) }),
      );
      return { node, open: yOf(open) };
    });
    const node = $('s3', `${m.id}-tile`);
    checkTile(node);
    const figures = $('s3', `${m.id}-figures`);
    const { left, top, right, bottom } = screenBox(figures.getBBox(), PUNCH_DRIFTED);
    if (left < 0 || right > SCREEN_ROOM.right || top < PUNCH.top || bottom > SCREEN_ROOM.bottom) {
      throw new Error(`chart ${m.id}: punched in, the figures run x ${left.toFixed(0)}–${right.toFixed(0)}, y ${top.toFixed(0)}–${bottom.toFixed(0)}, out of the room left of him and under the caption`);
    }
    return { m, node, centre: boxCentre(node), label: $('s3', `${m.id}-label`), candles: drawn, calls: $('s3', `${m.id}-calls`), figures, figuresCentre: boxCentre(figures) };
  }

  // ---------------------------------------------------------------- answers

  // The ideas' checks, with both calls per model; the hook's claims about the calls, each answer's beat and
  // his voice lines and jabs are checked here too.
  function checkResultIdeas() {
    const { ideas } = IDEAS;
    if (!Array.isArray(ideas) || !ideas.length || ideas.length > 4) throw new Error('ideas: the cards fit 1 to 4 models');
    if (new Set(ideas.map((idea) => idea.model)).size !== ideas.length) throw new Error('ideas: one idea per model');
    for (const idea of ideas) {
      const { model, name } = idea;
      if (!Object.hasOwn(MODEL_COLORS, model)) throw new Error(`ideas: unknown model ${model}`);
      if (!Object.hasOwn(LOGOS, model.toLowerCase())) throw new Error(`ideas: no logo for ${model}`);
      if (name !== undefined && (typeof name !== 'string' || !name.trim())) throw new Error(`ideas: ${model} name must be a non-empty line`);
      for (const m of MARKETS) {
        const { call: c, confidence: p } = idea[m.key] ?? {};
        if (!Object.hasOwn(CALL_LABELS, c)) throw new Error(`ideas: ${model}'s ${m.name} call must be up or down, got ${c}`);
        if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error(`ideas: ${model}'s ${m.name} confidence must be a number from 0 to 100`);
      }
      // His voice line for this card says its score and ends on the jab its sticker shows.
      const { stamps, jab } = beatOf(model.toLowerCase());
      if (!Array.isArray(stamps) || stamps.length !== MARKETS.length || !stamps.every(Number.isFinite) || !Number.isFinite(jab?.at) || typeof jab?.text !== 'string') {
        throw new Error(`${FILE}: beat "${model.toLowerCase()}" needs a stamp per market and a jab`);
      }
      const opens = `${nameOf(idea)}: ${scoreWords(idea)}.`;
      const line = STORY.voice.find(({ text }) => text.startsWith(`${nameOf(idea)}: `));
      if (!line?.text.startsWith(opens)) throw new Error(`${FILE}: ${nameOf(idea)}'s voice line must open "${opens}"`);
      if (!line.text.endsWith(jab.text)) throw new Error(`${FILE}: ${nameOf(idea)}'s voice line must end on its jab "${jab.text}"`);
    }
    // The jabs' claims.
    const split = ideas.filter((idea) => idea.btc.call !== idea.nasdaq.call);
    if (split.length !== 1 || split[0].model !== VERDICT.hero) throw new Error(`ideas: the jabs say only ${VERDICT.hero} split its calls`);
    if (both() !== 1 || scoreOf(heroIdea()) !== MARKETS.length) throw new Error(`ideas: the thumbnail says only 1 AI, ${VERDICT.hero}, got both`);
    const reason = heroIdea()?.reason;
    if (typeof reason !== 'string' || !reason.includes(VERDICT.words)) throw new Error(`ideas: ${VERDICT.hero}'s reason no longer says "${VERDICT.words}"`);
    const quoted = STORY.voice.find(({ text }) => text.endsWith('.') && reason.startsWith(text.slice(0, -1)) && text.includes(VERDICT.words));
    if (!quoted) throw new Error(`${FILE}: no voice line reads ${VERDICT.hero}'s own words "${VERDICT.words}"`);
    for (const said of [VERDICT.lead, scoredWords().join(' ')]) {
      if (!STORY.voice.some(({ text }) => text === said)) throw new Error(`${FILE}: "${said}" is not one of his voice lines`);
    }
  }

  // The one reason size for the hero's answer, the largest at which it fits its lines.
  function reasonSize(reason, parent) {
    const probe = parent.appendChild(svgEl('text', { class: 'card-reason' }));
    const size = RESULT_REASON.sizes.find((s) => {
      probe.style.fontSize = `${s}px`;
      return wrapLines(probe, reason, RESULT_CARD.width - RESULT_REASON.room).length <= RESULT_REASON.lines;
    });
    probe.remove();
    if (size === undefined) throw new Error(`ideas: the hero's reason is too long for its card even at ${RESULT_REASON.sizes.at(-1)} px`);
    return size;
  }

  // A card's frame: its box, the model's colour bar, logo and name.
  function drawCardFrame(parent, idea, height) {
    const { model } = idea;
    const { x, y, width } = RESULT_CARD;
    const card = parent.appendChild(svgEl('g'));
    const logo = svgEl('g', { transform: `translate(${x + RESULT_CARD.logo[0]} ${y + RESULT_CARD.logo[1]}) scale(${RESULT_CARD.logoScale})` });
    logo.appendChild(modelLogo(model, [0, 0]));
    const name = textEl(nameOf(idea), { class: 'card-name', x: x + RESULT_CARD.nameX, y: y + RESULT_CARD.rowY });
    card.append(
      svgEl('rect', { class: 'card', x, y, width, height, rx: RESULT_CARD.rx }),
      svgEl('rect', { x, y: y + RESULT_CARD.barInset, width: RESULT_CARD.bar, height: height - 2 * RESULT_CARD.barInset, rx: RESULT_CARD.bar / 2, fill: MODEL_COLORS[model] }),
      logo,
      name,
    );
    return { card, name };
  }

  // One card: logo and name on top, its score at the right; under them a row per market with the call, its
  // confidence and the stamp.
  function drawResultCard(idea, parent) {
    const { model } = idea;
    const { x, y, width, height } = RESULT_CARD;
    const { card, name } = drawCardFrame(parent, idea, height);
    const score = card.appendChild(textEl(scoreWords(idea), { class: 'card-call num', x: x + width - RESULT_CARD.edge, y: y + RESULT_CARD.rowY, 'text-anchor': 'end', fill: SCORE_INK[scoreOf(idea)], style: `font-size: ${SCORE.size}px` }));
    const nameRight = x + RESULT_CARD.nameX + name.getComputedTextLength();
    const gap = score.getBBox().x - nameRight;
    if (gap < CARD_LABEL_GAP) throw new Error(`ideas: ${model} and its score are ${gap.toFixed(1)} px apart, the card needs ${CARD_LABEL_GAP}`);
    const stamps = MARKETS.map((m, n) => {
      const rowY = y + CALL_ROW.ys[n];
      const { call, confidence } = idea[m.key];
      card.appendChild(textEl(m.name, { class: 'card-market', x: x + CALL_ROW.marketX, y: rowY }));
      const label = card.appendChild(textEl(CALL_LABELS[call], { class: `card-call card-${call}`, x: x + CALL_ROW.callX, y: rowY }));
      const conf = card.appendChild(textEl(`${confidence}%`, { class: 'card-conf num', x: label.getBBox().x + label.getBBox().width + CALL_ROW.confGap, y: rowY }));
      const mark = markOf(idea, m);
      const stamp = drawStamp(card, [x + CALL_ROW.stampX, rowY - CALL_ROW.stampLift], STAMP.words[mark], STAMP.ink[mark], STAMP);
      const { box } = stamp;
      const confRight = conf.getBBox().x + conf.getBBox().width;
      if (box.x - confRight < CALL_ROW.gap || box.x + box.width > x + width - STAMP.inset || box.y < y + RESULT_CARD.rowY || box.y + box.height > y + height - STAMP.inset) {
        throw new Error(`card ${model}, ${m.name}: stamp ${BOX(box)} runs into the confidence at x ${confRight.toFixed(0)} or out of the card`);
      }
      return { ...stamp, mark };
    });
    const [first, second] = stamps.map(({ box }) => box);
    if (first.y + first.height > second.y) throw new Error(`card ${model}: the two stamps overlap, ${BOX(first)} and ${BOX(second)}`);
    return { model, card, stamps, score, scoreCentre: boxCentre(score), gap };
  }

  // His jab as a sticker: dark words on a tilted chip in the card's score colour, checked against the frame
  // at both ends of its wobble with the camera drifted all the way in on the card.
  function drawJab(parent, words, ink) {
    const [cx, cy] = JAB.centre;
    const outer = parent.appendChild(svgEl('g'));
    const sticker = outer.appendChild(svgEl('g'));
    const text = sticker.appendChild(textEl(words, { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: JAB.ink, style: `font: 900 ${JAB.size}px 'Segoe UI', system-ui, sans-serif` }));
    const box = text.getBBox();
    sticker.insertBefore(svgEl('rect', { x: box.x - JAB.padX, y: box.y - JAB.padY, width: box.width + 2 * JAB.padX, height: box.height + 2 * JAB.padY, rx: JAB.rx, fill: ink }), text);
    for (const tilt of [JAB.tilt - JAB_WIGGLE.deg, JAB.tilt + JAB_WIGGLE.deg]) {
      sticker.setAttribute('transform', `rotate(${tilt} ${cx} ${cy})`);
      const { left, right, bottom } = screenBox(outer.getBBox(), CARD_VIEW);
      if (left < 0 || right > JAB.right || bottom > JAB.bottom) {
        throw new Error(`jab "${words}": tilted ${tilt}° and drifted in on, it runs x ${left.toFixed(0)}–${right.toFixed(0)} to y ${bottom.toFixed(0)}, out of the frame left of x ${JAB.right} above y ${JAB.bottom}`);
      }
    }
    sticker.setAttribute('transform', `rotate(${JAB.tilt} ${cx} ${cy})`);
    return { outer, sticker };
  }

  // One answer's slot: its card 1.7 times its size and his jab under it, in screen px, moving as one.
  function drawSlot(idea, parent, beat, next) {
    const outer = parent.appendChild(svgEl('g'));
    const inner = outer.appendChild(svgEl('g', { transform: `translate(${SLOT.x} ${SLOT.y}) scale(${SLOT.scale})` }));
    const card = drawResultCard(idea, inner);
    const right = SLOT.x + SLOT.scale * RESULT_CARD.width;
    if (right > 640) throw new Error(`cards: a card runs to x ${right.toFixed(0)}, off the frame`);
    return { ...card, ...beat, next, outer, jab: drawJab(outer, beat.words, SCORE_INK[scoreOf(idea)]) };
  }

  // The hero's answer in its slot: its card with the sentence word for word in place of the calls.
  function drawQuote(idea, parent) {
    const outer = parent.appendChild(svgEl('g'));
    const inner = outer.appendChild(svgEl('g', { transform: `translate(${SLOT.x} ${SLOT.y}) scale(${SLOT.scale})` }));
    const { x, y, width } = RESULT_CARD;
    const { card } = drawCardFrame(inner, idea, QUOTE_CARD.height);
    card.appendChild(textEl(QUOTE_CARD.kicker, { class: 'card-conf', x: x + width - RESULT_CARD.edge, y: y + RESULT_CARD.rowY, 'text-anchor': 'end' }));
    const size = reasonSize(idea.reason, card);
    const text = card.appendChild(svgEl('text', { class: 'card-reason', style: `font-size: ${size}px` }));
    const lines = wrapLines(text, idea.reason, width - RESULT_REASON.room);
    text.textContent = '';
    text.append(...lines.map((line, n) => textEl(line, { x: x + RESULT_REASON.inset, y: y + RESULT_REASON.first + n * RESULT_REASON.step }, 'tspan')));
    const bottom = text.getBBox().y + text.getBBox().height;
    if (bottom > y + QUOTE_CARD.height - STAMP.inset) throw new Error(`quote: the reason runs to y ${bottom.toFixed(0)}, past its card`);
    if (SLOT.y + SLOT.scale * QUOTE_CARD.height > 360) throw new Error('quote: the card runs off the frame');
    return { outer, card };
  }

  // A rect behind each line the words run on, so the words stay the model's own; the rects start with no
  // width and renderResultMonitor sweeps them open.
  function drawMark(card, words, ink) {
    const text = card.querySelector('.card-reason');
    const lines = [...text.querySelectorAll('tspan')];
    const start = lines.map((line) => line.textContent).join(' ').indexOf(words);
    if (start < 0) throw new Error(`ideas: the reason no longer says "${words}"`);
    const end = start + words.length;
    let offset = 0; // where each line starts in the reason
    return lines.flatMap((line) => {
      const length = line.textContent.length;
      const [from, to] = [Math.max(start, offset) - offset, Math.min(end, offset + length) - offset];
      offset += length + 1;
      if (to <= from) return [];
      const first = line.getExtentOfChar(from);
      const last = line.getExtentOfChar(to - 1);
      const height = Math.min(first.height, RESULT_REASON.step - 2);
      const rect = card.insertBefore(svgEl('rect', {
        x: first.x,
        y: first.y + (first.height - height) / 2,
        width: 0,
        height,
        rx: HERO_MARK.rx,
        fill: ink,
        'fill-opacity': HERO_MARK.opacity,
      }), text);
      return [{ rect, width: last.x + last.width - first.x }];
    });
  }

  // The marked words' middle on the screen, swept open, where the camera eases in.
  function markCentre(marks) {
    const at = (rect, key) => Number(rect.getAttribute(key));
    const left = Math.min(...marks.map(({ rect }) => at(rect, 'x')));
    const right = Math.max(...marks.map(({ rect, width }) => at(rect, 'x') + width));
    const top = Math.min(...marks.map(({ rect }) => at(rect, 'y')));
    const bottom = Math.max(...marks.map(({ rect }) => at(rect, 'y') + at(rect, 'height')));
    return [SLOT.x + (SLOT.scale * (left + right)) / 2, SLOT.y + (SLOT.scale * (top + bottom)) / 2];
  }

  // The corner count of the stamps so far, "5 hit", then " · 3 miss" once a miss lands; it is pinned to
  // the frame, over everything.
  function drawCounter() {
    const outer = $('s3', 'root').appendChild(svgEl('g'));
    const node = outer.appendChild(svgEl('g'));
    const text = node.appendChild(svgEl('text', { x: COUNTER.x, y: COUNTER.y, fill: COUNTER.fill, style: COUNTER.style }));
    const part = (ink) => text.appendChild(textEl('', ink ? { fill: ink } : {}, 'tspan'));
    return { outer, node, parts: { hit: [part(), part(STAMP.ink.hit)], miss: [part(), part(STAMP.ink.miss)] } };
  }

  // His lead-in to the hero's words, pinned to the frame.
  function drawLead() {
    const outer = $('s3', 'root').appendChild(svgEl('g'));
    const node = outer.appendChild(svgEl('g'));
    bigLine(node, [[VERDICT.lead]], LEAD, { style: TALLY_STYLE, fill: '#eef2f6' });
    return { outer, node, centre: boxCentre(node) };
  }

  // What is scored: a scrim, its two lines, and the logos moved in under them. The first line comes in as he
  // says it, the count, then the coin, so it is two parts of one line.
  function drawScored(logos) {
    const g = $('s3', 'root').appendChild(svgEl('g'));
    const scrim = g.appendChild(svgEl('rect', { width: 640, height: 360, fill: '#0a1526' }));
    const reveal = beatOf('scored').reveal;
    if (!Array.isArray(reveal) || reveal.length !== 2 || !(reveal[0] < reveal[1])) throw new Error(`${FILE}: the scored beat's reveal must be two frames, the coin's then the last line's`);
    const [said, rest] = scoredWords();
    const parts = said.split(/(?<=\. )/);
    if (parts.length !== 2) throw new Error(`scored: "${said}" must be two sentences, the count and the coin`);
    const [first, second] = [parts, [rest]].map((line, i) => {
      const node = g.appendChild(svgEl('g'));
      bigLine(node, line.map((words) => [words]), SCORED.lines[i], { style: TALLY_STYLE, fill: '#eef2f6' });
      return node;
    });
    const box = second.getBBox();
    if (box.y + box.height > LOGO_ROW.y) throw new Error(`scored: "${second.textContent}" runs to y ${(box.y + box.height).toFixed(0)}, the logos start at ${LOGO_ROW.y}`);
    g.appendChild(logos);
    return { scrim, first, coin: first.querySelectorAll('tspan')[1], second, secondCentre: boxCentre(second), reveal };
  }

  // The camera's view for the quoted line: as close as the hero's whole card fits with its margin, around the
  // marked words' height. Throws if the card would leave the view.
  function verdictView(marks) {
    const width = SLOT.scale * RESULT_CARD.width;
    const height = SLOT.scale * QUOTE_CARD.height;
    const zoom = Math.min(HERO_MARK.zoom, 640 / (width + 2 * HERO_MARK.margin), 360 / (height + 2 * HERO_MARK.margin));
    const view = around([SLOT.x + width / 2, markCentre(marks)[1]], zoom);
    const [x, y, w, h] = zoomAbout(view, viewCentre(view), DRIFT.verdict); // drifted all the way in
    const [right, bottom] = [SLOT.x + width, SLOT.y + height];
    if (SLOT.x < x || right > x + w || SLOT.y < y || bottom > y + h) throw new Error(`verdict: the hero's card runs x ${SLOT.x}–${right.toFixed(0)}, y ${SLOT.y}–${bottom.toFixed(0)}, out of the view`);
    return view;
  }

  function planResultMonitor() {
    const charts = MARKETS.map(planChart);
    const logos = drawLogos(IDEAS.ideas);
    const parent = $('s3', 'cards');
    const order = IDEAS.ideas.map((idea) => ({ idea, beat: cardBeat(idea.model) })).sort((a, b) => a.beat.start - b.beat.start);
    const slots = order.map(({ idea, beat }, i) => drawSlot(idea, parent, beat, order[i + 1]?.beat.start));
    const quote = drawQuote(heroIdea(), parent);
    const marks = drawMark(quote.card, VERDICT.words, MODEL_COLORS[heroIdea().model]);
    // Drifted in on a card, the header and the week's line must stay in the frame.
    for (const node of [$('s3', 'title'), $('s3', 'top')]) {
      const { left, top, right, bottom } = screenBox(node.getBBox(), CARD_VIEW);
      if (left < 0 || top < 0 || right > 640 || bottom > 360) throw new Error(`cards: drifted in on, "${node.textContent}" runs x ${left.toFixed(0)}–${right.toFixed(0)}, y ${top.toFixed(0)}–${bottom.toFixed(0)}, off the frame`);
    }
    const scored = drawScored(logos.layer);
    // Drifted in on the tally, its lines and the logos, shifted to the middle, must stay `margin` px inside the frame.
    const shifted = logos.layer.getBBox();
    for (const [what, box] of [['the tally', scored.first.getBBox()], ['the tally', scored.second.getBBox()], ['the logos', { ...shifted, x: shifted.x + SCORED.shift }]]) {
      const { left, top, right, bottom } = screenBox(box, zoomAbout(FULL_VIEW, DRIFT.scoredCentre, DRIFT.scored));
      const m = DRIFT.margin;
      if (left < m || top < m || right > 640 - m || bottom > 360 - m) throw new Error(`scored: drifted in on, ${what} runs x ${left.toFixed(0)}–${right.toFixed(0)}, y ${top.toFixed(0)}–${bottom.toFixed(0)}, closer than ${m} px to the frame's edge`);
    }
    return {
      charts,
      logos,
      slots,
      top: $('s3', 'top'),
      cardGap: Math.min(...slots.map(({ gap }) => gap)),
      verdict: { marks, view: verdictView(marks), lead: drawLead(), quote },
      scored,
      counter: drawCounter(),
      flash: drawFlash(), // last, over everything
    };
  }

  // One answer whips in from the right, pushing the one before out to the left, both running past their marks
  // and settling; the last stays until the hero's answer replaces it. Each stamp slams down on its call, squashes
  // and stays, the score pops in after the last one, and his jab is slapped on under the card and wobbles.
  function renderSlot(slot, k) {
    const { outer, stamps, stampAts, score, scoreCentre, jab, start, jabAt, next } = slot;
    const shown = overshoot(progress(k, start, SLOT.whip));
    const gone = next === undefined ? 0 : overshoot(progress(k, next, SLOT.whip));
    const until = next === undefined ? SAID_AT + QUOTE_CARD.fade : SCORED_AT;
    outer.style.opacity = k >= start && (next === undefined || k < next + SLOT.whip) && k < until ? 1 : 0;
    outer.setAttribute('transform', `translate(${640 * (1 - shown - gone)} 0)`);
    stamps.forEach((stamp, n) => {
      const slam = overshoot(progress(k, stampAts[n], STAMP.slam));
      const [cx, cy] = stamp.centre;
      stamp.stamp.setAttribute('transform', `translate(${cx} ${cy}) rotate(${STAMP.tilt}) scale(${lerp(STAMP.from, 1, slam)}) translate(${-cx} ${-cy})`);
      stamp.outer.style.opacity = progress(k + 1, stampAts[n], 2);
    });
    popIn(score, landing(k, stampAts.at(-1) + SCORE.pop), scoreCentre);
    const [jx, jy] = JAB.centre;
    const slapped = overshoot(progress(k, jabAt, JAB.slap));
    const settled = jabAt + JAB.slap;
    const wobble = k < settled ? 0 : JAB_WIGGLE.deg * Math.sin((2 * Math.PI * (k - settled)) / JAB_WIGGLE.period) * (1 - progress(k, settled, JAB_WIGGLE.frames));
    jab.sticker.setAttribute('transform', `translate(${jx} ${jy}) rotate(${JAB.tilt + wobble}) scale(${lerp(JAB.from, 1, slapped)}) translate(${-jx} ${-jy})`);
    const last = next === undefined ? 1 - progress(k, SAID_AT - BEAT_OUT, BEAT_OUT) : 1;
    jab.outer.style.opacity = k >= jabAt ? last : 0;
  }

  // The count changes and pops on each stamp; it steps aside for the hero's words and is back for the tally.
  function renderCounter({ node, parts }, slots, k) {
    const stamped = slots.flatMap(({ stamps, stampAts }) => stamps.map(({ mark }, n) => ({ mark, at: stampAts[n] }))).filter(({ at }) => k >= at);
    let counted = false;
    for (const [mark, [count, word]] of Object.entries(parts)) {
      const n = stamped.filter((stamp) => stamp.mark === mark).length;
      count.textContent = n ? `${counted ? ' · ' : ''}${n} ` : '';
      word.textContent = n ? STAMP.words[mark].toLowerCase() : '';
      counted ||= n > 0;
    }
    const last = Math.max(-Infinity, ...stamped.map(({ at }) => at));
    popIn(node, !stamped.length || k >= SCORED_AT ? 1 : landing(k, last), COUNTER.centre);
    node.style.opacity = !stamped.length || (k >= SAID_AT && k < SCORED_AT) ? 0 : 1;
  }

  // His lead-in pops in on its beat and is gone as the hero's words come in.
  function renderLead({ node, centre }, k) {
    const t = landing(k, VERDICT_AT);
    popIn(node, t, centre);
    node.style.opacity = t * (1 - progress(k, SAID_AT - BEAT_OUT, BEAT_OUT));
  }

  // The tally comes in as he says it over the scrim: the count cuts in, the coin after it in the same line,
  // then the last line pops in.
  function renderScored({ scrim, first, coin, second, secondCentre, reveal }, k) {
    const on = k >= SCORED_AT;
    scrim.style.opacity = on ? SCORED.scrim : 0;
    first.removeAttribute('transform');
    first.style.opacity = on ? 1 : 0;
    const coined = k >= SCORED_AT + reveal[0] ? 1 : 0;
    coin.style.fillOpacity = coined;
    coin.style.strokeOpacity = coined;
    popIn(second, on ? landing(k, SCORED_AT + reveal[1]) : 0, secondCentre);
  }

  // Under the tally the logos drop in one after another with both calls under their names, each running past
  // its place and settling, and each one's score slams down once it has landed.
  function renderScoredLogos({ layer, logos }, k) {
    layer.setAttribute('transform', `translate(${SCORED.shift} 0)`);
    logos.forEach(({ node, labels, stamp, path, stampCentre }, i) => {
      const at = SCORED_AT + i * LOGO_ROW.stagger;
      node.setAttribute('transform', `translate(0 ${SCORED_DROP.from * (1 - overshoot(progress(k, at, SCORED_DROP.frames)))})`);
      node.style.opacity = progress(k + 1, at, SCORED_DROP.fade);
      path.style.opacity = 1;
      for (const { node: label } of Object.values(labels)) label.style.opacity = 0;
      popIn(stamp, landing(k, at + SCORED_DROP.frames), stampCentre);
    });
  }

  // The camera at monitor frame k: drifting in on each card from its whip, easing in on the hero's words and
  // drifting on, then cut back for the tally and drifting in on it.
  function monitorView(plan, k) {
    if (k >= SCORED_AT) return zoomAbout(FULL_VIEW, DRIFT.scoredCentre, drift(k, SCORED_AT, STORY.monitorFrames, DRIFT.scored));
    const slot = plan.slots.findLast(({ start }) => start <= k) ?? plan.slots[0];
    const card = zoomAbout(FULL_VIEW, DRIFT.cardCentre, drift(k, slot.start, slot.next ?? SAID_AT, DRIFT.card));
    if (k < SAID_AT) return card;
    const { view } = plan.verdict;
    const hero = zoomAbout(view, viewCentre(view), drift(k, SAID_AT, SCORED_AT, DRIFT.verdict));
    return zoomBox(card, hero, ease(progress(k, SAID_AT, HERO_MARK.frames)));
  }

  // One answer at a time under a drifting camera that shakes on each stamp, eases in on the hero's words and
  // cuts back for the tally, knocked as each part of it comes in, with a flash; the count and the lead are
  // pinned to the frame.
  function renderResultMonitor(plan, k) {
    const { reveal } = plan.scored;
    const shakes = [
      ...plan.slots.flatMap(({ stampAts }) => stampAts.map((at) => [at, STAMP_SHAKE.px, STAMP_SHAKE.frames])),
      [SCORED_AT, SCORED.shake, SCORED.shakeFrames],
      ...reveal.map((at) => [SCORED_AT + at, REVEAL_SHAKE.px, REVEAL_SHAKE.frames]),
    ];
    const view = shaken(monitorView(plan, k), k, shakes);
    setViewBox('s3', view);
    renderFlash(plan.flash, view, k, [SCORED_AT]);
    for (const node of [plan.counter.outer, plan.verdict.lead.outer]) {
      pin(node, view);
      node.style.opacity = 1;
    }
    plan.charts.forEach(({ node }) => (node.style.opacity = 0));
    const titled = progress(k, TITLE_IN.start, TITLE_IN.frames);
    $('s3', 'title').style.opacity = titled;
    plan.top.style.opacity = k < VERDICT_AT ? titled : 0;
    plan.slots.forEach((slot) => renderSlot(slot, k));
    const { quote, marks } = plan.verdict;
    quote.outer.style.opacity = k < SCORED_AT ? progress(k, SAID_AT, QUOTE_CARD.fade) : 0;
    renderCounter(plan.counter, plan.slots, k);
    renderLead(plan.verdict.lead, k);
    marks.forEach(({ rect, width }, i) => rect.setAttribute('width', width * ease(progress(k, SAID_AT + HERO_MARK.at + i * HERO_MARK.sweep, HERO_MARK.sweep))));
    renderScored(plan.scored, k);
    plan.logos.layer.style.opacity = k >= SCORED_AT ? 1 : 0;
    if (k >= SCORED_AT) renderScoredLogos(plan.logos, k);
  }

  // ---------------------------------------------------------------- end card

  // He faces the viewer and points at the question, swaying a little.
  function poseCallEndFigure(k) {
    const sway = Math.sin((2 * Math.PI * k) / SWAY.frames);
    const standing = { ...Rig.STANDING, head: SWAY.head * sway };
    const y = standOn(END_FLOOR + SOLE_DROP, END_SLOT.scale, standing, 'front');
    const point = reachRight(toLocal(ASK_POINT, END_SLOT.x, y, END_SLOT.scale));
    const parts = { ...standing, ...point, 'arm-right-forearm': point['arm-right-forearm'] + SWAY.arm * sway };
    poseFigure('s4', { ...END_SLOT, y, parts, eyes: [0, 0], blink: blinkAt(k, 60), browLift: 2, chalk: false });
  }

  // The arrow to the reply button draws in, then bounces on every beat.
  function bounceArrow(k) {
    const t = progress(k, 0, END_DRAW);
    const arrow = $('s4', 'arrow');
    const line = $('s4', 'arrow-line');
    const head = $('s4', 'arrow-head');
    for (const path of [line, head]) path.style.strokeDasharray = '1 1';
    line.style.strokeDashoffset = 1 - clamp(t / 0.7, 0, 1);
    head.style.strokeDashoffset = 1 - clamp((t - 0.7) / 0.3, 0, 1);
    arrow.style.opacity = 1;
    const nod = progress(k, END_DRAW, END_NOD.ramp) * Math.cos((Math.PI * (k + episode.endStart)) / BEAT) ** 2;
    arrow.setAttribute('transform', `translate(0 ${END_NOD.depth * nod})`);
  }

  // The end starts on its text, all of it at once; only he and the arrow move.
  function renderCallEnd(k) {
    poseCallEndFigure(k);
    for (const id of ['place', 'text', 'kicker', 'cta', 'ask', 'reply', 'ledger']) $('s4', id).style.opacity = 1;
    for (const id of ['cta', 'ask', 'reply', 'ledger']) $('s4', id).removeAttribute('transform');
    bounceArrow(k);
  }

  // The frames score.py sounds on: each caption's cut, each jab and the lead (lines), each card whipping in
  // (cards), each stamp slamming down (stamps). Throws unless the music hits both weeks' figures and the tally.
  function resultClicks({ monitorStart }) {
    for (const hit of [...MARKETS.map(({ figuresAt }) => figuresAt), monitorStart + SCORED_AT]) {
      if (!STORY.music.hits.includes(hit)) throw new Error(`${FILE}: music.hits has no hit on frame ${hit}`);
    }
    const beats = IDEAS.ideas.map(({ model }) => cardBeat(model)).sort((a, b) => a.start - b.start);
    const reveals = beatOf('scored').reveal.map((at) => monitorStart + SCORED_AT + at);
    return {
      lines: [BTC.callsAt, BTC.closeAt, NDQ.callsAt, NDQ.closeAt, ...beats.map(({ jabAt }) => monitorStart + jabAt), monitorStart + VERDICT_AT, ...reveals],
      cards: beats.map(({ start }) => monitorStart + start),
      stamps: beats.flatMap(({ stampAts }) => stampAts.map((at) => monitorStart + at)),
    };
  }

  window.STORY = {
    ...window.STORY,
    hookFrames: STORY.hookFrames,
    monitorFrames: STORY.monitorFrames,
    endFrames: STORY.endFrames,
    planHook: planResultHook,
    renderHook: renderResultHook,
    renderHookScreen: renderResultHookScreen,
    planMonitor: planResultMonitor,
    renderMonitor: renderResultMonitor,
    renderEnd: renderCallEnd,
    endCut: true, // the tally cuts to the end card on the beat instead of dissolving under it
    clicks: resultClicks,
  };
})();
