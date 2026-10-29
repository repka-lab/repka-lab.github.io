// Grandpa from video/assets/stickman/grandpa.svg, posed by group transforms (pivots are listed in that file),
// plus a magnifier pose: the hand holds a magnifying glass over one eye and the lens shows that eye enlarged.
import { readFileSync } from "node:fs";
import path from "node:path";

const ARMS = {
  left: { shoulder: [59, 100], elbow: [54, 129], hand: [47.87, 154.27], outward: -1 },
  right: { shoulder: [101, 100], elbow: [106, 129], hand: [112.13, 154.27], outward: 1 },
};
const EYES = { left: [72, 60.8], right: [88, 60.8] };
const HEAD_PIVOT = [80, 80];
const HEAD_DROP = 6; // #head draws its art translate(0 6)
const HAND_R = 6;

const f = (n) => Number(n.toFixed(2));
const deg = (rad) => (rad * 180) / Math.PI;
const angle = ([x1, y1], [x2, y2]) => Math.atan2(y2 - y1, x2 - x1);
const dist = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
const norm = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

function cut(src, start, end, what) {
  const a = src.indexOf(start);
  const b = src.lastIndexOf(end);
  if (a < 0 || b <= a) throw new Error(`cannot find ${what}`);
  return src.slice(a, b);
}

export function loadRig(project) {
  const src = readFileSync(path.join(project, "video/assets/stickman/grandpa.svg"), "utf8");
  return {
    style: `${cut(src, "<style>", "</style>", "grandpa style")}</style>`,
    figure: cut(src, '<g id="grandpa">', "</svg>", "grandpa figure"),
  };
}

// Transforms and hiding go on any element with an id (groups, brows, eyes); `shapes` replaces a path's d.
export function posed(figure, { transforms = {}, hidden = [], shapes = {} }) {
  let out = figure;
  const set = (id, attr) => {
    const tag = ` id="${id}"`;
    if (!out.includes(tag)) throw new Error(`grandpa has no element #${id}`);
    out = out.replace(tag, `${tag} ${attr}`);
  };
  for (const [id, t] of Object.entries(transforms)) set(id, `transform="${t}"`);
  for (const id of hidden) set(id, 'display="none"');
  for (const [id, d] of Object.entries(shapes)) {
    const re = new RegExp(`( id="${id}"[^>]*? d=")[^"]*"`);
    if (!re.test(out)) throw new Error(`grandpa has no path #${id}`);
    out = out.replace(re, `$1${d}"`);
  }
  return out;
}

// The figure draws the arms before the head; a hand raised to the face has to come after it.
function armInFront(figure, side) {
  const start = figure.indexOf(`<g id="arm-${side}"`);
  const end = figure.indexOf(side === "left" ? '<g id="head"' : '<g id="arm-left"');
  if (start < 0 || end <= start) throw new Error(`cannot move arm-${side}`);
  const rest = figure.slice(0, start) + figure.slice(end);
  const close = rest.lastIndexOf("</g>");
  return rest.slice(0, close) + figure.slice(start, end) + rest.slice(close);
}

// Two-bone reach: rotations for the upper arm and forearm that put the hand centre on `target`.
// The elbow bends away from the body, or hangs below the arm with `elbow: "down"`.
export function reach(side, target, elbow = "out") {
  const { shoulder: S, elbow: E0, hand: H0, outward } = ARMS[side];
  const l1 = dist(S, E0);
  const l2 = dist(E0, H0);
  const d = dist(S, target);
  if (d <= Math.abs(l1 - l2) || d >= l1 + l2) throw new Error(`arm-${side} cannot reach ${target}`);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const base = angle(S, target);
  const elbows = [1, -1].map((s) => {
    const t = base + s * Math.acos(Math.max(-1, Math.min(1, cosA)));
    return [S[0] + l1 * Math.cos(t), S[1] + l1 * Math.sin(t)];
  });
  const key = elbow === "down" ? (e) => e[1] : (e) => outward * e[0];
  const E = elbows.sort((a, b) => key(b) - key(a))[0];
  const a1 = norm(deg(angle(S, E) - angle(S, E0)));
  const a2 = norm(deg(angle(E, target) - angle(E0, H0)) - a1);
  return {
    [`arm-${side}`]: `rotate(${f(a1)} ${S.join(" ")})`,
    [`arm-${side}-forearm`]: `rotate(${f(a2)} ${E0.join(" ")})`,
  };
}

function headPoint([x, y], tilt) {
  const t = (tilt * Math.PI) / 180;
  const [cx, cy] = HEAD_PIVOT;
  const dx = x - cx;
  const dy = y + HEAD_DROP - cy;
  return [cx + dx * Math.cos(t) - dy * Math.sin(t), cy + dx * Math.sin(t) + dy * Math.cos(t)];
}

function headFrontCopy(figure) {
  const a = figure.indexOf('<g id="head-front"');
  const b = figure.indexOf('<g id="head-side"');
  if (a < 0 || b <= a) throw new Error("cannot find head-front");
  return figure.slice(a, b).replace(/ id="[^"]*"/g, "");
}

function lens({ id, c, r, mag, tilt, head }) {
  const [cx, cy] = c.map(f);
  const zoom = `translate(${cx} ${cy}) scale(${mag}) translate(${-cx} ${-cy})`;
  return `
    <clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <g clip-path="url(#${id})">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f1c7a5"/>
      <g transform="${zoom}"><g transform="rotate(${tilt} ${HEAD_PIVOT.join(" ")})"><g transform="translate(0 ${HEAD_DROP})">${head}</g></g></g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#dff0ff" opacity="0.16"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0d1828" stroke-width="${f(r * 0.5)}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffc53d" stroke-width="${f(r * 0.3)}"/>
    <path d="M${f(cx + r * 0.32)} ${f(cy - r * 0.72)} A${f(r * 0.78)} ${f(r * 0.78)} 0 0 1 ${f(cx + r * 0.74)} ${f(cy - r * 0.26)}"
      fill="none" stroke="#ffffff" stroke-width="${f(r * 0.13)}" stroke-linecap="round" opacity="0.85"/>`;
}

// The handle runs from the rim through the hand and pokes out past the fist; the hand is redrawn on top of it.
function handle(c, r, hand) {
  const len = dist(c, hand);
  const dir = [(hand[0] - c[0]) / len, (hand[1] - c[1]) / len];
  const at = (k) => [c[0] + k * dir[0], c[1] + k * dir[1]].map(f).join(" ");
  const seg = (a, b, w, color) =>
    `<path d="M${at(a)} L${at(b)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  const collar = r * 1.1 + 4;
  return [
    seg(r * 1.1, len + 5, 6.6, "#0d1828"),
    seg(r * 1.1, collar, 4.4, "#ffc53d"),
    seg(collar, len + 5, 4.4, "#7a3f1d"),
    `<circle class="gp-skin gp-out" cx="${f(hand[0])}" cy="${f(hand[1])}" r="${HAND_R}"/>`,
  ].join("\n    ");
}

// Grandpa holding a magnifying glass over the eye on `side`, gripping its handle at `hand`.
// `look` holds extra transforms and `shapes` replacement paths for the expression.
// Returns markup in figure units (viewBox 0 0 160 230).
export function withMagnifier(rig, { id, side = "left", hand, tilt = 0, r = 13, mag = 1.7, look = {}, shapes = {}, pose = {} }) {
  const arm = reach(side, hand);
  const c = headPoint(EYES[side], tilt);
  const transforms = { head: `rotate(${tilt} ${HEAD_PIVOT.join(" ")})`, ...pose, ...look, ...arm };
  const figure = armInFront(posed(rig.figure, { transforms, hidden: ["chalk"], shapes }), side);
  return `${figure}
    ${handle(c, r, hand)}
    ${lens({ id, c, r, mag, tilt, head: headFrontCopy(figure) })}`;
}
