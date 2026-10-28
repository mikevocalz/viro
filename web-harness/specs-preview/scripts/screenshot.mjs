#!/usr/bin/env node
// Starts the dev server, opens each page in headless Chrome and writes
// screenshots to screenshots/. Fails when a page logs an error, a scene does
// not settle, or the canvas is a single flat color.
//
//   node scripts/screenshot.mjs [--out screenshots] [--port 4318] [--only <name prefix>]
//
// Uses the installed Google Chrome (channel "chrome"); Playwright's bundled
// Chromium is not required.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const out = path.resolve(root, arg("--out", "screenshots"));
const port = Number(arg("--port", "4318"));
/** `--only preview` runs the shots whose name starts with "preview". */
const only = arg("--only", "");

const SHOTS = [
  { name: "preview-platform-lab", url: "/index.html?fixture=platform-lab-scene", viewport: { width: 1440, height: 900 }, expect: "ready" },
  { name: "preview-all-fields", url: "/index.html?fixture=all-fields", viewport: { width: 1440, height: 900 }, expect: "degraded" },
  { name: "preview-invalid", url: "/index.html?fixture=invalid-parent", viewport: { width: 1280, height: 760 }, expect: "error" },
  { name: "preview-phone", url: "/index.html?fixture=platform-lab-scene", viewport: { width: 390, height: 844 }, expect: "ready" },
  { name: "gallery", url: "/gallery.html", viewport: { width: 1440, height: 1800 }, expect: "gallery" },
];

await mkdir(out, { recursive: true });
const server = await createServer({ root, configFile: path.join(root, "vite.config.ts"), server: { port, strictPort: true }, logLevel: "warn" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const failures = [];
try {
  for (const shot of SHOTS.filter((s) => s.name.startsWith(only))) {
    const context = await browser.newContext({ viewport: shot.viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && !/Failed to load resource: the server responded with a status of 404/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:" + port + shot.url, { waitUntil: "load" });
    if (shot.expect === "gallery") {
      await page.waitForFunction(() => window.__specsGallery?.settled === true, null, { timeout: 30000 });
    } else {
      await page.waitForFunction((want) => window.__specsPreview?.lifecycle === want, shot.expect, { timeout: 30000 });
    }
    await page.waitForTimeout(600);
    const flat = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
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
    const file = path.join(out, shot.name + ".png");
    await page.screenshot({ path: file, fullPage: shot.expect === "gallery" });
    const state = await page.evaluate(() => window.__specsPreview ? { lifecycle: window.__specsPreview.lifecycle, diagnostics: window.__specsPreview.diagnostics } : { gallery: window.__specsGallery?.cards });
    console.log(shot.name + ": " + file + " " + JSON.stringify(state));
    if (errors.length) failures.push(shot.name + ": console errors: " + errors.join(" | "));
    if (flat) failures.push(shot.name + ": canvas is a flat color");
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
