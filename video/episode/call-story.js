/*
 * The weekly call episode (assets/data/call.json): a cold open over the chart with the professor, the calls
 * landing one every two beats on the full-screen chart, the tally against the coin, then the end card with
 * him pointing at the question. He speaks his own captions (the story's "voice" cues), so there is no subtitle
 * layer and one text on screen at a time. Loads after episode.js and uses its helpers; an IIFE, because
 * classic scripts share one global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);

  const BEAT = 1800 / STORY.music.bpm; // frames per beat at 30 fps
  const PROF_AT = 2 * BEAT; // the cut to the professor and the second caption
  const COIN_AT = Math.round(5 * BEAT); // three beats for the shrug: his "No idea. Let me ask the AIs." runs ~2.1 s
  const CALLS_AT = STORY.hookFrames - HOOK_DISSOLVE; // the monitor starts; every caption is gone by then
  const CALL_STEP = 2 * BEAT; // one call every two beats, 1.5 s at 80 bpm
  const CLIMAX_AT = 8 * BEAT; // monitor frames
  const CENTRE = [320, 180];

  const CAPTIONS = {
    question: { title: [['Where is BTC going this week?']] },
    shrug: { title: [['No idea. Let me ask the AIs.']] },
    bar: { title: [['Can they beat a coin flip?']] },
  };
  const NOTE = { size: 12, maxWidth: 612, fill: '#8193ad', font: "system-ui, 'Segoe UI', sans-serif", hookY: 347, endY: 340 };
  const PUSH = { frames: 30, zoom: 1.5 }; // the fast push-in onto the last candle
  const JERK = { start: 6, frames: 8, px: 5 }; // the last candle kicks as the push lands
  const UNDER_CAPTION = { top: 50, fade: 16 }; // screen y where a scale label slides under the caption
  const OVER_NOTE = { bottom: 330, fade: 8 }; // and where a date slides into the disclaimer's band
  const DRIFT = 1.04; // the slow push from the cut to the calls
  const SETTLE = 12; // frames for the drift to ease back to the whole frame
  const FLICKER = { frames: 30, swap: 11, opacity: 0.12, colors: ['#26a69a', '#ef5350'] }; // under 3 swaps a second
  const HOOK_SLOT = { x: 440, scale: 0.85, floor: 328 };
  const GRAB = { frames: 30, reach: 6, shake: 5, shakeFrames: 10, left: [56, 52], right: [104, 52] }; // hands on his head
  const WAVE = { reach: 6, hand: [138, 88], wobble: 12, wobbleFrames: 7 }; // waves it off
  // The waving hand drops to his side with the coin on its thumb, flicks it up and catches it; local px,
  // frames from the coin's caption, degrees and screen px.
  const FLICK = { hand: [128, 128], raise: 6, at: 9, snap: -16, snapFrames: 5, flight: 26, rise: 92, turns: 2, dip: 8, dipFrames: 6 };
  const HAND_COIN = { scale: 0.45, perch: 9 }; // the coin smaller in his hand, resting just above it
  const LOOK = { eyes: 2.5, centre: [80, 60.8], in: 4, back: 2, head: 5 }; // he follows the coin, then looks back at the viewer
  const IDLE_HEAD = -6;
  const CALL_FAN = 44; // px between tips with the same call, less if the plot edge is nearer; the angle is not a size of move
  const TIP_EDGE = 6; // px the lowest or highest tip keeps off the plot's edge
  const ARROW_DRAW = 9; // 0.3 s
  const SLIDE = { frames: 6, px: 60 };
  const SHAKE = { frames: 6, px: 3 };
  const COUNT = { from: 50, frames: 12 }; // the confidence counts up from a coin flip
  const BUMP = { zoom: 0.02, frames: 8 };
  const TITLE_IN = { start: 16, frames: 6 }; // after the hook is gone
  const WEEK_IN = 8;
  const WEEK_LIT = { fill: '#132a4d', stroke: '#4a6fa5' };
  const CLIMAX = { scrim: 0.7, fade: 4, y: 214, coinY: 128, coinScale: 1.5, jump: 30, flight: 24, turns: 2 };
  const TALLY_STYLE = "font: 900 44px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 6px; stroke-linejoin: round";
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
    lead.setAttribute('y', END_LEAD.y);
    Object.assign(lead.style, { fill: END_LEAD.fill, fontWeight: 700, fontSize: `${END_LEAD.size}px` });
    const width = lead.getComputedTextLength();
    if (width > END_LEAD.maxWidth) lead.style.fontSize = `${(END_LEAD.size * END_LEAD.maxWidth) / width}px`;
    $('s4', 'ledger').setAttribute('y', END_LEDGER_Y);
  }

  // Three captions, one per two beats. The coin is in his hand, so it moves in front of him.
  function planCallHook() {
    const beats = $('s0', 'beats');
    const question = drawCaption(CAPTIONS.question, CAPTION.x, beats);
    const shrug = drawCaption(CAPTIONS.shrug, CAPTION.x, beats);
    const bar = drawCaption(CAPTIONS.bar, CAPTION.x, beats);
    $('s0', 'root').appendChild($('s0', 'coin'));
    const text = screenNote().textContent;
    const size = addNote('s0', NOTE.hookY, text);
    addNote('s4', NOTE.endY, text);
    screenNote().style.fontSize = `${size}px`;
    restyleEnd();
    return { beats: [question.group, shrug.group, bar.group] };
  }

  // A caption pops in on its beat and is gone by the next one; returns how much of it shows.
  function showBeat(node, h, start, end) {
    const landed = ease(progress(h, start, BEAT_IN));
    const shown = landed * (1 - progress(h, end - BEAT_OUT, BEAT_OUT));
    popIn(node, landed, [CAPTION.x, CAPTION.y]);
    node.style.opacity = shown;
    return shown;
  }

  // How high the flicked coin is at frame k of its caption, 0 in his hand and 1 at the top.
  const coinUp = (k) => {
    const t = progress(k, FLICK.at, FLICK.flight);
    return 4 * t * (1 - t);
  };

  // He grabs his head as the chart flickers, shaking it, then waves it all off. The hand drops to his side
  // with the coin, the thumb snaps it up, and the hand gives a little as it catches it; his head follows it.
  function hookParts(h) {
    const k = h - COIN_AT;
    const grab = { ...LEFT_ARM.reach(GRAB.left), ...reachRight(GRAB.right) };
    const grabbed = ease(progress(h, PROF_AT, GRAB.reach));
    const waved = ease(progress(h, PROF_AT + GRAB.frames, WAVE.reach));
    const ready = ease(progress(k, 0, FLICK.raise));
    const arms = blend(blend(blend({}, grab, grabbed), reachRight(WAVE.hand), waved), reachRight(FLICK.hand), ready);
    const shake = GRAB.shake * Math.sin((2 * Math.PI * h) / GRAB.shakeFrames) * grabbed * (1 - waved);
    const wobble = WAVE.wobble * Math.sin((2 * Math.PI * h) / WAVE.wobbleFrames) * waved * (1 - ready);
    const snap = FLICK.snap * Math.sin(Math.PI * progress(k, FLICK.at, FLICK.snapFrames));
    const dip = FLICK.dip * Math.sin(Math.PI * progress(k, FLICK.at + FLICK.flight, FLICK.dipFrames));
    const head = shake + lerp(IDLE_HEAD * ready, LOOK.head, coinUp(k));
    return { ...Rig.STANDING, ...arms, head, 'arm-right-forearm': (arms['arm-right-forearm'] ?? 0) + wobble + snap + dip };
  }

  const hookY = (parts) => standOn(HOOK_SLOT.floor + SOLE_DROP, HOOK_SLOT.scale, parts, 'front');
  const hookPoint = ([x, y], top) => [HOOK_SLOT.x + HOOK_SLOT.scale * x, top + HOOK_SLOT.scale * y];

  // Where the coin rests on his thumb at hook frame h.
  function perchAt(h) {
    const parts = hookParts(h);
    const [x, y] = hookPoint(Rig.hand(RIG, parts, 'right'), hookY(parts));
    return [x, y - HAND_COIN.perch];
  }

  // The coin shows with its caption on his thumb, spins up and drops back into his hand on the 50% side.
  function flickCoin(h, shown) {
    const k = h - COIN_AT;
    const t = progress(k, FLICK.at, FLICK.flight);
    const launch = COIN_AT + FLICK.at;
    const [x, base] = t > 0 && t < 1 ? mix(perchAt(launch), perchAt(launch + FLICK.flight), t) : perchAt(h);
    const y = base - FLICK.rise * coinUp(k);
    const facing = Math.cos(2 * Math.PI * FLICK.turns * t);
    const coin = $('s0', 'coin');
    coin.style.opacity = shown;
    coin.setAttribute('transform', `translate(${x} ${y}) scale(${HAND_COIN.scale})`);
    $('s0', 'coin-spin').setAttribute('transform', `scale(${Math.max(Math.abs(facing), COIN_EDGE)} 1)`);
    $('s0', 'coin-face').setAttribute('fill', facing >= 0 ? COIN_FACES.front : COIN_FACES.back);
    $('s0', 'coin-text').style.opacity = facing >= 0 ? 1 : 0;
    return [x, y];
  }

  // Before the coin he looks a little up; then his eyes find it and follow it, and after the catch they
  // come back to the viewer.
  function hookEyes(h, coin, top) {
    if (h < COIN_AT) return [0, -1];
    const k = h - COIN_AT;
    const centre = hookPoint(LOOK.centre, top);
    const d = dist(centre, coin);
    const follow = [((coin[0] - centre[0]) / d) * LOOK.eyes, ((coin[1] - centre[1]) / d) * LOOK.eyes];
    const found = mix([0, -1], follow, ease(progress(k, 0, LOOK.in)));
    return mix(found, [0, 0], ease(progress(k, FLICK.at + FLICK.flight + LOOK.back, LOOK.in)));
  }

  // He cuts in with the second caption and out on the beat the calls start.
  function renderHookFigure(h, coin) {
    const parts = hookParts(h);
    const y = hookY(parts);
    $('s0', 'place').style.opacity = h >= PROF_AT && h < CALLS_AT ? 1 : 0;
    poseFigure('s0', {
      x: HOOK_SLOT.x,
      y,
      scale: HOOK_SLOT.scale,
      parts,
      eyes: hookEyes(h, coin, y),
      blink: blinkAt(h, 20),
      browLift: h < COIN_AT ? 3 : 1 + 2 * coinUp(h - COIN_AT),
      chalk: false,
    });
  }

  function renderCallHook({ beats: [question, shrug, bar] }, h) {
    question.style.opacity = 1 - progress(h, PROF_AT - BEAT_OUT, BEAT_OUT);
    showBeat(shrug, h, PROF_AT, COIN_AT);
    renderHookFigure(h, flickCoin(h, showBeat(bar, h, COIN_AT, CALLS_AT)));
  }

  // The camera pushes onto the last candle; on the cut it pulls back to the whole chart and drifts in to
  // where the monitor starts.
  function hookView(focus, f) {
    if (f < PROF_AT) return zoomBox(FULL_VIEW, around(focus, PUSH.zoom), ease(progress(f, 0, PUSH.frames)));
    return zoomBox(FULL_VIEW, around(CENTRE, DRIFT), ease(progress(f, PROF_AT, CALLS_AT - PROF_AT)));
  }

  // Only the price scale and dates of the chart's labels show in the hook; one the push carries up fades
  // under the caption, and one it carries down fades before the disclaimer, instead of crossing them.
  function showScale(plan, view) {
    plan.frame.querySelectorAll('text, circle').forEach((node) => {
      const y = ((Number(node.getAttribute('y')) - view[1]) * 360) / view[3];
      const room = Math.min((y - UNDER_CAPTION.top) / UNDER_CAPTION.fade, (OVER_NOTE.bottom - y) / OVER_NOTE.fade);
      node.style.opacity = node.classList.contains('scale') ? clamp(room, 0, 1) : 0;
    });
  }

  // The chart is whole from the first frame, so it reads as one in the thumbnail; the header, the week and
  // the calls wait for the monitor.
  function renderCallHookScreen(plan, f) {
    renderChart(plan, Infinity);
    const cut = f >= PROF_AT;
    const view = hookView(plan.focus, f);
    showScale(plan, view);
    plan.lastPrice.style.opacity = 1;
    plan.week.style.opacity = 0;
    $('s3', 'title').style.opacity = 0;
    plan.note.style.opacity = 0;
    plan.ideas.forEach(({ reveal, card }) => {
      reveal.setAttribute('width', 0);
      card.style.opacity = 0;
    });
    renderClimax(plan.climax, -1);
    const t = progress(f, JERK.start, JERK.frames);
    plan.candles.at(-1).setAttribute('transform', `translate(0 ${JERK.px * (1 - t) ** 2 * Math.sin(3 * Math.PI * t)})`);
    const flickering = cut && f < PROF_AT + FLICKER.frames;
    plan.flicker.style.opacity = flickering ? FLICKER.opacity : 0;
    plan.flicker.setAttribute('fill', FLICKER.colors[Math.floor(Math.max(0, f - PROF_AT) / FLICKER.swap) % 2]);
    setViewBox('s3', view);
  }

  // ---------------------------------------------------------------- calls

  // The step between tips with one call: the whole fan fits between the price and the plot's edge,
  // so no arrow lands on another.
  function callFan(from, call) {
    const room = call === 'up' ? from[1] - (PLOT.y + TIP_EDGE) : PLOT.y + PLOT.height - TIP_EDGE - from[1];
    const same = IDEAS.ideas.filter((idea) => idea.call === call).length;
    const fan = Math.min(CALL_FAN, room / same);
    if (fan < ARROW_HEAD) throw new Error(`ideas: ${same} ${call} arrows are ${fan.toFixed(1)} px apart, they need ${ARROW_HEAD}`);
    return fan;
  }

  // drawIdeaArrow's geometry fanned wider and without the name: each call's card lands with its arrow.
  function drawCallArrow(scale, { model, call }, index, rank, parent) {
    const color = MODEL_COLORS[model];
    const from = [scale.x(scale.candles.length - 1), scale.y(scale.candles.at(-1).close)];
    const weekRight = PLOT.x + (scale.weekStart + WEEK_DAYS) * scale.slot;
    const to = [weekRight - 6, from[1] + (call === 'up' ? -1 : 1) * callFan(from, call) * (rank + 1)];
    const base = mix(to, from, ARROW_HEAD / dist(from, to));
    const [nx, ny] = [-Math.sin(angle(from, to)) * (ARROW_HEAD / 2), Math.cos(angle(from, to)) * (ARROW_HEAD / 2)];
    const arrow = parent.appendChild(svgEl('g'));
    arrow.append(
      svgEl('line', { x1: from[0], y1: from[1], x2: base[0], y2: base[1], stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }),
      svgEl('polygon', { points: `${to} ${base[0] + nx},${base[1] + ny} ${base[0] - nx},${base[1] - ny}`, fill: color }),
    );
    return { reveal: clipTo(arrow, `s3-reveal-idea-${index}`, [from[0] - 2, PLOT.y - 10, 0, PLOT.height + 20]), width: to[0] - from[0] + 4 };
  }

  // The tally over a dark scrim with the coin above it, under the disclaimer, which stays on top.
  function drawClimax(ideas) {
    const ups = ideas.filter((idea) => idea.call === 'up').length;
    const g = $('s3', 'root').insertBefore(svgEl('g'), screenNote());
    const scrim = g.appendChild(svgEl('rect', { width: 640, height: 360, fill: '#0a1526' }));
    const tally = g.appendChild(svgEl('text', { x: 320, y: CLIMAX.y, 'text-anchor': 'middle', style: TALLY_STYLE }));
    tally.append(
      textEl(`${ups} UP`, { fill: '#2fc4b2' }, 'tspan'),
      textEl(' · ', { fill: '#eef2f6' }, 'tspan'),
      textEl(`${ideas.length - ups} DOWN`, { fill: '#ff6b66' }, 'tspan'),
    );
    const coin = g.appendChild(svgEl('g'));
    const spin = coin.appendChild(svgEl('g'));
    const face = svgEl('circle', { r: COIN_R, fill: COIN_FACES.front, stroke: '#a87412', 'stroke-width': 3 });
    const label = textEl('50%', { y: 5, 'text-anchor': 'middle', fill: '#3a2600', style: "font: 800 14px 'Segoe UI', system-ui, sans-serif" });
    spin.append(face, svgEl('circle', { r: 18.5, fill: 'none', stroke: '#c99428', 'stroke-width': 1.4 }), label);
    return { scrim, tally, coin, spin, face, label };
  }

  function planCallMonitor() {
    checkMonitorData();
    const scale = chartScale();
    writeCallWeek(scale);
    const chart = $('s3', 'chart');
    const rankOf = (i) => IDEAS.ideas.slice(0, i).filter((idea) => idea.call === IDEAS.ideas[i].call).length;
    const cards = drawIdeaCards(IDEAS.ideas, $('s3', 'cards'));
    const frame = drawChartFrame(scale, chart);
    const candles = drawCandles(scale, chart);
    const lastPrice = drawLastPrice(scale, chart);
    const flicker = chart.appendChild(svgEl('rect', { x: PLOT.x, y: PLOT.y, width: PANE_RIGHT - PLOT.x, height: PLOT.height }));
    const week = drawWeek(scale, $('s3', 'week'));
    Object.assign(week.querySelector('rect.week').style, WEEK_LIT);
    const last = scale.candles.length - 1;
    return {
      frame,
      candles,
      lastPrice,
      flicker,
      week,
      focus: [scale.x(last), scale.y(scale.candles[last].close)],
      ideas: IDEAS.ideas.map((idea, i) => ({
        ...drawCallArrow(scale, idea, i, rankOf(i), $('s3', 'ideas')),
        card: cards[i].card,
        conf: cards[i].card.querySelector('.card-conf'),
        confidence: idea.confidence,
      })),
      cardGap: Math.min(...cards.map(({ gap }) => gap)),
      note: screenNote(),
      climax: drawClimax(IDEAS.ideas),
    };
  }

  // The camera bumps in a little as each arrow lands and eases back.
  const bumpAt = (k, count) =>
    Math.max(0, ...Array.from({ length: count }, (_, i) => {
      const t = k - i * CALL_STEP - ARROW_DRAW;
      return t >= 0 ? BUMP.zoom * (1 - progress(t, 0, BUMP.frames)) : 0;
    }));

  // One call: the arrow draws into the week, then its card slides in from the right with a small shake
  // and its confidence counts up from a coin flip.
  function landCall(idea, k) {
    idea.reveal.setAttribute('width', idea.width * ease(progress(k, 0, ARROW_DRAW)));
    const slid = ease(progress(k, ARROW_DRAW, SLIDE.frames));
    const settling = progress(k, ARROW_DRAW + SLIDE.frames, SHAKE.frames);
    const shake = settling > 0 && settling < 1 ? (noise(k, 1) - 0.5) * 2 * SHAKE.px * (1 - settling) : 0;
    idea.card.style.opacity = slid;
    idea.card.setAttribute('transform', `translate(${(1 - slid) * SLIDE.px + shake} 0)`);
    const counted = ease(progress(k, ARROW_DRAW, COUNT.frames));
    idea.conf.textContent = `${Math.round(lerp(Math.min(COUNT.from, idea.confidence), idea.confidence, counted))}%`;
  }

  // The tally slams in over the scrim and the coin jumps and spins above it.
  function renderClimax(climax, k) {
    const shown = ease(progress(k, 0, CLIMAX.fade));
    climax.scrim.style.opacity = CLIMAX.scrim * shown;
    popIn(climax.tally, ease(progress(k, 0, BEAT_IN)), [320, CLIMAX.y]);
    const t = progress(k, 2, CLIMAX.flight);
    const facing = Math.cos(2 * Math.PI * CLIMAX.turns * t);
    climax.coin.style.opacity = shown;
    climax.coin.setAttribute('transform', `translate(320 ${CLIMAX.coinY - CLIMAX.jump * 4 * t * (1 - t)}) scale(${CLIMAX.coinScale})`);
    climax.spin.setAttribute('transform', `scale(${Math.max(Math.abs(facing), COIN_EDGE)} 1)`);
    climax.face.setAttribute('fill', facing >= 0 ? COIN_FACES.front : COIN_FACES.back);
    climax.label.style.opacity = facing >= 0 ? 1 : 0;
  }

  // The disclaimer is pinned to the frame while the camera moves.
  function renderCallMonitor(plan, k) {
    const zoom = DRIFT - (DRIFT - 1) * ease(progress(k, 0, SETTLE)) + bumpAt(k, plan.ideas.length);
    const view = around(CENTRE, zoom);
    setViewBox('s3', view);
    plan.note.style.opacity = 1;
    plan.note.setAttribute('transform', `translate(${view[0]} ${view[1]}) scale(${view[2] / 640})`);
    renderChart(plan, Infinity);
    plan.frame.querySelectorAll('text, circle').forEach((node) => (node.style.opacity = 1));
    plan.flicker.style.opacity = 0;
    plan.week.style.opacity = ease(progress(k, 0, WEEK_IN));
    $('s3', 'title').style.opacity = progress(k, TITLE_IN.start, TITLE_IN.frames);
    plan.ideas.forEach((idea, i) => landCall(idea, k - i * CALL_STEP));
    renderClimax(plan.climax, k - CLIMAX_AT);
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

  // The frames score.py clicks on: each arrow starting to draw, and its card landing as the arrow does.
  function callClicks({ monitorStart }) {
    const lines = IDEAS.ideas.map((_, i) => monitorStart + i * CALL_STEP);
    return { lines, cards: lines.map((f) => f + ARROW_DRAW) };
  }

  window.STORY = {
    ...window.STORY,
    hookFrames: STORY.hookFrames,
    monitorFrames: STORY.monitorFrames,
    planHook: planCallHook,
    renderHook: renderCallHook,
    renderHookScreen: renderCallHookScreen,
    planMonitor: planCallMonitor,
    renderMonitor: renderCallMonitor,
    renderEnd: renderCallEnd,
    endCut: true, // the tally cuts to the end card on the beat instead of dissolving under it
    clicks: callClicks,
  };
})();
