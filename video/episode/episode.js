/*
 * Grandpa episode preview: hook -> board -> desk -> monitor -> end card. A story page may leave the
 * board or the desk out, run its own hook length and lay a question over the cut from its hook to the monitor.
 * renderFrame(f) is pure in f, so any frame renders the same on its own. It stands in for the
 * Task 6 Remotion composition; the same logic ports to useCurrentFrame().
 * Units: scene px (640x360 viewBox) unless a name says "local" (grandpa.svg px).
 */
'use strict';

const POSES = JSON.parse(document.getElementById('poses').textContent);
const BTC = JSON.parse(document.getElementById('btc').textContent);
const IDEAS = JSON.parse(document.getElementById('ideas').textContent);
const LOGOS = JSON.parse(document.getElementById('logos').textContent); // the site's model logos, by file name
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
// Kept short: the board is a quick beat between the hook and the calls, about 2 s with three points.
const POINT_HOLD = 0;
const POINT_RAISE = 6; // frames to raise the pointer from the rest pose, and to lower it back; at least 1
const POINT_TRAVEL = 6; // frames from one point to the next
const POINT_TAP = 8; // two quick taps
const POINT_DWELL = 2;
const POINT_OUTRO = 4; // frames he holds the lowered pointer, facing the viewer, before the cut
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

// Scene 3: the monitor. A real BTC daily chart full screen, laid out like a trading screen, the cards in a
// column on the right, then each AI's call for the week drawn over it one at a time, 1.5 s apart.
// The chart builds under the hook, so the monitor starts complete; with a desk it starts with the desk camera's
// flight in. The last card is in on frame 169; the screen holds over 2 s after it so it can be read.
const MONITOR = 250;
const CHART_DAYS = 30; // the last days of the candles file, so each slot is wide enough to read as a candle
const PLOT = { x: 12, y: 50, width: 270, height: 250 }; // the day slots: the candles, the gap days, next week
const NAME_LANE = 54; // the pane runs on past next week, where each arrow's model name sits at its tip
const PANE_RIGHT = PLOT.x + PLOT.width + NAME_LANE;
const SCALE_X = PANE_RIGHT + 5;
const PRICE_PAD = 0.06; // share of the price range kept free above and below the candles
const VOLUME_ROOM = 30; // px at the bottom of the pane kept below the lowest candle, where the volume bars mostly sit
const VOLUME_HEIGHT = 44;
const TICK_STEPS = [500, 1000, 2000, 2500, 5000, 10000]; // dollars between price grid lines
const MAX_TICKS = 6;
const BODY = 0.7; // candle body width, share of a day slot
const TAG = { height: 15, pad: 4 }; // the last price, on the price scale
const DATE_ROOM = 16; // half a date label: a Monday closer than this to the pane's left edge goes unlabelled
const WEEK_DAYS = 5; // Mon-Fri
const DAY_MS = 86400000;
const TOOLBAR_Y = 25;
const DATE_Y = 316;
const TIMEFRAME = '1D'; // the candles are UTC days
const COIN = { x: 22, y: 20, r: 8, tilt: 14 }; // the orange bitcoin mark before the pair
const FAN = 28; // px between arrow tips with the same call; the angle is not a size of move
const ARROW_HEAD = 9;
const CARD = { x: 392, y: 47, width: 234, height: 65, gap: 5 }; // stacked down the right of the screen
// The logo sits on a dark tile before the name, as on the site: the logo about two thirds of the tile.
const CARD_LOGO = { x: 11, y: 9, tile: 22, size: 14 };
// The name, the call and the confidence share the top row with at least this much between the name and the call;
// the reason gets the rows under them, its baselines by line count.
const CARD_LABEL_GAP = 6;
const REASON_BASELINES = [[48], [44, 59]];
const REASON_LINES = REASON_BASELINES.length;
const REASON_WORDS = 10; // what two rows hold at the smallest size; the card stays up after its 1.5 s
const CARD_TEXT_INSET = 28; // the reason rows are this much narrower than their card, inside its padding
// Every card reads its reason at one size: the largest of these that keeps each reason in its rows.
const REASON_SIZES = [14, 13, 12, 11];
const MODEL_COLORS = { ChatGPT: '#199e70', Claude: '#d95926', Gemini: '#3987e5', Grok: '#c98500' };
const CALL_LABELS = { up: '↑ up', down: '↓ down' };
const FADE = 10;
// The chart build, in hook frames.
const CANDLES_START = 4;
const CANDLES_SWEEP = 28; // frames from the first candle rising to the last
const CANDLE_RISE = 8;
const WEEK_START = 44;
// The calls, in monitor frames: each arrow draws, then its card pops in as the name lands at the tip.
const IDEAS_START = 14;
const IDEA_STEP = 45;
const ARROW_FRAMES = 12;
const POP = 6;
const CARD_POP = 8;
// Where the board cuts to the monitor: a story episode with a board lands 28 frames into its monitor.
const MONITOR_SKIP = 28;

// Hook: the cold open, for a feed that plays muted. It only asks the question: one caption at a time over
// the chart building full screen, its week still empty, so the calls show first on the monitor.
// Then the captions dissolve and the same screen carries on as the monitor. The first caption stays up 2 s.
const HOOK = 116;
const HOOK_DISSOLVE = 16; // the last frames of the hook, fading over the board, else the desk, else the monitor
const BEAT_SWAP = 60; // the second caption replaces the first
const BEAT_OUT = 3;
const BEAT_IN = 5;
const BEAT_POP = 0.12; // the second caption lands from this much larger
const CAPTION = { x: 320, y: 50, coinY: 39, maxWidth: 600 };
const CALL_CLASSES = { up: 'hook-up', down: 'hook-down' };
const COIN_R = 24; // as drawn in the hook layer
const COIN_GAP = 10;
const COIN_FLIGHT = 30; // the toss as its caption lands, then it rests face up
const COIN_TURNS = 2; // whole turns, so it lands on the 50% side
const COIN_TOSS = 10; // px the coin rises and falls
const COIN_EDGE = 0.06; // the thinnest the coin gets edge-on, share of its width
const COIN_FACES = { front: '#f2c14e', back: '#d9a33a' };

// Story question, on a page built with one: its plate fades in as the hook starts to dissolve, quicker than
// the screen lights up behind it, so the screen's header never shows through; its words come in once the
// plate is solid and go before it fades, so nothing shows through them; its answers land a beat later about
// (x, y), and it clears as the story gets going.
const QUESTION = { lead: HOOK_DISSOLVE, fade: 4, answers: 24, length: 70, x: 320, y: 68 };

// End card.
const END = 105;
const END_FADE = 12;
// Grandpa and the words come in only once the card is solid, so nothing of them shows over the monitor.
const END_IN = 6;
const CTA = { x: 200, y: 150, start: END_FADE + 6 }; // the question lands after the rest of the card, from BEAT_POP larger
// The call episode's card builds line by line after it is solid, in frames from the card starting to fade in:
// the question pops, the reply rises, the arrow draws down to the reply button and keeps nodding on the beat.
const END_STEPS = { ask: END_FADE + 4, reply: END_FADE + 14, arrow: END_FADE + 20, lead: END_FADE + 30, ledger: END_FADE + 38 };
const END_RISE = 8;
const END_ARROW_DRAW = 10;
const ARROW_NOD = { depth: 3, ramp: 6, beat: 18 }; // px down, frames to reach it, frames per beat at 100 bpm
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
const dollars = (price) => Math.round(price).toLocaleString('en-US');
const signed = (value, text) => `${value < 0 ? '−' : '+'}${text}`;
// The CSS class that colours a mark like a candle that closed higher or lower.
const toneOf = (isUp) => (isUp ? 'candle-up' : 'candle-down');

function dayRange(first, last) {
  if (first.getUTCMonth() === last.getUTCMonth()) return `${shortDay(first)}–${last.getUTCDate()}`;
  return `${shortDay(first)} – ${shortDay(last)}`;
}

// The Mon-Fri the calls cover, as every scene writes it, e.g. "Nov 2–6".
const weekLabel = (scale) => dayRange(scale.monday, addDays(scale.monday, WEEK_DAYS - 1));

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
  for (const { model, name, call, confidence, reason } of ideas) {
    if (!Object.hasOwn(MODEL_COLORS, model)) throw new Error(`ideas: unknown model ${model}`);
    if (!Object.hasOwn(LOGOS, model.toLowerCase())) throw new Error(`ideas: no logo for ${model}`);
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) throw new Error(`ideas: ${model} name must be a non-empty line`);
    if (!Object.hasOwn(CALL_LABELS, call)) throw new Error(`ideas: ${model} call must be up or down, got ${call}`);
    // The same range as the ledger's confidence.
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) throw new Error(`ideas: ${model} confidence must be a number from 0 to 100`);
    if (typeof reason !== 'string' || !reason.trim()) throw new Error(`ideas: ${model} has no reason`);
    const words = reason.trim().split(/\s+/).length;
    if (words > REASON_WORDS) throw new Error(`ideas: ${model} reason has ${words} words, the card reads ${REASON_WORDS}`);
  }
}

// Slots are whole UTC days: the last CHART_DAYS candles, the days still to come before Monday, then Mon-Fri.
function chartScale() {
  const candles = BTC.candles.slice(-CHART_DAYS);
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
// the symbol row with the timeframe above it.
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

// The symbol row: coin mark, pair, timeframe and exchange.
function drawToolbar(parent) {
  parent.append(
    svgEl('circle', { cx: COIN.x, cy: COIN.y, r: COIN.r, fill: '#f7931a' }),
    textEl('₿', { class: 'coin', x: COIN.x, y: COIN.y + 4, 'text-anchor': 'middle', transform: `rotate(${COIN.tilt} ${COIN.x} ${COIN.y})` }),
  );
  const pairX = COIN.x + COIN.r + 6;
  const pair = parent.appendChild(textEl('BTC/USD', { class: 'pair', x: pairX, y: TOOLBAR_Y }));
  const afterPair = pairX + pair.getComputedTextLength() + 8;
  parent.append(textEl(`Bitcoin / U.S. Dollar · ${TIMEFRAME} · Coinbase`, { class: 't-muted', x: afterPair, y: TOOLBAR_Y }));
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
  const label = group.appendChild(textEl(dollars(last.close), { class: 'price-tag num', x: PANE_RIGHT + TAG.pad, y: y + 4 }));
  tag.setAttribute('width', label.getComputedTextLength() + 2 * TAG.pad);
  return group;
}

function drawWeek(scale, parent) {
  const week = parent.appendChild(svgEl('g'));
  const x = PLOT.x + scale.weekStart * scale.slot;
  const width = WEEK_DAYS * scale.slot;
  const mid = x + width / 2;
  week.append(
    svgEl('rect', { class: 'week', x, y: PLOT.y, width, height: PLOT.height, rx: 3 }),
    textEl(weekLabel(scale), { class: 'scale week-dates', x: mid, y: DATE_Y, 'text-anchor': 'middle' }),
  );
  return week;
}

// The model's logo on its dark tile, its top left corner at [x, y].
function modelLogo(model, [x, y]) {
  const logo = svgEl('g');
  const mark = new DOMParser().parseFromString(LOGOS[model.toLowerCase()], 'image/svg+xml').documentElement;
  const inset = (CARD_LOGO.tile - CARD_LOGO.size) / 2;
  Object.entries({ x: x + inset, y: y + inset, width: CARD_LOGO.size, height: CARD_LOGO.size }).forEach(([k, v]) => mark.setAttribute(k, v));
  logo.append(
    svgEl('rect', { class: 'card-logo', x, y, width: CARD_LOGO.tile, height: CARD_LOGO.tile, rx: 5 }),
    document.importNode(mark, true),
  );
  return logo;
}

// A dashed arrow from the last close to the end of the week, the model's name in the lane at the tip.
// Ideas with the same call fan out by FAN in file order, so arrows never sit on top of each other.
function drawIdeaArrow(scale, { model, name: label, call }, index, rank, parent) {
  const color = MODEL_COLORS[model];
  const from = [scale.x(scale.candles.length - 1), scale.y(scale.candles.at(-1).close)];
  const weekRight = PLOT.x + (scale.weekStart + WEEK_DAYS) * scale.slot;
  const tipY = from[1] + (call === 'up' ? -1 : 1) * FAN * (rank + 1);
  const to = [weekRight - 6, clamp(tipY, PLOT.y + 6, PLOT.y + PLOT.height - 6)];
  const base = mix(to, from, ARROW_HEAD / dist(from, to));
  const [nx, ny] = [-Math.sin(angle(from, to)) * (ARROW_HEAD / 2), Math.cos(angle(from, to)) * (ARROW_HEAD / 2)];
  const arrow = parent.appendChild(svgEl('g'));
  arrow.append(
    svgEl('line', { x1: from[0], y1: from[1], x2: base[0], y2: base[1], stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }),
    svgEl('polygon', { points: `${to} ${base[0] + nx},${base[1] + ny} ${base[0] - nx},${base[1] - ny}`, fill: color }),
  );
  const name = parent.appendChild(textEl(label ?? model, { class: 'idea-name', x: weekRight + 3, y: to[1] + 4 }));
  return {
    reveal: clipTo(arrow, `s3-reveal-idea-${index}`, [from[0] - 2, PLOT.y - 10, 0, PLOT.height + 20]),
    width: to[0] - from[0] + 4,
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

// The one reason size for all the cards, in px, measured on the page.
function reasonSize(ideas, parent, layout) {
  const probe = parent.appendChild(svgEl('text', { class: 'card-reason' }));
  const overflow = (size) => ideas.find(({ reason }) => {
    probe.style.fontSize = `${size}px`;
    return wrapLines(probe, reason, layout.width - CARD_TEXT_INSET).length > REASON_LINES;
  });
  const size = REASON_SIZES.find((s) => overflow(s) === undefined);
  const tooLong = size === undefined && overflow(REASON_SIZES.at(-1));
  probe.remove();
  if (tooLong) throw new Error(`ideas: ${tooLong.model} reason is too long for its card even at ${REASON_SIZES.at(-1)} px`);
  return size;
}

// All the week's cards, their reasons at one size. A screen without a chart can pass a wider column.
function drawIdeaCards(ideas, parent, layout = CARD) {
  const size = reasonSize(ideas, parent, layout);
  return ideas.map((idea, i) => drawIdeaCard(idea, i, parent, size, layout));
}

// The card and the room left between the name and the call, measured on the page. The top row reads
// name, call, confidence; the call sits just before the confidence so the two read together.
function drawIdeaCard({ model, name: title, call, confidence, reason }, index, parent, size, layout) {
  const color = MODEL_COLORS[model];
  const { x, width, height } = layout;
  const y = layout.y + index * (height + layout.gap);
  const nameX = x + 40;
  const card = parent.appendChild(svgEl('g'));
  const name = textEl(title ?? model, { class: 'card-name', x: nameX, y: y + 25 });
  const conf = textEl(`${confidence}%`, { class: 'card-conf num', x: x + width - 12, y: y + 25, 'text-anchor': 'end' });
  card.append(
    svgEl('rect', { class: 'card', x, y, width, height, rx: 6 }),
    svgEl('rect', { x, y: y + 5, width: 4, height: height - 10, rx: 2, fill: color }),
    name,
    conf,
  );
  const label = card.appendChild(textEl(CALL_LABELS[call], { class: `card-call card-${call}`, x: conf.getBBox().x - 8, y: y + 25, 'text-anchor': 'end' }));
  const gap = label.getBBox().x - (nameX + name.getComputedTextLength());
  if (gap < CARD_LABEL_GAP) throw new Error(`ideas: ${model} and its call are ${gap.toFixed(1)} px apart, the card needs ${CARD_LABEL_GAP}`);
  card.appendChild(modelLogo(model, [x + CARD_LOGO.x, y + CARD_LOGO.y]));
  const text = card.appendChild(svgEl('text', { class: 'card-reason', style: `font-size: ${size}px` }));
  const lines = wrapLines(text, reason, width - CARD_TEXT_INSET);
  if (lines.length > REASON_LINES) throw new Error(`ideas: ${model} reason needs ${lines.length} lines, the card fits ${REASON_LINES}`);
  text.textContent = '';
  text.append(...lines.map((line, i) => textEl(line, { x: x + 16, y: y + REASON_BASELINES[lines.length - 1][i] }, 'tspan')));
  return { card, gap, centre: [x + width / 2, y + height / 2] };
}

// One week everywhere: the board's question and the screen's title name the same Mon-Fri as the chart.
function writeCallWeek(scale) {
  const week = weekLabel(scale);
  const board = $('s1', 'week');
  if (board) board.textContent = `BTC: up or down, ${week}?`;
  $('s3', 'title').textContent += ` · ${week.toUpperCase()}`;
}

function planMonitor() {
  checkMonitorData();
  const scale = chartScale();
  writeCallWeek(scale);
  const chart = $('s3', 'chart');
  const rankOf = (i) => IDEAS.ideas.slice(0, i).filter((idea) => idea.call === IDEAS.ideas[i].call).length;
  const cards = drawIdeaCards(IDEAS.ideas, $('s3', 'cards'));
  return {
    frame: drawChartFrame(scale, chart),
    candles: drawCandles(scale, chart),
    lastPrice: drawLastPrice(scale, chart),
    week: drawWeek(scale, $('s3', 'week')),
    ideas: IDEAS.ideas.map((idea, i) => ({
      ...drawIdeaArrow(scale, idea, i, rankOf(i), $('s3', 'ideas')),
      card: cards[i].card,
      cardCentre: cards[i].centre,
    })),
    cardGap: Math.min(...cards.map(({ gap }) => gap)),
  };
}

function riseIn(node, t) {
  node.style.opacity = t;
  node.setAttribute('transform', `translate(0 ${(1 - t) * 6})`);
}

// A beat landing: it fades in from BEAT_POP larger, scaled about its anchor.
function popIn(node, t, [x, y]) {
  node.style.opacity = t;
  node.setAttribute('transform', `translate(${x} ${y}) scale(${1 + BEAT_POP * (1 - t)}) translate(${-x} ${-y})`);
}

// Draws the arrow over `frames`, then fades the name in at its tip.
function revealIdea({ reveal, width, name }, k, frames) {
  reveal.setAttribute('width', width * ease(progress(k, 0, frames)));
  name.style.opacity = ease(progress(k, frames - 2, POP));
}

// The chart builds over the hook, `t` frames in: the candles left to right, then the last price and the week.
function renderChart(plan, t) {
  plan.frame.style.opacity = 1;
  const step = CANDLES_SWEEP / Math.max(1, plan.candles.length - 1);
  plan.candles.forEach((candle, i) => riseIn(candle, ease(progress(t, CANDLES_START + i * step, CANDLE_RISE))));
  plan.lastPrice.style.opacity = progress(t, CANDLES_START + CANDLES_SWEEP, FADE);
  plan.week.style.opacity = progress(t, WEEK_START, FADE);
}

// The chart is whole by now; the calls land one at a time, each arrow and then its card.
function renderMonitor(plan, k, view = FULL_VIEW) {
  setViewBox('s3', view);
  renderChart(plan, Infinity);
  plan.ideas.forEach((idea, i) => {
    const start = IDEAS_START + i * IDEA_STEP;
    revealIdea(idea, k - start, ARROW_FRAMES);
    popIn(idea.card, ease(progress(k, start + ARROW_FRAMES, CARD_POP)), idea.cardCentre);
  });
}

// ---------------------------------------------------------------- hook

// One caption at a time, the only text on screen: the question, then the bar the calls have to clear,
// with the coin after it. They never tell the calls; those show first on the monitor.
// Each part is [text, class]; the call words wear the candle colours, next to the word itself.
function hookCaptions(ideas) {
  const n = ideas.length;
  return [
    { title: [[`${n} ${n === 1 ? 'AI' : 'AIs'}. BTC `], ['up', CALL_CLASSES.up], [' or '], ['down', CALL_CLASSES.down], [' this week?']] },
    { title: [['Can they beat a coin flip?']] },
  ];
}

function drawCaption({ title }, x, parent) {
  const group = parent.appendChild(svgEl('g'));
  const line = group.appendChild(svgEl('text', { class: 'hook-title', x, y: CAPTION.y, 'text-anchor': 'middle' }));
  line.append(...title.map(([text, cls]) => textEl(text, cls ? { class: cls } : {}, 'tspan')));
  const width = line.getComputedTextLength();
  if (width > CAPTION.maxWidth) throw new Error(`hook: "${line.textContent}" is ${width.toFixed(0)} px wide, the frame fits ${CAPTION.maxWidth}`);
  return { group, width };
}

// The second title moves left so that it and the coin after it sit centred together.
function planHook() {
  const [first, second] = hookCaptions(IDEAS.ideas);
  const shift = COIN_GAP / 2 + COIN_R;
  const bar = drawCaption(second, CAPTION.x - shift, $('s0', 'beats'));
  return {
    beats: [drawCaption(first, CAPTION.x, $('s0', 'beats')).group, bar.group],
    coinX: CAPTION.x - shift + bar.width / 2 + COIN_GAP + COIN_R,
  };
}

// The chart builds full frame under the captions, its week still empty; the calls wait for the monitor.
function renderHookScreen(monitor, h) {
  setViewBox('s3', FULL_VIEW);
  renderChart(monitor, h);
  monitor.ideas.forEach((idea) => {
    revealIdea(idea, -1, ARROW_FRAMES);
    idea.card.style.opacity = 0;
  });
}

function renderHook({ beats: [first, second], coinX }, h) {
  first.style.opacity = 1 - progress(h, BEAT_SWAP - BEAT_OUT, BEAT_OUT);
  const secondShown = ease(progress(h, BEAT_SWAP, BEAT_IN));
  popIn(second, secondShown, [CAPTION.x, CAPTION.y]);
  // A toss as the second caption lands: up and back down, spinning while in the air.
  const tossed = progress(h, BEAT_SWAP, COIN_FLIGHT);
  const facing = Math.cos(2 * Math.PI * COIN_TURNS * tossed);
  const coin = $('s0', 'coin');
  coin.style.opacity = secondShown;
  coin.setAttribute('transform', `translate(${coinX} ${CAPTION.coinY - COIN_TOSS * 4 * tossed * (1 - tossed)})`);
  $('s0', 'coin-spin').setAttribute('transform', `scale(${Math.max(Math.abs(facing), COIN_EDGE)} 1)`);
  $('s0', 'coin-face').setAttribute('fill', facing >= 0 ? COIN_FACES.front : COIN_FACES.back);
  $('s0', 'coin-text').style.opacity = facing >= 0 ? 1 : 0;
}

// ---------------------------------------------------------------- end card

function poseEndFigure(k) {
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
}

// The card fades in whole and its question pops in after; a story episode keeps this one.
function renderPlainEnd(k) {
  poseEndFigure(k);
  const cardIn = progress(k, END_FADE, END_IN);
  $('s4', 'place').style.opacity = cardIn;
  $('s4', 'text').style.opacity = cardIn;
  popIn($('s4', 'cta'), ease(progress(k, CTA.start, BEAT_IN)), [CTA.x, CTA.y]);
}

// The call episode's card builds line by line so the end never sits still: the question pops in,
// the reply rises under it, the arrow draws to the reply button and nods on the beat, then the rest rises.
function renderEnd(k) {
  poseEndFigure(k);
  const cardIn = progress(k, END_FADE, END_IN);
  $('s4', 'place').style.opacity = cardIn;
  $('s4', 'text').style.opacity = 1;
  $('s4', 'kicker').style.opacity = cardIn;
  popIn($('s4', 'ask'), ease(progress(k, END_STEPS.ask, BEAT_IN)), [CTA.x, CTA.y]);
  for (const id of ['reply', 'lead', 'ledger']) riseIn($('s4', id), ease(progress(k, END_STEPS[id], END_RISE)));
  drawEndArrow(k);
}

function drawEndArrow(k) {
  const arrow = $('s4', 'arrow');
  if (!arrow) return;
  const t = progress(k, END_STEPS.arrow, END_ARROW_DRAW);
  const line = $('s4', 'arrow-line');
  const head = $('s4', 'arrow-head');
  for (const path of [line, head]) path.style.strokeDasharray = '1 1';
  line.style.strokeDashoffset = 1 - clamp(t / 0.7, 0, 1);
  head.style.strokeDashoffset = 1 - clamp((t - 0.7) / 0.3, 0, 1);
  arrow.style.opacity = t > 0 ? 1 : 0;
  const nod = progress(k, END_STEPS.arrow + END_ARROW_DRAW, ARROW_NOD.ramp) * Math.cos((Math.PI * (k + episode.endStart)) / ARROW_NOD.beat) ** 2;
  arrow.setAttribute('transform', `translate(0 ${ARROW_NOD.depth * nod})`);
}

// ---------------------------------------------------------------- story question

const questionShown = (f, start) => {
  const { fade, length } = QUESTION;
  return progress(f + 1, start, fade) * (1 - progress(f + 1, start + length - fade, fade));
};

// The question is written into its layer at build time; only its words fade, inside the plate's fades,
// and the answers move.
function renderQuestion(k) {
  const { fade, length, answers, x, y } = QUESTION;
  $('s5', 'words').style.opacity = progress(k + 1, fade, fade) * (1 - progress(k + 1, length - 2 * fade, fade));
  popIn($('s5', 'answers'), ease(progress(k, answers, BEAT_IN)), [x, y]);
}

// ---------------------------------------------------------------- timeline

// A story episode (heist-*.js) swaps the hook and the monitor for its own, and may set its own hook length;
// everything else is shared. Its page may also leave the board or the desk out or carry a question layer:
// the layers on the page decide.
const STANDARD = { hookFrames: HOOK, monitorFrames: MONITOR, planHook, renderHook, renderHookScreen, planMonitor, renderMonitor, renderEnd };

let episode;

// When each scene starts. The hook dissolves over the board, else over the desk, else straight over the monitor.
function timeline(story, board, desk) {
  const hookEnd = story.hookFrames;
  const dissolveStart = hookEnd - HOOK_DISSOLVE;
  const boardEnd = hookEnd + (board ? board.frames.length : 0);
  const deskStart = boardEnd - DESK_SKIP; // desk frame 0; the cut from the board lands on desk frame DESK_SKIP
  // Without a board the hook dissolves straight over the desk, held on that frame until the hook is gone.
  const deskIn = board ? boardEnd : dissolveStart;
  const deskEnd = deskStart + DESK_LENGTH;
  // Without a desk the monitor runs full screen from the cut off the board, else from the start of the hook's dissolve.
  const screenOn = desk ? deskStart + SETTLED : board ? boardEnd : dissolveStart; // he starts typing
  // Monitor frame 0: the camera starts flying in; the cut from the board lands on monitor frame MONITOR_SKIP.
  const monitorStart = desk ? screenOn + TYPE : board ? screenOn - MONITOR_SKIP : screenOn;
  const endStart = monitorStart + story.monitorFrames - END_FADE;
  return { hookEnd, boardEnd, deskStart, deskIn, deskEnd, screenOn, monitorStart, endStart };
}

function setup() {
  const story = { ...STANDARD, ...window.STORY };
  const board = hasLayer('board') ? planBoard() : null;
  const desk = hasLayer('desk') ? planDesk() : null;
  const times = timeline(story, board, desk);
  const { hookEnd, boardEnd, deskEnd, monitorStart, endStart } = times;
  const questionStart = hasLayer('question') ? hookEnd - QUESTION.lead : null;
  // Subtitles come with a story script (subtitles.js) that plans and plays them.
  const subs = hasLayer('subs') ? story.planSubs() : null;
  episode = { story, hook: story.planHook(), board, desk, monitor: story.planMonitor(), questionStart, subs, ...times };
  window.TOTAL_FRAMES = endStart + (story.endFrames ?? END); // a story may hold its end card shorter
  // Frame ranges, end exclusive, for rendering one scene at a time.
  window.SCENES = {
    hook: [0, hookEnd],
    ...(board && { board: [hookEnd, boardEnd] }),
    ...(questionStart !== null && { question: [questionStart, questionStart + QUESTION.length] }),
    ...(desk && { desk: [boardEnd, deskEnd] }),
    monitor: [Math.max(monitorStart, times.screenOn), endStart + (story.endCut ? 0 : END_FADE)],
    end: [endStart, window.TOTAL_FRAMES],
  };
  window.report = checks(board, desk);
  return window.TOTAL_FRAMES;
}

// Numbers to eyeball before rendering: whether the chalk stays in reach, how fast he walks at the board,
// how high he rises on his toes, how often the shoes switch, and whether the seated pose lands on the slot.
function checks(board, desk) {
  return {
    frames: window.TOTAL_FRAMES,
    monitorStart: episode.monitorStart, // monitor frame 0, which story beats count from; after a board it is before the cut
    ...(board && boardChecks(board)),
    ...(desk && deskChecks(desk)),
    ...(episode.monitor.cardGap !== undefined && { cardGap: +episode.monitor.cardGap.toFixed(1) }),
    ...(episode.story.renderMonitor === renderMonitor && { clicks: ideaClicks(episode.monitorStart, episode.monitor.ideas) }),
    ...(episode.story.clicks && { clicks: episode.story.clicks(episode) }),
    endY: +standOn(END_FLOOR + SOLE_DROP, END_SLOT.scale, Rig.STANDING, 'front').toFixed(2),
  };
}

// The frames score.py clicks on: each arrow starting to draw, and its card popping in at the tip.
function ideaClicks(monitorStart, ideas) {
  const starts = ideas.map((idea, i) => monitorStart + IDEAS_START + i * IDEA_STEP);
  return { lines: starts, cards: starts.map((start) => start + ARROW_FRAMES) };
}

function deskChecks(desk) {
  const seatedParts = deskParts(desk, SETTLED);
  return {
    deskPulledOut: +desk.pulledOut.toFixed(2),
    deskStopAmount: +desk.gait[WALK].amount.toFixed(3),
    deskSeatedY: +standOn(DESK_FLOOR + SOLE_DROP, POSES.desk.scale, seatedParts, 'right').toFixed(2),
    deskSeatY: POSES.desk.y,
  };
}

function boardChecks(board) {
  const switches = (gait) => gait.filter((g, k) => k && g.feet !== gait[k - 1].feet).length;
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
    boardFrames: board.frames.length,
    boardMaxWalk: +Math.max(...board.xs.map((x, k) => (k ? Math.abs(x - board.xs[k - 1]) : 0))).toFixed(2),
    boardMaxLift: +Math.max(...board.lifts).toFixed(2),
    boardLiftFrames: board.lifts.filter((v) => v > 0.5).length,
    boardTipMiss: +Math.max(...misses).toFixed(2),
    boardReach: [Math.min(...shares), Math.max(...shares)].map((v) => +v.toFixed(3)),
    boardCrowded: crowded,
    boardShoeSwitches: switches(board.gait),
    boardShoes: [...new Set(board.gait.map((g) => g.feet))],
  };
}

function hasLayer(name) {
  return document.getElementById(`layer-${name}`) !== null;
}

function showLayer(name, opacity, render) {
  document.getElementById(`layer-${name}`).style.opacity = opacity;
  if (opacity > 0) render();
}

window.renderFrame = (f) => {
  const { story, hook, board, desk, monitor, questionStart, subs, hookEnd, boardEnd, deskStart, deskIn, deskEnd, screenOn, monitorStart, endStart } = episode;
  const hooked = f < hookEnd;
  const hookShown = 1 - progress(f + 1, hookEnd - HOOK_DISSOLVE, HOOK_DISSOLVE);
  const atDesk = desk !== null && f >= deskIn && f < deskEnd;
  if (board) showLayer('board', f >= hookEnd - HOOK_DISSOLVE && f < boardEnd ? 1 : 0, () => renderBoard(board, Math.max(0, f - hookEnd)));
  if (desk) showLayer('desk', atDesk ? 1 : 0, () => renderDesk(desk, Math.max(DESK_SKIP, f - deskStart)));
  // Before the screen comes on only the hook's own screen shows; a hook without one (renderHookScreen null)
  // keeps the monitor dark until then.
  const onScreen = f >= screenOn;
  const hookScreen = story.renderHookScreen ? hookShown : 0;
  // The board cuts to the monitor as hard as it does to the desk, and a hook screen is the monitor already lit;
  // only a screen that lights up fades in.
  const screenShown = !desk && (board || story.renderHookScreen) ? 1 : progress(f + 1, screenOn, SCREEN_ON);
  showLayer('monitor', onScreen ? screenShown : hookScreen, () => {
    // At the desk only the screen shows, over the desk's own; the desk draws the room around it.
    $('s3', 'room').style.visibility = atDesk ? 'hidden' : 'visible';
    if (onScreen) story.renderMonitor(monitor, f - monitorStart, atDesk ? monitorThroughDesk(desk, f - deskStart) : FULL_VIEW);
    else story.renderHookScreen(monitor, f);
  });
  showLayer('hook', hooked ? hookShown : 0, () => story.renderHook(hook, f));
  if (questionStart !== null) showLayer('question', questionShown(f, questionStart), () => renderQuestion(f - questionStart));
  if (subs) showLayer('subs', 1, () => story.renderSubs(subs, f));
  // A story with endCut cuts to the end on its first frame; the others dissolve into it.
  const endShown = story.endCut ? Number(f >= endStart) : progress(f + 1, endStart, END_FADE);
  showLayer('end', endShown, () => story.renderEnd(f - endStart));
  document.getElementById('flash').style.opacity = board ? 1 - clamp(Math.abs(f + 0.5 - boardEnd) / FLASH, 0, 1) : 0;
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

// Story scripts come after this one, so wait for the whole page to parse: with the fonts cached, setup
// would otherwise run before they do.
const parsed = new Promise((resolve) =>
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', resolve, { once: true }) : resolve(),
);
// Web fonts load only once something lays out with them; load every face up front so frame one has them.
window.episodeReady = parsed
  .then(() => Promise.all([...document.fonts].map((face) => face.load())))
  .then(() => document.fonts.ready)
  .then(setup);
