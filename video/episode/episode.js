/*
 * Grandpa episode preview: hook -> board -> desk -> monitor -> end card.
 * renderFrame(f) is pure in f, so any frame renders the same on its own. It stands in for the
 * Task 6 Remotion composition; the same logic ports to useCurrentFrame().
 * Units: scene px (640x360 viewBox) unless a name says "local" (grandpa.svg px).
 */
'use strict';

const POSES = JSON.parse(document.getElementById('poses').textContent);
const BTC = JSON.parse(document.getElementById('btc').textContent);
const IDEAS = JSON.parse(document.getElementById('ideas').textContent);
const SVG_NS = 'http://www.w3.org/2000/svg';
const FULL_VIEW = [0, 0, 640, 360];

// grandpa.svg skeleton, local px; rig.js holds the joints, the gait and the soles.
const RIG = Rig.RIGS.v2;
const SHOULDER = RIG.pivots['arm-left']; // left shoulder, the chalk arm
const ELBOW = RIG.pivots['arm-left-forearm'];
const CHALK_TIP = RIG.chalk;
const HAND = RIG.hands.left;
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
// The pointer opening: the board is written from the first frame and he taps each [data-point] in turn.
const POINTER_LENGTH = 110; // local px, from the middle of the fist on along the forearm
// Before and after, the arm hangs loose and the fist tips the pointer down to the floor, degrees.
const POINTER_REST_ARM = { 'arm-left': 6, 'arm-left-forearm': -4 };
const POINTER_REST_WRIST = 30;
const POINT_HOLD = 4;
const POINT_RAISE = 14; // frames to raise the pointer from the rest pose, and to lower it back
const POINT_TRAVEL = 14; // frames from one point to the next
const POINT_TAP = 16; // two soft taps
const POINT_DWELL = 6;
const POINT_OUTRO = 12; // frames he holds the lowered pointer, facing the viewer, before the cut
const POINTER_KNOCK = 4; // a tap pulls the tip back this far toward the shoulder

// Scene 2: the desk.
const WALK = 96; // about two steps a second
const DECEL = 24; // the last frames of the walk, spent braking evenly to a stop
const SIT = 20;
const SCOOT = 12; // the chair rolls him in to the desk
const TYPE = 16;
const ZOOM = 32;
const SETTLED = WALK + SIT + SCOOT;
const DESK_LENGTH = SETTLED + TYPE + ZOOM;
const DESK_SKIP = SETTLED; // the board cuts to him already seated and typing; 0 brings back the walk in and the sit
const DESK_FLOOR = 312;
const WALK_FROM = -130;
const SCREEN_ON = 6; // frames for the screen to light up as he starts typing
const TYPING = { 'arm-left-forearm': 1, 'arm-right-forearm': -1 };

// Scene 3: the monitor. A real BTC daily chart, laid out like a trading screen, then each AI's idea
// for next week drawn over it. It starts with the desk camera's flight in.
const MONITOR = 216;
const PLOT = { x: 44, y: 94, width: 444, height: 111 }; // the day slots: the candles, the gap days, next week
const PANE_RIGHT = 554; // the pane runs on under the model names up to the price scale
const SCALE_X = 559;
const PRICE_PAD = 0.06; // share of the price range kept free above and below the candles
const VOLUME_ROOM = 14; // px at the bottom of the pane kept below the lowest candle, where the volume bars mostly sit
const VOLUME_HEIGHT = 22;
const TICK_STEPS = [500, 1000, 2000, 2500, 5000, 10000]; // dollars between price grid lines
const MAX_TICKS = 6;
const BODY = 0.7; // candle body width, share of a day slot
const TAG = { height: 13, pad: 4 }; // the last price, on the price scale
const DATE_ROOM = 16; // half a date label: a Monday closer than this to the pane's left edge goes unlabelled
const WEEK_DAYS = 5; // Mon-Fri
const DAY_MS = 86400000;
const TOOLBAR_Y = 73;
const LEGEND_Y = 87;
const DATE_Y = 216;
const TIMEFRAMES = ['1H', '4H', '1D', '1W', '1M'];
const TIMEFRAME = '1D'; // the candles are UTC days
const PILL = { width: 20, height: 13, step: 22, right: 596 };
const COIN = { x: 50, y: 69, r: 6.5, tilt: 14 }; // the orange bitcoin mark before the pair
const FAN = 20; // px between arrow tips with the same call; the angle is not a size of move
const ARROW_HEAD = 7;
const HEAD_SCALE = 0.42; // robot head from the header, 34 px wide at scale 1
const CARD = { x: 44, y: 223, width: 132, height: 67, gap: 8 };
const REASON_LINES = 3;
const MODEL_COLORS = { ChatGPT: '#199e70', Claude: '#d95926', Gemini: '#3987e5', Grok: '#c98500' };
const CALL_LABELS = { up: '↑ up', down: '↓ down' };
const FRAME_START = 18;
const FADE = 10;
const CANDLES_START = 26;
const CANDLES_SWEEP = 28; // frames from the first candle rising to the last
const CANDLE_RISE = 8;
const WEEK_START = 56;
const IDEAS_START = 64;
const IDEA_STEP = 20;
const ARROW_FRAMES = 16;
const POP = 6;
const CARD_SLIDE = 10;

// Hook: the cold open, for a feed that plays muted. The finished monitor held close while the AI arrows
// shoot out again under two big captions, then the camera pulls back to the whole monitor in its navy
// room and that dissolves into the board, which has the same wall.
const HOOK = 102;
const HOOK_VIEW = [272, 26, 330, 185.625]; // 16:9; the left edge falls between legend fields, before "C"
const HOOK_PULL_START = 52;
const HOOK_PULL = 42;
const HOOK_DISSOLVE = 16; // the last frames of the hook, fading over the board as the pull-back settles
const HOOK_ARROWS = 8; // the first arrow leaves here...
const HOOK_ARROW_STEP = 5; // ...and each next one this much later
const HOOK_ARROW_FRAMES = 12;
const BEAT_SWAP = 42; // the second caption replaces the first
const BEAT_OUT = 3;
const BEAT_IN = 5;
const BEAT_POP = 0.12; // the second caption lands from this much larger
const CAPTION = { x: 320, y: 50, subY: 74, coinY: 38 };
const CALL_CLASSES = { up: 'hook-up', down: 'hook-down' };
const COIN_R = 17;
const COIN_GAP = 10;
const COIN_FLIGHT = 30; // the toss, then it rests face up until the caption goes
const COIN_TURNS = 2; // whole turns, so it lands on the 50% side
const COIN_TOSS = 10; // px the coin rises and falls
const COIN_EDGE = 0.06; // the thinnest the coin gets edge-on, share of its width
const COIN_FACES = { front: '#f2c14e', back: '#d9a33a' };

// End card.
const END = 105;
const END_FADE = 12;
const CTA = { x: 200, y: 150, start: 10 }; // the question lands after the rest of the card, from BEAT_POP larger
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
const UPPER_REST = angle(SHOULDER, ELBOW);
const POINTER_TIP = mix(HAND, ELBOW, -POINTER_LENGTH / dist(ELBOW, HAND));

function poseFigure(scene, { x, y, scale, parts, eyes, blink, browLift, chalk, feet = 'front' }) {
  Rig.pose(scene, RIG, { place: [x, y, scale], parts, eyes, chalk, feet });
  for (const eye of ['eye-left', 'eye-right', 'eye-side']) {
    $(scene, eye).setAttribute('transform', `translate(0 ${EYE_Y}) scale(1 ${blink}) translate(0 ${-EYE_Y})`);
  }
  for (const brows of ['brows', 'brows-side']) {
    $(scene, brows).setAttribute('transform', `translate(0 ${-browLift})`);
  }
}

// The figure's y that puts its lowest sole at soleY.
const standOn = (soleY, scale, parts, feet) => soleY - scale * Rig.lowestSole(RIG, parts, feet);

// Leg and arm angles for one gait frame: amount 0 is the standing pose, 1 the full stride.
function gaitParts({ phase, amount, dir }) {
  return Object.fromEntries(
    Object.entries(Rig.walk(RIG, phase, dir)).map(([part, v]) => [part, lerp(Rig.STANDING[part] ?? 0, v, amount)]),
  );
}

// Two-bone IK for a tool in the left hand: reach() puts its tip on a local point, the elbow always bending
// down and out. stretch is a straight arm, fold the closest the tip gets to the shoulder, local px.
function armWith(tip) {
  const forearm = dist(ELBOW, tip);
  const forearmRest = angle(ELBOW, tip);
  const stretch = UPPER_ARM + forearm;
  const fold = Math.abs(UPPER_ARM - forearm);
  return {
    stretch,
    fold,
    reach(target) {
      const d = clamp(dist(SHOULDER, target), fold + 0.01, stretch - 0.01);
      const upper = angle(SHOULDER, target) - Math.acos((UPPER_ARM ** 2 + d ** 2 - forearm ** 2) / (2 * UPPER_ARM * d));
      const elbow = [SHOULDER[0] + UPPER_ARM * Math.cos(upper), SHOULDER[1] + UPPER_ARM * Math.sin(upper)];
      return {
        'arm-left': wrap(deg(upper - UPPER_REST)),
        'arm-left-forearm': wrap(deg(angle(elbow, target) - upper)) - deg(forearmRest - UPPER_REST),
      };
    },
  };
}
const CHALK_ARM = armWith(CHALK_TIP);
const POINTER_ARM = armWith(POINTER_TIP);

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
const BOARD_SLOT_X = POSES.board.x + POSES.board.scale * SHOULDER[0]; // the shoulder at the slot
const BOARD_STRETCH = CHALK_ARM.stretch * POSES.board.scale; // a straight arm
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
function followTip(targets, outroStart) {
  const follow = lazyShoulder(reachBounds(targets[0]).near);
  const lazy = targets.map((target) => follow(target).x);
  const settled = lazy.map((x, k) =>
    k < outroStart ? x : lerp(lazy[outroStart], BOARD_SLOT_X, ease(progress(k, outroStart, OUTRO_WALK))),
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
  const points = [...$('s1', 'chalk-drawing').querySelectorAll('[data-point]')];
  if (points.length) return planPointer(points.map((node) => node.dataset.point.split(' ').map(Number)));
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
  const free = followTip(targets, frames.length - OUTRO);
  const freeGait = gaitOf(free, scale);
  const xs = withinReach(targets, free, freeGait, liftsFor(targets, free, freeGait));
  const gait = gaitOf(xs, scale);
  return { strokes, frames, xs, gait, lifts: liftsFor(targets, xs, gait), arm: CHALK_ARM };
}

// The pointer, in the left forearm under the fist so the fist covers its end; drawn like the one on the X header.
function addPointer() {
  const stick = (width, stroke) =>
    svgEl('line', {
      x1: HAND[0],
      y1: HAND[1],
      x2: POINTER_TIP[0],
      y2: POINTER_TIP[1],
      stroke,
      'stroke-width': width,
      'stroke-linecap': 'round',
    });
  const pointer = svgEl('g', { id: 's1-pointer' });
  pointer.append(
    stick(4.4, '#0d1828'),
    stick(2.4, '#b8642a'),
    svgEl('circle', { cx: POINTER_TIP[0], cy: POINTER_TIP[1], r: 2.4, fill: '#f4f1e8', stroke: '#0d1828', 'stroke-width': 1 }),
  );
  $('s1', 'chalk').after(pointer);
}

// The pointer opening: the board is already written. He stands at the slot without a step, raises the
// pointer from a loose hang, taps each point in document order, lowers it and turns to the viewer.
// rest is how far a frame sits in the rest pose: 1 hangs loose, 0 puts the tip on target.
function planPointer(points) {
  addPointer();
  const shoulder = [BOARD_SLOT_X, BOARD_SHOULDER_Y];
  const frames = [];
  const hold = (count, target, rest = 0) => {
    for (let k = 0; k < count; k++) frames.push({ target, rest });
  };
  const move = (from, to, count) => {
    for (let k = 1; k <= count; k++) frames.push({ target: mix(from, to, ease(k / count)) });
  };
  // Raising and lowering blend the joint angles rather than the tip, so the arm swings up in an arc.
  const swing = (target, from, to) => {
    for (let k = 1; k <= POINT_RAISE; k++) frames.push({ target, rest: lerp(from, to, ease(k / POINT_RAISE)) });
  };
  hold(POINT_HOLD, points[0], 1);
  swing(points[0], 1, 0);
  points.forEach((point, i) => {
    if (i) move(points[i - 1], point, POINT_TRAVEL);
    const back = mix(point, shoulder, POINTER_KNOCK / dist(point, shoulder));
    for (let k = 0; k < POINT_TAP; k++) frames.push({ target: mix(point, back, Math.sin((2 * Math.PI * k) / POINT_TAP) ** 2) });
    hold(POINT_DWELL, point);
  });
  swing(points.at(-1), 0, 1);
  hold(POINT_OUTRO, points.at(-1), 1);

  const xs = frames.map(() => BOARD_SLOT_X);
  return { strokes: [], frames, xs, gait: gaitOf(xs, POSES.board.scale), lifts: frames.map(() => 0), arm: POINTER_ARM };
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
  const { drawn, t, target, rest = 0 } = frames[k];
  strokes.forEach((stroke, i) => stroke.show(i < drawn ? 1 : i === drawn ? t : 0));

  const pose = POSES.board;
  const { x, y, legs, feet } = boardBody(plan, k);
  const reach = plan.arm.reach([(target[0] - x) / pose.scale, (target[1] - y) / pose.scale]);
  const arm = rest
    ? Object.fromEntries(Object.entries(reach).map(([part, v]) => [part, lerp(v, POINTER_REST_ARM[part], rest)]))
    : reach;
  // Turns to the board, back to the viewer at the end.
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
      ...arm,
    },
    eyes: pose.translate.eyes.map((v) => v * look),
    blink: blinkAt(k, 40),
    browLift: 2 * (1 - look),
    chalk: plan.arm === CHALK_ARM,
    feet,
  });
  if (plan.arm === POINTER_ARM) $('s1', 'pointer').setAttribute('transform', `rotate(${POINTER_REST_WRIST * rest} ${HAND.join(' ')})`);
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
  const screens = { desk: $('s2', 'screen').getBBox(), monitor: $('s3', 'screen').getBBox() };
  return {
    xs,
    gait,
    // He sits back with his feet planted, so he lands this far short of the slot; the chair,
    // pulled out by as much, then rolls him in.
    footX: xs[WALK] + seat.scale * ankleX(stopped),
    pulledOut: seat.scale * (ankleX(seated(seat)) - ankleX(stopped)),
    chair: $('s2', 'chair'),
    screens,
    // Scene 3's full view in desk px: the camera ends on it, so the cut to scene 3 lands on the same picture.
    zoomTo: mapBox(FULL_VIEW, screens.monitor, screens.desk),
    steam: $('s2', 'mug').querySelector('.steam'),
  };
}

// Maps a box from one scene to another where the rect `from` lands on the rect `to`.
function mapBox([x, y, width, height], from, to) {
  const scale = to.width / from.width;
  return [to.x + (x - from.x) * scale, to.y + (y - from.y) * scale, width * scale, height * scale];
}

const deskView = (plan, k) => zoomBox(FULL_VIEW, plan.zoomTo, ease(progress(k, SETTLED + TYPE, ZOOM)));

// Scene 3 as seen through the desk's screen: the same camera, in monitor px.
const monitorThroughDesk = (plan, k) => mapBox(deskView(plan, k), plan.screens.desk, plan.screens.monitor);

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
  plan.steam.setAttribute('transform', `translate(0 ${-1.5 * Math.sin((2 * Math.PI * k) / 40)})`);
  setViewBox('s2', deskView(plan, k));
}

// ---------------------------------------------------------------- scene 3: monitor

const dayOf = (iso) => new Date(`${iso}T00:00:00Z`);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const shortDay = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fullDay = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const cents = (price) => price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (value, text) => `${value < 0 ? '−' : '+'}${text}`;
// The CSS class that colours a mark like a candle that closed higher or lower.
const toneOf = (isUp) => (isUp ? 'candle-up' : 'candle-down');

function dayRange(first, last) {
  if (first.getUTCMonth() === last.getUTCMonth()) return `${shortDay(first)}–${last.getUTCDate()}`;
  return `${shortDay(first)} – ${shortDay(last)}`;
}

function textEl(text, attrs, tag = 'text') {
  const node = svgEl(tag, attrs);
  node.textContent = text;
  return node;
}

// Fail on bad data instead of drawing a chart that looks right and isn't.
function checkMonitorData() {
  const { candles } = BTC;
  if (!Array.isArray(candles) || candles.length < 2) throw new Error('btc: need at least 2 candles');
  candles.forEach((c, i) => {
    const prices = [c.open, c.high, c.low, c.close];
    const inRange = c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close);
    const hasVolume = Number.isFinite(c.volume) && c.volume >= 0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.day) || !prices.every(Number.isFinite) || !inRange || !hasVolume) {
      throw new Error(`btc: bad candle ${JSON.stringify(c)}`);
    }
    // One slot per UTC day, so a missing day would bend the time axis.
    if (i && dayOf(c.day) - dayOf(candles[i - 1].day) !== DAY_MS) throw new Error(`btc: no candle between ${candles[i - 1].day} and ${c.day}`);
  });
  if (!candles.some((c) => c.volume > 0)) throw new Error('btc: no volume on any day');
  const { ideas } = IDEAS;
  if (!Array.isArray(ideas) || !ideas.length || ideas.length > 4) throw new Error('ideas: the cards fit 1 to 4 models');
  if (new Set(ideas.map((idea) => idea.model)).size !== ideas.length) throw new Error('ideas: one idea per model');
  for (const { model, call, reason } of ideas) {
    if (!Object.hasOwn(MODEL_COLORS, model)) throw new Error(`ideas: unknown model ${model}`);
    if (!Object.hasOwn(CALL_LABELS, call)) throw new Error(`ideas: ${model} call must be up or down, got ${call}`);
    if (typeof reason !== 'string' || !reason.trim()) throw new Error(`ideas: ${model} has no reason`);
  }
}

// Slots are whole UTC days: the candles, the days still to come before Monday, then Mon-Fri.
function chartScale() {
  const { candles } = BTC;
  const last = dayOf(candles.at(-1).day);
  const toMonday = (8 - last.getUTCDay()) % 7 || 7;
  const weekStart = candles.length + toMonday - 1;
  const slot = PLOT.width / (weekStart + WEEK_DAYS);
  const low = Math.min(...candles.map((c) => c.low));
  const high = Math.max(...candles.map((c) => c.high));
  const [bottom, top] = [low - (high - low) * PRICE_PAD, high + (high - low) * PRICE_PAD];
  // The finest round step that keeps the price scale to MAX_TICKS lines.
  const step = TICK_STEPS.find((s) => Math.floor(top / s) - Math.ceil(bottom / s) < MAX_TICKS) ?? TICK_STEPS.at(-1);
  const firstTick = Math.ceil(bottom / step) * step;
  return {
    candles,
    slot,
    weekStart,
    monday: addDays(last, toMonday),
    ticks: Array.from({ length: Math.floor((top - firstTick) / step) + 1 }, (_, i) => firstTick + i * step),
    maxVolume: Math.max(...candles.map((c) => c.volume)),
    x: (i) => PLOT.x + (i + 0.5) * slot,
    y: (price) => PLOT.y + ((top - price) / (top - bottom)) * (PLOT.height - VOLUME_ROOM),
  };
}

// The chart laid out like a trading screen: price scale on the right, dates under the pane in UTC,
// the symbol row with the timeframe above it and the last candle's OHLC under that.
function drawChartFrame(scale, parent) {
  const frame = parent.appendChild(svgEl('g'));
  const bottom = PLOT.y + PLOT.height;
  const lastY = scale.y(scale.candles.at(-1).close);
  for (const price of scale.ticks) {
    const y = scale.y(price);
    frame.append(svgEl('line', { class: 'grid', x1: PLOT.x, y1: y, x2: PANE_RIGHT, y2: y }));
    // The last-price tag covers the scale there, so the label under it is left out.
    if (Math.abs(y - lastY) >= TAG.height) frame.append(textEl(price.toLocaleString('en-US'), { class: 'scale num', x: SCALE_X, y: y + 3 }));
  }
  drawTimeAxis(scale, frame);
  frame.append(
    svgEl('line', { class: 'axis', x1: PLOT.x, y1: bottom, x2: PANE_RIGHT, y2: bottom }),
    svgEl('line', { class: 'axis', x1: PANE_RIGHT, y1: PLOT.y, x2: PANE_RIGHT, y2: bottom }),
    textEl('UTC', { class: 'scale', x: SCALE_X, y: DATE_Y }),
  );
  drawToolbar(frame);
  drawLegend(scale.candles, frame);
  return frame;
}

// A grid line and a date on every Monday, as a daily chart's time scale has; next week carries its own dates.
function drawTimeAxis(scale, parent) {
  scale.candles.forEach((c, i) => {
    const [day, x] = [dayOf(c.day), scale.x(i)];
    if (day.getUTCDay() !== 1 || x - PLOT.x < DATE_ROOM) return;
    parent.append(
      svgEl('line', { class: 'grid', x1: x, y1: PLOT.y, x2: x, y2: PLOT.y + PLOT.height }),
      textEl(shortDay(day), { class: 'scale', x, y: DATE_Y, 'text-anchor': 'middle' }),
    );
  });
}

// The symbol row: coin mark, pair, timeframe and exchange, and the timeframe buttons with 1D pressed.
function drawToolbar(parent) {
  parent.append(
    svgEl('circle', { cx: COIN.x, cy: COIN.y, r: COIN.r, fill: '#f7931a' }),
    textEl('₿', { class: 'coin', x: COIN.x, y: COIN.y + 3.2, 'text-anchor': 'middle', transform: `rotate(${COIN.tilt} ${COIN.x} ${COIN.y})` }),
  );
  const pair = parent.appendChild(textEl('BTC/USD', { class: 't-primary', x: COIN.x + 11, y: TOOLBAR_Y }));
  const afterPair = COIN.x + 11 + pair.getComputedTextLength() + 7;
  parent.append(textEl(`Bitcoin / U.S. Dollar · ${TIMEFRAME} · Coinbase`, { class: 't-muted', x: afterPair, y: TOOLBAR_Y }));
  TIMEFRAMES.forEach((label, i) => {
    const x = PILL.right - (TIMEFRAMES.length - i) * PILL.step + (PILL.step - PILL.width);
    const isOn = label === TIMEFRAME;
    if (isOn) parent.append(svgEl('rect', { class: 'pill-on', x, y: TOOLBAR_Y - 10, width: PILL.width, height: PILL.height, rx: 2.5 }));
    parent.append(textEl(label, { class: isOn ? 'pill-text-on' : 'pill-text', x: x + PILL.width / 2, y: TOOLBAR_Y - 0.5, 'text-anchor': 'middle' }));
  });
}

// The last candle's OHLC, its change on the day before and its volume, coloured like the candle.
function drawLegend(candles, parent) {
  const [before, last] = candles.slice(-2);
  const change = last.close - before.close;
  const percent = `${Math.abs((change / before.close) * 100).toFixed(2)}%`;
  const candleTone = toneOf(last.close >= last.open);
  const fields = [
    ['O', cents(last.open), candleTone],
    ['H', cents(last.high), candleTone],
    ['L', cents(last.low), candleTone],
    ['C', cents(last.close), candleTone],
    ['', `${signed(change, cents(Math.abs(change)))} (${signed(change, percent)})`, toneOf(change >= 0)],
    ['Vol', `${(last.volume / 1000).toFixed(2)}K BTC`, candleTone],
  ];
  const legend = parent.appendChild(textEl(fullDay(dayOf(last.day)), { class: 'legend num', x: PLOT.x, y: LEGEND_Y }));
  for (const [label, value, tone] of fields) {
    if (label) legend.append(textEl(label, { dx: 8 }, 'tspan'));
    legend.append(textEl(value, { class: `toned ${tone}`, dx: label ? 2.5 : 8 }, 'tspan'));
  }
}

function drawCandles(scale, parent) {
  const body = scale.slot * BODY;
  const bottom = PLOT.y + PLOT.height;
  return scale.candles.map((c, i) => {
    const candle = parent.appendChild(svgEl('g', { class: toneOf(c.close >= c.open) }));
    const x = scale.x(i);
    const [top, base] = [scale.y(Math.max(c.open, c.close)), scale.y(Math.min(c.open, c.close))];
    const volume = (c.volume / scale.maxVolume) * VOLUME_HEIGHT;
    candle.append(
      svgEl('rect', { class: 'candle-volume', x: x - body / 2, y: bottom - volume, width: body, height: volume }),
      svgEl('line', { class: 'candle-wick', x1: x, y1: scale.y(c.high), x2: x, y2: scale.y(c.low) }),
      svgEl('rect', { class: 'candle-body', x: x - body / 2, y: top, width: body, height: Math.max(1, base - top) }),
    );
    return candle;
  });
}

// The level every arrow starts from: a dotted line at the last close and its tag on the price scale.
function drawLastPrice(scale, parent) {
  const last = scale.candles.at(-1);
  const tone = toneOf(last.close >= last.open);
  const y = scale.y(last.close);
  const group = parent.appendChild(svgEl('g'));
  group.append(svgEl('line', { class: `price-line ${tone}`, x1: PLOT.x, y1: y, x2: PANE_RIGHT, y2: y }));
  const tag = group.appendChild(svgEl('rect', { class: `toned ${tone}`, x: PANE_RIGHT, y: y - TAG.height / 2, height: TAG.height, rx: 2 }));
  const label = group.appendChild(textEl(cents(last.close), { class: 'price-tag num', x: PANE_RIGHT + TAG.pad, y: y + 3 }));
  tag.setAttribute('width', label.getComputedTextLength() + 2 * TAG.pad);
  return group;
}

function drawWeek(scale, parent) {
  const week = parent.appendChild(svgEl('g'));
  const x = PLOT.x + scale.weekStart * scale.slot;
  const width = WEEK_DAYS * scale.slot;
  const mid = x + width / 2;
  week.append(svgEl('rect', { class: 'week', x, y: PLOT.y, width, height: PLOT.height, rx: 3 }));
  // At the bottom of the zone: the arrow tips stay above the volume strip, so they never cross it.
  week.append(textEl('next week', { class: 'scale', x: mid, y: PLOT.y + PLOT.height - 4, 'text-anchor': 'middle' }));
  const friday = addDays(scale.monday, WEEK_DAYS - 1);
  week.append(textEl(dayRange(scale.monday, friday), { class: 'scale week-dates', x: mid, y: DATE_Y, 'text-anchor': 'middle' }));
  return week;
}

function robotHead(color) {
  const head = svgEl('g');
  head.append(
    svgEl('line', { x1: 0, y1: -14.28, x2: 0, y2: -22.28, stroke: color, 'stroke-width': 3 }),
    svgEl('circle', { cx: 0, cy: -24.28, r: 3.5, fill: color }),
    svgEl('rect', { x: -17, y: -14.28, width: 34, height: 28.56, rx: 8.84, fill: '#0b1024', stroke: color, 'stroke-width': 3 }),
    svgEl('circle', { cx: -6.46, cy: -2, r: 3.06, fill: color }),
    svgEl('circle', { cx: 6.46, cy: -2, r: 3.06, fill: color }),
    svgEl('path', { d: 'M-4.76 5.712 Q0 9.1392 4.76 5.712', fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
  );
  return head;
}

// A dashed arrow from the last close to the end of the week, the model's head and name at the tip.
// Ideas with the same call fan out by FAN in file order, so arrows never sit on top of each other.
function drawIdeaArrow(scale, { model, call }, index, rank, parent) {
  const color = MODEL_COLORS[model];
  const from = [scale.x(scale.candles.length - 1), scale.y(scale.candles.at(-1).close)];
  const weekRight = PLOT.x + (scale.weekStart + WEEK_DAYS) * scale.slot;
  const tipY = from[1] + (call === 'up' ? -1 : 1) * FAN * (rank + 1);
  const to = [weekRight - 6, clamp(tipY, PLOT.y + 6, PLOT.y + PLOT.height - 6)];
  const base = mix(to, from, ARROW_HEAD / dist(from, to));
  const [nx, ny] = [-Math.sin(angle(from, to)) * 3.5, Math.cos(angle(from, to)) * 3.5];
  const arrow = parent.appendChild(svgEl('g'));
  arrow.append(
    svgEl('line', { x1: from[0], y1: from[1], x2: base[0], y2: base[1], stroke: color, 'stroke-width': 2, 'stroke-dasharray': '5 4' }),
    svgEl('polygon', { points: `${to} ${base[0] + nx},${base[1] + ny} ${base[0] - nx},${base[1] - ny}`, fill: color }),
  );
  const head = parent.appendChild(robotHead(color));
  const name = parent.appendChild(textEl(model, { class: 't-secondary', x: weekRight + 21, y: to[1] + 3.5, style: 'font-size: 10px' }));
  return {
    reveal: clipTo(arrow, `s3-reveal-idea-${index}`, [from[0] - 2, PLOT.y - 10, 0, PLOT.height + 20]),
    width: to[0] - from[0] + 4,
    head,
    at: [weekRight + 11, to[1]],
    name,
  };
}

// Greedy word wrap measured on the page, so it matches the font the frame renders with.
function wrapLines(probe, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const longer = line ? `${line} ${word}` : word;
    probe.textContent = longer;
    if (line && probe.getComputedTextLength() > width) {
      lines.push(line);
      line = word;
    } else {
      line = longer;
    }
  }
  return [...lines, line];
}

function drawIdeaCard({ model, call, reason }, index, parent) {
  const color = MODEL_COLORS[model];
  const x = CARD.x + index * (CARD.width + CARD.gap);
  const { y } = CARD;
  const card = parent.appendChild(svgEl('g'));
  card.append(
    svgEl('rect', { class: 'card', x, y, width: CARD.width, height: CARD.height, rx: 3 }),
    svgEl('rect', { x, y: y + 4, width: 3, height: CARD.height - 8, rx: 1.5, fill: color }),
    textEl(model, { class: 't-primary', x: x + 28, y: y + 21 }),
    textEl(CALL_LABELS[call], { class: 't-primary', x: x + CARD.width - 8, y: y + 21, 'text-anchor': 'end' }),
  );
  const head = card.appendChild(robotHead(color));
  head.setAttribute('transform', `translate(${x + 16} ${y + 17}) scale(${HEAD_SCALE})`);
  const text = card.appendChild(svgEl('text', { class: 't-secondary', style: 'font-size: 10px' }));
  const lines = wrapLines(text, reason, CARD.width - 18);
  if (lines.length > REASON_LINES) throw new Error(`ideas: ${model} reason needs ${lines.length} lines, the card fits ${REASON_LINES}`);
  text.textContent = '';
  text.append(...lines.map((line, i) => textEl(line, { x: x + 10, y: y + 35 + 12 * i }, 'tspan')));
  return card;
}

function planMonitor() {
  checkMonitorData();
  const scale = chartScale();
  const chart = $('s3', 'chart');
  const rankOf = (i) => IDEAS.ideas.slice(0, i).filter((idea) => idea.call === IDEAS.ideas[i].call).length;
  return {
    frame: drawChartFrame(scale, chart),
    candles: drawCandles(scale, chart),
    lastPrice: drawLastPrice(scale, chart),
    week: drawWeek(scale, $('s3', 'week')),
    ideas: IDEAS.ideas.map((idea, i) => ({
      ...drawIdeaArrow(scale, idea, i, rankOf(i), $('s3', 'ideas')),
      card: drawIdeaCard(idea, i, $('s3', 'cards')),
    })),
  };
}

function riseIn(node, t) {
  node.style.opacity = t;
  node.setAttribute('transform', `translate(0 ${(1 - t) * 6})`);
}

// Draws the arrow over `frames`, then pops the head and the name in at its tip.
function revealIdea({ reveal, width, head, at, name }, k, frames) {
  reveal.setAttribute('width', width * ease(progress(k, 0, frames)));
  const popped = ease(progress(k, frames - 2, POP));
  head.setAttribute('transform', `translate(${at[0]} ${at[1]}) scale(${HEAD_SCALE * popped})`);
  name.style.opacity = popped;
}

function renderMonitor(plan, k, view = FULL_VIEW) {
  setViewBox('s3', view);
  plan.frame.style.opacity = progress(k, FRAME_START, FADE);
  const step = CANDLES_SWEEP / Math.max(1, plan.candles.length - 1);
  plan.candles.forEach((candle, i) => riseIn(candle, ease(progress(k, CANDLES_START + i * step, CANDLE_RISE))));
  plan.lastPrice.style.opacity = progress(k, CANDLES_START + CANDLES_SWEEP, FADE);
  plan.week.style.opacity = progress(k, WEEK_START, FADE);
  plan.ideas.forEach((idea, i) => {
    const start = IDEAS_START + i * IDEA_STEP;
    revealIdea(idea, k - start, ARROW_FRAMES);
    riseIn(idea.card, ease(progress(k, start + ARROW_FRAMES, CARD_SLIDE)));
  });
}

// ---------------------------------------------------------------- hook

// The two captions, written from the ideas: the match-up, then how the calls split.
// Each part is [text, class]; the call words wear the candle colours, next to the word itself.
function hookCaptions(ideas) {
  const n = ideas.length;
  const split = Object.keys(CALL_CLASSES)
    .map((call) => ({ call, k: ideas.filter((idea) => idea.call === call).length }))
    .filter(({ k }) => k > 0)
    .flatMap(({ call, k }, i) => [
      [`${i ? ' ' : ''}${k === n && n > 1 ? 'All ' : ''}${k} ${k === 1 ? 'says' : 'say'} `],
      [call, CALL_CLASSES[call]],
      ['.'],
    ]);
  return [
    { title: [[`${n} ${n === 1 ? 'AI' : 'AIs'} vs a coin flip`]], sub: "Next week's Bitcoin calls" },
    { title: split, sub: 'Friday decides.' },
  ];
}

function drawCaption({ title, sub }, x, parent) {
  const group = parent.appendChild(svgEl('g'));
  const line = group.appendChild(svgEl('text', { class: 'hook-title', x, y: CAPTION.y, 'text-anchor': 'middle' }));
  line.append(...title.map(([text, cls]) => textEl(text, cls ? { class: cls } : {}, 'tspan')));
  group.append(textEl(sub, { class: 'hook-sub', x: CAPTION.x, y: CAPTION.subY, 'text-anchor': 'middle' }));
  return { group, width: line.getComputedTextLength() };
}

// The first title moves left so that it and the coin after it sit centred together.
function planHook() {
  const [first, second] = hookCaptions(IDEAS.ideas);
  const shift = COIN_GAP / 2 + COIN_R;
  const matchUp = drawCaption(first, CAPTION.x - shift, $('s0', 'beats'));
  return {
    beats: [matchUp.group, drawCaption(second, CAPTION.x, $('s0', 'beats')).group],
    coinX: CAPTION.x - shift + matchUp.width / 2 + COIN_GAP + COIN_R,
  };
}

// The finished screen, held close while the arrows shoot again, then pulled back to show the room.
function renderHookScreen(monitor, h) {
  renderMonitor(monitor, MONITOR, zoomBox(HOOK_VIEW, FULL_VIEW, ease(progress(h, HOOK_PULL_START, HOOK_PULL))));
  monitor.ideas.forEach((idea, i) => revealIdea(idea, h - HOOK_ARROWS - i * HOOK_ARROW_STEP, HOOK_ARROW_FRAMES));
}

function renderHook({ beats: [first, second], coinX }, h) {
  const firstShown = 1 - progress(h, BEAT_SWAP - BEAT_OUT, BEAT_OUT);
  first.style.opacity = firstShown;
  const landed = ease(progress(h, BEAT_SWAP, BEAT_IN));
  const size = 1 + BEAT_POP * (1 - landed);
  second.style.opacity = landed;
  second.setAttribute('transform', `translate(${CAPTION.x} ${CAPTION.y}) scale(${size}) translate(${-CAPTION.x} ${-CAPTION.y})`);
  // A toss: up and back down, spinning while in the air.
  const tossed = progress(h, 0, COIN_FLIGHT);
  const facing = Math.cos(2 * Math.PI * COIN_TURNS * tossed);
  const coin = $('s0', 'coin');
  coin.style.opacity = firstShown;
  coin.setAttribute('transform', `translate(${coinX} ${CAPTION.coinY - COIN_TOSS * 4 * tossed * (1 - tossed)})`);
  $('s0', 'coin-spin').setAttribute('transform', `scale(${Math.max(Math.abs(facing), COIN_EDGE)} 1)`);
  $('s0', 'coin-face').setAttribute('fill', facing >= 0 ? COIN_FACES.front : COIN_FACES.back);
  $('s0', 'coin-text').style.opacity = facing >= 0 ? 1 : 0;
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
  const landed = ease(progress(k, CTA.start, BEAT_IN));
  const cta = $('s4', 'cta');
  cta.style.opacity = landed;
  cta.setAttribute('transform', `translate(${CTA.x} ${CTA.y}) scale(${1 + BEAT_POP * (1 - landed)}) translate(${-CTA.x} ${-CTA.y})`);
}

// ---------------------------------------------------------------- timeline

let episode;

function setup() {
  const board = planBoard();
  const boardEnd = HOOK + board.frames.length;
  const deskStart = boardEnd - DESK_SKIP; // desk frame 0; the cut from the board lands on desk frame DESK_SKIP
  const deskEnd = deskStart + DESK_LENGTH;
  const screenOn = deskStart + SETTLED; // he starts typing
  const monitorStart = screenOn + TYPE; // the camera starts flying in
  const endStart = monitorStart + MONITOR - END_FADE;
  const desk = planDesk();
  episode = { hook: planHook(), board, desk, monitor: planMonitor(), boardEnd, deskStart, deskEnd, screenOn, monitorStart, endStart };
  window.TOTAL_FRAMES = endStart + END;
  // Frame ranges, end exclusive, for rendering one scene at a time.
  window.SCENES = {
    hook: [0, HOOK],
    board: [HOOK, boardEnd],
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
  // Shoulder to tip target as a share of a straight arm; frames with the pointer at rest hang off the IK.
  const shares = board.frames.flatMap(({ target, rest }, k) => {
    if (rest) return [];
    const { x, y } = boardBody(board, k);
    const shoulder = [x + POSES.board.scale * SHOULDER[0], y + POSES.board.scale * SHOULDER[1]];
    return [dist(shoulder, target) / (board.arm.stretch * POSES.board.scale)];
  });
  // How far the tip falls short of its target, or past it where the arm can't fold that close, scene px.
  const { stretch, fold } = board.arm;
  const misses = shares.map((share) => Math.max(0, (share - 1) * stretch, fold - share * stretch) * POSES.board.scale);
  // Frames where the reach clamp pulled the shoulder inside the head clearance.
  const crowded = board.frames.filter(({ target: [tx, ty] }, k) => board.xs[k] - tx < minDxFor(ty) - 0.5).length;
  return {
    frames: window.TOTAL_FRAMES,
    boardFrames: board.frames.length,
    boardMaxWalk: +Math.max(...board.xs.map((x, k) => (k ? Math.abs(x - board.xs[k - 1]) : 0))).toFixed(2),
    boardMaxLift: +Math.max(...board.lifts).toFixed(2),
    boardLiftFrames: board.lifts.filter((v) => v > 0.5).length,
    boardTipMiss: +Math.max(...misses).toFixed(2),
    boardReach: [Math.min(...shares), Math.max(...shares)].map((v) => +v.toFixed(3)),
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
  const { hook, board, desk, monitor, boardEnd, deskStart, deskEnd, screenOn, monitorStart, endStart } = episode;
  const hooked = f < HOOK;
  const hookShown = 1 - progress(f + 1, HOOK - HOOK_DISSOLVE, HOOK_DISSOLVE);
  const atDesk = f >= boardEnd && f < deskEnd;
  showLayer('board', f >= HOOK - HOOK_DISSOLVE && f < boardEnd ? 1 : 0, () => renderBoard(board, Math.max(0, f - HOOK)));
  showLayer('desk', atDesk ? 1 : 0, () => renderDesk(desk, f - deskStart));
  showLayer('monitor', hooked ? hookShown : progress(f + 1, screenOn, SCREEN_ON), () => {
    // At the desk only the screen shows, over the desk's own; the desk draws the room around it.
    $('s3', 'room').style.visibility = atDesk ? 'hidden' : 'visible';
    if (hooked) renderHookScreen(monitor, f);
    else renderMonitor(monitor, f - monitorStart, atDesk ? monitorThroughDesk(desk, f - deskStart) : FULL_VIEW);
  });
  showLayer('hook', hooked ? hookShown : 0, () => renderHook(hook, f));
  showLayer('end', progress(f + 1, endStart, END_FADE), () => renderEnd(f - endStart));
  document.getElementById('flash').style.opacity = 1 - clamp(Math.abs(f + 0.5 - boardEnd) / FLASH, 0, 1);
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

// Web fonts load only once something lays out with them; load every face up front so frame one has them.
window.episodeReady = Promise.all([...document.fonts].map((face) => face.load()))
  .then(() => document.fonts.ready)
  .then(setup);
