#!/usr/bin/env node
// Serves storybook-static/ on a local port, opens story iframes in headless
// Chrome (incognito context) and writes PNGs to screenshots/storybook/.
// Fails when a story logs an error, does not settle, ends in the wrong
// lifecycle, is missing an expected Lens panel, or its canvas is one flat color.
//
//   npm run build-storybook && node scripts/storybook-screenshots.mjs [--port 6007] [--only <story id prefix>]
//
// Uses the installed Google Chrome (channel "chrome").
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const staticDir = path.join(root, "storybook-static");
const out = path.join(root, "screenshots", "storybook");
const port = Number(arg("--port", "6007"));
const only = arg("--only", "");

/** Story ID, expected lifecycle, Lens panels that must be open, extra wait in ms. */
const SHOTS = [
  { id: "scene-primitives--transforms", lifecycle: "ready" },
  { id: "scene-primitives--text", lifecycle: "ready" },
  { id: "scene-primitives--model", lifecycle: "ready" },
  { id: "scene-primitives--polyline", lifecycle: "ready" },
  { id: "scene-primitives--missing-assets", lifecycle: "degraded", panels: ["error"] },
  { id: "premium-components--spatial-panel", lifecycle: "ready" },
  { id: "premium-components--panel-text", lifecycle: "ready" },
  { id: "premium-components--panel-image", lifecycle: "degraded", panels: ["error"] },
  { id: "premium-components-panelbutton--default", lifecycle: "ready" },
  { id: "premium-components-panelbutton--hover", lifecycle: "ready" },
  { id: "premium-components-panelbutton--pressed", lifecycle: "ready" },
  { id: "premium-components-panelbutton--disabled", lifecycle: "ready" },
  { id: "premium-components-panelbutton--error-state", lifecycle: "ready" },
  { id: "premium-components-panelbutton--all-states", lifecycle: "ready" },
  { id: "premium-components-spatialscrollview--top", lifecycle: "ready" },
  { id: "premium-components-spatialscrollview--scrolled", lifecycle: "ready" },
  { id: "premium-components-modelviewer--ready", lifecycle: "ready" },
  { id: "premium-components-modelviewer--turntable", lifecycle: "ready", wait: 1500 },
  { id: "premium-components-modelviewer--loading", lifecycle: "loading", panels: ["loading"] },
  { id: "premium-components-modelviewer--loading", name: "premium-components-modelviewer--loading-slow", lifecycle: "loading", panels: ["loading"], wait: 2600 },
  { id: "premium-components-modelviewer--load-error", lifecycle: "degraded", panels: ["error"] },
  { id: "experience-states--rejected", lifecycle: "error", panels: ["error"] },
  { id: "experience-states--hand-tracking-unavailable", lifecycle: "ready", panels: ["notice"] },
  { id: "experience-states--world-query-unsupported", lifecycle: "ready", panels: ["notice"] },
  { id: "experience-states--high-contrast", lifecycle: "ready" },
  { id: "experience-states--high-contrast-off", lifecycle: "ready" },
];

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".glb": "model/gltf-binary", ".woff2": "font/woff2" };

const server = createServer((req, res) => {
  const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = path.resolve(staticDir, "." + (rel.endsWith("/") ? rel + "index.html" : rel));
  if (!file.startsWith(staticDir + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
  createReadStream(file).pipe(res);
});

if (!existsSync(path.join(staticDir, "iframe.html"))) {
  console.error("storybook-static/iframe.html not found. Run npm run build-storybook first.");
  process.exit(1);
}
await mkdir(out, { recursive: true });
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const failures = [];
try {
  for (const shot of SHOTS.filter((s) => (s.name ?? s.id).startsWith(only))) {
    const name = shot.name ?? shot.id;
    // newContext() is Playwright's incognito profile: no cookies or storage carried between shots.
    const context = await browser.newContext({ viewport: { width: 1200, height: 860 } });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && !/status of 404/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + port + "/iframe.html?viewMode=story&id=" + shot.id, { waitUntil: "load" });
    try {
      await page.waitForFunction(
        (want) => {
          const s = window.__specsStory;
          if (!s || s.frames < 20) return false;
          return want === "loading" ? s.lifecycle === "loading" && s.panels.includes("loading") : s.settled && s.lifecycle === want;
        },
        shot.lifecycle,
        { timeout: 30000 }
      );
    } catch {
      failures.push(name + ": did not reach " + shot.lifecycle);
    }
    await page.waitForTimeout(shot.wait ?? 700);
    const state = await page.evaluate(() => {
      const s = window.__specsStory;
      return s ? { lifecycle: s.lifecycle, codes: [...new Set(s.codes)], panels: s.panels } : null;
    });
    const flat = await page.evaluate(() => {
      const canvas = document.querySelector(".specs-story canvas");
      if (!canvas) return true;
      const probe = document.createElement("canvas");
      probe.width = 64;
      probe.height = 64;
      const ctx = probe.getContext("2d");
      ctx.drawImage(canvas, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      const seen = new Set();
      for (let i = 0; i < data.length; i += 4) seen.add((data[i] >> 3) + "," + (data[i + 1] >> 3) + "," + (data[i + 2] >> 3));
      return seen.size < 4;
    });
    const file = path.join(out, name + ".png");
    await page.screenshot({ path: file });
    console.log(name + ": " + path.relative(root, file) + " " + JSON.stringify(state));
    for (const panel of shot.panels ?? []) if (!state?.panels.includes(panel)) failures.push(name + ": " + panel + " panel not open");
    if (state && state.lifecycle !== shot.lifecycle) failures.push(name + ": lifecycle " + state.lifecycle + ", expected " + shot.lifecycle);
    if (errors.length) failures.push(name + ": console errors: " + errors.join(" | "));
    if (flat) failures.push(name + ": canvas is a flat color");
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
