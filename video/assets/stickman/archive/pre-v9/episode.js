/*
 * Grandpa episode preview: board -> desk -> monitor -> end card.
 * renderFrame(f) is pure in f, so any frame renders the same on its own. It stands in for the
 * Task 6 Remotion composition; the same logic ports to useCurrentFrame().
 * Units: scene px (640x360 viewBox) unless a name says "local" (grandpa.svg px).
 */
'use strict';

const POSES = JSON.parse(document.getElementById('poses').textContent);
const SVG_NS = 'http://www.w3.org/2000/svg';
const FULL_VIEW = [0, 0, 640, 360];

// grandpa.svg skeleton, local px; rig.js holds the joints, the gait and the soles.
const RIG = Rig.RIGS.v2;
const SHOULDER = RIG.pivots['arm-left']; // left shoulder, the chalk arm
const ELBOW = RIG.pivots['arm-left-forearm'];
const CHALK_TIP = RIG.chalk;
const EYE_Y = 60.8;
const SOLE_DROP = 2.5; // the soles stand this far below a floor line, just in front of it

// Walking.
const FULL_STRIDE = 2.5; // scene px per frame from which the legs take full steps
const WALK_IN = 0.5; // stride amount that switches to profile shoes...
const WALK_OUT = 0.2; // ...and back to front shoes
const MIN_RUN = 6; // frames; shorter shoe switches are dropped so the shoes don't flicker

// Scene 1: the board.
const DRAW_SPEED = 20; // chalk px per frame
const WRITE_SPEED = 8;
const TRAVEL_SPEED = 14;
const BOARD_WALK = 5; // shoulder px per frame; the chalk waits wherever the body would have to walk faster
const SLICES = 8; // timing samples per frame of chalk motion
const FOLLOW_RADIUS = 4; // frames averaged into the body's path
const LIFT_RADIUS = 4;
const INTRO = 18;
const TAP = 12;
const OUTRO = 34;
const OUTRO_WALK = 20;
const GROK_ARROW = [410, 199.5];
const MIN_DX = 33; // the shoulder stays this far right of the chalk
const MAX_LIFT = 4; // rising on the toes for the top row; any higher and the soles leave the floor line
const ELBOW_ROOM = 16; // writing pushes the body this far past the head-clearance limit, so the hand stays off the face
const COMFORT = 0.95;
const HEAD_ABOVE_SHOULDER = 50; // local px
const HEAD_RIGHT_OF_SHOULDER = 16; // the head centre sits over the middle of the chest, local px
const HEAD_CLEARANCE = 42; // side hair from the head centre + half a sleeve, local px

// Scene 2: the desk.
const WALK = 96; // about two steps a second
const DECEL = 24; // the last frames of the walk, spent braking evenly to a stop
const SIT = 20;
const SCOOT = 12; // the chair rolls him in to the desk
const TYPE = 40;
const ZOOM = 32;
const SETTLED = WALK + SIT + SCOOT;
const DESK_LENGTH = SETTLED + TYPE + ZOOM;
const DESK_FLOOR = 312;
const WALK_FROM = -130;
const ZOOM_TO = [365.5, 125.97, 185, 104.06]; // 16:9 inside #screen
const TYPING = { 'arm-left-forearm': 1, 'arm-right-forearm': -1 };

// Scene 3: the monitor.
const CROSS = 10;
const MONITOR = 200;
const MONITOR_FROM = [71, 33, 497.8, 280]; // 16:9 inside #screen
const MONITOR_ZOOM = 40;
const PRICE_START = 30;
const PRICE_FRAMES = 40;
const PRICE_X = [52, 336];
const SLIDE = 8;
const GROW = 24;
const HIT_AXIS_X = 430;

// End card.
const END = 120;
const END_FADE = 12;
const END_SLOT = { x: 30, scale: 0.85 };
const END_FLOOR = 312;
const FLASH = 6;

const $ = (scene, id) => document.getElementById(`${scene}-${id}`);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const progress = (f, start, length) => clamp((f - start) / length, 0, 1);
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const dist = ([ax, ay], [bx, by]) => Math.hypot(bx - ax, by - ay);
const angle = ([ax, ay], [bx, by]) => Math.atan2(by - ay, bx - ax);
const deg = (radians) => (radians * 180) / Math.PI;
const wrap = (degrees) => ((((degrees + 180) % 360) + 360) % 360) - 180;
const blinkAt = (f, offset) => [0.5, 0.1, 0.5][(f + offset) % 87] ?? 1;
const pointAt = (node, length) => {
  const p = node.getPointAtLength(length);
  return [p.x, p.y];
};

function smooth(values, radius) {
  return values.map((_, i) => {
    const span = values.slice(Math.max(0, i - radius), i + radius + 1);
    return span.reduce((sum, v) => sum + v, 0) / span.length;
  });
}

// Zoom at a constant rate around the one point both boxes share, so it never seems to speed up.
function zoomBox(from, to, t) {
  const ratio = to[2] / from[2];
  const scale = ratio ** t;
  const fixed = [0, 1].map((i) => (to[i] - ratio * from[i]) / (1 - ratio));
  return [...fixed.map((p, i) => p - (p - from[i]) * scale), from[2] * scale, from[3] * scale];
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function defsOf(svg) {
  return svg.querySelector(':scope > defs') ?? svg.appendChild(svgEl('defs'));
}

function clipTo(node, id, [x, y, width, height]) {
  const rect = svgEl('rect', { x, y, width, height });
  const clip = svgEl('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
  clip.append(rect);
  defsOf(node.ownerSVGElement).append(clip);
  node.setAttribute('clip-path', `url(#${id})`);
  return rect;
}

function setViewBox(scene, box) {
  $(scene, 'root').setAttribute('viewBox', box.join(' '));
}

// ---------------------------------------------------------------- figure

const UPPER_ARM = dist(SHOULDER, ELBOW);
const FOREARM = dist(ELBOW, CHALK_TIP);
const UPPER_REST = angle(SHOULDER, ELBOW);
const FOREARM_REST = angle(ELBOW, CHALK_TIP);

function poseFigure(scene, { x, y, scale, parts, eyes, blink, browLift, chalk, feet = 'front' }) {
  Rig.pose(scene, RIG, { place: [x, y, scale], parts, eyes, chalk, feet });
  for (const eye of ['eye-left', 'eye-right']) {
    $(scene, eye).setAttribute('transform', `translate(0 ${EYE_Y}) scale(1 ${blink}) translate(0 ${-EYE_Y})`);
  }
  $(scene, 'brows').setAttribute('transform', `translate(0 ${-browLift})`);
}

// The figure's y that puts its lowest sole at soleY.
const standOn = (soleY, scale, parts, feet) => soleY - scale * Rig.lowestSole(RIG, parts, feet);

// Leg and arm angles for one gait frame: amount 0 is the standing pose, 1 the full stride.
function gaitParts({ phase, amount, dir }) {
  return Object.fromEntries(
    Object.entries(Rig.walk(RIG, phase, dir)).map(([part, v]) => [part, lerp(Rig.STANDING[part] ?? 0, v, amount)]),
  );
}

// Two-bone IK that puts the chalk tip on a local point; the elbow always bends down and out.
function reachArm(target) {
  const d = clamp(dist(SHOULDER, target), Math.abs(UPPER_ARM - FOREARM) + 0.01, UPPER_ARM + FOREARM - 0.01);
  const upper = angle(SHOULDER, target) - Math.acos((UPPER_ARM ** 2 + d ** 2 - FOREARM ** 2) / (2 * UPPER_ARM * d));
  const elbow = [SHOULDER[0] + UPPER_ARM * Math.cos(upper), SHOULDER[1] + UPPER_ARM * Math.sin(upper)];
  return {
    'arm-left': wrap(deg(upper - UPPER_REST)),
    'arm-left-forearm': wrap(deg(angle(elbow, target) - upper)) - deg(FOREARM_REST - UPPER_REST),
  };
}

// Body travel per step (half a gait cycle) with a foot planted, local px.
const STEP = Rig.walkOffset(RIG, Math.PI) - Rig.walkOffset(RIG, 0);

// The gait phase at which the planted feet have carried the body this far, local px.
function phaseAt(distance) {
  const travelled = (phase) => Rig.walkOffset(RIG, phase) - Rig.walkOffset(RIG, 0);
  let lo = 0;
  let hi = Math.PI * (Math.floor(distance / STEP) + 2);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (travelled(mid) < distance) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Profile shoes while walking, front shoes while standing. Hysteresis and MIN_RUN keep them from flickering:
// a run shorter than MIN_RUN takes the shoes of the run before it.
function shoesOf(gait) {
  let walking = false;
  const raw = gait.map(({ amount, dir }) => {
    walking = walking ? amount >= WALK_OUT : amount > WALK_IN;
    return walking ? (dir > 0 ? 'right' : 'left') : 'front';
  });
  const shoes = [];
  for (let start = 0, end = 0; start < raw.length; start = end) {
    while (end < raw.length && raw[end] === raw[start]) end++;
    const feet = end - start < MIN_RUN && start > 0 ? shoes[start - 1] : raw[start];
    for (let k = start; k < end; k++) shoes.push(feet);
  }
  return shoes;
}

// Below FULL_STRIDE the cadence holds and only the stride shrinks; above it the steps keep up with the
// ground speed. Either way the stance foot moves back about as fast as the body moves on, so it doesn't slide.
function gaitOf(xs, scale) {
  const speeds = smooth(xs.map((x, k) => (k ? x - xs[k - 1] : xs[1] - xs[0])), 3);
  let walked = 0;
  const gait = speeds.map((v) => {
    const amount = clamp(Math.abs(v) / FULL_STRIDE, 0, 1);
    walked += amount > 0.01 ? Math.max(Math.abs(v), FULL_STRIDE) / scale : 0;
    return { phase: phaseAt(walked), amount, dir: Math.sign(v) || -1 };
  });
  const shoes = shoesOf(gait);
  return gait.map((frame, k) => ({ ...frame, feet: shoes[k] }));
}

// ---------------------------------------------------------------- scene 1: board

const BOARD_SHOULDER_Y = POSES.board.y + POSES.board.scale * SHOULDER[1];
const BOARD_SOLE_Y = POSES.board.y + POSES.board.scale * Rig.lowestSole(RIG, POSES.board.rotate, 'front');
const BOARD_STRETCH = (UPPER_ARM + FOREARM) * POSES.board.scale; // a straight arm
const BOARD_REACH = BOARD_STRETCH * COMFORT;
// A straight arm from the shoulder clears the head when dx >= rise * HEAD_SLOPE.
const HEAD_SLOPE = Math.tan(
  Math.asin(HEAD_CLEARANCE / Math.hypot(HEAD_ABOVE_SHOULDER, HEAD_RIGHT_OF_SHOULDER)) -
    Math.atan2(HEAD_RIGHT_OF_SHOULDER, HEAD_ABOVE_SHOULDER),
);

// One dash pattern must not run across several subpaths, so each M becomes its own path.
function splitSubpaths(drawing) {
  for (const path of drawing.querySelectorAll('path')) {
    const parts = path.getAttribute('d').split(/(?=M)/).map((d) => d.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    for (const d of parts) {
      const part = path.cloneNode();
      part.setAttribute('d', d);
      path.before(part);
    }
    path.remove();
  }
}

// Geometry: the chalk line grows along the path.
function lineStroke(node) {
  const length = node.getTotalLength();
  node.style.strokeDasharray = `${length} ${length}`;
  return {
    frames: Math.max(2, Math.round(length / DRAW_SPEED)),
    at: (t) => pointAt(node, length * t),
    show: (t) => {
      node.style.strokeDashoffset = length * (1 - t);
      node.style.visibility = t > 0 ? 'visible' : 'hidden';
    },
  };
}

// The dashed line keeps its own dash pattern, so a clip box grows down it instead.
function dashStroke(node, id) {
  const length = node.getTotalLength();
  const box = node.getBBox();
  const reveal = clipTo(node, id, [box.x - 4, box.y - 4, box.width + 8, 0]);
  return {
    frames: Math.max(2, Math.round(length / DRAW_SPEED)),
    at: (t) => pointAt(node, length * t),
    show: (t) => reveal.setAttribute('height', (box.height + 8) * t),
  };
}

// Text: a clip box uncovers it left to right while the chalk tip wiggles along the line.
function textStroke(node, id) {
  const box = node.getBBox();
  const baseline = Number(node.getAttribute('y'));
  const size = parseFloat(getComputedStyle(node).fontSize);
  const reveal = clipTo(node, id, [box.x - 2, box.y - 4, 0, box.height + 8]);
  return {
    frames: Math.max(4, Math.round(box.width / WRITE_SPEED)),
    at: (t) => [box.x + box.width * t, baseline - size * (0.32 + 0.18 * Math.sin((2 * Math.PI * box.width * t) / 24))],
    show: (t) => reveal.setAttribute('width', (box.width + 4) * t),
  };
}

function boardStrokes() {
  const drawing = $('s1', 'chalk-drawing');
  splitSubpaths(drawing);
  return [...drawing.children].map((node, i) => {
    if (node.tagName === 'text') return textStroke(node, `s1-write-${i}`);
    if (node.classList.contains('dash')) return dashStroke(node, `s1-dash-${i}`);
    return lineStroke(node);
  });
}

// High targets need the shoulder further right so the raised arm passes beside the head;
// the rise is capped where that arm still reaches, and liftsFor() raises him on his toes for the rest.
function minDxFor(ty) {
  const rise = Math.min(BOARD_SHOULDER_Y - ty, BOARD_REACH / Math.hypot(1, HEAD_SLOPE));
  return Math.max(MIN_DX, rise * HEAD_SLOPE);
}

// Shoulder x range for one chalk target: near = head clearance plus elbow room (never below the
// clearance itself, since maxDx >= minDx + 6), far = comfortable reach.
function reachBounds([tx, ty]) {
  const rise = ty < BOARD_SHOULDER_Y ? Math.max(0, BOARD_SHOULDER_Y - ty - MAX_LIFT) : ty - BOARD_SHOULDER_Y;
  const minDx = minDxFor(ty);
  const maxDx = Math.max(minDx + 6, Math.sqrt(Math.max(0, BOARD_REACH ** 2 - rise ** 2)));
  return { near: tx + Math.min(minDx + ELBOW_ROOM, maxDx - 6), far: tx + maxDx };
}

// The body only steps when the chalk would leave that range; step is how far it moved, scene px.
function lazyShoulder(start) {
  let x = start;
  return (target) => {
    const { near, far } = reachBounds(target);
    const next = clamp(x, near, far);
    const step = Math.abs(next - x);
    x = next;
    return { x, step };
  };
}

// The shoulder path: lazy, back to the slot at the end, averaged so the steps ease in and out.
function followChalk(targets, outroStart) {
  const follow = lazyShoulder(reachBounds(targets[0]).near);
  const lazy = targets.map((target) => follow(target).x);
  const slot = POSES.board.x + POSES.board.scale * SHOULDER[0];
  const settled = lazy.map((x, k) =>
    k < outroStart ? x : lerp(lazy[outroStart], slot, ease(progress(k, outroStart, OUTRO_WALK))),
  );
  return smooth(settled, FOLLOW_RADIUS);
}

// The figure's y in gait frame g, raised on his toes by lift.
function boardY(g, lift) {
  return standOn(BOARD_SOLE_Y, POSES.board.scale, { ...POSES.board.rotate, ...gaitParts(g) }, g.feet) - lift;
}
const boardShoulderY = (g, lift) => boardY(g, lift) + POSES.board.scale * SHOULDER[1];

// How far he rises on his toes so a straight arm still reaches the chalk, up to MAX_LIFT.
// The running max rises before he needs it and comes down after.
function liftsFor(targets, xs, gait) {
  const needed = targets.map(([tx, ty], k) => {
    const reachUp = Math.sqrt(Math.max(0, BOARD_STRETCH ** 2 - (xs[k] - tx) ** 2));
    return clamp(boardShoulderY(gait[k], 0) - ty - reachUp, 0, MAX_LIFT);
  });
  const peaks = needed.map((_, k) => Math.max(...needed.slice(Math.max(0, k - LIFT_RADIUS), k + LIFT_RADIUS + 1)));
  return smooth(peaks, LIFT_RADIUS);
}

// Where the lift runs out, the body moves in until a straight arm reaches: the chalk stays in the hand
// even if the raised arm passes closer to the head than minDxFor() asks.
function withinReach(targets, xs, gait, lifts) {
  return xs.map((x, k) => {
    const [tx, ty] = targets[k];
    const rise = boardShoulderY(gait[k], lifts[k]) - ty;
    return Math.min(tx + Math.sqrt(Math.max(0, BOARD_STRETCH ** 2 - rise ** 2)), Math.max(x, tx + minDxFor(ty)));
  });
}

function planBoard() {
  const strokes = boardStrokes();
  const follow = lazyShoulder(reachBounds(strokes[0].at(0)).near);
  const frames = [];
  const hold = (count, drawn, target) => {
    for (let k = 0; k < count; k++) frames.push({ drawn, t: 0, target });
  };
  // One chalk move, frameAt(u) for u from 0 to 1, planned over count frames. Where the body would
  // have to walk faster than BOARD_WALK to keep the chalk in reach, the chalk slows down for him.
  const play = (count, frameAt) => {
    const slices = count * SLICES;
    const times = [0];
    for (let i = 1; i <= slices; i++) {
      const { step } = follow(frameAt(i / slices).target);
      times.push(times[i - 1] + Math.max(1 / SLICES, step / BOARD_WALK));
    }
    const total = times[slices];
    const length = Math.max(1, Math.round(total));
    for (let k = 1; k <= length; k++) {
      const at = (k / length) * total;
      const i = Math.max(1, times.findIndex((time) => time >= at - 1e-9));
      frames.push(frameAt(Math.min(1, (i - 1 + (at - times[i - 1]) / (times[i] - times[i - 1])) / slices)));
    }
  };
  const travel = (from, to, drawn) =>
    play(Math.max(2, Math.round(dist(from, to) / TRAVEL_SPEED)), (u) => ({ drawn, t: 0, target: mix(from, to, ease(u)) }));

  let tip = strokes[0].at(0);
  hold(INTRO, 0, tip);
  strokes.forEach((stroke, i) => {
    travel(tip, stroke.at(0), i);
    play(stroke.frames, (u) => ({ drawn: i, t: u, target: stroke.at(u) }));
    tip = stroke.at(1);
  });
  travel(tip, GROK_ARROW, strokes.length);
  for (let k = 0; k < TAP; k++) {
    const knock = 3 * Math.abs(Math.sin((2 * Math.PI * k) / TAP));
    frames.push({ drawn: strokes.length, t: 0, target: [GROK_ARROW[0], GROK_ARROW[1] - knock] });
  }
  hold(OUTRO, strokes.length, GROK_ARROW);

  const targets = frames.map((frame) => frame.target);
  const scale = POSES.board.scale;
  const free = followChalk(targets, frames.length - OUTRO);
  const freeGait = gaitOf(free, scale);
  const xs = withinReach(targets, free, freeGait, liftsFor(targets, free, freeGait));
  const gait = gaitOf(xs, scale);
  return { strokes, frames, xs, gait, lifts: liftsFor(targets, xs, gait) };
}

// Where the body stands in frame k. The arms never reach the soles, so the legs alone set the height;
// rising on his toes lifts him by up to MAX_LIFT, which keeps the soles on the floor line.
function boardBody({ xs, lifts, gait }, k) {
  return {
    x: xs[k] - POSES.board.scale * SHOULDER[0],
    y: boardY(gait[k], lifts[k]),
    legs: gaitParts(gait[k]),
    feet: gait[k].feet,
  };
}

function renderBoard(plan, k) {
  const { frames, strokes } = plan;
  const { drawn, t, target } = frames[k];
  strokes.forEach((stroke, i) => stroke.show(i < drawn ? 1 : i === drawn ? t : 0));

  const pose = POSES.board;
  const { x, y, legs, feet } = boardBody(plan, k);
  // Turns to the board to write, back to the viewer at the end.
  const look = ease(progress(k, 6, 10)) * (1 - ease(progress(k, frames.length - 22, 12)));
  poseFigure('s1', {
    x,
    y,
    scale: pose.scale,
    parts: {
      ...pose.rotate,
      ...legs,
      head: pose.rotate.head * look,
      'arm-right': pose.rotate['arm-right'] + legs['arm-right'],
      'arm-right-forearm': (pose.rotate['arm-right-forearm'] ?? 0) + legs['arm-right-forearm'],
      ...reachArm([(target[0] - x) / pose.scale, (target[1] - y) / pose.scale]),
    },
    eyes: pose.translate.eyes.map((v) => v * look),
    blink: blinkAt(k, 40),
    browLift: 2 * (1 - look),
    chalk: true,
    feet,
  });
}

// ---------------------------------------------------------------- scene 2: desk

// Mean x of the two ankles, local px.
const ankleX = (parts) => (Rig.ankle(RIG, parts, 'left')[0] + Rig.ankle(RIG, parts, 'right')[0]) / 2;

function planDesk() {
  const seat = POSES.desk;
  // Cruise, then brake evenly over the last DECEL frames to stop at the slot.
  const cruise = (seat.x - WALK_FROM) / (WALK - DECEL / 2);
  const xs = Array.from({ length: WALK + 1 }, (_, k) => {
    const braking = Math.max(0, k - (WALK - DECEL));
    return WALK_FROM + cruise * (k - braking ** 2 / (2 * DECEL));
  });
  const gait = gaitOf(xs, seat.scale);
  const stopped = gaitParts(gait[WALK]);
  const [title, base, marker, line, ...bars] = $('s2', 'screen-content').children;
  const lineLength = line.getTotalLength();
  line.style.strokeDasharray = `${lineLength} ${lineLength}`;
  return {
    xs,
    gait,
    // He sits back with his feet planted, so he lands this far short of the slot; the chair,
    // pulled out by as much, then rolls him in.
    footX: xs[WALK] + seat.scale * ankleX(stopped),
    pulledOut: seat.scale * (ankleX(seated(seat)) - ankleX(stopped)),
    chair: $('s2', 'chair'),
    screen: { title, base, marker, line, lineLength },
    bars: bars.map((bar) => ({ bar, width: Number(bar.getAttribute('width')) })),
    steam: $('s2', 'mug').querySelector('.steam'),
  };
}

function renderDeskScreen(plan, on) {
  const { title, base, marker, line, lineLength } = plan.screen;
  title.style.opacity = progress(on, 0, 5);
  base.style.opacity = progress(on, 3, 5);
  marker.style.opacity = progress(on, 3, 5);
  line.style.strokeDashoffset = lineLength * (1 - progress(on, 5, 18));
  line.style.visibility = on > 5 ? 'visible' : 'hidden';
  plan.bars.forEach(({ bar, width }, i) => bar.setAttribute('width', width * ease(progress(on, 14 + 3 * i, 12))));
}

// The seated pose: the scene's rotations over Rig.SEATED, which draws the hips and shoulders in to the profile.
const seated = (seat) => ({ ...Rig.SEATED, ...seat.rotate });

// The parts for desk frame k: walking, easing into the seated pose, then typing.
function deskParts(plan, k) {
  const target = seated(POSES.desk);
  const legs = gaitParts(plan.gait[Math.min(k, WALK)]);
  const sit = ease(progress(k, WALK, SIT));
  const typing = progress(k, SETTLED, 4) * 6 * Math.sin((2 * Math.PI * (k - SETTLED)) / 7);
  return Object.fromEntries(
    [...Object.keys(RIG.pivots), 'hips', 'shoulders'].map((part) => [
      part,
      lerp(legs[part] ?? 0, target[part] ?? 0, sit) + (TYPING[part] ?? 0) * typing,
    ]),
  );
}

function renderDesk(plan, k) {
  const seat = POSES.desk;
  const parts = deskParts(plan, k);
  const scoot = ease(progress(k, WALK + SIT, SCOOT));
  // While he sits the ankles hold still and the body moves back over them; seated, the chair carries him.
  const x = k < WALK ? plan.xs[k] : plan.footX - seat.scale * ankleX(parts) + plan.pulledOut * scoot;
  plan.chair.setAttribute('transform', `translate(${-plan.pulledOut * (1 - scoot)} 0)`);
  poseFigure('s2', {
    x,
    // Profile shoes throughout: he walks right and sits facing right.
    y: standOn(DESK_FLOOR + SOLE_DROP, seat.scale, parts, 'right'),
    scale: seat.scale,
    parts,
    eyes: mix([3, 0], seat.translate.eyes, ease(progress(k, WALK, SIT))),
    blink: blinkAt(k, 10),
    browLift: 0,
    chalk: false,
    feet: 'right',
  });
  renderDeskScreen(plan, k - SETTLED);
  // The small screen goes dark before the monitor UI fades in, so the two layouts never overlap.
  $('s2', 'screen-content').style.opacity = 1 - progress(k, DESK_LENGTH - CROSS - 8, 8);
  plan.steam.setAttribute('transform', `translate(0 ${-1.5 * Math.sin((2 * Math.PI * k) / 40)})`);
  setViewBox('s2', zoomBox(FULL_VIEW, ZOOM_TO, ease(progress(k, SETTLED + TYPE, ZOOM))));
}

// ---------------------------------------------------------------- scene 3: monitor

function chunk(items, size) {
  return Array.from({ length: items.length / size }, (_, i) => items.slice(i * size, (i + 1) * size));
}

function planMonitor() {
  const [, , , , , markRec, markVer, labelRec, labelVer, line, dotRec, dotVer] = $('s3', 'panel-price').children;
  const calls = chunk([...$('s3', 'panel-calls').children].slice(1), 5);
  const hits = chunk([...$('s3', 'panel-hit-rate').children].slice(2), 3);
  return {
    reveal: clipTo(line, 's3-reveal-price', [PRICE_X[0] - 4, 90, 0, 200]),
    recorded: [markRec, labelRec, dotRec],
    verified: [markVer, labelVer, dotVer],
    calls: calls.map((row) => ({ call: row.slice(0, 4), result: row[4] })),
    hits: hits.map(([, bar, num]) => ({
      bar,
      num,
      width: Number(bar.getAttribute('width')),
      value: parseInt(num.textContent, 10),
    })),
  };
}

function slideIn(nodes, t) {
  for (const node of nodes) {
    node.style.opacity = t;
    node.setAttribute('transform', `translate(${(1 - t) * 8} 0)`);
  }
}

function renderMonitor(plan, k) {
  setViewBox('s3', zoomBox(MONITOR_FROM, FULL_VIEW, ease(progress(k, CROSS, MONITOR_ZOOM))));

  const drawn = progress(k, PRICE_START, PRICE_FRAMES);
  plan.reveal.setAttribute('width', drawn > 0 ? lerp(PRICE_X[0], PRICE_X[1], drawn) - (PRICE_X[0] - 4) : 0);
  const reachedAt = (x) => PRICE_START + ((x - PRICE_X[0]) / (PRICE_X[1] - PRICE_X[0])) * PRICE_FRAMES;
  const recordedAt = reachedAt(220);
  const verifiedAt = reachedAt(316);
  for (const node of plan.recorded) node.style.opacity = progress(k, recordedAt, 6);
  for (const node of plan.verified) node.style.opacity = progress(k, verifiedAt, 6);

  plan.calls.forEach(({ call, result }, r) => {
    slideIn(call, ease(progress(k, recordedAt + 4 + 5 * r, SLIDE)));
    slideIn([result], ease(progress(k, verifiedAt + 8 + 6 * r, SLIDE)));
  });
  plan.hits.forEach(({ bar, num, width, value }, r) => {
    const grown = ease(progress(k, verifiedAt + 40 + 4 * r, GROW));
    bar.setAttribute('width', width * grown);
    num.textContent = `${Math.round(value * grown)}%`;
    num.setAttribute('x', HIT_AXIS_X + width * grown + 6);
    num.style.visibility = grown > 0 ? 'visible' : 'hidden';
  });
}

// ---------------------------------------------------------------- end card

function renderEnd(k) {
  const parts = {
    ...Rig.STANDING,
    head: -4,
    'arm-right': -92.5,
    'arm-right-forearm': -76.1 + 15 * Math.sin((2 * Math.PI * k) / 16),
  };
  poseFigure('s4', {
    ...END_SLOT,
    y: standOn(END_FLOOR + SOLE_DROP, END_SLOT.scale, parts, 'front'),
    parts,
    eyes: [2, 0],
    blink: blinkAt(k, 60),
    browLift: 2,
    chalk: false,
  });
  $('s4', 'text').style.opacity = progress(k, 4, 10);
}

// ---------------------------------------------------------------- timeline

let episode;

function setup() {
  const board = planBoard();
  const boardEnd = board.frames.length;
  const deskEnd = boardEnd + DESK_LENGTH;
  const monitorStart = deskEnd - CROSS;
  const endStart = monitorStart + MONITOR - END_FADE;
  const desk = planDesk();
  episode = { board, desk, monitor: planMonitor(), boardEnd, deskEnd, monitorStart, endStart };
  window.TOTAL_FRAMES = endStart + END;
  // Frame ranges, end exclusive, for rendering one scene at a time.
  window.SCENES = {
    board: [0, boardEnd],
    desk: [boardEnd, deskEnd],
    monitor: [monitorStart, endStart + END_FADE],
    end: [endStart, window.TOTAL_FRAMES],
  };
  window.report = checks(board, desk);
  return window.TOTAL_FRAMES;
}

// Numbers to eyeball before rendering: whether the chalk stays in reach, how fast he walks at the board,
// how high he rises on his toes, how often the shoes switch, and whether the seated pose lands on the slot.
function checks(board, desk) {
  const switches = (gait) => gait.filter((g, k) => k && g.feet !== gait[k - 1].feet).length;
  const seatedParts = deskParts(desk, SETTLED);
  // How far a straight arm falls short of the chalk target, scene px.
  const misses = board.frames.map(({ target }, k) => {
    const { x, y } = boardBody(board, k);
    const shoulder = [x + POSES.board.scale * SHOULDER[0], y + POSES.board.scale * SHOULDER[1]];
    return Math.max(0, dist(shoulder, target) - BOARD_STRETCH);
  });
  // Frames where the reach clamp pulled the shoulder inside the head clearance.
  const crowded = board.frames.filter(({ target: [tx, ty] }, k) => board.xs[k] - tx < minDxFor(ty) - 0.5).length;
  return {
    frames: window.TOTAL_FRAMES,
    boardFrames: board.frames.length,
    boardMaxWalk: +Math.max(...board.xs.map((x, k) => (k ? Math.abs(x - board.xs[k - 1]) : 0))).toFixed(2),
    boardMaxLift: +Math.max(...board.lifts).toFixed(2),
    boardLiftFrames: board.lifts.filter((v) => v > 0.5).length,
    boardChalkMiss: +Math.max(...misses).toFixed(2),
    boardCrowded: crowded,
    boardShoeSwitches: switches(board.gait),
    boardShoes: [...new Set(board.gait.map((g) => g.feet))],
    deskPulledOut: +desk.pulledOut.toFixed(2),
    deskStopAmount: +desk.gait[WALK].amount.toFixed(3),
    deskSeatedY: +standOn(DESK_FLOOR + SOLE_DROP, POSES.desk.scale, seatedParts, 'right').toFixed(2),
    deskSeatY: POSES.desk.y,
    endY: +standOn(END_FLOOR + SOLE_DROP, END_SLOT.scale, Rig.STANDING, 'front').toFixed(2),
  };
}

function showLayer(name, opacity, render) {
  document.getElementById(`layer-${name}`).style.opacity = opacity;
  if (opacity > 0) render();
}

window.renderFrame = (f) => {
  const { board, desk, monitor, boardEnd, deskEnd, monitorStart, endStart } = episode;
  showLayer('board', f < boardEnd ? 1 : 0, () => renderBoard(board, f));
  showLayer('desk', f >= boardEnd && f < deskEnd ? 1 : 0, () => renderDesk(desk, f - boardEnd));
  showLayer('monitor', progress(f + 1, monitorStart, CROSS), () => renderMonitor(monitor, f - monitorStart));
  showLayer('end', progress(f + 1, endStart, END_FADE), () => renderEnd(f - endStart));
  document.getElementById('flash').style.opacity = 1 - clamp(Math.abs(f + 0.5 - boardEnd) / FLASH, 0, 1);
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

window.episodeReady = document.fonts.ready.then(setup);
