/*
 * The flip-back episode (assets/data/btc-flipback.json). Frame 0 is the thumbnail: "4 AIs. 7 FLIPS." and
 * "Bitcoin −7% in a day." over the four logos, all stamped FLIPPED, each with its calls since Monday as
 * triangles under its name, while he holds his head. Then the chart: Bitcoin's 4h candles up to the
 * Wednesday check-in, and the Wednesday calls drawn from its price as arrows, four green up, each with its
 * logo and confidence.
 * "Then it dumped 7% in a day.": the candles since the check-in sweep in, the arrows shake harder and
 * harder and crack as the day's high to low lands and the camera punches in on it.
 * Then one Thursday answer at a time whips in, big: its Wednesday call flips to the Thursday one under a
 * slammed stamp that holds half a second and goes, FLIPPED BACK when it is the Monday call again, a
 * corner count goes up, the answer's own words fade in, and his jab, the end of his voice line, is
 * slapped on under the card as a sticker. The last card flipped off its Monday call; "Its excuse?",
 * then its own line about luck is marked as the camera eases in on the whole card, and what is scored
 * cuts in with the Monday calls under the logos.
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
    if (!beat) throw new Error(`btc-flipback.json: no beat "${id}"`);
    return beat;
  };
  const hookAt = (id) => CALLS_AT + beatOf(id).start;
  const WEDNESDAY_AT = hookAt('wednesday');
  const DROP_AT = hookAt('drop');
  const LUCK_AT = beatOf('luck').start; // monitor frames from here on
  const RAN_OUT_AT = LUCK_AT + beatOf('luck').ranOut;
  const SCORED_AT = beatOf('scored').start;
  // One answer's beat, named after its model: it whips in, its stamp slams down, his jab lands.
  const cardBeat = (model) => {
    const { start, stamp, jab } = beatOf(model.toLowerCase());
    return { start, stampAt: start + stamp, jabAt: start + jab.at, words: jab.text };
  };

  const UP_INK = '#2fc4b2';
  const DOWN_INK = '#ff6b66';
  // What the hook claims, checked against the ideas and the candles before anything plays.
  const CALLED = { call: 'up', count: 4 }; // "Wednesday: all 4 AIs said Bitcoin goes UP."
  const FLIPS = 7; // the thumbnail's "7 FLIPS.": every call that changed, Monday to Wednesday and Wednesday to Thursday
  // The Wednesday check-in's candle, the candle the day's high to low is measured from, the caption's
  // drop and the way Bitcoin went since the check-in.
  const WEEK = { checkin: '2026-11-04T16', from: '2026-11-04T12', drop: '7%', went: 'down' };
  const CHECKIN = CANDLES.findIndex(({ time }) => time.startsWith(WEEK.checkin)); // the candles after it sweep in
  if (CHECKIN < 0) throw new Error(`chart: no candle at the Wednesday check-in ${WEEK.checkin}`);
  const CHECKIN_PRICE = 80358.58; // the ticker at 17:02 UTC on 4 Nov, as shown to the models (data/prompts/2026-11-04-checkin)
  // How an answer's call moved on Thursday: kept the Wednesday one, back to the Monday one, or off it.
  const turnOf = ({ monday, was, call }) => (call === was.call ? 'kept' : call === monday.call ? 'back' : 'changed');
  const CAPTION_LINE = { x: 320, y: 56, size: 44, min: 34, maxWidth: 600, stroke: 7, lines: [48, 94] }; // one line at y, two at lines
  const THUMB_LINES = [{ y: 62, size: 64, min: 52, stroke: 10 }, { y: 104, size: 36, min: 30, stroke: 6 }]; // frame 0's two lines
  const NOTE = { size: 12, maxWidth: 612, fill: '#8193ad', font: "system-ui, 'Segoe UI', sans-serif", hookY: 347, endY: 340 };
  const HOOK_SLOT = { x: 500, scale: 0.85, floor: 328 };
  // His finger follows what each caption is about, screen px; out of reach, the arm points straight at it.
  const POINTS = [
    { at: 0, target: [270, 170] }, // the Wednesday calls' arrows
    { at: DROP_AT, target: [336, 262] }, // the day's big red candle
  ];
  const POINT = { move: 6 };
  const NOD = { head: 1.5 };
  const LOOK = { eyes: 2.5, ramp: 4, hold: 16 }; // a glance at the screen as each caption lands
  const BROWS = { rest: 1, lift: 2.5, ramp: 4 };
  const GRAB = { reach: 6, shake: 5, shakeFrames: 10, left: [56, 52], right: [104, 52] }; // hands on his head
  // The four models in a row with each Monday call under its name; the calls pop in one after another.
  const LOGO_ROW = { x: 40, step: 128, y: 140, size: 88, nameY: 256, nameSize: 22, nameGap: 8, callY: 290, callSize: 24, right: 530, stagger: 4 };
  const LOGO_STAMP = { y: 202, size: 18, tilt: -10, padX: 6, padY: 1, rx: 4, spacing: 1, stroke: 2, width: 120 }; // over each logo
  // The thumbnail's calls under each name, Monday, Wednesday and Thursday, as triangles centred on y.
  const PATH = { y: 290, width: 26, height: 22, gap: 10 };
  const SCREEN_ROOM = { right: 530, top: 108, bottom: 328 }; // left of him and below the caption shade
  const TILE_PAD = 12;
  // The candles' pane in the chart tile; the candles since the check-in grow from their opens, one after another.
  const CHART = { x: 34, width: 312, top: 210, bottom: 304 };
  const SWEEP = { from: 3, step: 3, grow: 4 };
  const FIGURES_AT = DROP_AT + SWEEP.from + (CANDLES.length - 1 - CHECKIN) * SWEEP.step + SWEEP.grow; // the last candle is up
  // The Wednesday calls as arrows from the check-in price, `reach` px to the right: an up call from `rise`
  // above the line, a down call from `drop` under it, one `row` apart, each with its logo and confidence at
  // its tip. They draw in one after another; the wrong ones shake harder through the sweep and crack on
  // the day's figures, the head half turning down and falling, and dim; a right one glints.
  const ARROW = {
    from: 8, stagger: 6, draw: 6,
    reach: 50, rise: 28, drop: 20, row: 23,
    stroke: 4, head: [12, 7], dot: 4,
    logo: 18, gap: 6, textGap: 4, style: "font: 900 17px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 4px; stroke-linejoin: round",
    quake: 2.5,
    crack: { at: 0.55, turn: 20, drop: 6, frames: 6, dim: 0.4 },
    glint: { scale: 0.3, frames: 8 },
  };
  // The camera punches in on the day's figures as they land, with a shake; they stay under the caption and
  // the cracking arrows stay in the view.
  const PUNCH = { centre: [376, 197], zoom: 1.3, frames: 4, shake: 8, shakeFrames: 8, top: 72 };
  const TITLE_IN = { start: 16, frames: 6 }; // after the hook is gone
  // Each answer's card, drawn at 0,0 and shown 1.8 times its size; it whips in and out over `whip` frames.
  const SLOT = { x: 52, y: 80, scale: 1.8, whip: 6 };
  const FLIP_CARD = { x: 0, y: 0, width: 298, height: 114, rx: 8, bar: 5, barInset: 8, logo: [14, 12], logoScale: 1.5, nameX: 56, rowY: 37, rowMid: 29, edge: 14, callGap: 8 };
  const FLIP_REASON = { sizes: [19, 18, 17, 16], inset: 16, room: 32, lines: 3, first: 63, step: 21 };
  const FLIP = { frames: 6 }; // the call row folds shut and opens on the new call
  // The stamp slams down as the call flips, holds half a second and goes as the answer's words come in.
  const STAMP = { words: { back: 'FLIPPED BACK', changed: 'FLIPPED' }, ink: { back: DOWN_INK, changed: DOWN_INK }, size: 24, y: 78, tilt: -6, padX: 12, padY: 2, rx: 6, spacing: 2, stroke: 4, inset: 2, slam: 5, from: 1.8, hold: 15, fade: 4 };
  const STAMP_SHAKE = { px: 6, frames: 4 };
  // His jab, slapped on under the card in screen px; the last card's goes as the camera punches in.
  const JAB = { centre: [400, 294], size: 26, tilt: -3, padX: 10, padY: 3, rx: 6, ink: '#0a1526', fill: { back: '#f08a24', changed: DOWN_INK }, from: 1.4, slap: 4, right: 640, bottom: 328 };
  // How his voice line on each card opens after its name, by how its call moved.
  const VOICED = { back: 'flipped back.', changed: 'flipped too.' };
  const COUNTER = { x: 16, y: 28, centre: [16, 22], fill: '#eef2f6', style: "font: 700 18px system-ui, 'Segoe UI', sans-serif" };
  // Its own words, marked as the camera eases in on its card, no closer than the card fits with `margin`
  // px on each side; `at` counts from the luck line.
  const HERO_MARK = { words: "The luck that lifted Monday's call ran out", at: 4, sweep: 8, opacity: 0.5, rx: 3, zoom: 1.6, margin: 12, frames: 8 };
  const TALLY_STYLE = "font: 900 44px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 6px; stroke-linejoin: round";
  const LEAD = { words: 'Its excuse?', x: 320, y: 70, size: 34, min: 28, maxWidth: 600, stroke: 5 };
  // What is scored, both lines at once over a scrim, the logos moved in under it and shifted to the middle.
  const SCORED = {
    words: ["Good thing flips don't count.", "Only Monday's calls do."],
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
  const heroIdea = () => IDEAS.ideas.find((idea) => turnOf(idea) === 'changed');

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
    if ($('s4', 'lead').textContent.trim()) throw new Error('btc-flipback.json: the end card has no follow line, so end.lead must be ""');
    const ask = $('s4', 'ask');
    const lines = ask.textContent.split('. ').map((line, i, all) => (i < all.length - 1 ? `${line}.` : line));
    if (lines.length !== END_ASK.lines.length) throw new Error(`btc-flipback.json: end.ask "${ask.textContent}" must be ${END_ASK.lines.length} sentences`);
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
    { start: 0, specs: THUMB_LINES, lines: [[[`${IDEAS.ideas.length} AIs. `], [`${FLIPS} FLIPS.`, DOWN_INK]], [['Bitcoin '], [`−${WEEK.drop}`, DOWN_INK], [' in a day.']]] },
    { start: WEDNESDAY_AT, lines: [[[`Wednesday: all ${CALLED.count} AIs said`]], [['Bitcoin goes '], [CALLED.call.toUpperCase(), UP_INK], ['.']]] },
    { start: DROP_AT, lines: [[['Then it dumped '], [WEEK.drop, DOWN_INK], [' in a day.']]] },
  ];

  // The captions, 1.5 times the weekly size; each one he speaks is his voice line word for word. The
  // ideas are checked here, as the hook is planned first. No coin in this episode.
  function planFlipHook() {
    checkFlipIdeas();
    $('s0', 'coin').style.display = 'none';
    const shade = $('s0', 'root').querySelector('rect[fill="url(#s0-shade)"]');
    if (!shade) throw new Error('flipback.html: the hook has no shade');
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

  // He holds his head on the thumbnail, then points at the screen and nods on the beat; when the day's
  // figures land he grabs his head again, shaking it, until the answers start.
  function hookParts(h) {
    const top = hookY(Rig.STANDING);
    const point = LEFT_ARM.reach(toLocal(pointTarget(h), HOOK_SLOT.x, top, HOOK_SLOT.scale));
    const grab = { ...LEFT_ARM.reach(GRAB.left), ...reachRight(GRAB.right) };
    const shaking = during(h, FIGURES_AT, CALLS_AT, GRAB.reach);
    const grabbed = Math.max(1 - ease(progress(h, WEDNESDAY_AT, GRAB.reach)), shaking);
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

  // His brows are up on the thumbnail and for the drop.
  const hookBrows = (h) =>
    BROWS.rest + BROWS.lift * Math.max(1 - progress(h, WEDNESDAY_AT, BROWS.ramp), during(h, DROP_AT, CALLS_AT, BROWS.ramp));

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
  function renderFlipHook({ captions, shade }, h) {
    shade.style.opacity = h < CALLS_AT ? 1 : 0;
    captions.forEach((caption) => showBeat(caption, h));
    renderHookFigure(captions, h);
  }

  // The logos are on the thumbnail only, with their stamps and their calls since Monday.
  function renderHookLogos({ layer, logos }, f) {
    layer.removeAttribute('transform');
    layer.style.opacity = f < WEDNESDAY_AT ? 1 : 0;
    logos.forEach(({ node, label, stamp, path }) => {
      node.removeAttribute('transform');
      node.style.opacity = 1;
      stamp.style.opacity = 1;
      path.style.opacity = 1;
      label.style.opacity = 0;
    });
  }

  // Each Wednesday call's arrow grows from the check-in price with its label; the wrong ones shake harder
  // through the sweep and crack on the day's figures, a right one glints.
  function renderArrows(arrows, f) {
    const quake = f < FIGURES_AT ? ARROW.quake * progress(f, DROP_AT, FIGURES_AT - DROP_AT) : 0;
    const cracked = ease(progress(f, FIGURES_AT, ARROW.crack.frames));
    const glint = 1 + ARROW.glint.scale * Math.sin(Math.PI * progress(f, FIGURES_AT, ARROW.glint.frames));
    arrows.forEach(({ outer, grow, head, label, origin: [ox, oy], crack: [cx, cy], right, drawAt }, i) => {
      const t = ease(progress(f, drawAt, ARROW.draw));
      grow.setAttribute('transform', `translate(${ox} ${oy}) scale(${t}) translate(${-ox} ${-oy})`);
      label.style.opacity = t;
      if (right) {
        outer.setAttribute('transform', `translate(${ox} ${oy}) scale(${glint}) translate(${-ox} ${-oy})`);
        outer.style.opacity = 1;
        head.removeAttribute('transform');
        return;
      }
      const [dx, dy] = [0, 1].map((n) => quake * 2 * (noise(f, 2 * i + n) - 0.5));
      outer.setAttribute('transform', `translate(${dx} ${dy})`);
      outer.style.opacity = lerp(1, ARROW.crack.dim, cracked);
      head.setAttribute('transform', `translate(0 ${ARROW.crack.drop * cracked}) rotate(${ARROW.crack.turn * cracked} ${cx} ${cy})`);
    });
  }

  // The chart tile cuts in with the Wednesday calls: the candles up to the check-in, the arrows from its
  // price and the Wednesday figures. With the drop the candles since grow from their opens left to right,
  // then the day's figures pop in in the Wednesday figures' place on the hit.
  function renderChartTile(chart, f) {
    popIn(chart.node, landing(f, WEDNESDAY_AT), chart.centre);
    chart.candles.forEach(({ node, open }, i) => {
      const t = i < CHECKIN ? 1 : ease(progress(f, DROP_AT + SWEEP.from + (i - CHECKIN) * SWEEP.step, SWEEP.grow));
      squash(node, open, t);
      node.style.opacity = t > 0 ? 1 : 0;
    });
    chart.calls.style.opacity = f < FIGURES_AT ? 1 : 0;
    popIn(chart.figures, landing(f, FIGURES_AT), chart.figuresCentre);
    renderArrows(chart.arrows, f);
  }

  // The hook's screen: the logos, then the chart with the camera punching in on the day's figures. The
  // header, the answers, the count and the leads wait for the monitor.
  function renderFlipHookScreen(plan, f) {
    for (const node of [$('s3', 'title'), plan.top, plan.note, plan.counter.outer, plan.luck.lead.outer]) node.style.opacity = 0;
    plan.slots.forEach(({ outer }) => (outer.style.opacity = 0));
    renderScored(plan.scored, -1);
    renderHookLogos(plan.logos, f);
    renderChartTile(plan.chart, f);
    const punched = ease(progress(f, FIGURES_AT, PUNCH.frames));
    setViewBox('s3', shaken(zoomBox(FULL_VIEW, PUNCH_VIEW, punched), f, [[FIGURES_AT, PUNCH.shake, PUNCH.shakeFrames]]));
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
  // down ones red and pointing down.
  function drawPath(parent, centre, calls) {
    const path = parent.appendChild(svgEl('g'));
    const left = centre - (calls.length * PATH.width + (calls.length - 1) * PATH.gap) / 2;
    calls.forEach((call, n) => {
      const x = left + n * (PATH.width + PATH.gap);
      const [tip, base] = call === 'up' ? [PATH.y - PATH.height / 2, PATH.y + PATH.height / 2] : [PATH.y + PATH.height / 2, PATH.y - PATH.height / 2];
      const points = [[x + PATH.width / 2, tip], [x, base], [x + PATH.width, base]];
      path.appendChild(svgEl('polygon', { points: points.join(' '), fill: call === 'up' ? UP_INK : DOWN_INK }));
    });
    return path;
  }

  // Each model's logo 88 px wide with its name and its Monday call, the scored one, under it, in the
  // file's order, a FLIPPED stamp over the logo and, for the thumbnail, its calls since Monday.
  function drawLogos(ideas) {
    const layer = $('s3', 'logos');
    const tile = LOGO_ROW.size / CARD_LOGO.tile;
    const logos = ideas.map(({ model, name: title, monday, was, call }, i) => {
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
      const stamp = drawStamp(node, [centre, LOGO_STAMP.y], 'changed', LOGO_STAMP);
      if (stamp.box.width > LOGO_STAMP.width) throw new Error(`logos: ${model}'s stamp is ${stamp.box.width.toFixed(0)} px wide, the row fits ${LOGO_STAMP.width}`);
      const path = drawPath(node, centre, [monday.call, was.call, call]);
      const { width } = path.getBBox();
      if (width > LOGO_ROW.step - LOGO_ROW.nameGap) throw new Error(`logos: ${model}'s calls are ${width.toFixed(0)} px, the row fits ${LOGO_ROW.step - LOGO_ROW.nameGap}`);
      return { node, label, stamp: stamp.outer, path, labelCentre: boxCentre(label) };
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

  // Throws unless the tile's figures and the hook's claims are what the candles say.
  function checkFigures(candles) {
    const from = candles.findIndex(({ time }) => time.startsWith(WEEK.from));
    if (from < 0) throw new Error(`chart: no candle at ${WEEK.from}`);
    const day = candles.slice(from);
    const high = Math.max(...day.map((c) => c.high));
    const low = Math.min(...day.map((c) => c.low));
    const [highAt, lowAt] = [day.findIndex((c) => c.high === high), day.findIndex((c) => c.low === low)];
    if (highAt >= lowAt) throw new Error(`chart: the high (candle ${from + highAt}) must come before the low (candle ${from + lowAt}) for a drop`);
    const drop = (100 * (high - low)) / high;
    const { low: checkinLow, high: checkinHigh } = candles[CHECKIN];
    if (CHECKIN_PRICE < checkinLow || CHECKIN_PRICE > checkinHigh) throw new Error(`chart: the check-in price ${CHECKIN_PRICE} is outside its candle, ${checkinLow}–${checkinHigh}`);
    const called = (call) => IDEAS.ideas.filter(({ was }) => was.call === call).length;
    const found = {
      'the drop': [$('s3', 'jump-big').textContent, `−${drop.toFixed(1)}%`],
      "the caption's drop": [WEEK.drop, `${Math.floor(drop)}%`],
      'the check-in price': [$('s3', 'monday-open').textContent, usd(CHECKIN_PRICE)],
      'the tally': [$('s3', 'monday-tally').textContent, `${called('down')} down, ${called('up')} up`],
      'the high and low': [[...$('s3', 'chart-figures').querySelectorAll('.zone-text')].map((text) => text.textContent).join(', '), `high ${usd(high)}, low ${usd(low)}`],
    };
    for (const [what, [shown, data]] of Object.entries(found)) {
      if (shown !== data) throw new Error(`chart: ${what} reads "${shown}", the candles say "${data}"`);
    }
  }

  // A box in the punched-in view's screen px.
  function punchedBox(box) {
    const [vx, vy, vw] = PUNCH_VIEW;
    const [left, top] = [((box.x - vx) * 640) / vw, ((box.y - vy) * 640) / vw];
    return { left, top, right: left + (box.width * 640) / vw, bottom: top + (box.height * 640) / vw };
  }

  // Each Wednesday call as an arrow from the check-in price, drawn at its full length: a tail to where it
  // cracks, then the rest of the shaft and the head, and its logo and confidence at the tip.
  function drawArrows(parent, origin) {
    const layer = parent.appendChild(svgEl('g'));
    layer.appendChild(svgEl('circle', { cx: origin[0], cy: origin[1], r: ARROW.dot, fill: '#eef2f6' }));
    const rows = { up: 0, down: 0 };
    return IDEAS.ideas.map(({ model, was }, i) => {
      const up = was.call === 'up';
      const row = rows[was.call]++ * ARROW.row;
      const tip = [origin[0] + ARROW.reach, up ? origin[1] - ARROW.rise - row : origin[1] + ARROW.drop + row];
      const length = dist(origin, tip);
      const [dx, dy] = [(tip[0] - origin[0]) / length, (tip[1] - origin[1]) / length];
      const base = [tip[0] - dx * ARROW.head[0], tip[1] - dy * ARROW.head[0]];
      const side = (s) => [base[0] - dy * ARROW.head[1] * s, base[1] + dx * ARROW.head[1] * s];
      const crack = [lerp(origin[0], base[0], ARROW.crack.at), lerp(origin[1], base[1], ARROW.crack.at)];
      const ink = up ? UP_INK : DOWN_INK;
      const outer = layer.appendChild(svgEl('g'));
      const grow = outer.appendChild(svgEl('g', { stroke: ink, fill: ink, 'stroke-width': ARROW.stroke, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      grow.appendChild(svgEl('line', { x1: origin[0], y1: origin[1], x2: crack[0], y2: crack[1] }));
      const head = grow.appendChild(svgEl('g'));
      head.append(
        svgEl('line', { x1: crack[0], y1: crack[1], x2: base[0], y2: base[1] }),
        svgEl('polygon', { points: [tip, side(1), side(-1)].map((p) => p.join(',')).join(' ') }),
      );
      const label = outer.appendChild(svgEl('g'));
      const mark = label.appendChild(svgEl('g', { transform: `translate(${tip[0] + ARROW.gap} ${tip[1] - ARROW.logo / 2}) scale(${ARROW.logo / CARD_LOGO.tile})` }));
      mark.appendChild(modelLogo(model, [0, 0]));
      mark.querySelector('.card-logo').style.vectorEffect = 'non-scaling-stroke';
      label.appendChild(textEl(`${was.confidence}%`, { x: tip[0] + ARROW.gap + ARROW.logo + ARROW.textGap, y: tip[1], 'dominant-baseline': 'central', fill: '#eef2f6', style: ARROW.style }));
      return { outer, grow, head, label, origin, crack, right: was.call === WEEK.went, drawAt: WEDNESDAY_AT + ARROW.from + i * ARROW.stagger };
    });
  }

  // The story's candles from Tuesday on, the check-in price dashed across the candles since and the
  // Wednesday calls as arrows from it. The arrows' labels must stay apart and clear of the candles since
  // the check-in and the tile's kicker, and, punched in on, the arrows must stay in the view and the
  // day's figures left of him and under the caption.
  function planChart() {
    checkFigures(CANDLES);
    const lo = Math.min(...CANDLES.map((c) => c.low));
    const hi = Math.max(...CANDLES.map((c) => c.high));
    const yOf = (price) => lerp(CHART.bottom, CHART.top, (price - lo) / (hi - lo));
    const slot = CHART.width / CANDLES.length;
    const xOf = (i) => CHART.x + slot * (i + 0.5);
    const body = slot * BODY;
    const layer = $('s3', 'chart-candles');
    const origin = [xOf(CHECKIN) - slot / 2, yOf(CHECKIN_PRICE)];
    layer.appendChild(svgEl('line', { class: 'open-line', x1: origin[0], y1: origin[1], x2: CHART.x + CHART.width, y2: origin[1] }));
    const drawn = CANDLES.map(({ open, high, low, close }, i) => {
      const node = layer.appendChild(svgEl('g', { class: toneOf(close >= open) }));
      const [top, base] = [yOf(Math.max(open, close)), yOf(Math.min(open, close))];
      node.append(
        svgEl('line', { class: 'candle-wick', x1: xOf(i), y1: yOf(high), x2: xOf(i), y2: yOf(low) }),
        svgEl('rect', { class: 'candle-body', x: xOf(i) - body / 2, y: top, width: body, height: Math.max(1, base - top) }),
      );
      return { node, open: yOf(open), boxes: [...node.children].map((part) => part.getBBox()) };
    });
    const arrows = drawArrows(layer, origin);
    const labels = arrows.map(({ label }) => label.getBBox());
    const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    labels.forEach((a, i) => labels.slice(i + 1).forEach((b, j) => {
      if (overlap(a, b)) throw new Error(`chart: the arrows' labels ${i} and ${i + 1 + j} overlap`);
    }));
    const node = $('s3', 'chart-tile');
    const kicker = node.querySelector(':scope > text.kicker').getBBox();
    labels.forEach((label, i) => {
      if (overlap(label, kicker)) throw new Error(`chart: the arrows' label ${i} runs into the tile's kicker`);
      drawn.slice(CHECKIN).forEach(({ boxes }, n) => {
        if (boxes.some((box) => overlap(label, box))) throw new Error(`chart: the arrows' label ${i} runs into candle ${CHECKIN + n}`);
      });
    });
    const card = node.querySelector(':scope > rect.card');
    const arrowsBox = arrows[0].outer.parentNode.getBBox();
    if (arrowsBox.y + arrowsBox.height > Number(card.getAttribute('y')) + Number(card.getAttribute('height'))) throw new Error('chart: the arrows run under the tile');
    const punchedArrows = punchedBox(arrowsBox);
    if (punchedArrows.left < 0 || punchedArrows.top < PUNCH.top) throw new Error(`chart: punched in, the arrows start at x ${punchedArrows.left.toFixed(0)}, y ${punchedArrows.top.toFixed(0)}, out of the view`);
    checkTile(node);
    const figures = $('s3', 'chart-figures');
    const { left, top, right, bottom } = punchedBox(figures.getBBox());
    if (left < 0 || right > SCREEN_ROOM.right || top < PUNCH.top || bottom > SCREEN_ROOM.bottom) {
      throw new Error(`chart: punched in, the figures run x ${left.toFixed(0)}–${right.toFixed(0)}, y ${top.toFixed(0)}–${bottom.toFixed(0)}, out of the room left of him and under the caption`);
    }
    return { node, centre: boxCentre(node), candles: drawn, arrows, calls: $('s3', 'monday-calls'), figures, figuresCentre: boxCentre(figures) };
  }

  // ---------------------------------------------------------------- answers

  // checkMonitorData's checks on the ideas, without its ten-word cap, plus each Monday and Wednesday call
  // and whether it changed; the hook's claims about the Wednesday calls, each answer's beat and his voice
  // lines and jabs are checked here too.
  function checkFlipIdeas() {
    const { ideas } = IDEAS;
    if (!Array.isArray(ideas) || !ideas.length || ideas.length > 4) throw new Error('ideas: the cards fit 1 to 4 models');
    if (new Set(ideas.map((idea) => idea.model)).size !== ideas.length) throw new Error('ideas: one idea per model');
    for (const idea of ideas) {
      const { model, name, monday, was, call, confidence, since, reason } = idea;
      if (!Object.hasOwn(MODEL_COLORS, model)) throw new Error(`ideas: unknown model ${model}`);
      if (!Object.hasOwn(LOGOS, model.toLowerCase())) throw new Error(`ideas: no logo for ${model}`);
      if (name !== undefined && (typeof name !== 'string' || !name.trim())) throw new Error(`ideas: ${model} name must be a non-empty line`);
      for (const [when, { call: c, confidence: p }] of [['Monday', monday ?? {}], ['Wednesday', was ?? {}], ['Thursday', { call, confidence }]]) {
        if (!Object.hasOwn(CALL_LABELS, c)) throw new Error(`ideas: ${model}'s ${when} call must be up or down, got ${c}`);
        if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error(`ideas: ${model}'s ${when} confidence must be a number from 0 to 100`);
      }
      if (since !== (call === was.call ? 'kept' : 'changed')) throw new Error(`ideas: ${model} went ${was.call} to ${call}, so since can't be ${since}`);
      if (typeof reason !== 'string' || !reason.trim()) throw new Error(`ideas: ${model} has no reason`);
      // His voice line for this card says how it flipped and ends on the jab its sticker shows.
      const { stamp, jab } = beatOf(model.toLowerCase());
      if (!Number.isFinite(stamp) || !Number.isFinite(jab?.at) || typeof jab?.text !== 'string') throw new Error(`btc-flipback.json: beat "${model.toLowerCase()}" needs a stamp and a jab`);
      const opens = `${name ?? model} ${VOICED[turnOf(idea)]}`;
      const line = STORY.voice.find(({ text }) => text.startsWith(`${name ?? model} `));
      if (!line?.text.startsWith(opens)) throw new Error(`btc-flipback.json: ${name ?? model}'s voice line must open "${opens}"`);
      if (!line.text.endsWith(jab.text)) throw new Error(`btc-flipback.json: ${name ?? model}'s voice line must end on its jab "${jab.text}"`);
    }
    const called = ideas.filter(({ was }) => was.call === CALLED.call);
    if (called.length !== CALLED.count) throw new Error(`ideas: ${called.length} Wednesday calls were ${CALLED.call}, the hook says ${CALLED.count}`);
    const held = ideas.find(({ since }) => since !== 'changed');
    if (held) throw new Error(`ideas: the hook says they all flipped, and ${held.model} kept its call`);
    const flips = ideas.reduce((n, { monday, was, call }) => n + (was.call !== monday.call) + (call !== was.call), 0);
    if (flips !== FLIPS) throw new Error(`ideas: the calls flipped ${flips} times since Monday, the thumbnail says ${FLIPS}`);
    const heroes = ideas.filter((idea) => turnOf(idea) === 'changed');
    if (heroes.length !== 1) throw new Error(`ideas: the hook is about the one model that flipped off its Monday call, and ${heroes.length} did`);
    if (!heroes[0].reason.includes(HERO_MARK.words)) throw new Error(`ideas: ${heroes[0].model}'s reason no longer says "${HERO_MARK.words}"`);
    for (const said of [LEAD.words, SCORED.words.join(' ')]) {
      if (!STORY.voice.some(({ text }) => text === said)) throw new Error(`btc-flipback.json: "${said}" is not one of his voice lines`);
    }
  }

  // The one reason size for all four cards, the largest at which every reason fits its lines.
  function flipReasonSize(ideas, parent) {
    const probe = parent.appendChild(svgEl('text', { class: 'card-reason' }));
    const fits = (size) => ideas.every(({ reason }) => {
      probe.style.fontSize = `${size}px`;
      return wrapLines(probe, reason, FLIP_CARD.width - FLIP_REASON.room).length <= FLIP_REASON.lines;
    });
    const size = FLIP_REASON.sizes.find(fits);
    probe.remove();
    if (size === undefined) throw new Error(`ideas: a reason is too long for its card even at ${FLIP_REASON.sizes.at(-1)} px`);
    return size;
  }

  // One card: logo, name, call and confidence on top, the reason word for word under them. It carries
  // both calls, Wednesday's and Thursday's, and the stamp, drawn under the reason.
  function drawFlipCard({ model, name: title, monday, was, call, confidence, reason }, parent, size) {
    const { x, y, width, height } = FLIP_CARD;
    const card = parent.appendChild(svgEl('g'));
    const name = textEl(title ?? model, { class: 'card-name', x: x + FLIP_CARD.nameX, y: y + FLIP_CARD.rowY });
    const logo = svgEl('g', { transform: `translate(${x + FLIP_CARD.logo[0]} ${y + FLIP_CARD.logo[1]}) scale(${FLIP_CARD.logoScale})` });
    logo.appendChild(modelLogo(model, [0, 0]));
    card.append(
      svgEl('rect', { class: 'card', x, y, width, height, rx: FLIP_CARD.rx }),
      svgEl('rect', { x, y: y + FLIP_CARD.barInset, width: FLIP_CARD.bar, height: height - 2 * FLIP_CARD.barInset, rx: FLIP_CARD.bar / 2, fill: MODEL_COLORS[model] }),
      logo,
      name,
    );
    const nameEnd = x + FLIP_CARD.nameX + name.getComputedTextLength();
    const callRow = (c, p) => {
      const row = card.appendChild(svgEl('g'));
      const conf = row.appendChild(textEl(`${p}%`, { class: 'card-conf num', x: x + width - FLIP_CARD.edge, y: y + FLIP_CARD.rowY, 'text-anchor': 'end' }));
      const label = row.appendChild(textEl(CALL_LABELS[c], { class: `card-call card-${c}`, x: conf.getBBox().x - FLIP_CARD.callGap, y: y + FLIP_CARD.rowY, 'text-anchor': 'end' }));
      const gap = label.getBBox().x - nameEnd;
      if (gap < CARD_LABEL_GAP) throw new Error(`ideas: ${model} and its call "${label.textContent}" are ${gap.toFixed(1)} px apart, the card needs ${CARD_LABEL_GAP}`);
      return { row, label, conf, gap };
    };
    const before = callRow(was.call, was.confidence);
    const after = callRow(call, confidence);
    const flips = [before.row, after.row];
    const turn = turnOf({ monday, was, call });
    const stamp = drawStamp(card, [x + width / 2, y + STAMP.y], turn, STAMP);
    const room = { left: x + STAMP.inset, right: x + width - STAMP.inset, top: y + FLIP_CARD.rowY + STAMP.inset, bottom: y + height - STAMP.inset };
    const { box } = stamp;
    if (box.x < room.left || box.x + box.width > room.right || box.y < room.top || box.y + box.height > room.bottom) {
      throw new Error(`stamp "${STAMP.words[turn]}": x ${box.x.toFixed(0)}–${(box.x + box.width).toFixed(0)}, y ${box.y.toFixed(0)}–${(box.y + box.height).toFixed(0)} leaves its card below the call`);
    }
    const text = card.appendChild(svgEl('text', { class: 'card-reason', style: `font-size: ${size}px` }));
    const lines = wrapLines(text, reason, width - FLIP_REASON.room);
    text.textContent = '';
    const first = y + FLIP_REASON.first + ((FLIP_REASON.lines - lines.length) * FLIP_REASON.step) / 2;
    text.append(...lines.map((line, n) => textEl(line, { x: x + FLIP_REASON.inset, y: first + n * FLIP_REASON.step }, 'tspan')));
    return { model, card, flips, mid: y + FLIP_CARD.rowMid, reason: text, stamp, gap: Math.min(before.gap, after.gap) };
  }

  // His jab as a sticker: dark words on a tilted chip, checked against the frame's right edge and bottom rule.
  function drawJab(parent, words, turn) {
    const [cx, cy] = JAB.centre;
    const outer = parent.appendChild(svgEl('g'));
    const sticker = outer.appendChild(svgEl('g', { transform: `rotate(${JAB.tilt} ${cx} ${cy})` }));
    const text = sticker.appendChild(textEl(words, { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: JAB.ink, style: `font: 900 ${JAB.size}px 'Segoe UI', system-ui, sans-serif` }));
    const box = text.getBBox();
    sticker.insertBefore(svgEl('rect', { x: box.x - JAB.padX, y: box.y - JAB.padY, width: box.width + 2 * JAB.padX, height: box.height + 2 * JAB.padY, rx: JAB.rx, fill: JAB.fill[turn] }), text);
    const room = outer.getBBox();
    if (room.x < 0 || room.x + room.width > JAB.right || room.y + room.height > JAB.bottom) throw new Error(`jab "${words}": x ${room.x.toFixed(0)}–${(room.x + room.width).toFixed(0)}, bottom ${(room.y + room.height).toFixed(0)}, leaves the frame left of x ${JAB.right} above y ${JAB.bottom}`);
    return { outer, sticker };
  }

  // One answer's slot: its card 1.8 times its size and his jab under it, in screen px, moving as one.
  function drawSlot(idea, parent, size, beat, next) {
    const outer = parent.appendChild(svgEl('g'));
    const inner = outer.appendChild(svgEl('g', { transform: `translate(${SLOT.x} ${SLOT.y}) scale(${SLOT.scale})` }));
    const card = drawFlipCard(idea, inner, size);
    const right = SLOT.x + SLOT.scale * FLIP_CARD.width;
    if (right > 640) throw new Error(`cards: a card runs to x ${right.toFixed(0)}, off the frame`);
    const turn = turnOf(idea);
    return { ...card, ...beat, next, turn, outer, jab: drawJab(outer, beat.words, turn) };
  }

  // A rect behind each line the words run on, so the words stay the model's own; the rects start with no
  // width and renderFlipMonitor sweeps them open.
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
      const height = Math.min(first.height, FLIP_REASON.step - 2);
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

  // The corner count of the stamps so far, "3 flipped back", then " · 1 flipped" once Grok Bot's lands;
  // it is pinned to the frame, over everything.
  function drawCounter() {
    const outer = $('s3', 'root').appendChild(svgEl('g'));
    const node = outer.appendChild(svgEl('g'));
    const text = node.appendChild(svgEl('text', { x: COUNTER.x, y: COUNTER.y, fill: COUNTER.fill, style: COUNTER.style }));
    const part = (ink) => text.appendChild(textEl('', ink ? { fill: ink } : {}, 'tspan'));
    return { outer, node, parts: { back: [part(), part(STAMP.ink.back)], changed: [part(), part(STAMP.ink.changed)] } };
  }

  // "Its excuse?", pinned to the frame under the disclaimer.
  function drawLead() {
    const outer = $('s3', 'root').insertBefore(svgEl('g'), screenNote());
    const node = outer.appendChild(svgEl('g'));
    bigLine(node, [[LEAD.words]], LEAD, { style: TALLY_STYLE, fill: '#eef2f6' });
    return { outer, node, centre: boxCentre(node) };
  }

  // What is scored: a scrim, its two lines, and the logos moved in under them; the disclaimer stays on top.
  function drawScored(logos) {
    const g = $('s3', 'root').insertBefore(svgEl('g'), screenNote());
    const scrim = g.appendChild(svgEl('rect', { width: 640, height: 360, fill: '#0a1526' }));
    const [first, second] = SCORED.words.map((words, i) => {
      const node = g.appendChild(svgEl('g'));
      bigLine(node, [[words]], SCORED.lines[i], { style: TALLY_STYLE, fill: '#eef2f6' });
      return node;
    });
    const box = second.getBBox();
    if (box.y + box.height > LOGO_ROW.y) throw new Error(`scored: "${second.textContent}" runs to y ${(box.y + box.height).toFixed(0)}, the logos start at ${LOGO_ROW.y}`);
    g.appendChild(logos);
    return { scrim, first, second };
  }

  // The camera's view for the luck line: as close as the hero's whole card fits with its margin, around the
  // marked words' height. Throws if the card would leave the view.
  function luckView(marks) {
    const width = SLOT.scale * FLIP_CARD.width;
    const zoom = Math.min(HERO_MARK.zoom, 640 / (width + 2 * HERO_MARK.margin));
    const view = around([SLOT.x + width / 2, markCentre(marks)[1]], zoom);
    const [x, y, w, h] = view;
    const [right, bottom] = [SLOT.x + width, SLOT.y + SLOT.scale * FLIP_CARD.height];
    if (SLOT.x < x || right > x + w || SLOT.y < y || bottom > y + h) throw new Error(`luck: the hero's card runs x ${SLOT.x}–${right.toFixed(0)}, y ${SLOT.y}–${bottom.toFixed(0)}, out of the view`);
    return view;
  }

  function planFlipMonitor() {
    const chart = planChart();
    const logos = drawLogos(IDEAS.ideas);
    const parent = $('s3', 'cards');
    const size = flipReasonSize(IDEAS.ideas, parent);
    const beats = IDEAS.ideas.map(({ model }) => cardBeat(model));
    const slots = IDEAS.ideas.map((idea, i) => drawSlot(idea, parent, size, beats[i], beats[i + 1]?.start));
    const hero = slots.find(({ model }) => model === heroIdea().model);
    const marks = drawMark(hero.card, HERO_MARK.words, MODEL_COLORS[hero.model]);
    return {
      chart,
      logos,
      slots,
      top: $('s3', 'top'),
      cardGap: Math.min(...slots.map(({ gap }) => gap)),
      note: screenNote(),
      luck: { marks, view: luckView(marks), lead: drawLead() },
      scored: drawScored(logos.layer),
      counter: drawCounter(),
    };
  }

  // One answer whips in from the right, and out to the left as the next one whips in. On its stamp the
  // call row folds shut and opens on Thursday's call as the stamp slams down; the stamp holds half a
  // second and goes as the answer's own words come in, and his jab is slapped on under the card.
  function renderSlot(slot, k) {
    const { outer, flips: [from, to], mid, reason, stamp, jab, start, stampAt, jabAt, next } = slot;
    const shown = ease(progress(k, start, SLOT.whip));
    const gone = next === undefined ? 0 : ease(progress(k, next, SLOT.whip));
    outer.style.opacity = k >= start && gone < 1 && k < SCORED_AT ? 1 : 0;
    outer.setAttribute('transform', `translate(${640 * (1 - shown - gone)} 0)`);
    const t = progress(k, stampAt, FLIP.frames);
    squash(from, mid, t < 0.5 ? 1 - 2 * t : 0);
    squash(to, mid, t < 0.5 ? 0 : 2 * t - 1);
    from.style.opacity = t < 0.5 ? 1 : 0;
    to.style.opacity = t < 0.5 ? 0 : 1;
    const slam = ease(progress(k, stampAt, STAMP.slam));
    const [cx, cy] = stamp.centre;
    stamp.stamp.setAttribute('transform', `translate(${cx} ${cy}) rotate(${STAMP.tilt}) scale(${lerp(STAMP.from, 1, slam)}) translate(${-cx} ${-cy})`);
    const faded = progress(k, stampAt + STAMP.hold, STAMP.fade);
    stamp.outer.style.opacity = progress(k + 1, stampAt, 2) * (1 - faded);
    reason.style.opacity = faded;
    const [jx, jy] = JAB.centre;
    const slapped = ease(progress(k, jabAt, JAB.slap));
    jab.sticker.setAttribute('transform', `translate(${jx} ${jy}) rotate(${JAB.tilt}) scale(${lerp(JAB.from, 1, slapped)}) translate(${-jx} ${-jy})`);
    const last = next === undefined ? 1 - progress(k, RAN_OUT_AT - BEAT_OUT, BEAT_OUT) : 1;
    jab.outer.style.opacity = k >= jabAt ? last : 0;
  }

  // The count changes and pops on each stamp; it steps aside for the punch-in and is back for what is scored.
  function renderCounter({ node, parts }, slots, k) {
    const stamped = slots.filter(({ stampAt }) => k >= stampAt);
    let counted = false;
    for (const [turn, [count, word]] of Object.entries(parts)) {
      const n = stamped.filter((slot) => slot.turn === turn).length;
      count.textContent = n ? `${counted ? ' · ' : ''}${n} ` : '';
      word.textContent = n ? STAMP.words[turn].toLowerCase() : '';
      counted ||= n > 0;
    }
    const last = stamped.at(-1)?.stampAt;
    popIn(node, last === undefined || k >= SCORED_AT ? 1 : landing(k, last), COUNTER.centre);
    node.style.opacity = last === undefined || (k >= RAN_OUT_AT && k < SCORED_AT) ? 0 : 1;
  }

  // "Its excuse?" pops in on its beat and is gone as the camera punches in.
  function renderLead({ node, centre }, k) {
    const t = landing(k, LUCK_AT);
    popIn(node, t, centre);
    node.style.opacity = t * (1 - progress(k, RAN_OUT_AT - BEAT_OUT, BEAT_OUT));
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

  // Under what is scored the logos have no stamps or paths; the Monday calls pop in under them one after another.
  function renderScoredLogos({ layer, logos }, k) {
    layer.setAttribute('transform', `translate(${SCORED.shift} 0)`);
    logos.forEach(({ node, label, stamp, path, labelCentre }, i) => {
      node.removeAttribute('transform');
      node.style.opacity = 1;
      stamp.style.opacity = 0;
      path.style.opacity = 0;
      popIn(label, landing(k, SCORED_AT + i * LOGO_ROW.stagger), labelCentre);
    });
  }

  // One answer at a time under a still camera that shakes on each stamp, eases in on the hero's card
  // and cuts back for what is scored; the disclaimer, the count and the lead are pinned to the frame.
  function renderFlipMonitor(plan, k) {
    const punched = k >= RAN_OUT_AT && k < SCORED_AT ? ease(progress(k, RAN_OUT_AT, HERO_MARK.frames)) : 0;
    const shakes = [...plan.slots.map(({ stampAt }) => [stampAt, STAMP_SHAKE.px, STAMP_SHAKE.frames]), [SCORED_AT, SCORED.shake, SCORED.shakeFrames]];
    const view = shaken(zoomBox(FULL_VIEW, plan.luck.view, punched), k, shakes);
    setViewBox('s3', view);
    for (const node of [plan.note, plan.counter.outer, plan.luck.lead.outer]) {
      pin(node, view);
      node.style.opacity = 1;
    }
    plan.chart.node.style.opacity = 0;
    const titled = progress(k, TITLE_IN.start, TITLE_IN.frames);
    $('s3', 'title').style.opacity = titled;
    plan.top.style.opacity = k < LUCK_AT ? titled : 0;
    plan.slots.forEach((slot) => renderSlot(slot, k));
    renderCounter(plan.counter, plan.slots, k);
    renderLead(plan.luck.lead, k);
    plan.luck.marks.forEach(({ rect, width }, i) => rect.setAttribute('width', width * ease(progress(k, RAN_OUT_AT + HERO_MARK.at + i * HERO_MARK.sweep, HERO_MARK.sweep))));
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
  // (cards), each stamp slamming down (stamps). Throws unless the music hits the day's figures and what is
  // scored.
  function flipClicks({ monitorStart }) {
    for (const hit of [FIGURES_AT, monitorStart + SCORED_AT]) {
      if (!STORY.music.hits.includes(hit)) throw new Error(`btc-flipback.json: music.hits has no hit on frame ${hit}`);
    }
    const beats = IDEAS.ideas.map(({ model }) => cardBeat(model));
    return {
      lines: [WEDNESDAY_AT, DROP_AT, ...beats.map(({ jabAt }) => monitorStart + jabAt), monitorStart + LUCK_AT],
      cards: beats.map(({ start }) => monitorStart + start),
      stamps: beats.map(({ stampAt }) => monitorStart + stampAt),
    };
  }

  window.STORY = {
    ...window.STORY,
    hookFrames: STORY.hookFrames,
    monitorFrames: STORY.monitorFrames,
    endFrames: STORY.endFrames,
    planHook: planFlipHook,
    renderHook: renderFlipHook,
    renderHookScreen: renderFlipHookScreen,
    planMonitor: planFlipMonitor,
    renderMonitor: renderFlipMonitor,
    renderEnd: renderCallEnd,
    endCut: true, // what is scored cuts to the end card on the beat instead of dissolving under it
    clicks: flipClicks,
  };
})();
