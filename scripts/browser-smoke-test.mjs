import { createServer } from "node:http";
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const fixturePath = join(scriptDir, "fixtures", "store-demo.html");
const screenshotPath = join(projectRoot, "docs", "store-assets", "screenshot-1280x800.png");
const frameRoot = join(projectRoot, "docs", "store-assets", "video-frames");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profilePath = await mkdtemp(join(tmpdir(), "ntc-smoke-"));
await mkdir(frameRoot, { recursive: true });

function delay(ms) { return new Promise((resolveDelay) => setTimeout(resolveDelay, ms)); }

async function waitFor(check, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check().catch(() => null);
    if (value) return value;
    await delay(100);
  }
  throw new Error(message);
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener("open", resolveReady, { once: true });
      this.socket.addEventListener("error", rejectReady, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    const result = new Promise((resolveResult, rejectResult) => this.pending.set(id, { resolve: resolveResult, reject: rejectResult }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  close() { this.socket.close(); }
}

const fixture = await readFile(fixturePath);
const bridgeScript = await readFile(join(projectRoot, "bridge.js"), "utf8");
const contentScript = await readFile(join(projectRoot, "content.js"), "utf8");
const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(fixture);
});
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const port = server.address().port;
const pageUrl = `http://127.0.0.1:${port}/`;

const chrome = spawn(chromePath, [
  `--user-data-dir=${profilePath}`,
  "--headless=new",
  "--no-first-run",
  "--disable-default-apps",
  "--remote-debugging-port=0",
  "--window-size=1280,800",
  pageUrl
], { stdio: "ignore", windowsHide: true });

let cdp;
try {
  const portFile = join(profilePath, "DevToolsActivePort");
  const debugPort = await waitFor(async () => {
    const lines = (await readFile(portFile, "utf8")).trim().split(/\r?\n/);
    return Number(lines[0]) || null;
  }, 15000, "Chrome did not expose a debugging port.");

  const pageTarget = await waitFor(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    return targets.find((target) => target.type === "page" && target.url === pageUrl);
  }, 15000, "The test page did not load.");

  cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await waitFor(async () => {
    const result = await cdp.send("Runtime.evaluate", {
      expression: "document.readyState === 'complete' && Boolean(document.querySelector('#checkout'))",
      returnByValue: true
    });
    return result.result.value;
  }, 10000, "The fixture DOM did not become ready.");

  await cdp.send("Runtime.evaluate", { expression: `${bridgeScript}\n//# sourceURL=ntc-bridge-smoke.js` });
  await cdp.send("Runtime.evaluate", {
    expression: "window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };"
  });
  await cdp.send("Runtime.evaluate", { expression: `${contentScript}\n//# sourceURL=ntc-content-smoke.js` });
  await cdp.send("Runtime.evaluate", { expression: "window.__ntcToggle()" });

  async function capture(path) {
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path, Buffer.from(screenshot.data, "base64"));
  }

  await capture(join(frameRoot, "01-activate-picker.png"));

  async function inspect(selector) {
    const rectResult = await cdp.send("Runtime.evaluate", {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.style.position = "static"; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
      returnByValue: true
    });
    if (rectResult.exceptionDetails) throw new Error(rectResult.exceptionDetails.text);
    const { x, y } = rectResult.result.value;
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await delay(150);
    const textResult = await cdp.send("Runtime.evaluate", {
      expression: "document.getElementById('__name-that-component-host__').shadowRoot.getElementById('ntc-body').innerText",
      returnByValue: true
    });
    return textResult.result.value;
  }

  const ideal = await inspect("#checkout");
  if (!ideal.includes("Checkout Button") || !ideal.includes("Pay $48.00") || !ideal.includes("CheckoutButton.tsx:42")) {
    throw new Error(`Ideal React boundary did not render expected details:\n${ideal}`);
  }
  await capture(join(frameRoot, "02-react-component.png"));

  const common = await inspect("input#card-name");
  if (!common.includes("Name on card") || !common.includes("Ada Lovelace")) {
    throw new Error(`Common labeled-input boundary did not render expected details:\n${common}`);
  }
  await capture(join(frameRoot, "03-accessible-input.png"));

  const messy = await inspect("#messy");
  if (!messy.includes("Save & continue") || !messy.includes("日本語") || !messy.includes("🚀")) {
    throw new Error(`Messy Unicode boundary did not render expected details:\n${messy}`);
  }

  await cdp.send("Runtime.evaluate", { expression: "document.querySelector('#messy').style.position = 'absolute'" });
  await inspect("aside[aria-label='Order summary']");
  await capture(join(frameRoot, "04-semantic-panel.png"));
  await inspect("#checkout");
  await capture(screenshotPath);
  console.log("Browser smoke test passed: real bridge/content scripts, React metadata, labeled input, Unicode text, and rendered panel.");
  console.log(`Created ${screenshotPath}`);
} finally {
  if (cdp) cdp.close();
  chrome.kill();
  server.close();
  await Promise.race([
    new Promise((resolveExit) => chrome.once("exit", resolveExit)),
    delay(2000)
  ]);
  const resolvedProfile = resolve(profilePath);
  const resolvedTemp = resolve(tmpdir()) + "\\";
  if (!resolvedProfile.startsWith(resolvedTemp)) {
    throw new Error(`Refusing to remove unexpected profile path: ${resolvedProfile}`);
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await rm(resolvedProfile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 7) console.warn(`Could not clean temporary Chrome profile: ${error.message}`);
      else await delay(250);
    }
  }
}
