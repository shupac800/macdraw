// Check complete composited tool cells, including ink placement and blank margins.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const glyphs = JSON.parse(await readFile(new URL('../assets/bitmaps/macdraw-1.9-tools.json', import.meta.url)));
const legacy = process.env.MACDRAW_EXPECT_LEGACY_BEARINGS === '1';
const origin = process.env.MACDRAW_TEST_ORIGIN || 'http://127.0.0.1:5174';
const dprs = legacy ? [1.125] : [1, 1.125, 1.5625, 2.2], scales = legacy ? [2] : [1, 2, 3];
const output = new URL('../output/toolbar-centering/', import.meta.url); await mkdir(output, { recursive: true });
const file = name => new URL(name, output).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let checks = 0;
const placement = {}, errors = [];
try {
  for (const dpr of dprs) {
    const context = await browser.newContext({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: dpr });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin); await page.waitForFunction(() => !!window.app);
    for (const scale of scales) {
      await page.evaluate(scale => app.screen.setScale(String(scale)), scale);
      for (const state of ['normal', 'selected', 'locked']) {
        for (const [id, glyph] of Object.entries(glyphs)) {
          const active = state !== 'normal';
          const target = page.locator(`[data-tool="${active ? id : id === 'select' ? 'rect' : 'select'}"]`);
          if (state === 'locked' && id !== 'select') await target.dblclick(); else await target.click();
          await page.mouse.move(0, 0);
          const bounds = await page.locator(`[data-tool="${id}"] canvas`).boundingBox();
          assert.ok(Math.abs(bounds.x * dpr - Math.round(bounds.x * dpr)) < 0.02);
          assert.ok(Math.abs(bounds.y * dpr - Math.round(bounds.y * dpr)) < 0.02);
          const shot = await page.screenshot();
          const left = 4 + (legacy ? 0 : glyph.bearing + glyph.sourceCrop[0]), top = 2 + glyph.sourceCrop[1];
          const result = await page.evaluate(async ({ shot, x, y, scale, active, glyph, left, top }) => {
            const image = new Image(); image.src = shot; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            const pixels = ctx.getImageData(x, y, 24 * scale, 16 * scale).data;
            let failures = 0, minX = Infinity, maxX = -1;
            for (let y = 0; y < 16 * scale; y++) for (let x = 0; x < 24 * scale; x++) {
              const row = Math.floor(y / scale) - top, column = Math.floor(x / scale) - left;
              const ink = glyph.rows[row]?.[column] === '1';
              const expected = ink === active ? 255 : 0, i = (y * 24 * scale + x) * 4;
              if (pixels[i] !== expected || pixels[i + 1] !== expected || pixels[i + 2] !== expected || pixels[i + 3] !== 255) failures++;
              if (pixels[i] === (active ? 255 : 0)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
            }
            return { failures, left: minX / scale, right: (maxX + 1) / scale, center: (minX + maxX + 1) / (2 * scale) };
          }, { shot: `data:image/png;base64,${shot.toString('base64')}`, x: Math.round(bounds.x * dpr), y: Math.round(bounds.y * dpr), scale, active, glyph, left, top });
          assert.equal(result.failures, 0, `${id}: DPR ${dpr}, scale ${scale}, ${state}`);
          if (!legacy) assert.equal(result.center, 11.5, `${id}: common original ink center`);
          placement[id] = { left: result.left, right: result.right, center: result.center, top, bearing: glyph.bearing };
          checks++;
        }
        if (dpr === 1.125 && scale === 2) {
          const target = page.locator(`[data-tool="${state === 'normal' ? 'select' : 'text'}"]`);
          if (state === 'locked') await target.dblclick(); else await target.click();
          await page.mouse.move(0, 0);
          const label = `${legacy ? 'before' : 'after'}-${state}`;
          await page.screenshot({ path: file(`${label}.png`) });
          const toolbar = await page.locator('#toolbar').boundingBox();
          await page.screenshot({ clip: toolbar, path: file(`${label}-palette.png`) });
        }
      }
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL(`${legacy ? 'before' : 'after'}-results.json`, output), JSON.stringify({ origin, browser: await browser.version(), checks, dprs, scales, placement, errors }, null, 2));
  console.log(`${checks} complete-cell screenshot checks passed; ${legacy ? 'legacy placement recorded' : 'all ten ink centers aligned at column 11.5'}`);
} finally { await browser.close(); }
