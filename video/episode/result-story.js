/*
 * The week's result (assets/data/btc-result.json). Frame 0 is the thumbnail: the count of hits and misses
 * over the four logos, each stamped HIT or MISS, with its calls since Monday as triangles under its name,
 * while he holds his head. Then the Monday calls pop in under the logos. The flips: each call turns into
 * its triangle, over its day, and Wednesday's and Thursday's calls land beside it, a day at a time.
 * "Friday's close": the chart cuts in, the week's 4h candles sweep in from Monday's open and the camera
 * punches in on the week's figures.
 * Then one card at a time whips in, big, with its Monday call: a stamp slams down and holds half a second,
 * a corner count goes up, the answer's own words fade in, and his jab, the end of his voice line, is
 * slapped on under the card as a sticker. Then the hero's own line is marked as the camera eases in on the
 * whole card, and the tally against a coin cuts in, with the Monday calls under the logos and the stamps
 * coming down on them one after another.
 * The outcome, the marks and the figures all come from the story's `result` and the Monday calls; his voice
 * lines are checked against them, so a different end price stops here until they are rewritten.
 * He speaks his own captions (the story's "voice" cues), so there is no subtitle layer. Every time comes
 * from the story's beats. Loads after episode.js and uses its helpers; an IIFE, because classic scripts
 * share one global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);
  const CANDLES = JSON.parse(document.getElementById('candles-btc').textContent);

  const BEAT = 1800 / STORY.music.bpm; // frames per beat at 30 fps
  const CALLS_AT = STORY.hookFrames - HOOK_DISSOLVE; // the monitor starts; every caption is gone by then

  // A beat as the story writes it; its start is in monitor frames, as score.py counts them.
  const beatOf = (id) => {
    const beat = STORY.beats.find((b) => b.id === id);
    if (!beat) throw new Error(`btc-result.json: no beat "${id}"`);
    return beat;
  };
  const hookAt = (id) => CALLS_AT + beatOf(id).start;
  const MONDAY_AT = hookAt('monday');
  const FLIPS_AT = hookAt('flips');
  // When each day's calls land under the logos: the Monday calls turn into triangles as the flips start.
  const DAY_AT = [0, beatOf('flips').wednesday, beatOf('flips').thursday].map((at) => FLIPS_AT + at);
  const FLIP_AT = DAY_AT.slice(1); // the two days a call can change on
  const CLOSE_AT = hookAt('close');
  const VERDICT = beatOf('verdict'); // whose own words are marked, and his lead-in to them
  const VERDICT_AT = VERDICT.start; // monitor frames from here on
  const SAID_AT = VERDICT_AT + VERDICT.said;
  const SCORED_AT = beatOf('scored').start;
  // One answer's beat, named after its model: it whips in, its stamp slams down, his jab lands.
  const cardBeat = (model) => {
    const { start, stamp, jab } = beatOf(model.toLowerCase());
    return { start, stampAt: start + stamp, jabAt: start + jab.at, words: jab.text };
  };

  const UP_INK = '#2fc4b2';
  const DOWN_INK = '#ff6b66';
  const FLIP_INK = '#f08a24';
  // The week: its two prices, which way it went and what that makes each Monday call, read the way
  // classifyMove in src/ledger.ts reads them. Before the close the end price is only the latest one, and
  // only a closed week's price is checked against its last candle.
  const { start: WEEK_OPEN, end: WEEK_END, at: PRICED_AT } = STORY.result;
  const WEEK = { opens: '2026-11-02T00', lastCandle: '2026-11-06T20', closes: '2026-11-06T23:59:59.000Z' };
  const FINAL = PRICED_AT >= WEEK.closes;
  const WENT = WEEK_END > WEEK_OPEN ? 'up' : 'down';
  const WENT_INK = WENT === 'up' ? UP_INK : DOWN_INK;
  const CHANGE = `${Math.abs((100 * (WEEK_END - WEEK_OPEN)) / WEEK_OPEN).toFixed(1)}%`;
  const markOf = ({ monday }) => (monday.call === WENT ? 'hit' : 'miss');
  const countOf = (mark) => IDEAS.ideas.filter((idea) => markOf(idea) === mark).length;
  const FLIPS = 7; // the thumbnail's and the flips beat's count: every call that changed, Monday to Wednesday and Wednesday to Thursday
  const OPEN = CANDLES.findIndex(({ time }) => time.startsWith(WEEK.opens)); // the candles from it sweep in
  if (OPEN < 0) throw new Error(`chart: no candle at the week's open ${WEEK.opens}`);
  const CAPTION_LINE = { x: 320, y: 56, size: 44, min: 34, maxWidth: 600, stroke: 7, lines: [48, 94] }; // one line at y, two at lines
  const THUMB_LINES = [{ y: 62, size: 64, min: 52, stroke: 10 }, { y: 104, size: 36, min: 30, stroke: 6 }]; // frame 0's two lines
  const NOTE = { size: 12, maxWidth: 612, fill: '#8193ad', font: "system-ui, 'Segoe UI', sans-serif", hookY: 347, endY: 340 };
  const HOOK_SLOT = { x: 500, scale: 0.85, floor: 328 };
  // His finger follows what each caption is about, screen px; out of reach, the arm points straight at it.
  const POINTS = [
    { at: 0, target: [270, 170] }, // the four Monday calls
    { at: FLIPS_AT, target: [270, 290] }, // the triangles
    { at: CLOSE_AT, target: [340, 285] }, // the week's last candle
  ];
  const POINT = { move: 6 };
  const NOD = { head: 1.5 };
  const LOOK = { eyes: 2.5, ramp: 4, hold: 16 }; // a glance at the screen as each caption lands
  const BROWS = { rest: 1, lift: 2.5, ramp: 4 };
  const GRAB = { reach: 6, shake: 5, shakeFrames: 10, left: [56, 52], right: [104, 52] }; // hands on his head
  // The four models in a row with each Monday call under its name; the calls pop in one after another.
  const LOGO_ROW = { x: 40, step: 128, y: 140, size: 88, nameY: 256, nameSize: 22, nameGap: 8, callY: 290, callSize: 24, right: 530, stagger: 4 };
  const LOGO_STAMP = { y: 202, size: 22, tilt: -10, padX: 6, padY: 1, rx: 4, spacing: 1, stroke: 2, width: 120 }; // over each logo
  // The calls under each name, Monday, Wednesday and Thursday, as triangles centred on y; their days show only in the flips beat.
  const PATH = { y: 290, width: 26, height: 22, gap: 10, days: ['MON', 'WED', 'THU'], dayY: 316, dayStyle: "font: 700 12px system-ui, 'Segoe UI', sans-serif", dayInk: '#c7d0dc' };
  const SCREEN_ROOM = { right: 530, top: 108, bottom: 328 }; // left of him and below the caption shade
  const TILE_PAD = 12;
  // The candles' pane in the chart tile; the week's candles grow from their opens, one after another.
  const CHART = { x: 34, width: 312, top: 210, bottom: 304 };
  const SWEEP = { from: 3, step: 2, grow: 4 };
  const FIGURES_AT = CLOSE_AT + SWEEP.from + (CANDLES.length - 1 - OPEN) * SWEEP.step + SWEEP.grow; // the last candle is up
  // The camera punches in on the week's figures as they land, with a shake; they stay under the caption.
  const PUNCH = { centre: [376, 197], zoom: 1.3, frames: 4, shake: 8, shakeFrames: 8, top: 72 };
  const TITLE_IN = { start: 16, frames: 6 }; // after the hook is gone
  // Each answer's card, drawn at 0,0 and shown 1.8 times its size; it whips in and out over `whip` frames.
  const SLOT = { x: 52, y: 80, scale: 1.8, whip: 6 };
  const RESULT_CARD = { x: 0, y: 0, width: 298, height: 114, rx: 8, bar: 5, barInset: 8, logo: [14, 12], logoScale: 1.5, nameX: 56, rowY: 37, rowMid: 29, edge: 14, callGap: 8 };
  const RESULT_REASON = { sizes: [19, 18, 17, 16], inset: 16, room: 32, lines: 3, first: 63, step: 21 };
  // The stamp slams down, holds half a second and goes as the answer's words come in.
  const STAMP = { words: { hit: 'HIT', miss: 'MISS' }, ink: { hit: UP_INK, miss: DOWN_INK }, size: 30, y: 78, tilt: -6, padX: 12, padY: 2, rx: 6, spacing: 2, stroke: 4, inset: 2, slam: 5, from: 1.8, hold: 15, fade: 4 };
  const STAMP_SHAKE = { px: 6, frames: 4 };
  // His jab, slapped on under the card in screen px; the last card's goes as the camera punches in.
  const JAB = { centre: [400, 294], size: 26, tilt: -3, padX: 10, padY: 3, rx: 6, ink: '#0a1526', fill: { hit: FLIP_INK, miss: DOWN_INK }, from: 1.4, slap: 4, right: 640, bottom: 328 };
  const COUNTER = { x: 16, y: 28, centre: [16, 22], fill: '#eef2f6', style: "font: 700 18px system-ui, 'Segoe UI', sans-serif" };
  // Its own words, marked as the camera eases in on its card, no closer than the card fits with `margin`
  // px on each side; `at` counts from the quoted line.
  const HERO_MARK = { at: 4, sweep: 8, opacity: 0.5, rx: 3, zoom: 1.6, margin: 12, frames: 8 };
  const TALLY_STYLE = "font: 900 44px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 6px; stroke-linejoin: round";
  const LEAD = { x: 320, y: 70, size: 34, min: 28, maxWidth: 600, stroke: 5 };
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
  const toLocal = ([x, y], left, top, scale) => [(x - left) / scale, (y - top) / scale];
  const screenNote = () => $('s3', 'root').querySelector(':scope > text.t-muted');
  const boxCentre = (node) => {
    const box = node.getBBox();
    return [box.x + box.width / 2, box.y + box.height / 2];
  };
  // 1 from `from` to `to`, easing in and out over `ramp` frames.
  const during = (h, from, to, ramp) => ease(progress(h, from, ramp)) * (1 - ease(progress(h, to - ramp, ramp)));
  // 0 before `at`, then easing to 1 over `frames`, already showing on `at` itself: a cut lands on its frame.
  const landing = (f, at, frames = BEAT_IN) => ease(progress(f + 1, at, frames));
  const usd = (price) => `$${Math.round(price).toLocaleString('en-US')}`;
  const squash = (node, mid, s) => node.setAttribute('transform', `translate(0 ${mid}) scale(1 ${s}) translate(0 ${-mid})`);
  // An overlay pinned to the frame while the view moves.
  const pin = (node, [x, y, width]) => node.setAttribute('transform', `translate(${x} ${y}) scale(${width / 640})`);
  const heroIdea = () => IDEAS.ideas.find(({ model }) => model === VERDICT.hero);
  const counted = (n, one, many) => `${n} ${n === 1 ? one : many}.`;
  const scoredWords = () => {
    const calls = IDEAS.ideas.length;
    return [`${countOf('hit')} of ${calls} hit. A coin averages ${calls / 2}.`, 'One week proves nothing.'];
  };

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

  // The disclaimer a little larger in a scene's own layer, shrunk to the frame if it has to be.
  function addNote(scene, y, text) {
    const note = $(scene, 'root').appendChild(textEl(text, { x: 320, y, 'text-anchor': 'middle', fill: NOTE.fill, style: `font: ${NOTE.size}px ${NOTE.font}` }));
    const size = NOTE.size * Math.min(1, NOTE.maxWidth / note.getComputedTextLength());
    note.style.fontSize = `${size}px`;
    return size;
  }

  // The end card has no follow line: the question breaks into its sentences, one a line, and the reply,
  // its arrow and the ledger line move down under it.
  function restyleEnd() {
    if ($('s4', 'lead').textContent.trim()) throw new Error('btc-result.json: the end card has no follow line, so end.lead must be ""');
    const ask = $('s4', 'ask');
    const lines = ask.textContent.split('. ').map((line, i, all) => (i < all.length - 1 ? `${line}.` : line));
    if (lines.length !== END_ASK.lines.length) throw new Error(`btc-result.json: end.ask "${ask.textContent}" must be ${END_ASK.lines.length} sentences`);
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

  // One caption at a time, each until the next starts; a caption is one or two lines of [words, ink] parts,
  // and the thumbnail's lines have their own sizes.
  const hookCaptions = () => [
    { start: 0, specs: THUMB_LINES, lines: [[[`${counted(countOf('hit'), 'HIT', 'HITS')} `, UP_INK], [counted(countOf('miss'), 'MISS', 'MISSES'), DOWN_INK]], [[`Week 1. After ${FLIPS} flips.`]]] },
    { start: MONDAY_AT, lines: [[['Monday: 3 AIs said '], ['DOWN', DOWN_INK], ['.']], [['Grok Bot said '], ['UP', UP_INK], ['.']]] },
    { start: FLIPS_AT, lines: [[['Then '], [`${FLIPS} flips`, FLIP_INK], [' in 2 days.']]] },
    { start: CLOSE_AT, lines: [[["Friday's close:"]], [['Bitcoin '], [`${WENT} ${CHANGE}`, WENT_INK], ['.']]] },
  ];

  // The captions, 1.5 times the weekly size; each one he speaks is his voice line word for word. The
  // ideas are checked here, as the hook is planned first. No coin in this episode.
  function planResultHook() {
    checkResultIdeas();
    $('s0', 'coin').style.display = 'none';
    const shade = $('s0', 'root').querySelector('rect[fill="url(#s0-shade)"]');
    if (!shade) throw new Error('result.html: the hook has no shade');
    const layer = $('s0', 'beats');
    const captions = hookCaptions().map(({ start, specs, lines }, i, all) => {
      const said = lines.map((parts) => parts.map(([words]) => words).join('')).join(' ');
      if (start > 0 && !STORY.voice.some(({ text }) => text === said)) throw new Error(`hook: "${said}" is not one of his voice lines`);
      const node = layer.appendChild(svgEl('g'));
      const ys = lines.length === 1 ? [CAPTION_LINE.y] : CAPTION_LINE.lines;
      lines.forEach((parts, n) => bigLine(node, parts, { ...CAPTION_LINE, y: ys[n], ...specs?.[n] }, { class: 'hook-title' }));
      return { node, start, end: all[i + 1]?.start ?? CALLS_AT, centre: boxCentre(node) };
    });
    const text = screenNote().textContent;
    const size = addNote('s0', NOTE.hookY, text);
    addNote('s4', NOTE.endY, text);
    screenNote().style.fontSize = `${size}px`;
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

  // He holds his head on the thumbnail, then points at the screen and nods on the beat; when the week's
  // figures land he grabs his head again, shaking it, until the answers start.
  function hookParts(h) {
    const top = hookY(Rig.STANDING);
    const point = LEFT_ARM.reach(toLocal(pointTarget(h), HOOK_SLOT.x, top, HOOK_SLOT.scale));
    const grab = { ...LEFT_ARM.reach(GRAB.left), ...reachRight(GRAB.right) };
    const shaking = during(h, FIGURES_AT, CALLS_AT, GRAB.reach);
    const grabbed = Math.max(1 - ease(progress(h, MONDAY_AT, GRAB.reach)), shaking);
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

  // His brows are up on the thumbnail and from the flips on.
  const hookBrows = (h) =>
    BROWS.rest + BROWS.lift * Math.max(1 - progress(h, MONDAY_AT, BROWS.ramp), during(h, FLIPS_AT, CALLS_AT, BROWS.ramp));

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

  // The logos hold the hook until the chart cuts in: stamped, with their calls since Monday, on the
  // thumbnail, then with the Monday call alone, popping in one after another, then the flips: the calls
  // as triangles over their days, a day at a time.
  function renderHookLogos({ layer, logos }, f) {
    layer.removeAttribute('transform');
    layer.style.opacity = f < CLOSE_AT ? 1 : 0;
    const thumbnail = f < MONDAY_AT;
    const flipping = f >= FLIPS_AT;
    logos.forEach(({ node, label, stamp, path, days, labelCentre }, i) => {
      node.removeAttribute('transform');
      node.style.opacity = 1;
      stamp.removeAttribute('transform');
      stamp.style.opacity = thumbnail ? 1 : 0;
      path.style.opacity = thumbnail || flipping ? 1 : 0;
      popIn(label, thumbnail || flipping ? 0 : landing(f, MONDAY_AT + i * LOGO_ROW.stagger), labelCentre);
      days.forEach(({ call, callCentre, day, dayCentre }, n) => {
        popIn(call, thumbnail ? 1 : landing(f, DAY_AT[n]), callCentre);
        popIn(day, flipping ? landing(f, DAY_AT[n]) : 0, dayCentre);
      });
    });
  }

  // The chart tile cuts in with Friday's close: the candles before the week, then the week's grow from
  // their opens left to right, and its figures pop in in the Monday figures' place on the hit.
  function renderChartTile(chart, f) {
    popIn(chart.node, landing(f, CLOSE_AT), chart.centre);
    chart.candles.forEach(({ node, open }, i) => {
      const t = i < OPEN ? 1 : ease(progress(f, CLOSE_AT + SWEEP.from + (i - OPEN) * SWEEP.step, SWEEP.grow));
      squash(node, open, t);
      node.style.opacity = t > 0 ? 1 : 0;
    });
    chart.calls.style.opacity = f < FIGURES_AT ? 1 : 0;
    popIn(chart.figures, landing(f, FIGURES_AT), chart.figuresCentre);
  }

  // The hook's screen: the logos, then the chart with the camera punching in on the week's figures. The
  // header, the answers, the count and the leads wait for the monitor.
  function renderResultHookScreen(plan, f) {
    for (const node of [$('s3', 'title'), plan.top, plan.note, plan.counter.outer, plan.verdict.lead.outer]) node.style.opacity = 0;
    plan.slots.forEach(({ outer }) => (outer.style.opacity = 0));
    renderScored(plan.scored, -1);
    renderHookLogos(plan.logos, f);
    renderChartTile(plan.chart, f);
    const punched = ease(progress(f, FIGURES_AT, PUNCH.frames));
    const shakes = [[FIGURES_AT, PUNCH.shake, PUNCH.shakeFrames], ...FLIP_AT.map((at) => [at, STAMP_SHAKE.px, STAMP_SHAKE.frames])];
    setViewBox('s3', shaken(zoomBox(FULL_VIEW, PUNCH_VIEW, punched), f, shakes));
    // Punched in, the frame's edge would cut the chart's label, so it goes.
    $('s3', 'chart-label').style.opacity = 1 - punched;
  }

  // ---------------------------------------------------------------- hook's screen

  // A stamp centred on [cx, cy], tilted; the outer group's box is the tilted stamp's, for its checks.
  function drawStamp(parent, [cx, cy], turn, { size, tilt, padX, padY, rx, spacing, stroke }) {
    const ink = STAMP.ink[turn];
    const outer = parent.appendChild(svgEl('g'));
    const stamp = outer.appendChild(svgEl('g', { transform: `rotate(${tilt} ${cx} ${cy})` }));
    const text = stamp.appendChild(textEl(STAMP.words[turn], { class: 'stamp-text', x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: ink, style: `font-size: ${size}px; letter-spacing: ${spacing}px` }));
    const words = text.getBBox();
    stamp.insertBefore(svgEl('rect', { class: 'stamp-box', x: words.x - padX, y: words.y - padY, width: words.width + 2 * padX, height: words.height + 2 * padY, rx, stroke: ink, style: `stroke-width: ${stroke}px` }), text);
    return { outer, stamp, centre: [cx, cy], box: outer.getBBox() };
  }

  // A model's calls since Monday as triangles centred under its name, up ones green and pointing up,
  // down ones red and pointing down, each over its day. The days stay out of the group `path`, as the
  // thumbnail shows only the triangles.
  function drawPath(parent, centre, calls) {
    const path = parent.appendChild(svgEl('g'));
    const left = centre - (calls.length * PATH.width + (calls.length - 1) * PATH.gap) / 2;
    const days = calls.map((call, n) => {
      const x = left + n * (PATH.width + PATH.gap);
      const [tip, base] = call === 'up' ? [PATH.y - PATH.height / 2, PATH.y + PATH.height / 2] : [PATH.y + PATH.height / 2, PATH.y - PATH.height / 2];
      const points = [[x + PATH.width / 2, tip], [x, base], [x + PATH.width, base]];
      const triangle = path.appendChild(svgEl('polygon', { points: points.join(' '), fill: call === 'up' ? UP_INK : DOWN_INK }));
      const day = parent.appendChild(textEl(PATH.days[n], { x: x + PATH.width / 2, y: PATH.dayY, 'text-anchor': 'middle', fill: PATH.dayInk, style: PATH.dayStyle }));
      return { call: triangle, callCentre: [x + PATH.width / 2, PATH.y], day, dayCentre: boxCentre(day) };
    });
    return { path, days };
  }

  // Each model's logo 88 px wide with its name and its Monday call, the scored one, under it, in the
  // file's order, its stamp over the logo and, for the thumbnail, its calls since Monday.
  function drawLogos(ideas) {
    const layer = $('s3', 'logos');
    const tile = LOGO_ROW.size / CARD_LOGO.tile;
    const logos = ideas.map((idea, i) => {
      const { model, name: title, monday, wednesday, thursday } = idea;
      const x = LOGO_ROW.x + i * LOGO_ROW.step;
      const centre = x + LOGO_ROW.size / 2;
      const node = layer.appendChild(svgEl('g'));
      const mark = node.appendChild(svgEl('g', { transform: `translate(${x} ${LOGO_ROW.y}) scale(${tile})` }));
      mark.appendChild(modelLogo(model, [0, 0]));
      mark.querySelector('.card-logo').style.vectorEffect = 'non-scaling-stroke';
      const name = node.appendChild(textEl(title ?? model, { class: 'card-name', x: centre, y: LOGO_ROW.nameY, 'text-anchor': 'middle', style: `font-size: ${LOGO_ROW.nameSize}px` }));
      const label = node.appendChild(textEl(CALL_LABELS[monday.call], { class: `card-call card-${monday.call}`, x: centre, y: LOGO_ROW.callY, 'text-anchor': 'middle', style: `font-size: ${LOGO_ROW.callSize}px` }));
      for (const line of [name, label]) {
        const width = line.getComputedTextLength();
        if (width > LOGO_ROW.step - LOGO_ROW.nameGap) throw new Error(`logos: ${model}'s "${line.textContent}" is ${width.toFixed(0)} px, the row fits ${LOGO_ROW.step - LOGO_ROW.nameGap}`);
      }
      const stamp = drawStamp(node, [centre, LOGO_STAMP.y], markOf(idea), LOGO_STAMP);
      if (stamp.box.width > LOGO_STAMP.width) throw new Error(`logos: ${model}'s stamp is ${stamp.box.width.toFixed(0)} px wide, the row fits ${LOGO_STAMP.width}`);
      const { path, days } = drawPath(node, centre, [monday.call, wednesday.call, thursday.call]);
      const { width } = path.getBBox();
      if (width > LOGO_ROW.step - LOGO_ROW.nameGap) throw new Error(`logos: ${model}'s calls are ${width.toFixed(0)} px, the row fits ${LOGO_ROW.step - LOGO_ROW.nameGap}`);
      return { node, label, stamp: stamp.outer, path, days, labelCentre: boxCentre(label), stampCentre: stamp.centre };
    });
    const box = layer.getBBox();
    if (box.x + box.width > LOGO_ROW.right) throw new Error(`logos: the row runs to x ${(box.x + box.width).toFixed(0)}, he stands from ${LOGO_ROW.right}`);
    if (box.y < SCREEN_ROOM.top || box.y + box.height > SCREEN_ROOM.bottom) throw new Error(`logos: y ${box.y.toFixed(0)}–${(box.y + box.height).toFixed(0)} leaves the screen's room`);
    return { layer, logos };
  }

  // Throws if a tile leaves the room left of him, or a line runs past its box.
  function checkTile(node) {
    const box = node.getBBox();
    if (box.x + box.width > SCREEN_ROOM.right || box.y < SCREEN_ROOM.top || box.y + box.height > SCREEN_ROOM.bottom) {
      throw new Error(`${node.id}: x ${box.x.toFixed(0)}–${(box.x + box.width).toFixed(0)}, y ${box.y.toFixed(0)}–${(box.y + box.height).toFixed(0)} leaves the screen's room`);
    }
    const rects = [...node.querySelectorAll(':scope > rect')];
    const right = Math.max(...rects.map((rect) => Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')))) - TILE_PAD;
    for (const text of node.querySelectorAll('text')) {
      const line = text.getBBox();
      if (line.x + line.width > right) throw new Error(`${node.id}: "${text.textContent}" runs to x ${(line.x + line.width).toFixed(0)}, past ${right}`);
    }
  }

  // Writes the week's figures in, from the story's two prices, after checking them against the candles:
  // the open is the Monday candle's, and a closed week's end price lies in its last candle.
  function fillFigures(candles) {
    if (candles[OPEN].open !== WEEK_OPEN) throw new Error(`chart: the week opens at ${candles[OPEN].open}, the story says ${WEEK_OPEN}`);
    const last = candles.at(-1);
    if (FINAL && (!last.time.startsWith(WEEK.lastCandle) || WEEK_END < last.low || WEEK_END > last.high)) {
      throw new Error(`chart: the end price ${WEEK_END} is outside the week's last candle at ${last.time}, ${last.low}–${last.high}`);
    }
    const called = (call) => IDEAS.ideas.filter(({ monday }) => monday.call === call).length;
    const tally = `${called('down')} down, ${called('up')} up`;
    if ($('s3', 'monday-tally').textContent !== tally) throw new Error(`chart: the tally reads "${$('s3', 'monday-tally').textContent}", the calls say "${tally}"`);
    const change = `${WENT === 'up' ? '+' : '−'}${CHANGE}`;
    for (const id of ['monday-open', 'week-open']) $('s3', id).textContent = usd(WEEK_OPEN);
    $('s3', 'week-close').textContent = usd(WEEK_END);
    for (const id of ['week-big', 'top-change']) {
      $('s3', id).textContent = change;
      $('s3', id).setAttribute('fill', WENT_INK);
    }
  }

  // A box in the punched-in view's screen px.
  function punchedBox(box) {
    const [vx, vy, vw] = PUNCH_VIEW;
    const [left, top] = [((box.x - vx) * 640) / vw, ((box.y - vy) * 640) / vw];
    return { left, top, right: left + (box.width * 640) / vw, bottom: top + (box.height * 640) / vw };
  }

  // The story's candles, with the week's open dashed across the week. The tile must stay in the room left
  // of him and, punched in on, the week's figures left of him and under the caption.
  function planChart() {
    fillFigures(CANDLES);
    const lo = Math.min(...CANDLES.map((c) => c.low));
    const hi = Math.max(...CANDLES.map((c) => c.high));
    const yOf = (price) => lerp(CHART.bottom, CHART.top, (price - lo) / (hi - lo));
    const slot = CHART.width / CANDLES.length;
    const xOf = (i) => CHART.x + slot * (i + 0.5);
    const body = slot * BODY;
    const layer = $('s3', 'chart-candles');
    layer.appendChild(svgEl('line', { class: 'open-line', x1: xOf(OPEN) - slot / 2, y1: yOf(WEEK_OPEN), x2: CHART.x + CHART.width, y2: yOf(WEEK_OPEN) }));
    const drawn = CANDLES.map(({ open, high, low, close }, i) => {
      const node = layer.appendChild(svgEl('g', { class: toneOf(close >= open) }));
      const [top, base] = [yOf(Math.max(open, close)), yOf(Math.min(open, close))];
      node.append(
        svgEl('line', { class: 'candle-wick', x1: xOf(i), y1: yOf(high), x2: xOf(i), y2: yOf(low) }),
        svgEl('rect', { class: 'candle-body', x: xOf(i) - body / 2, y: top, width: body, height: Math.max(1, base - top) }),
      );
      return { node, open: yOf(open) };
    });
    const node = $('s3', 'chart-tile');
    checkTile(node);
    const figures = $('s3', 'chart-figures');
    const { left, top, right, bottom } = punchedBox(figures.getBBox());
    if (left < 0 || right > SCREEN_ROOM.right || top < PUNCH.top || bottom > SCREEN_ROOM.bottom) {
      throw new Error(`chart: punched in, the figures run x ${left.toFixed(0)}–${right.toFixed(0)}, y ${top.toFixed(0)}–${bottom.toFixed(0)}, out of the room left of him and under the caption`);
    }
    return { node, centre: boxCentre(node), candles: drawn, calls: $('s3', 'monday-calls'), figures, figuresCentre: boxCentre(figures) };
  }

  // ---------------------------------------------------------------- answers

  // checkMonitorData's checks on the ideas, without its ten-word cap, plus each call since Monday; the
  // hook's claims about the calls, each answer's beat and his voice lines and jabs are checked here too.
  function checkResultIdeas() {
    const { ideas } = IDEAS;
    if (!Array.isArray(ideas) || !ideas.length || ideas.length > 4) throw new Error('ideas: the cards fit 1 to 4 models');
    if (new Set(ideas.map((idea) => idea.model)).size !== ideas.length) throw new Error('ideas: one idea per model');
    for (const idea of ideas) {
      const { model, name, monday, wednesday, thursday, reason } = idea;
      if (!Object.hasOwn(MODEL_COLORS, model)) throw new Error(`ideas: unknown model ${model}`);
      if (!Object.hasOwn(LOGOS, model.toLowerCase())) throw new Error(`ideas: no logo for ${model}`);
      if (name !== undefined && (typeof name !== 'string' || !name.trim())) throw new Error(`ideas: ${model} name must be a non-empty line`);
      for (const [when, { call: c, confidence: p }] of [['Monday', monday ?? {}], ['Wednesday', wednesday ?? {}], ['Thursday', thursday ?? {}]]) {
        if (!Object.hasOwn(CALL_LABELS, c)) throw new Error(`ideas: ${model}'s ${when} call must be up or down, got ${c}`);
        if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error(`ideas: ${model}'s ${when} confidence must be a number from 0 to 100`);
      }
      if (typeof reason !== 'string' || !reason.trim()) throw new Error(`ideas: ${model} has no reason`);
      // His voice line for this card says its mark and ends on the jab its sticker shows.
      const { stamp, jab } = beatOf(model.toLowerCase());
      if (!Number.isFinite(stamp) || !Number.isFinite(jab?.at) || typeof jab?.text !== 'string') throw new Error(`btc-result.json: beat "${model.toLowerCase()}" needs a stamp and a jab`);
      const opens = `${name ?? model}: ${markOf(idea)}.`;
      const line = STORY.voice.find(({ text }) => text.startsWith(`${name ?? model}: `));
      if (!line?.text.startsWith(opens)) throw new Error(`btc-result.json: ${name ?? model}'s voice line must open "${opens}"`);
      if (!line.text.endsWith(jab.text)) throw new Error(`btc-result.json: ${name ?? model}'s voice line must end on its jab "${jab.text}"`);
    }
    const ups = ideas.filter(({ monday }) => monday.call === 'up');
    if (ups.length !== 1 || ups[0].name !== 'Grok Bot') throw new Error('ideas: the hook says only Grok Bot called UP on Monday');
    const flips = ideas.reduce((n, { monday, wednesday, thursday }) => n + (wednesday.call !== monday.call) + (thursday.call !== wednesday.call), 0);
    if (flips !== FLIPS) throw new Error(`ideas: the calls flipped ${flips} times since Monday, the thumbnail says ${FLIPS}`);
    if (!heroIdea()?.reason.includes(VERDICT.words)) throw new Error(`ideas: ${VERDICT.hero}'s reason no longer says "${VERDICT.words}"`);
    for (const said of [`Friday's close: Bitcoin ${WENT} ${CHANGE}.`, VERDICT.lead, scoredWords().join(' ')]) {
      if (!STORY.voice.some(({ text }) => text === said)) throw new Error(`btc-result.json: "${said}" is not one of his voice lines`);
    }
  }

  // The one reason size for all four cards, the largest at which every reason fits its lines.
  function reasonSize(ideas, parent) {
    const probe = parent.appendChild(svgEl('text', { class: 'card-reason' }));
    const fits = (size) => ideas.every(({ reason }) => {
      probe.style.fontSize = `${size}px`;
      return wrapLines(probe, reason, RESULT_CARD.width - RESULT_REASON.room).length <= RESULT_REASON.lines;
    });
    const size = RESULT_REASON.sizes.find(fits);
    probe.remove();
    if (size === undefined) throw new Error(`ideas: a reason is too long for its card even at ${RESULT_REASON.sizes.at(-1)} px`);
    return size;
  }

  // One card: logo, name, Monday call and confidence on top, the reason word for word under them, and the
  // stamp, drawn under the reason.
  function drawResultCard(idea, parent, size) {
    const { model, name: title, monday, reason } = idea;
    const { x, y, width, height } = RESULT_CARD;
    const card = parent.appendChild(svgEl('g'));
    const name = textEl(title ?? model, { class: 'card-name', x: x + RESULT_CARD.nameX, y: y + RESULT_CARD.rowY });
    const logo = svgEl('g', { transform: `translate(${x + RESULT_CARD.logo[0]} ${y + RESULT_CARD.logo[1]}) scale(${RESULT_CARD.logoScale})` });
    logo.appendChild(modelLogo(model, [0, 0]));
    card.append(
      svgEl('rect', { class: 'card', x, y, width, height, rx: RESULT_CARD.rx }),
      svgEl('rect', { x, y: y + RESULT_CARD.barInset, width: RESULT_CARD.bar, height: height - 2 * RESULT_CARD.barInset, rx: RESULT_CARD.bar / 2, fill: MODEL_COLORS[model] }),
      logo,
      name,
    );
    const conf = card.appendChild(textEl(`${monday.confidence}%`, { class: 'card-conf num', x: x + width - RESULT_CARD.edge, y: y + RESULT_CARD.rowY, 'text-anchor': 'end' }));
    const label = card.appendChild(textEl(CALL_LABELS[monday.call], { class: `card-call card-${monday.call}`, x: conf.getBBox().x - RESULT_CARD.callGap, y: y + RESULT_CARD.rowY, 'text-anchor': 'end' }));
    const gap = label.getBBox().x - (x + RESULT_CARD.nameX + name.getComputedTextLength());
    if (gap < CARD_LABEL_GAP) throw new Error(`ideas: ${model} and its call "${label.textContent}" are ${gap.toFixed(1)} px apart, the card needs ${CARD_LABEL_GAP}`);
    const mark = markOf(idea);
    const stamp = drawStamp(card, [x + width / 2, y + STAMP.y], mark, STAMP);
    const room = { left: x + STAMP.inset, right: x + width - STAMP.inset, top: y + RESULT_CARD.rowY + STAMP.inset, bottom: y + height - STAMP.inset };
    const { box } = stamp;
    if (box.x < room.left || box.x + box.width > room.right || box.y < room.top || box.y + box.height > room.bottom) {
      throw new Error(`stamp "${STAMP.words[mark]}": x ${box.x.toFixed(0)}–${(box.x + box.width).toFixed(0)}, y ${box.y.toFixed(0)}–${(box.y + box.height).toFixed(0)} leaves its card below the call`);
    }
    const text = card.appendChild(svgEl('text', { class: 'card-reason', style: `font-size: ${size}px` }));
    const lines = wrapLines(text, reason, width - RESULT_REASON.room);
    text.textContent = '';
    const first = y + RESULT_REASON.first + ((RESULT_REASON.lines - lines.length) * RESULT_REASON.step) / 2;
    text.append(...lines.map((line, n) => textEl(line, { x: x + RESULT_REASON.inset, y: first + n * RESULT_REASON.step }, 'tspan')));
    return { model, card, reason: text, stamp, gap };
  }

  // His jab as a sticker: dark words on a tilted chip, checked against the frame's right edge and bottom rule.
  function drawJab(parent, words, mark) {
    const [cx, cy] = JAB.centre;
    const outer = parent.appendChild(svgEl('g'));
    const sticker = outer.appendChild(svgEl('g', { transform: `rotate(${JAB.tilt} ${cx} ${cy})` }));
    const text = sticker.appendChild(textEl(words, { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: JAB.ink, style: `font: 900 ${JAB.size}px 'Segoe UI', system-ui, sans-serif` }));
    const box = text.getBBox();
    sticker.insertBefore(svgEl('rect', { x: box.x - JAB.padX, y: box.y - JAB.padY, width: box.width + 2 * JAB.padX, height: box.height + 2 * JAB.padY, rx: JAB.rx, fill: JAB.fill[mark] }), text);
    const room = outer.getBBox();
    if (room.x < 0 || room.x + room.width > JAB.right || room.y + room.height > JAB.bottom) throw new Error(`jab "${words}": x ${room.x.toFixed(0)}–${(room.x + room.width).toFixed(0)}, bottom ${(room.y + room.height).toFixed(0)}, leaves the frame left of x ${JAB.right} above y ${JAB.bottom}`);
    return { outer, sticker };
  }

  // One answer's slot: its card 1.8 times its size and his jab under it, in screen px, moving as one.
  function drawSlot(idea, parent, size, beat, next) {
    const outer = parent.appendChild(svgEl('g'));
    const inner = outer.appendChild(svgEl('g', { transform: `translate(${SLOT.x} ${SLOT.y}) scale(${SLOT.scale})` }));
    const card = drawResultCard(idea, inner, size);
    const right = SLOT.x + SLOT.scale * RESULT_CARD.width;
    if (right > 640) throw new Error(`cards: a card runs to x ${right.toFixed(0)}, off the frame`);
    const mark = markOf(idea);
    return { ...card, ...beat, next, mark, outer, jab: drawJab(outer, beat.words, mark) };
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

  // The marked words' middle on the screen, swept open, where the camera punches in.
  function markCentre(marks) {
    const at = (rect, key) => Number(rect.getAttribute(key));
    const left = Math.min(...marks.map(({ rect }) => at(rect, 'x')));
    const right = Math.max(...marks.map(({ rect, width }) => at(rect, 'x') + width));
    const top = Math.min(...marks.map(({ rect }) => at(rect, 'y')));
    const bottom = Math.max(...marks.map(({ rect }) => at(rect, 'y') + at(rect, 'height')));
    return [SLOT.x + (SLOT.scale * (left + right)) / 2, SLOT.y + (SLOT.scale * (top + bottom)) / 2];
  }

  // The corner count of the stamps so far, "3 hit", then " · 1 miss" once the last one lands;
  // it is pinned to the frame, over everything.
  function drawCounter() {
    const outer = $('s3', 'root').appendChild(svgEl('g'));
    const node = outer.appendChild(svgEl('g'));
    const text = node.appendChild(svgEl('text', { x: COUNTER.x, y: COUNTER.y, fill: COUNTER.fill, style: COUNTER.style }));
    const part = (ink) => text.appendChild(textEl('', ink ? { fill: ink } : {}, 'tspan'));
    return { outer, node, parts: { hit: [part(), part(STAMP.ink.hit)], miss: [part(), part(STAMP.ink.miss)] } };
  }

  // His lead-in to the hero's words, pinned to the frame under the disclaimer.
  function drawLead() {
    const outer = $('s3', 'root').insertBefore(svgEl('g'), screenNote());
    const node = outer.appendChild(svgEl('g'));
    bigLine(node, [[VERDICT.lead]], LEAD, { style: TALLY_STYLE, fill: '#eef2f6' });
    return { outer, node, centre: boxCentre(node) };
  }

  // What is scored: a scrim, its two lines, and the logos moved in under them; the disclaimer stays on top.
  function drawScored(logos) {
    const g = $('s3', 'root').insertBefore(svgEl('g'), screenNote());
    const scrim = g.appendChild(svgEl('rect', { width: 640, height: 360, fill: '#0a1526' }));
    const [first, second] = scoredWords().map((words, i) => {
      const node = g.appendChild(svgEl('g'));
      bigLine(node, [[words]], SCORED.lines[i], { style: TALLY_STYLE, fill: '#eef2f6' });
      return node;
    });
    const box = second.getBBox();
    if (box.y + box.height > LOGO_ROW.y) throw new Error(`scored: "${second.textContent}" runs to y ${(box.y + box.height).toFixed(0)}, the logos start at ${LOGO_ROW.y}`);
    g.appendChild(logos);
    return { scrim, first, second };
  }

  // The camera's view for the quoted line: as close as the hero's whole card fits with its margin, around the
  // marked words' height. Throws if the card would leave the view.
  function verdictView(marks) {
    const width = SLOT.scale * RESULT_CARD.width;
    const zoom = Math.min(HERO_MARK.zoom, 640 / (width + 2 * HERO_MARK.margin));
    const view = around([SLOT.x + width / 2, markCentre(marks)[1]], zoom);
    const [x, y, w, h] = view;
    const [right, bottom] = [SLOT.x + width, SLOT.y + SLOT.scale * RESULT_CARD.height];
    if (SLOT.x < x || right > x + w || SLOT.y < y || bottom > y + h) throw new Error(`verdict: the hero's card runs x ${SLOT.x}–${right.toFixed(0)}, y ${SLOT.y}–${bottom.toFixed(0)}, out of the view`);
    return view;
  }

  function planResultMonitor() {
    const chart = planChart();
    const logos = drawLogos(IDEAS.ideas);
    const parent = $('s3', 'cards');
    const size = reasonSize(IDEAS.ideas, parent);
    const beats = IDEAS.ideas.map(({ model }) => cardBeat(model));
    const slots = IDEAS.ideas.map((idea, i) => drawSlot(idea, parent, size, beats[i], beats[i + 1]?.start));
    const hero = slots.find(({ model }) => model === heroIdea().model);
    const marks = drawMark(hero.card, VERDICT.words, MODEL_COLORS[hero.model]);
    return {
      chart,
      logos,
      slots,
      top: $('s3', 'top'),
      cardGap: Math.min(...slots.map(({ gap }) => gap)),
      note: screenNote(),
      verdict: { marks, view: verdictView(marks), lead: drawLead() },
      scored: drawScored(logos.layer),
      counter: drawCounter(),
    };
  }

  // One answer whips in from the right, and out to the left as the next one whips in. On its stamp the
  // stamp slams down, holds half a second and goes as the answer's own words come in, and his jab is
  // slapped on under the card.
  function renderSlot(slot, k) {
    const { outer, reason, stamp, jab, start, stampAt, jabAt, next } = slot;
    const shown = ease(progress(k, start, SLOT.whip));
    const gone = next === undefined ? 0 : ease(progress(k, next, SLOT.whip));
    outer.style.opacity = k >= start && gone < 1 && k < SCORED_AT ? 1 : 0;
    outer.setAttribute('transform', `translate(${640 * (1 - shown - gone)} 0)`);
    const slam = ease(progress(k, stampAt, STAMP.slam));
    const [cx, cy] = stamp.centre;
    stamp.stamp.setAttribute('transform', `translate(${cx} ${cy}) rotate(${STAMP.tilt}) scale(${lerp(STAMP.from, 1, slam)}) translate(${-cx} ${-cy})`);
    const faded = progress(k, stampAt + STAMP.hold, STAMP.fade);
    stamp.outer.style.opacity = progress(k + 1, stampAt, 2) * (1 - faded);
    reason.style.opacity = faded;
    const [jx, jy] = JAB.centre;
    const slapped = ease(progress(k, jabAt, JAB.slap));
    jab.sticker.setAttribute('transform', `translate(${jx} ${jy}) rotate(${JAB.tilt}) scale(${lerp(JAB.from, 1, slapped)}) translate(${-jx} ${-jy})`);
    const last = next === undefined ? 1 - progress(k, SAID_AT - BEAT_OUT, BEAT_OUT) : 1;
    jab.outer.style.opacity = k >= jabAt ? last : 0;
  }

  // The count changes and pops on each stamp; it steps aside for the punch-in and is back for the tally.
  function renderCounter({ node, parts }, slots, k) {
    const stamped = slots.filter(({ stampAt }) => k >= stampAt);
    let counted = false;
    for (const [mark, [count, word]] of Object.entries(parts)) {
      const n = stamped.filter((slot) => slot.mark === mark).length;
      count.textContent = n ? `${counted ? ' · ' : ''}${n} ` : '';
      word.textContent = n ? STAMP.words[mark].toLowerCase() : '';
      counted ||= n > 0;
    }
    const last = stamped.at(-1)?.stampAt;
    popIn(node, last === undefined || k >= SCORED_AT ? 1 : landing(k, last), COUNTER.centre);
    node.style.opacity = last === undefined || (k >= SAID_AT && k < SCORED_AT) ? 0 : 1;
  }

  // His lead-in pops in on its beat and is gone as the camera punches in.
  function renderLead({ node, centre }, k) {
    const t = landing(k, VERDICT_AT);
    popIn(node, t, centre);
    node.style.opacity = t * (1 - progress(k, SAID_AT - BEAT_OUT, BEAT_OUT));
  }

  // Both lines cut in at once over the scrim.
  function renderScored({ scrim, first, second }, k) {
    const on = k >= SCORED_AT;
    scrim.style.opacity = on ? SCORED.scrim : 0;
    for (const line of [first, second]) {
      line.removeAttribute('transform');
      line.style.opacity = on ? 1 : 0;
    }
  }

  // Under the tally the logos have no paths, and their stamps slam down one after another over the Monday calls.
  function renderScoredLogos({ layer, logos }, k) {
    layer.setAttribute('transform', `translate(${SCORED.shift} 0)`);
    logos.forEach(({ node, label, stamp, path, days, stampCentre }, i) => {
      node.removeAttribute('transform');
      node.style.opacity = 1;
      path.style.opacity = 0;
      days.forEach(({ day }) => (day.style.opacity = 0));
      label.removeAttribute('transform');
      label.style.opacity = 1;
      popIn(stamp, landing(k, SCORED_AT + i * LOGO_ROW.stagger), stampCentre);
    });
  }

  // One answer at a time under a still camera that shakes on each stamp, eases in on the hero's card
  // and cuts back for the tally; the disclaimer, the count and the lead are pinned to the frame.
  function renderResultMonitor(plan, k) {
    const punched = k >= SAID_AT && k < SCORED_AT ? ease(progress(k, SAID_AT, HERO_MARK.frames)) : 0;
    const shakes = [...plan.slots.map(({ stampAt }) => [stampAt, STAMP_SHAKE.px, STAMP_SHAKE.frames]), [SCORED_AT, SCORED.shake, SCORED.shakeFrames]];
    const view = shaken(zoomBox(FULL_VIEW, plan.verdict.view, punched), k, shakes);
    setViewBox('s3', view);
    for (const node of [plan.note, plan.counter.outer, plan.verdict.lead.outer]) {
      pin(node, view);
      node.style.opacity = 1;
    }
    plan.chart.node.style.opacity = 0;
    const titled = progress(k, TITLE_IN.start, TITLE_IN.frames);
    $('s3', 'title').style.opacity = titled;
    plan.top.style.opacity = k < VERDICT_AT ? titled : 0;
    plan.slots.forEach((slot) => renderSlot(slot, k));
    renderCounter(plan.counter, plan.slots, k);
    renderLead(plan.verdict.lead, k);
    plan.verdict.marks.forEach(({ rect, width }, i) => rect.setAttribute('width', width * ease(progress(k, SAID_AT + HERO_MARK.at + i * HERO_MARK.sweep, HERO_MARK.sweep))));
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
  // (cards), each stamp slamming down and each day of flips landing (stamps). Throws unless the music hits the week's figures and the
  // tally.
  function resultClicks({ monitorStart }) {
    for (const hit of [FIGURES_AT, monitorStart + SCORED_AT]) {
      if (!STORY.music.hits.includes(hit)) throw new Error(`btc-result.json: music.hits has no hit on frame ${hit}`);
    }
    const beats = IDEAS.ideas.map(({ model }) => cardBeat(model));
    return {
      lines: [MONDAY_AT, FLIPS_AT, CLOSE_AT, ...beats.map(({ jabAt }) => monitorStart + jabAt), monitorStart + VERDICT_AT],
      cards: beats.map(({ start }) => monitorStart + start),
      stamps: [...FLIP_AT, ...beats.map(({ stampAt }) => monitorStart + stampAt)],
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
