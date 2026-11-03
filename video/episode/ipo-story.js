/*
 * The Anthropic IPO episode (assets/data/anthropic-ipo.json): one pre-registered question instead of a
 * chart. He is on from the first frame, pointing at the screen: the four models with Claude singled out,
 * the filing, then its one figure with its own caption, how US IPOs since 1980 closed day one and "Is this
 * one different?".
 * Then the four calls land two by two under the question, and the climax: all four say up, including
 * Claude, so "Biased?" brings Claude's conflict of interest, the disclosure, while Claude's own reason
 * for a pop is marked on its card. He speaks his own captions (the
 * story's "voice" cues), so there is no subtitle layer. Every time comes from the story's beats. Loads
 * after episode.js and uses its helpers; an IIFE, because classic scripts share one global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);

  const BEAT = 1800 / STORY.music.bpm; // frames per beat at 30 fps
  const CALLS_AT = STORY.hookFrames - HOOK_DISSOLVE; // the monitor starts; every caption is gone by then
  const CALL_STEP = 2 * BEAT; // one call every two beats, 1.5 s at 80 bpm
  const CENTRE = [320, 180];

  // A beat's start in monitor frames, as the story and score.py count them.
  const beatStart = (id) => {
    const beat = STORY.beats.find((b) => b.id === id);
    if (!beat) throw new Error(`anthropic-ipo.json: no beat "${id}"`);
    return beat.start;
  };
  const hookAt = (id) => CALLS_AT + beatStart(id);
  const CLAUDE_AT = hookAt('claude');
  const FACTS_AT = hookAt('facts');
  const REVENUE_AT = hookAt('revenue');
  const POP_AT = hookAt('pop');
  const DIFFERENT_AT = hookAt('different');
  const CLIMAX_AT = beatStart('climax'); // monitor frames
  const BIASED_AT = beatStart('biased');

  const UP_INK = '#2fc4b2';
  // One caption at a time, each until the next starts; the parts are [words, ink].
  const HOOK_CAPTIONS = [
    { start: 0, title: [["4 AIs on Anthropic's IPO."]] },
    { start: CLAUDE_AT, title: [['One of them is '], ['Claude', MODEL_COLORS.Claude], ['.']] },
    { start: FACTS_AT, title: [['Anthropic filed for an IPO.']] },
    { start: REVENUE_AT, title: [['Q3 revenue: about $17B.']] },
    { start: POP_AT, title: [['Most IPOs pop.']] },
    { start: DIFFERENT_AT, title: [['Is this one different?']] },
  ];
  const CAPTION_LINE = { x: 320, y: 56, size: 44, min: 34, maxWidth: 600, stroke: 7 };
  const NOTE = { size: 12, maxWidth: 612, fill: '#8193ad', font: "system-ui, 'Segoe UI', sans-serif", hookY: 347, endY: 340 };
  const DRIFT = 1.04; // the slow push from "different?" to the calls
  const SETTLE = 12; // frames for the drift to ease back to the whole frame
  const HOOK_SLOT = { x: 500, scale: 0.85, floor: 328 };
  // His finger follows what each caption is about, screen px; out of reach, the arm points straight at it.
  const POINTS = [
    { at: 0, target: [330, 196] },
    { at: CLAUDE_AT, target: [212, 194] },
    { at: FACTS_AT, target: [300, 180] },
    { at: REVENUE_AT, target: [300, 270] },
    { at: POP_AT, target: [300, 200] },
  ];
  const POINT = { raiseAt: 2, raise: 6, move: 6 };
  const NOD = { head: 1.5 };
  const LOOK = { eyes: 2.5, ramp: 4, hold: 16 }; // a glance at the screen as each caption lands
  const BROWS = { rest: 1, lift: 2.5, ramp: 4 };
  const GRAB = { frames: 30, reach: 6, shake: 5, shakeFrames: 10, left: [56, 52], right: [104, 52] }; // hands on his head
  const WAVE = { reach: 6, hand: [138, 88], wobble: 12, wobbleFrames: 7 }; // waves it off
  // The four models in a row, Claude's grown and ringed from its caption on, the others dimmed.
  const LOGO_ROW = { x: 40, step: 128, y: 150, size: 88, nameY: 266, nameSize: 22, nameGap: 8, right: 530, popAt: 2, popStep: 6, claudeScale: 1.15, dim: 0.35, ringPad: 6, ringRx: 14, ringWidth: 3 };
  const SCREEN_ROOM = { right: 530, top: 108, bottom: 328 }; // left of him and below the caption shade
  const TILE_PAD = 12;
  // When each tile of the hook's screen shows, by caption.
  const TILES = [
    { id: 'ipo-tile', from: FACTS_AT, to: POP_AT },
    { id: 'pop-tile', from: POP_AT, to: Infinity },
  ];
  const DOTS = { of: 10, above: 7, columns: 5, r: 10, step: 30, gap: 32, rows: [178, 208], right: 508, step_frames: 2, grow: 4, on: UP_INK, off: '#2b4365' };
  const SLIDE = { frames: 6, px: 60 };
  const SHAKE = { frames: 6, px: 3 };
  const BUMP = { zoom: 0.02, frames: 8 };
  const TITLE_IN = { start: 16, frames: 6 }; // after the hook is gone
  const IPO_CARD = { x: [16, 326], y: [82, 204], width: 298, height: 114, rx: 8, bar: 5, barInset: 8, logo: [14, 12], logoScale: 1.5, nameX: 56, rowY: 37, edge: 14, callGap: 8 };
  const IPO_REASON = { sizes: [19, 18, 17, 16], inset: 16, room: 32, lines: 3, first: 63, step: 21 };
  const CLAUDE_RING = { pad: 3, rx: 11, stroke: MODEL_COLORS.Claude, width: 2 }; // ties Claude's card to the disclosure
  // Claude's own words, marked line by line on its card while "Biased?" is up; `at` counts from "Biased?".
  const CLAUDE_MARK = { words: 'mega IPOs usually pop', at: 30, sweep: 8, opacity: 0.5, rx: 3 };
  const TALLY_STYLE = "font: 900 44px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 6px; stroke-linejoin: round";
  const CLIMAX = { scrim: 0.85, fade: 4, leadY: [252, 306], size: 50, min: 40, stroke: 6, biasedY: 296, biasedSize: 84, biasedMin: 60, biasedStroke: 8, disclose: 18 };
  const LEAD_BAND = { gap: 4, fill: '#0a1526', opacity: 0.7 }; // over the scrim under the lead, so the reasons there all but vanish
  const DISCLOSURE_FIT = { pad: 12, head: 20, line: 16 }; // the smallest each line may shrink to, px
  const END_LEAD = { size: 22, y: 220, fill: '#eef2f6', maxWidth: 424 };
  const END_LEDGER_Y = 246;
  const END_DRAW = 8;
  const END_NOD = { depth: 4, ramp: 6 };
  const ASK_POINT = [196, 130]; // the left end of the question, where his finger aims
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
  const toLocal = ([x, y], left, top, scale) => [(x - left) / scale, (y - top) / scale];
  const screenNote = () => $('s3', 'root').querySelector(':scope > text.t-muted');
  const boxCentre = (node) => {
    const box = node.getBBox();
    return [box.x + box.width / 2, box.y + box.height / 2];
  };
  // 1 from `from` to `to`, easing in and out over `ramp` frames.
  const during = (h, from, to, ramp) => ease(progress(h, from, ramp)) * (1 - ease(progress(h, to - ramp, ramp)));

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

  // Shrinks a line until it ends by `right`, never under min px.
  function fitRight(text, right, min) {
    const size = parseFloat(getComputedStyle(text).fontSize);
    const box = text.getBBox();
    const fitted = size * Math.min(1, (right - box.x) / box.width);
    if (fitted < min) throw new Error(`"${text.textContent}" needs ${fitted.toFixed(1)} px to end by x ${right}, under the ${min} px floor`);
    text.style.fontSize = `${fitted}px`;
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

  // The follow line is the one to read on the end card, so it grows; the ledger line moves under it.
  function restyleEnd() {
    const lead = $('s4', 'lead');
    if (!lead.textContent.trim()) throw new Error('anthropic-ipo.json: end.lead, the follow line, is empty');
    lead.setAttribute('y', END_LEAD.y);
    Object.assign(lead.style, { fill: END_LEAD.fill, fontWeight: 700, fontSize: `${END_LEAD.size}px` });
    const width = lead.getComputedTextLength();
    if (width > END_LEAD.maxWidth) lead.style.fontSize = `${(END_LEAD.size * END_LEAD.maxWidth) / width}px`;
    $('s4', 'ledger').setAttribute('y', END_LEDGER_Y);
  }

  // The captions, 1.5 times the weekly size. No coin in this episode.
  function planIpoHook() {
    $('s0', 'coin').style.display = 'none';
    const layer = $('s0', 'beats');
    const captions = HOOK_CAPTIONS.map(({ start, title }, i) => {
      const node = layer.appendChild(svgEl('g'));
      bigLine(node, title, CAPTION_LINE, { class: 'hook-title' });
      return { node, start, end: HOOK_CAPTIONS[i + 1]?.start ?? CALLS_AT };
    });
    const text = screenNote().textContent;
    const size = addNote('s0', NOTE.hookY, text);
    addNote('s4', NOTE.endY, text);
    screenNote().style.fontSize = `${size}px`;
    restyleEnd();
    return { captions };
  }

  // A caption pops in on its beat and is gone by the next one; the first is up from frame 0.
  function showBeat({ node, start, end }, h) {
    const landed = start > 0 ? ease(progress(h, start, BEAT_IN)) : 1;
    popIn(node, landed, [CAPTION_LINE.x, CAPTION_LINE.y - 15]);
    node.style.opacity = landed * (1 - progress(h, end - BEAT_OUT, BEAT_OUT));
  }

  // Where his finger aims at hook frame h: each caption's target, eased in from the one before.
  function pointTarget(h) {
    const i = POINTS.findLastIndex(({ at }) => at <= h);
    const from = POINTS[Math.max(0, i - 1)].target;
    return mix(from, POINTS[i].target, ease(progress(h, POINTS[i].at, POINT.move)));
  }

  const hookY = (parts) => standOn(HOOK_SLOT.floor + SOLE_DROP, HOOK_SLOT.scale, parts, 'front');
  const hookPoint = ([x, y], top) => [HOOK_SLOT.x + HOOK_SLOT.scale * x, top + HOOK_SLOT.scale * y];

  // He points at the screen and nods on the beat; at "different?" he grabs his head, shaking it, then
  // waves it all off.
  function hookParts(h) {
    const top = hookY(Rig.STANDING);
    const point = LEFT_ARM.reach(toLocal(pointTarget(h), HOOK_SLOT.x, top, HOOK_SLOT.scale));
    const raised = ease(progress(h, POINT.raiseAt, POINT.raise));
    const grab = { ...LEFT_ARM.reach(GRAB.left), ...reachRight(GRAB.right) };
    const grabbed = ease(progress(h, DIFFERENT_AT, GRAB.reach));
    const waved = ease(progress(h, DIFFERENT_AT + GRAB.frames, WAVE.reach));
    const arms = blend(blend(blend({}, point, raised), grab, grabbed), reachRight(WAVE.hand), waved);
    const shake = GRAB.shake * Math.sin((2 * Math.PI * h) / GRAB.shakeFrames) * grabbed * (1 - waved);
    const wobble = WAVE.wobble * Math.sin((2 * Math.PI * h) / WAVE.wobbleFrames) * waved;
    const nod = NOD.head * Math.sin((Math.PI * h) / BEAT) * (1 - grabbed);
    return { ...Rig.STANDING, ...arms, head: shake + nod, 'arm-right-forearm': (arms['arm-right-forearm'] ?? 0) + wobble };
  }

  // His eyes go to the screen as each caption lands, then back to the viewer.
  function hookEyes(h) {
    const glance = Math.max(0, ...HOOK_CAPTIONS.filter(({ start }) => start > 0).map(({ start }) => during(h, start, start + LOOK.hold, LOOK.ramp)));
    return [-LOOK.eyes * glance, 0];
  }

  // His brows go up for Claude and for "different?".
  const hookBrows = (h) =>
    BROWS.rest + BROWS.lift * Math.max(during(h, CLAUDE_AT, FACTS_AT, BROWS.ramp), during(h, DIFFERENT_AT, CALLS_AT, BROWS.ramp));

  // He is on from the first frame and out on the beat the calls start.
  function renderHookFigure(h) {
    const parts = hookParts(h);
    $('s0', 'place').style.opacity = h < CALLS_AT ? 1 : 0;
    poseFigure('s0', {
      x: HOOK_SLOT.x,
      y: hookY(parts),
      scale: HOOK_SLOT.scale,
      parts,
      eyes: hookEyes(h),
      blink: blinkAt(h, 20),
      browLift: hookBrows(h),
      chalk: false,
    });
  }

  function renderIpoHook({ captions }, h) {
    captions.forEach((caption) => showBeat(caption, h));
    renderHookFigure(h);
  }

  // The logos pop in one by one; from Claude's caption its logo grows and is ringed and the others dim.
  function renderLogos(logos, f) {
    const gone = 1 - progress(f, FACTS_AT - BEAT_OUT, BEAT_OUT);
    const singled = ease(progress(f, CLAUDE_AT, BEAT_IN));
    logos.forEach(({ node, ring, model, at, centre: [x, y] }, i) => {
      const landed = ease(progress(f, at, BEAT_IN));
      const isClaude = model === 'Claude';
      const scale = (1 + BEAT_POP * (1 - landed)) * (isClaude ? lerp(1, LOGO_ROW.claudeScale, singled) : 1);
      node.setAttribute('transform', `translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`);
      node.style.opacity = landed * gone * (isClaude ? 1 : lerp(1, LOGO_ROW.dim, singled));
      if (ring) ring.style.opacity = singled;
    });
  }

  // A tile pops in with its caption and fades as the next tile's caption lands.
  function showTile({ node, from, to, centre }, f) {
    const landed = ease(progress(f, from, BEAT_IN));
    popIn(node, landed, centre);
    node.style.opacity = landed * (1 - progress(f, to - BEAT_OUT, BEAT_OUT));
  }

  // The revenue pops in with its caption as the filing tile grows to hold it; the tile fades it out.
  function renderRevenue({ part, box, heights, centre }, f) {
    const landed = ease(progress(f, REVENUE_AT, BEAT_IN));
    box.setAttribute('height', lerp(heights[0], heights[1], landed));
    popIn(part, landed, centre);
  }

  // Seven of ten dots light up, one after another, after "≈7 in 10" lands.
  function renderDots(dots, f) {
    dots.forEach((dot, i) => dot.setAttribute('r', DOTS.r * ease(progress(f, POP_AT + BEAT_IN + i * DOTS.step_frames, DOTS.grow))));
  }

  // The hook's screen: the models, the filing with its one figure, the base rate, one at a time, and
  // the camera drifts in from "different?" to where the monitor starts. The header, the cards and
  // the climax wait for the monitor.
  function renderIpoHookScreen(plan, f) {
    for (const node of [$('s3', 'title'), plan.top, plan.note]) node.style.opacity = 0;
    plan.ideas.forEach(({ card }) => (card.style.opacity = 0));
    renderClimax(plan.climax, -1);
    renderLogos(plan.logos, f);
    plan.tiles.forEach((tile) => showTile(tile, f));
    renderRevenue(plan.revenue, f);
    renderDots(plan.dots, f);
    setViewBox('s3', zoomBox(FULL_VIEW, around(CENTRE, DRIFT), ease(progress(f, DIFFERENT_AT, CALLS_AT - DIFFERENT_AT))));
  }

  // ---------------------------------------------------------------- hook's screen

  // Each model's logo 88 px wide with its name under it, in the file's order.
  function drawLogos(ideas) {
    const layer = $('s3', 'logos');
    const tile = LOGO_ROW.size / CARD_LOGO.tile;
    const logos = ideas.map(({ model, name: title }, i) => {
      const x = LOGO_ROW.x + i * LOGO_ROW.step;
      const node = layer.appendChild(svgEl('g'));
      const mark = node.appendChild(svgEl('g', { transform: `translate(${x} ${LOGO_ROW.y}) scale(${tile})` }));
      mark.appendChild(modelLogo(model, [0, 0]));
      mark.querySelector('.card-logo').style.vectorEffect = 'non-scaling-stroke';
      const name = node.appendChild(textEl(title ?? model, { class: 'card-name', x: x + LOGO_ROW.size / 2, y: LOGO_ROW.nameY, 'text-anchor': 'middle', style: `font-size: ${LOGO_ROW.nameSize}px` }));
      const width = name.getComputedTextLength();
      if (width > LOGO_ROW.step - LOGO_ROW.nameGap) throw new Error(`logos: ${model}'s name is ${width.toFixed(0)} px, the row fits ${LOGO_ROW.step - LOGO_ROW.nameGap}`);
      const ring = model === 'Claude'
        ? node.appendChild(svgEl('rect', {
          x: x - LOGO_ROW.ringPad,
          y: LOGO_ROW.y - LOGO_ROW.ringPad,
          width: LOGO_ROW.size + 2 * LOGO_ROW.ringPad,
          height: LOGO_ROW.size + 2 * LOGO_ROW.ringPad,
          rx: LOGO_ROW.ringRx,
          fill: 'none',
          stroke: MODEL_COLORS.Claude,
          'stroke-width': LOGO_ROW.ringWidth,
        }))
        : null;
      return { node, ring, model, at: LOGO_ROW.popAt + i * LOGO_ROW.popStep, centre: [x + LOGO_ROW.size / 2, LOGO_ROW.y + LOGO_ROW.size / 2] };
    });
    const right = layer.getBBox().x + layer.getBBox().width;
    if (right > LOGO_ROW.right) throw new Error(`logos: the row runs to x ${right.toFixed(0)}, he stands from ${LOGO_ROW.right}`);
    return logos;
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

  // Ten dots after "≈7 in 10", seven lit.
  function drawDots() {
    const big = $('s3', 'pop-big').getBBox();
    const left = big.x + big.width + DOTS.gap;
    const right = left + (DOTS.columns - 1) * DOTS.step + DOTS.r;
    if (right > DOTS.right) throw new Error(`pop: the dots run to x ${right.toFixed(0)}, past ${DOTS.right}`);
    const layer = $('s3', 'pop-dots');
    return Array.from({ length: DOTS.of }, (_, i) => layer.appendChild(svgEl('circle', {
      cx: left + (i % DOTS.columns) * DOTS.step,
      cy: DOTS.rows[Math.floor(i / DOTS.columns)],
      r: 0,
      fill: i < DOTS.above ? DOTS.on : DOTS.off,
    })));
  }

  // The filing tile's lower half, the revenue: the tile's box runs down to its rule until the revenue
  // caption, then grows to hold it.
  function planRevenue() {
    const part = $('s3', 'ipo-revenue');
    const box = $('s3', 'ipo-tile').querySelector(':scope > rect');
    const top = Number(box.getAttribute('y'));
    const heights = [Number(part.querySelector('line').getAttribute('y1')) - top, Number(box.getAttribute('height'))];
    return { part, box, heights, centre: boxCentre(part) };
  }

  function planTiles() {
    const dots = drawDots();
    const tiles = TILES.map(({ id, from, to }) => {
      const node = $('s3', id);
      checkTile(node);
      return { node, from, to, centre: boxCentre(node) };
    });
    return { tiles, dots, revenue: planRevenue() };
  }

  // ---------------------------------------------------------------- calls

  // checkMonitorData's checks on the ideas, without its ten-word cap: the reasons are the models' own words
  // and two run to eleven; ipoReasonSize still throws if one does not fit its card.
  function checkIpoIdeas() {
    const { ideas } = IDEAS;
    if (!Array.isArray(ideas) || !ideas.length || ideas.length > 4) throw new Error('ideas: the cards fit 1 to 4 models');
    if (new Set(ideas.map((idea) => idea.model)).size !== ideas.length) throw new Error('ideas: one idea per model');
    for (const { model, name, call, confidence, reason } of ideas) {
      if (!Object.hasOwn(MODEL_COLORS, model)) throw new Error(`ideas: unknown model ${model}`);
      if (!Object.hasOwn(LOGOS, model.toLowerCase())) throw new Error(`ideas: no logo for ${model}`);
      if (name !== undefined && (typeof name !== 'string' || !name.trim())) throw new Error(`ideas: ${model} name must be a non-empty line`);
      if (!Object.hasOwn(CALL_LABELS, call)) throw new Error(`ideas: ${model} call must be up or down, got ${call}`);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) throw new Error(`ideas: ${model} confidence must be a number from 0 to 100`);
      if (typeof reason !== 'string' || !reason.trim()) throw new Error(`ideas: ${model} has no reason`);
    }
    if (!ideas.some((idea) => idea.model === 'Claude')) throw new Error('ideas: the episode is about Claude, and it has no call');
  }

  // The one reason size for all four cards, the largest at which every reason fits its lines.
  function ipoReasonSize(ideas, parent) {
    const probe = parent.appendChild(svgEl('text', { class: 'card-reason' }));
    const fits = (size) => ideas.every(({ reason }) => {
      probe.style.fontSize = `${size}px`;
      return wrapLines(probe, reason, IPO_CARD.width - IPO_REASON.room).length <= IPO_REASON.lines;
    });
    const size = IPO_REASON.sizes.find(fits);
    probe.remove();
    if (size === undefined) throw new Error(`ideas: a reason is too long for its card even at ${IPO_REASON.sizes.at(-1)} px`);
    return size;
  }

  // One card of the two by two: logo, name, call and confidence on top, the reason word for word under them.
  function drawIpoCard({ model, name: title, call, confidence, reason }, i, parent, size) {
    const { width, height } = IPO_CARD;
    const x = IPO_CARD.x[i % 2];
    const y = IPO_CARD.y[Math.floor(i / 2)];
    const card = parent.appendChild(svgEl('g'));
    const name = textEl(title ?? model, { class: 'card-name', x: x + IPO_CARD.nameX, y: y + IPO_CARD.rowY });
    const conf = textEl(`${confidence}%`, { class: 'card-conf num', x: x + width - IPO_CARD.edge, y: y + IPO_CARD.rowY, 'text-anchor': 'end' });
    const logo = svgEl('g', { transform: `translate(${x + IPO_CARD.logo[0]} ${y + IPO_CARD.logo[1]}) scale(${IPO_CARD.logoScale})` });
    logo.appendChild(modelLogo(model, [0, 0]));
    card.append(
      svgEl('rect', { class: 'card', x, y, width, height, rx: IPO_CARD.rx }),
      svgEl('rect', { x, y: y + IPO_CARD.barInset, width: IPO_CARD.bar, height: height - 2 * IPO_CARD.barInset, rx: IPO_CARD.bar / 2, fill: MODEL_COLORS[model] }),
      logo,
      name,
      conf,
    );
    const label = card.appendChild(textEl(CALL_LABELS[call], { class: `card-call card-${call}`, x: conf.getBBox().x - IPO_CARD.callGap, y: y + IPO_CARD.rowY, 'text-anchor': 'end' }));
    const gap = label.getBBox().x - (x + IPO_CARD.nameX + name.getComputedTextLength());
    if (gap < CARD_LABEL_GAP) throw new Error(`ideas: ${model} and its call are ${gap.toFixed(1)} px apart, the card needs ${CARD_LABEL_GAP}`);
    const text = card.appendChild(svgEl('text', { class: 'card-reason', style: `font-size: ${size}px` }));
    const lines = wrapLines(text, reason, width - IPO_REASON.room);
    text.textContent = '';
    const first = y + IPO_REASON.first + ((IPO_REASON.lines - lines.length) * IPO_REASON.step) / 2;
    text.append(...lines.map((line, n) => textEl(line, { x: x + IPO_REASON.inset, y: first + n * IPO_REASON.step }, 'tspan')));
    if (model === 'Claude') {
      card.appendChild(svgEl('rect', {
        x: x - CLAUDE_RING.pad,
        y: y - CLAUDE_RING.pad,
        width: width + 2 * CLAUDE_RING.pad,
        height: height + 2 * CLAUDE_RING.pad,
        rx: CLAUDE_RING.rx,
        fill: 'none',
        stroke: CLAUDE_RING.stroke,
        'stroke-width': CLAUDE_RING.width,
      }));
    }
    return { model, card, gap };
  }

  // A rect behind each line Claude's words run on, so the words stay the model's own; the rects start
  // with no width and renderClimax sweeps them open.
  function drawMark(card) {
    const text = card.querySelector('.card-reason');
    const lines = [...text.querySelectorAll('tspan')];
    const start = lines.map((line) => line.textContent).join(' ').indexOf(CLAUDE_MARK.words);
    if (start < 0) throw new Error(`ideas: Claude's reason no longer says "${CLAUDE_MARK.words}"`);
    const end = start + CLAUDE_MARK.words.length;
    let offset = 0; // where each line starts in the reason
    return lines.flatMap((line) => {
      const length = line.textContent.length;
      const [from, to] = [Math.max(start, offset) - offset, Math.min(end, offset + length) - offset];
      offset += length + 1;
      if (to <= from) return [];
      const first = line.getExtentOfChar(from);
      const last = line.getExtentOfChar(to - 1);
      const height = Math.min(first.height, IPO_REASON.step - 2);
      const rect = card.insertBefore(svgEl('rect', {
        x: first.x,
        y: first.y + (first.height - height) / 2,
        width: 0,
        height,
        rx: CLAUDE_MARK.rx,
        fill: MODEL_COLORS.Claude,
        'fill-opacity': CLAUDE_MARK.opacity,
      }), text);
      return [{ rect, width: last.x + last.width - first.x }];
    });
  }

  // A dark band the frame's width under the lead, from just below Claude's card to the disclaimer's rule,
  // so the Gemini and Grok Bot reasons under the lead all but vanish. It fades with the lead but never pops.
  function drawLeadBand(parent, lead, claude) {
    const card = claude.getBBox();
    const top = card.y + card.height + LEAD_BAND.gap;
    const lines = lead.getBBox(); // its top is the font's ascent, above the capitals, so only its bottom is checked
    if (lines.y + lines.height > SCREEN_ROOM.bottom) throw new Error(`climax: the lead runs to y ${(lines.y + lines.height).toFixed(0)}, past its band's end at ${SCREEN_ROOM.bottom}`);
    return parent.insertBefore(svgEl('rect', {
      x: 0,
      y: top,
      width: 640,
      height: SCREEN_ROOM.bottom - top,
      fill: LEAD_BAND.fill,
      'fill-opacity': LEAD_BAND.opacity,
    }), lead);
  }

  // The climax: a scrim over everything but Claude's card, the lead line, then "Biased?", the disclosure
  // and the mark on Claude's words. The disclaimer stays on top.
  function drawClimax(cards) {
    const claude = cards.find(({ model }) => model === 'Claude').card;
    const layer = $('s3', 'cards');
    layer.appendChild(claude);
    const scrim = layer.insertBefore(svgEl('rect', { width: 640, height: 360, fill: '#0a1526' }), claude);
    const g = $('s3', 'root').insertBefore(svgEl('g'), screenNote());
    const lead = g.appendChild(svgEl('g'));
    const leadLine = { x: 320, size: CLIMAX.size, min: CLIMAX.min, maxWidth: CAPTION_LINE.maxWidth, stroke: CLIMAX.stroke };
    const style = { style: TALLY_STYLE, fill: '#eef2f6' };
    bigLine(lead, [['All four say '], ['up', UP_INK], [',']], { ...leadLine, y: CLIMAX.leadY[0] }, style);
    bigLine(lead, [['including '], ['Claude', MODEL_COLORS.Claude], ['.']], { ...leadLine, y: CLIMAX.leadY[1] }, style);
    const band = drawLeadBand(g, lead, claude);
    const biased = g.appendChild(svgEl('g'));
    bigLine(biased, [['Biased?']], { x: 320, y: CLIMAX.biasedY, size: CLIMAX.biasedSize, min: CLIMAX.biasedMin, maxWidth: CAPTION_LINE.maxWidth, stroke: CLIMAX.biasedStroke }, style);
    const disclosure = $('s3', 'disclosure');
    const box = disclosure.querySelector('rect.disclosure');
    const right = Number(box.getAttribute('x')) + Number(box.getAttribute('width')) - DISCLOSURE_FIT.pad;
    fitRight(disclosure.querySelector('.disclosure-head'), right, DISCLOSURE_FIT.head);
    fitRight(disclosure.querySelector('.tile-line'), right, DISCLOSURE_FIT.line);
    return { scrim, band, lead, leadAt: boxCentre(lead), biased, biasedAt: boxCentre(biased), disclosure, disclosureAt: boxCentre(disclosure), marks: drawMark(claude) };
  }

  function planIpoMonitor() {
    checkIpoIdeas();
    const parent = $('s3', 'cards');
    const size = ipoReasonSize(IDEAS.ideas, parent);
    const cards = IDEAS.ideas.map((idea, i) => drawIpoCard(idea, i, parent, size));
    return {
      logos: drawLogos(IDEAS.ideas),
      ...planTiles(),
      top: $('s3', 'top'),
      ideas: cards,
      cardGap: Math.min(...cards.map(({ gap }) => gap)),
      note: screenNote(),
      climax: drawClimax(cards),
    };
  }

  // The camera bumps in a little on each of these monitor frames and eases back.
  const bumpAt = (k, starts) =>
    Math.max(0, ...starts.map((start) => {
      const t = k - start;
      return t >= 0 ? BUMP.zoom * (1 - progress(t, 0, BUMP.frames)) : 0;
    }));

  // One call: its card slides in from the right with a small shake, its confidence final from the start.
  function landCall(idea, k) {
    const slid = ease(progress(k, 0, SLIDE.frames));
    const settling = progress(k, SLIDE.frames, SHAKE.frames);
    const shake = settling > 0 && settling < 1 ? (noise(k, 1) - 0.5) * 2 * SHAKE.px * (1 - settling) : 0;
    idea.card.style.opacity = slid;
    idea.card.setAttribute('transform', `translate(${(1 - slid) * SLIDE.px + shake} 0)`);
  }

  // "All four say up, including Claude." over the scrim, then "Biased?" in its place, the disclosure and
  // Claude's words marked one line after another.
  function renderClimax(climax, k) {
    climax.marks.forEach(({ rect, width }, i) => rect.setAttribute('width', width * ease(progress(k, BIASED_AT + CLAUDE_MARK.at + i * CLAUDE_MARK.sweep, CLAUDE_MARK.sweep))));
    climax.scrim.style.opacity = CLIMAX.scrim * ease(progress(k, CLIMAX_AT, CLIMAX.fade));
    const led = ease(progress(k, CLIMAX_AT, BEAT_IN));
    popIn(climax.lead, led, climax.leadAt);
    climax.lead.style.opacity = led * (1 - progress(k, BIASED_AT - BEAT_OUT, BEAT_OUT));
    climax.band.style.opacity = climax.lead.style.opacity;
    popIn(climax.biased, ease(progress(k, BIASED_AT, BEAT_IN)), climax.biasedAt);
    const disclosed = ease(progress(k, BIASED_AT + CLIMAX.disclose, BEAT_IN));
    popIn(climax.disclosure, disclosed, climax.disclosureAt);
    climax.disclosure.style.opacity = disclosed > 0 ? 1 : 0; // opaque from its first frame: ChatGPT's card under it never shows through
  }

  // The disclaimer is pinned to the frame while the camera moves.
  function renderIpoMonitor(plan, k) {
    const bumps = [...plan.ideas.map((_, i) => i * CALL_STEP), CLIMAX_AT, BIASED_AT];
    const zoom = DRIFT - (DRIFT - 1) * ease(progress(k, 0, SETTLE)) + bumpAt(k, bumps);
    const view = around(CENTRE, zoom);
    setViewBox('s3', view);
    plan.note.style.opacity = 1;
    plan.note.setAttribute('transform', `translate(${view[0]} ${view[1]}) scale(${view[2] / 640})`);
    plan.logos.forEach(({ node }) => (node.style.opacity = 0));
    plan.tiles.forEach(({ node }) => (node.style.opacity = 0));
    const titled = progress(k, TITLE_IN.start, TITLE_IN.frames);
    $('s3', 'title').style.opacity = titled;
    plan.top.style.opacity = titled;
    plan.ideas.forEach((idea, i) => landCall(idea, k - i * CALL_STEP));
    renderClimax(plan.climax, k);
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
    for (const id of ['place', 'text', 'kicker', 'cta', 'ask', 'reply', 'lead', 'ledger']) $('s4', id).style.opacity = 1;
    for (const id of ['cta', 'ask', 'reply', 'lead', 'ledger']) $('s4', id).removeAttribute('transform');
    bounceArrow(k);
  }

  // The frames score.py clicks on: each logo popping in, each caption's screen changing, each card landing.
  function ipoClicks({ monitorStart }) {
    return {
      lines: [...IDEAS.ideas.map((_, i) => LOGO_ROW.popAt + i * LOGO_ROW.popStep), CLAUDE_AT, FACTS_AT, REVENUE_AT, POP_AT],
      cards: IDEAS.ideas.map((_, i) => monitorStart + i * CALL_STEP),
    };
  }

  window.STORY = {
    ...window.STORY,
    hookFrames: STORY.hookFrames,
    monitorFrames: STORY.monitorFrames,
    planHook: planIpoHook,
    renderHook: renderIpoHook,
    renderHookScreen: renderIpoHookScreen,
    planMonitor: planIpoMonitor,
    renderMonitor: renderIpoMonitor,
    renderEnd: renderCallEnd,
    endCut: true, // the disclosure cuts to the end card on the beat instead of dissolving under it
    clicks: ipoClicks,
  };
})();
