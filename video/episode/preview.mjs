// One quiet command for the episode: checks, frames rendered in parallel, a contact sheet and an MP4.
// The page exposes episodeReady, TOTAL_FRAMES, SCENES, renderFrame(f) and report (see episode.js).
// Prints one summary line; frames are reused while the page, its scripts and the options stay the same.
//
// node preview.mjs <episode.html> <name> [options]       frames land in out/<name>/
//   --checks             only print the report, render nothing (name not needed)
//   --scene <name>       board | desk | monitor | end; or --from N --to N, end exclusive
//   --step K             every K-th frame; the MP4 plays them at 30/K fps
//   --at 10,200,480      just these frames, e.g. for a pose sheet
//   --scale 0.5          smaller frames for drafts
//   --format jpeg        faster than png, fine for drafts
//   --workers N          parallel Edge instances, default 6
//   --js variant.js      render with this script in place of episode.js, no html copy needed
//   --sheet 4x3          contact sheet 1280 px wide, frames spread evenly; without --mp4 only those frames render
//   --crop w:h:x:y       crop each frame before tiling, in render pixels (e.g. a floor strip)
//   --mp4 <path>         encode the frames
//
// Edge rasterises with tiny run-to-run differences (PSNR > 60 dB), so compare renders by PSNR, not file hashes.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { evaluate, launch, open, screenshot } from "../tools/cdp.mjs";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const BASE_PORT = 9340;
const MAX_WORKERS = 12;
const JPEG_QUALITY = 92;
const SHEET_WIDTH = 1280;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    checks: { type: "boolean", default: false },
    scene: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    step: { type: "string", default: "1" },
    at: { type: "string" },
    scale: { type: "string", default: "1" },
    format: { type: "string", default: "png" },
    workers: { type: "string", default: "6" },
    js: { type: "string" },
    sheet: { type: "string" },
    crop: { type: "string" },
    mp4: { type: "string" },
  },
});

function int(value, flag, min = 0) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new Error(`${flag}: expected a whole number >= ${min}, got ${value}`);
  return n;
}

function validate() {
  if (!positionals[0] || (!opt.checks && !positionals[1])) {
    throw new Error("usage: node preview.mjs <episode.html> <name> [options], see the header of preview.mjs");
  }
  if (!["png", "jpeg"].includes(opt.format)) throw new Error("--format: png or jpeg");
  const scale = Number(opt.scale);
  if (!(scale > 0 && scale <= 1)) throw new Error("--scale: a number in (0, 1]");
  if (opt.sheet && !/^\d+x\d+$/.test(opt.sheet)) throw new Error("--sheet: COLSxROWS, e.g. 4x3");
  if (opt.crop && !/^\d+:\d+:\d+:\d+$/.test(opt.crop)) throw new Error("--crop: w:h:x:y");
  return {
    htmlPath: path.resolve(positionals[0]),
    name: positionals[1] ?? "checks",
    scale,
    step: int(opt.step, "--step", 1),
    workers: Math.min(MAX_WORKERS, int(opt.workers, "--workers", 1)),
    ext: opt.format === "jpeg" ? "jpg" : "png",
  };
}

// The page with --js swapped in for episode.js, written next to it so relative paths still resolve.
function variantPage(htmlPath) {
  if (!opt.js) return { page: htmlPath, drop() {} };
  const html = readFileSync(htmlPath, "utf8");
  const tag = 'src="episode.js"';
  if (html.split(tag).length !== 2) throw new Error(`expected one ${tag} in ${htmlPath}`);
  const src = path.relative(path.dirname(htmlPath), path.resolve(opt.js)).replaceAll("\\", "/");
  const page = path.join(path.dirname(htmlPath), `.variant-${process.pid}.html`);
  writeFileSync(page, html.replace(tag, `src="${src}"`));
  return { page, drop: () => rmSync(page, { force: true }) };
}

function frameList(total, scenes, step) {
  const inRange = (f, flag) => {
    if (f >= total) throw new Error(`${flag}: frame ${f} is past the last frame ${total - 1}`);
    return f;
  };
  if (opt.at) return opt.at.split(",").map((v) => inRange(int(v, "--at"), "--at"));
  if (opt.scene && !scenes) throw new Error("--scene: this page sets no window.SCENES, use --from/--to");
  if (opt.scene && !(opt.scene in scenes)) throw new Error(`--scene: one of ${Object.keys(scenes).join(", ")}`);
  const [lo, hi] = opt.scene ? scenes[opt.scene] : [0, total];
  const from = opt.from ? inRange(int(opt.from, "--from"), "--from") : lo;
  const to = Math.min(total, opt.to ? int(opt.to, "--to") : hi);
  return Array.from({ length: Math.max(0, Math.ceil((to - from) / step)) }, (_, k) => from + k * step);
}

// A sheet without an MP4 only needs its tiles: n frames spread evenly, first and last included.
function sheetOnly(frames) {
  const [cols, rows] = opt.sheet.split("x").map(Number);
  const n = cols * rows;
  if (frames.length <= n) return frames;
  if (n === 1) return [frames[0]];
  return Array.from({ length: n }, (_, k) => frames[Math.round((k * (frames.length - 1)) / (n - 1))]);
}

// Everything the frames depend on: the page, its scripts and the render options.
function inputsKey(page, frames, cfg) {
  const html = readFileSync(page, "utf8");
  const hash = createHash("sha1").update(html);
  for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) {
    hash.update(readFileSync(path.resolve(path.dirname(page), src)));
  }
  return hash.update(JSON.stringify({ frames, scale: cfg.scale, ext: cfg.ext })).digest("hex");
}

async function startWorker(index, page) {
  const worker = await launch({ port: BASE_PORT + index, width: WIDTH, height: HEIGHT });
  try {
    await open(worker.cdp, page);
    await evaluate(worker.cdp, "window.episodeReady");
    return worker;
  } catch (err) {
    worker.close();
    throw err;
  }
}

async function startWorkers(first, count, page) {
  const started = await Promise.allSettled(Array.from({ length: count }, (_, k) => startWorker(first + k, page)));
  const ready = started.filter((s) => s.status === "fulfilled").map((s) => s.value);
  const failed = started.find((s) => s.status === "rejected");
  if (failed) {
    ready.forEach((w) => w.close());
    throw failed.reason;
  }
  return ready;
}

const frameFile = (dir, i, ext) => path.join(dir, `f${String(i).padStart(4, "0")}.${ext}`);

// Workers pull the next frame index from one shared counter, so a slow scene does not hold up the rest.
async function renderAll(workers, frames, dir, cfg) {
  const shot = {
    format: opt.format,
    quality: JPEG_QUALITY,
    clip: cfg.scale < 1 ? { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: cfg.scale } : undefined,
  };
  let next = 0;
  const run = async ({ cdp }) => {
    while (next < frames.length) {
      const i = next++;
      await evaluate(cdp, `window.renderFrame(${frames[i]})`);
      writeFileSync(frameFile(dir, i, cfg.ext), await screenshot(cdp, shot));
    }
  };
  await Promise.all(workers.map(run));
}

function ffmpeg(args) {
  const run = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`ffmpeg: ${run.stderr?.trim() || run.error?.message}`);
}

// Returns the episode frame numbers that made it onto the sheet, left to right, top to bottom.
function contactSheet(dir, frames, cfg, out) {
  const [cols, rows] = opt.sheet.split("x").map(Number);
  const every = Math.max(1, Math.ceil(frames.length / (cols * rows)));
  const tile = Math.floor(SHEET_WIDTH / cols / 2) * 2;
  const filters = [
    `select=not(mod(n\\,${every}))`,
    ...(opt.crop ? [`crop=${opt.crop}`] : []),
    `scale=${tile}:-2`,
    `tile=${cols}x${rows}`,
  ];
  const input = path.join(dir, `f%04d.${cfg.ext}`);
  ffmpeg(["-i", input, "-vf", filters.join(","), "-fps_mode", "passthrough", "-frames:v", "1", out]);
  return frames.filter((_, i) => i % every === 0).slice(0, cols * rows);
}

function encode(dir, cfg, out) {
  const rate = opt.at ? FPS : FPS / cfg.step;
  const input = path.join(dir, `f%04d.${cfg.ext}`);
  const even = "scale=trunc(iw/2)*2:trunc(ih/2)*2";
  ffmpeg(["-framerate", String(rate), "-i", input, "-vf", even, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", path.resolve(out)]);
}

const seconds = (since) => +((performance.now() - since) / 1000).toFixed(1);

async function main() {
  const started = performance.now();
  const cfg = validate();
  const { page, drop } = variantPage(cfg.htmlPath);
  const workers = [];
  try {
    workers.push(...(await startWorkers(0, 1, page)));
    const { total, scenes, report } = await evaluate(
      workers[0].cdp,
      "({ total: window.TOTAL_FRAMES, scenes: window.SCENES, report: window.report })",
    );
    if (opt.checks) return { report, scenes };

    const listed = frameList(total, scenes, cfg.step);
    if (listed.length === 0) throw new Error("no frames selected");
    const frames = opt.sheet && !opt.mp4 ? sheetOnly(listed) : listed;
    const dir = path.join(path.dirname(cfg.htmlPath), "out", cfg.name);
    const metaPath = path.join(dir, "meta.json");
    const key = inputsKey(page, frames, cfg);
    const cached = existsSync(metaPath) && JSON.parse(readFileSync(metaPath, "utf8")).key === key;
    const renderStart = performance.now();
    if (!cached) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const extra = Math.min(cfg.workers, frames.length) - 1;
      workers.push(...(await startWorkers(1, extra, page)));
      await renderAll(workers, frames, dir, cfg);
      writeFileSync(metaPath, JSON.stringify({ key, frames: frames.length }));
    }
    const renderS = seconds(renderStart);
    const sheet = opt.sheet ? path.join(path.dirname(dir), `${cfg.name}-sheet.png`) : undefined;
    const sheetFrames = sheet ? contactSheet(dir, frames, cfg, sheet) : undefined;
    if (opt.mp4) encode(dir, cfg, opt.mp4);
    return { report, frames: frames.length, cached, workers: workers.length, renderS, totalS: seconds(started), dir, sheet, sheetFrames, mp4: opt.mp4 };
  } finally {
    workers.forEach((w) => w.close());
    drop();
  }
}

main().then(
  (summary) => console.log(JSON.stringify(summary)),
  (err) => {
    console.error(err.message);
    process.exitCode = 1;
  },
);
