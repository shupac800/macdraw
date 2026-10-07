// Rendered-state regressions: bitmap tools/text and reclaimed drawing area.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.MACDRAW_TEST_ORIGIN || 'http://127.0.0.1:5174';
const output = new URL('../output/ui-correction/', import.meta.url);
await mkdir(output, { recursive: true });
const file = name => new URL(name, output).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [], errors = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function checkScreenshot(page, selected, dpr) {
  const bounds = await page.locator('#drawing-canvas').boundingBox(), shot = await page.screenshot();
  const failures = await page.evaluate(async ({ shot, bounds, selected, dpr }) => {
    const image = new Image(); image.src = shot; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const scale = Number(document.getElementById('app').dataset.screenScale);
    const pixels = ctx.getImageData(Math.round(bounds.x * dpr) + selected.x * scale, Math.round(bounds.y * dpr) + selected.y * scale, selected.width * scale, selected.height * scale).data;
    let bad = 0;
    for (let y = 0; y < selected.height * scale; y++) for (let x = 0; x < selected.width * scale; x++) {
      const expected = selected.pixels[(Math.floor(y / scale) * selected.width + Math.floor(x / scale)) * 4];
      const i = (y * selected.width * scale + x) * 4;
      if (pixels[i] !== expected || pixels[i + 1] !== expected || pixels[i + 2] !== expected) bad++;
    }
    return bad;
  }, { shot: `data:image/png;base64,${shot.toString('base64')}`, bounds, selected, dpr });
  assert.equal(failures, 0, `composited text differs from bitmap at DPR ${dpr}`);
}
try {
  for (const dpr of [1, 1.125, 1.25, 1.5, 2.2]) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: dpr });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin); await page.waitForFunction(() => !!window.app);
    await page.evaluate(async () => {
      const { createShape } = await import('/src/model/Shape.js');
      app.doc.clear(); app.doc.snapToGrid = false; app.doc.showGrid = false; app.doc.showRulerLines = false;
      app.doc.showRulers = true; app.screen.setScale('2');
      window.uiText = createShape('text', { x: 60, y: 40, width: 96, height: 16, text: 'Bitmap text' });
      app.doc.addObject(uiText); app._handleResize();
    });
    assert.equal(await page.locator('#statusbar').isVisible(), false);
    assert.equal(await page.locator('#status-text').textContent(), '');
    assert.deepEqual(await page.evaluate(() => ({ margin: getComputedStyle(document.getElementById('document-window')).margin, shadow: getComputedStyle(document.getElementById('document-window')).boxShadow })), { margin: '0px', shadow: 'none' });
    // Repeat actual toolbar clicks/double clicks, not only model state changes.
    for (let repeat = 0; repeat < 2; repeat++) {
      for (const id of ['rect', 'oval', 'text', 'line', 'roundRect', 'select']) {
        const tool = page.locator(`[data-tool="${id}"]`);
        await tool.click(); assert.equal(await tool.getAttribute('aria-pressed'), 'true');
        if (id !== 'select') {
          await tool.dblclick(); assert.equal(await page.evaluate(() => app.toolManager.lockedTool), id);
          assert.equal(await tool.evaluate(button => getComputedStyle(button).outlineStyle), 'none');
        }
      }
    }
    // Compare painted editing/selection pixels to committed pixels at each zoom.
    for (const zoom of [0.5, 1, 2]) {
      await page.evaluate(zoom => {
        app.finishText(); app.selection.clear(); app.setZoom(zoom);
        document.getElementById('canvas-container').scrollTo(0, 0); app.renderer.render();
      }, zoom);
      const capture = () => page.evaluate(() => {
        const canvas = app.canvas, ctx = canvas.getContext('2d'), z = app.zoom;
        const x = Math.round(uiText.x * z), y = Math.round(uiText.y * z);
        const width = Math.round(uiText.width * z), height = Math.round(uiText.height * z);
        return { x, y, width, height, pixels: Array.from(ctx.getImageData(x, y, width, height).data) };
      });
      const committed = await capture();
      await page.evaluate(() => { app.toolManager.chooseTool('text'); app.toolManager._tools.text.startEditing(uiText); });
      const editor = page.getByRole('textbox', { name: 'Edit drawing text' });
      await editor.press('End'); await settle(page);
      // Caret is beyond the last ink; exclude its column from the comparison.
      const unselected = await capture();
      const unchanged = await page.evaluate(({ committed, unselected }) => {
        const end = app.canvas.getContext('2d').measureText(uiText.text).width * app.zoom;
        let failures = 0;
        for (let y = 0; y < committed.height; y++) for (let x = 0; x < Math.floor(end); x++) {
          const i = (y * committed.width + x) * 4;
          if (committed.pixels[i] !== unselected.pixels[i]) failures++;
        }
        return failures;
      }, { committed, unselected });
      assert.equal(unchanged, 0, `editing changed glyphs at DPR ${dpr}, zoom ${zoom}`);
      await editor.press('Control+a'); await settle(page);
      const selected = await capture();
      assert.ok(selected.pixels.every((value, index) => index % 4 === 3 ? value === 255 : value === 0 || value === 255));
      assert.notDeepEqual(selected.pixels, committed.pixels);
      // Test the actual composited screenshot, including the transparent editor.
      await checkScreenshot(page, selected, dpr);
      if (dpr === 1.125 && zoom === 1) await page.screenshot({ path: file('highlighted-text-DPR-1.125.png') });
      // Partial character selection, replacement, undo and cancel.
      await editor.press('Home'); await editor.press('ArrowRight'); await editor.press('Shift+ArrowRight');
      assert.deepEqual(await editor.evaluate(e => [e.selectionStart, e.selectionEnd]), [1, 2]);
      await editor.press('x'); await editor.press('Escape');
      assert.equal(await page.evaluate(() => uiText.text), 'Bitmap text');
      assert.equal(await page.evaluate(() => !!app.doc._textDraft), false);
      results.push(`PASS editing/highlight screenshot and cancel, DPR ${dpr}, zoom ${zoom}`);
    }
    await page.evaluate(() => {
      app.setZoom(1); document.getElementById('canvas-container').scrollTo(0, 0);
      app.toolManager.chooseTool('text'); app.toolManager._tools.text.startEditing(uiText);
    });
    const editor = page.getByRole('textbox', { name: 'Edit drawing text' });
    const point = async (x, y) => page.evaluate(({ x, y }) => {
      const r = app.canvas.getBoundingClientRect(), scale = r.width / app.canvas.clientWidth, v = document.getElementById('canvas-container');
      return { x: r.left + (x * app.zoom - v.scrollLeft) * scale, y: r.top + (y * app.zoom - v.scrollTop) * scale };
    }, { x, y });
    const from = await point(61, 44), to = await point(90, 44);
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up();
    assert.ok(await editor.evaluate(e => e.selectionEnd > e.selectionStart), 'pointer selects characters on bitmap positions');
    await editor.press('End'); await editor.press('!'); await editor.press('Control+Enter');
    assert.equal(await page.evaluate(() => uiText.text), 'Bitmap text!');
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => { uiText = app.doc.getObjectById(uiText.id); return uiText.text; }), 'Bitmap text');
    results.push(`PASS pointer character selection, caret typing, commit and undo, DPR ${dpr}`);
    await page.evaluate(() => {
      uiText.text = 'First line\n\nSecond line wraps'; uiText.wrap = true; uiText.width = 96; uiText.height = 64;
      uiText.textAlign = 'right'; uiText.textDecoration = 'underline'; uiText.shadow = true;
      app.toolManager.chooseTool('text'); app.toolManager._tools.text.startEditing(uiText);
    });
    assert.equal(await editor.evaluate(e => e.spellcheck), false);
    await editor.press('Control+Home'); await editor.press('ArrowDown');
    assert.ok(await editor.evaluate(e => e.selectionStart > 0));
    await editor.press('Control+a'); await settle(page);
    const paragraph = await page.evaluate(() => {
      app.renderer.render(); const x = 60, y = 40, width = 96, height = 64;
      return { x, y, width, height, pixels: Array.from(app.canvas.getContext('2d').getImageData(x, y, width, height).data) };
    });
    await checkScreenshot(page, paragraph, dpr);
    if (dpr === 1.125) await page.screenshot({ path: file('highlighted-paragraph-DPR-1.125.png') });
    await editor.press('Escape');
    results.push(`PASS wrapped/blank lines, right alignment, underline/shadow and keyboard caret, DPR ${dpr}`);
    // The original manual requires the selection pointer for object handles.
    await page.evaluate(() => app.toolManager.chooseTool('text'));
    const p = await point(70, 46); await page.mouse.click(p.x, p.y);
    assert.equal(await page.evaluate(() => app.toolManager.getActiveTool()), 'text');
    await editor.press('Control+Enter');
    await page.locator('[data-tool="select"]').click();
    await page.mouse.click(p.x, p.y);
    const handle = await page.evaluate(async () => {
      const { getHandlePositions, getSelectionHandleBounds } = await import('/src/util/geometry.js');
      return getHandlePositions(getSelectionHandleBounds(uiText, app.zoom, true)).e;
    });
    const h = await point(handle.x, handle.y); await page.mouse.move(h.x, h.y);
    assert.equal(await page.locator('#drawing-canvas').evaluate(c => c.style.cursor), 'ew-resize');
    // Viewports and display zoom change physical geometry without stretching bits.
    for (const viewport of [{ width: 760, height: 560 }, { width: 1280, height: 800 }, { width: 1800, height: 1200 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => app.screen.setScale('auto')); await settle(page);
      assert.ok(await page.locator('[data-tool="polygon"]').isVisible());
      const geometry = await page.evaluate(() => {
        const root = document.getElementById('app').getBoundingClientRect();
        const doc = document.getElementById('document-window').getBoundingClientRect();
        return { gap: doc.left - root.left, width: doc.width - root.width, canvasHeight: app.canvas.height };
      });
      assert.equal(geometry.gap, 0); assert.equal(geometry.width, 0); assert.ok(geometry.canvasHeight >= 260);
    }
    await page.screenshot({ path: file(`reclaimed-window-DPR-${dpr}.png`) });
    await page.locator('#style-preview').click(); assert.ok(await page.getByRole('menu', { name: 'Fill' }).isVisible());
    await page.keyboard.press('Escape');
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('ui-results.json', output), JSON.stringify({ browser: await browser.version(), results, errors }, null, 2));
  console.log(`${results.length} UI/text scenarios passed; screenshots verified against canvas pixels`);
} finally { await browser.close(); }
