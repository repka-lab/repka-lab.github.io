// Headless Edge over the Chrome DevTools Protocol: launch, open a page, evaluate, screenshot.
// Every instance gets its own port and profile, so several can run side by side.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const TRIES = 50;
const RETRY_MS = 200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget(port) {
  for (let i = 0; i < TRIES; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Edge is still starting.
    }
    await sleep(RETRY_MS);
  }
  throw new Error(`Edge on port ${port} did not expose a page target`);
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const waiters = new Map();
  let nextId = 0;

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
    } else if (waiters.has(msg.method)) {
      waiters.get(msg.method)(msg.params);
      waiters.delete(msg.method);
    }
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener("error", () => reject(new Error("CDP socket error")));
    ws.addEventListener("open", () =>
      resolve({
        send(method, params = {}) {
          const id = ++nextId;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej, method }));
        },
        once(method) {
          return new Promise((res) => waiters.set(method, res));
        },
        close: () => ws.close(),
      }),
    );
  });
}

export async function evaluate(cdp, expression, awaitPromise = true) {
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (exceptionDetails) {
    const text = exceptionDetails.exception?.description ?? exceptionDetails.text;
    throw new Error(`page error: ${text}`);
  }
  return result.value;
}

export const setSize = (cdp, width, height) =>
  cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

export async function open(cdp, htmlPath) {
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: pathToFileURL(htmlPath).href });
  await loaded;
}

// format 'png' or 'jpeg'; clip { x, y, width, height, scale } shrinks the shot without touching the layout.
export async function screenshot(cdp, { format = "png", quality, clip } = {}) {
  const params = { format, ...(format === "jpeg" ? { quality } : {}), ...(clip ? { clip } : {}) };
  const { data } = await cdp.send("Page.captureScreenshot", params);
  return Buffer.from(data, "base64");
}

// Starts a headless Edge; close() drops the socket and kills the process tree.
export async function launch({ port, width = 800, height = 600 }) {
  const profile = fileURLToPath(new URL(`.edge/${port}`, import.meta.url));
  const edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "--force-device-scale-factor=1",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const kill = () => spawnSync("taskkill", ["/pid", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
  try {
    const cdp = await connect(await pageTarget(port));
    await cdp.send("Page.enable");
    await setSize(cdp, width, height);
    return {
      cdp,
      close() {
        cdp.close();
        kill();
      },
    };
  } catch (err) {
    kill();
    throw err;
  }
}
