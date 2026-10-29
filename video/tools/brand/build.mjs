// node video/tools/brand/build.mjs
// X avatar (400x400) and header (1500x500) as SVG and PNG in video/assets/brand/, with the host from the video rig.
// Avatar: he holds a magnifier over one eye. Header: he points at four AI calls fanning out of a chart.
// No turnip, no wordmark, no logos.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, open, screenshot, setSize } from "../cdp.mjs";
import { loadRig, posed, reach, withMagnifier } from "./rig.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, "../../..");
const outDir = path.join(project, "video/assets/brand");
const rig = loadRig(project);

// Raised left brow, the right eye squinting, a lopsided smile.
const SKEPTIC = {
  look: {
    "brow-left": "translate(0 -2.8) rotate(-5 71 50)",
    "brow-right": "translate(0 1.2) rotate(-9 89 50)",
    "eye-right": "translate(0 18.24) scale(1 0.7)",
  },
  shapes: { mouth: "M75.6 78.4 Q81.5 81.6 86.2 76.2 Q81.2 79.6 75.6 78.4 Z" },
};
// Elbow out to the side, the fist below the cheek, the lens on the left eye.
const MAGNIFIER = { side: "left", hand: [44, 92], r: 13, mag: 1.7 };
const AIS = [
  { name: "Grok", color: "#e5e7eb" },
  { name: "ChatGPT", color: "#34d399" },
  { name: "Claude", color: "#ff8f6b" },
  { name: "Gemini", color: "#60a5fa" },
];
const CLOSES = [0.47, 0.44, 0.52, 0.49, 0.58, 0.63, 0.57, 0.66, 0.61, 0.7, 0.66, 0.72];
const OPEN0 = 0.42;

// Candles from closes in 0..1; up candles are hollow, down candles filled.
function candles({ x0, step, w, yOf, color, wick = 0.03 }) {
  return CLOSES.map((c, i) => {
    const o = i === 0 ? OPEN0 : CLOSES[i - 1];
    const x = x0 + i * step;
    const top = yOf(Math.max(o, c));
    const bottom = yOf(Math.min(o, c));
    const fill = c >= o ? "none" : color;
    return `<line x1="${x}" y1="${yOf(Math.max(o, c) + wick)}" x2="${x}" y2="${yOf(Math.min(o, c) - wick)}" stroke="${color}" stroke-width="2"/>
    <rect x="${x - w / 2}" y="${top}" width="${w}" height="${Math.max(bottom - top, 2)}" rx="1.5" fill="${fill}" stroke="${color}" stroke-width="2"/>`;
  }).join("\n    ");
}

// Four-point twinkle.
const sparkle = ([x, y], r, color) =>
  `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${color}"/>`;

// ---------- avatar: 400x400, X shows it as a circle ----------

const AVATAR_FRAME = [30, 27, 88]; // x, y, size in figure units: face, lens and fist fill the circle
const LENS_AT = [((72 - AVATAR_FRAME[0]) * 400) / AVATAR_FRAME[2], ((66.8 - AVATAR_FRAME[1]) * 400) / AVATAR_FRAME[2]];
const AVATAR_BG = { inner: "#9b6dff", outer: "#4b1fa6" };
const AVATAR_SPARKLES = [[[318, 64], 15], [[64, 92], 10], [[362, 248], 9], [[262, 30], 7]];

// Light rays from the lens to past the edges.
function rays([cx, cy], n = 22, len = 600) {
  const at = (a) => `${(cx + len * Math.cos(a)).toFixed(1)} ${(cy + len * Math.sin(a)).toFixed(1)}`;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)} L${at(a)} L${at(a + Math.PI / n)} Z"/>`;
  }).join("");
}

const avatar = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="72%">
      <stop offset="0" stop-color="${AVATAR_BG.inner}"/><stop offset="1" stop-color="${AVATAR_BG.outer}"/>
    </radialGradient>
  </defs>
  ${rig.style}
  <rect width="400" height="400" fill="url(#bg)"/>
  <g fill="#ffffff" opacity="0.1">${rays(LENS_AT)}</g>
  <g opacity="0.85">${AVATAR_SPARKLES.map(([p, r]) => sparkle(p, r, "#ffffff")).join("")}</g>
  <svg viewBox="${AVATAR_FRAME[0]} ${AVATAR_FRAME[1]} ${AVATAR_FRAME[2]} ${AVATAR_FRAME[2]}" width="400" height="400">
    ${withMagnifier(rig, { id: "avatar-lens", ...MAGNIFIER, ...SKEPTIC })}
  </svg>
</svg>
`;

// ---------- header: 1500x500 ----------
// X lays the avatar over the bottom-left (about x 40-375, y > 333 at this size),
// so the text stays above y 330 and everything else starts right of x 400.

const CHART = { x0: 664, step: 23, w: 12, top: 200, bottom: 370, lo: 0.4, hi: 0.75 };
const chartY = (v) => Math.round(CHART.bottom - ((v - CHART.lo) / (CHART.hi - CHART.lo)) * (CHART.bottom - CHART.top));
const NOW = [CHART.x0 + (CLOSES.length - 1) * CHART.step, chartY(CLOSES.at(-1))];
const END_X = 1040;
const CALL_YS = [118, 178, 266, 324];
const ROBOT = 34;
const GP = { x: 1150, y: 20, scale: 2.4 }; // the bottom edge cuts mid-shin (figure y 200), above the socks
const GP_HAND = [14, 92]; // figure units: arm out to the left at shoulder height
const POINTER_TIP = [1066, 222]; // between the ChatGPT and Claude calls
const HEADER_SPARKLES = [[[640, 112], 10], [[868, 92], 7], [[1180, 440], 9], [[560, 420], 6], [[960, 446], 7]];
const toHeader = ([x, y]) => [GP.x + x * GP.scale, GP.y + y * GP.scale];

// A small robot head standing for one AI.
function robot([cx, cy], color, s = ROBOT) {
  const h = s * 0.84;
  return `<g transform="translate(${cx} ${cy})">
    <line x1="0" y1="${-h / 2}" x2="0" y2="${-h / 2 - 8}" stroke="${color}" stroke-width="3"/>
    <circle cx="0" cy="${-h / 2 - 10}" r="3.5" fill="${color}"/>
    <rect x="${-s / 2}" y="${-h / 2}" width="${s}" height="${h}" rx="${s * 0.26}" fill="#0b1024" stroke="${color}" stroke-width="3"/>
    <circle cx="${-s * 0.19}" cy="-2" r="${s * 0.09}" fill="${color}"/>
    <circle cx="${s * 0.19}" cy="-2" r="${s * 0.09}" fill="${color}"/>
    <path d="M${-s * 0.14} ${h * 0.2} Q0 ${h * 0.32} ${s * 0.14} ${h * 0.2}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
  </g>`;
}

// A teacher's pointer from the fist to `tip`; drawn under the figure so the fist covers its end.
function pointer(hand, tip) {
  const seg = (w, color) => `<path d="M${hand.join(" ")} L${tip.join(" ")}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  return `${seg(9, "#0d1828")}${seg(5, "#b8642a")}<circle cx="${tip[0]}" cy="${tip[1]}" r="5" fill="#f4f1e8" stroke="#0d1828" stroke-width="2"/>`;
}

const headline = () => `
  <text x="74" y="168" class="h-big">Testing AIs</text>
  <text x="74" y="258" class="h-big h-neon">on the market</text>`;

// Dashed calls from now to each AI, ending at its robot and name.
const chart = () => {
  const calls = AIS.map((ai, i) => ({ ...ai, at: [END_X, CALL_YS[i]] }));
  return `
  <rect x="${NOW[0]}" y="96" width="${END_X - NOW[0] + 30}" height="290" fill="url(#h-future)"/>
  <text x="${(NOW[0] + END_X) / 2 + 6}" y="330" class="h-q">?</text>
  <line x1="${NOW[0]}" y1="96" x2="${NOW[0]}" y2="386" stroke="#7c86a8" stroke-width="2" stroke-dasharray="4 6"/>
  <g filter="url(#h-glow)">
    ${candles({ x0: CHART.x0, step: CHART.step, w: CHART.w, yOf: chartY, color: "#a78bfa" })}
  </g>
  <g filter="url(#h-glow)">
    ${calls.map((c) => `<path d="M${NOW.join(" ")} L${c.at.join(" ")}" stroke="${c.color}" stroke-width="3" stroke-dasharray="9 7" stroke-linecap="round" fill="none"/>`).join("\n    ")}
    <circle cx="${NOW[0]}" cy="${NOW[1]}" r="6" fill="#ffffff"/>
  </g>
  ${calls.map((c) => robot(c.at, c.color)).join("\n  ")}
  ${calls.map((c) => `<text x="${END_X + ROBOT / 2 + 12}" y="${c.at[1] + 8}" class="h-label" fill="${c.color}">${c.name}</text>`).join("\n  ")}`;
};

const host = () => {
  const transforms = {
    ...SKEPTIC.look,
    eyes: "translate(-2 0)",
    head: "rotate(-4 80 80)",
    "arm-right": "rotate(-4 101 100)",
    ...reach("left", GP_HAND, "down"),
  };
  return `${pointer(toHeader(GP_HAND), POINTER_TIP)}
  <svg x="${GP.x}" y="${GP.y}" width="${160 * GP.scale}" height="${230 * GP.scale}" viewBox="0 0 160 230" overflow="visible">
    ${posed(rig.figure, { transforms, hidden: ["chalk"], shapes: SKEPTIC.shapes })}
  </svg>`;
};

const header = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500">
  <defs>
    <linearGradient id="h-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1024"/><stop offset="1" stop-color="#140c2e"/>
    </linearGradient>
    <radialGradient id="h-spot" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#7c3aed" stop-opacity="0.45"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="h-neon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#34d399"/><stop offset="0.5" stop-color="#60a5fa"/><stop offset="1" stop-color="#c084fc"/>
    </linearGradient>
    <linearGradient id="h-future" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0.14"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
    </linearGradient>
    <pattern id="h-grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0 L0 0 L0 48" fill="none" stroke="#1c2547" stroke-width="1"/>
    </pattern>
    <filter id="h-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${rig.style}
  <style>
    .h-big { font: 900 86px 'Segoe UI', sans-serif; fill: #ffffff; letter-spacing: -2px; }
    .h-neon { fill: url(#h-neon); }
    .h-label { font: 800 22px 'Segoe UI', sans-serif; }
    .h-q { font: 900 210px 'Segoe UI', sans-serif; fill: #a78bfa; opacity: 0.12; text-anchor: middle; }
  </style>
  <rect width="1500" height="500" fill="url(#h-bg)"/>
  <rect width="1500" height="500" fill="url(#h-grid)"/>
  <ellipse cx="${GP.x + 80 * GP.scale}" cy="250" rx="260" ry="240" fill="url(#h-spot)"/>
  <g filter="url(#h-glow)" opacity="0.8">${HEADER_SPARKLES.map(([p, r]) => sparkle(p, r, "#c4b5fd")).join("")}</g>
  ${headline()}
  ${chart()}
  ${host()}
</svg>
`;

const IMAGES = [
  { name: "avatar", svg: avatar(), width: 400, height: 400 },
  { name: "header", svg: header(), width: 1500, height: 500 },
];

mkdirSync(outDir, { recursive: true });
const edge = await launch({ port: 9337, width: 1500, height: 800 });
try {
  for (const { name, svg, width, height } of IMAGES) {
    const file = path.join(outDir, `${name}.svg`);
    writeFileSync(file, svg);
    await setSize(edge.cdp, width, height);
    await open(edge.cdp, file);
    writeFileSync(path.join(outDir, `${name}.png`), await screenshot(edge.cdp));
    console.log(`${name}.svg, ${name}.png ${width}x${height}`);
  }
} finally {
  edge.close();
}
