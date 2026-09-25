import { chromium } from '/Users/mikevocalz/moyo-rive-panel/node_modules/playwright-core/index.mjs';

const EXE = '/Users/mikevocalz/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = 'http://localhost:8087/';

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => errors.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

const canvasPixels = () => page.evaluate(() => {
  const c = document.querySelector('#viroCanvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return { lit: -1, note: 'no ctx' };
  const px = new Uint8Array(4 * c.width * c.height);
  gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let lit = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) lit++;
  return { lit, total: c.width * c.height };
});

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.viroModule, { timeout: 20000 });
await page.waitForTimeout(3000);

const status1 = await page.textContent('#status');
const f1 = await canvasPixels();
await page.screenshot({ path: '/tmp/viro-smoke-1-cube.png' });
await page.waitForTimeout(1200);
const f2 = await canvasPixels();
await page.screenshot({ path: '/tmp/viro-smoke-2-cube.png' });

// Exercise the lifecycle: destroy → confirm cleared → re-init + rebuild cube.
const life = await page.evaluate(() => {
  const m = window.viroModule;
  const out = { hasDestroy: typeof m.destroyViroScene === 'function' };
  if (!out.hasDestroy) return out;
  m.destroyViroScene();
  out.destroyed = true;
  try {
    m.initViroScene('#viroCanvas', 800, 600);
    m.viroBuildDemoCube();
    out.reinit = 'ok';
  } catch (e) {
    out.reinit = 'threw: ' + e;
  }
  return out;
});
await page.waitForTimeout(2500);
const f3 = await canvasPixels();
await page.screenshot({ path: '/tmp/viro-smoke-3-reinit.png' });
const status3 = await page.textContent('#status');

console.log(JSON.stringify({ status1, f1, f2, life, status3, f3 }, null, 2));
console.log('--- ERRORS (' + errors.length + ') ---');
errors.forEach((l) => console.log(l));
await browser.close();
process.exit(0);
