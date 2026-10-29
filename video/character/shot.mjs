// Screenshot whole pages through headless Edge, sized to their content, and print each page's report.
// Usage: node shot.mjs <page.html> <out.png> [<page.html> <out.png> ...]
import { writeFileSync } from "node:fs";
import path from "node:path";
import { evaluate, launch, open, screenshot, setSize } from "../tools/cdp.mjs";

const PORT = 9335;
const START_WIDTH = 800;
const START_HEIGHT = 600;

const args = process.argv.slice(2).map((p) => path.resolve(p));
if (args.length === 0 || args.length % 2 !== 0) {
  console.error("usage: node shot.mjs <page.html> <out.png> [...]");
  process.exit(2);
}

async function shoot(cdp, htmlPath, pngPath) {
  await setSize(cdp, START_WIDTH, START_HEIGHT);
  await open(cdp, htmlPath);
  const size = await evaluate(
    cdp,
    `window.episodeReady.then(() => ({ w: document.body.scrollWidth, h: document.documentElement.scrollHeight }))`,
  );
  await setSize(cdp, size.w, size.h);
  writeFileSync(pngPath, await screenshot(cdp));
  console.log(`${path.basename(pngPath)}: ${size.w}x${size.h}`);
  const report = await evaluate(cdp, "window.report ?? ''");
  if (report) console.log(typeof report === "string" ? report : JSON.stringify(report));
}

const edge = await launch({ port: PORT, width: START_WIDTH, height: START_HEIGHT });
try {
  for (let i = 0; i < args.length; i += 2) await shoot(edge.cdp, args[i], args[i + 1]);
} finally {
  edge.close();
}
