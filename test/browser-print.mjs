// Run against a Vite origin, production preview or deployed MacDraw URL.
// PLAYWRIGHT_MODULE may name an installed Playwright module as a file URL.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Document } from '../src/model/Document.js';
import { createShape } from '../src/model/Shape.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.MACDRAW_TEST_ORIGIN || 'http://127.0.0.1:5174';
const output = new URL(process.env.MACDRAW_PRINT_OUTPUT || '../output/print-qa/', import.meta.url);
await mkdir(output, { recursive: true });
const file = name => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [], errors = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

try {
  for (const { name, width, height, dpr } of [
    { name: 'letter', width: 612, height: 792, dpr: 1 },
    { name: 'a4', width: 595, height: 842, dpr: 1.25 },
    { name: 'legal', width: 612, height: 1008, dpr: 1 },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 850 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.waitForFunction(() => !!window.app?.doc);
    const scene = new Document({ pageWidth: width, pageHeight: height, snapToGrid: false, showRulers: true });
    const ink = { fill: { type: 'solid', color: '#000000', patternId: null }, stroke: { width: 0 } };
    // Build the fixture with the model's own API, without requesting source
    // modules from the live site. Ink at all corners exposes print clipping.
    for (const x of [12, width - 32]) for (const y of [12, height - 32]) {
      scene.addObject(createShape('rect', { x, y, width: 20, height: 20, ...ink }));
    }
    scene.addObject(createShape('text', { x: 48, y: 48, width: 240, height: 30, text: 'Whole drawing - no scrollbars' }));
    scene._defaultFill = ink.fill;
    await page.evaluate(seed => {
      const doc = app.doc.constructor.fromJSON(seed);
      app.loadDocument(doc);
      app.screen.setScale('1');
      document.getElementById('canvas-container').scrollTo(100, 400);
    }, scene.toJSON());
    await settle(page);

    const screen = () => page.evaluate(() => {
      const viewport = document.getElementById('canvas-container');
      return { x: viewport.scrollLeft, y: viewport.scrollTop, overflow: getComputedStyle(viewport).overflow,
        scrollbar: getComputedStyle(viewport, '::-webkit-scrollbar').width };
    });
    const before = await screen();
    assert.equal(before.overflow, 'scroll');
    assert.equal(before.scrollbar, '16px');
    assert.ok(before.x > 0 && before.y > 0);

    // Draw with actual pointer input after scrolling, rather than seeding this box.
    await page.locator('[data-tool="rect"]').click();
    const point = (x, y) => page.evaluate(({ x, y }) => {
      const canvas = app.canvas, bounds = canvas.getBoundingClientRect();
      const viewport = document.getElementById('canvas-container');
      const scale = bounds.width / canvas.clientWidth;
      return { x: bounds.left + (x * app.zoom - viewport.scrollLeft) * scale,
        y: bounds.top + (y * app.zoom - viewport.scrollTop) * scale };
    }, { x, y });
    const from = await point(220, 500), to = await point(280, 560);
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up();
    await settle(page);
    const drawn = await page.evaluate(() => {
      const { x, y, width, height } = app.doc.objects.at(-1);
      return { x, y, width, height };
    });
    for (const [key, expected] of Object.entries({ x: 220, y: 500, width: 60, height: 60 })) {
      assert.ok(Math.abs(drawn[key] - expected) < 1, `scrolled drawing ${key}: ${drawn[key]}`);
    }
    const snapshot = await page.evaluate(() => JSON.stringify(app.doc.toJSON()));
    await page.screenshot({ path: file(`${name}-scrolled-screen.png`) });

    // Capture the SVG synchronously at the real window.print call. Chrome's
    // headless PDF API does not display the blocking native print dialog.
    await page.evaluate(() => {
      window.printCapture = null;
      window.print = () => { window.printCapture = document.getElementById('print-drawing').innerHTML; };
    });
    await page.keyboard.press('Control+p');
    await page.waitForFunction(() => !!window.printCapture);
    assert.equal(await page.locator('#print-drawing').innerHTML(), '');
    assert.equal(await page.evaluate(() => JSON.stringify(app.doc.toJSON())), snapshot);
    assert.deepEqual(await screen(), before, 'Print preserves the on-screen scroll position and bars');
    await page.evaluate(() => { document.getElementById('print-drawing').innerHTML = window.printCapture; });
    await page.setViewportSize({ width: 360, height: 240 });
    await page.emulateMedia({ media: 'print' });
    const print = await page.evaluate(() => {
      const holder = document.getElementById('print-drawing'), svg = holder.firstElementChild;
      const bounds = svg.getBoundingClientRect();
      const style = getComputedStyle(svg);
      return { htmlOverflow: getComputedStyle(document.documentElement).overflow,
        bodyOverflow: getComputedStyle(document.body).overflow,
        htmlHeight: getComputedStyle(document.documentElement).height,
        scrollbarWidth: getComputedStyle(document.documentElement).scrollbarWidth,
        scrollbar: getComputedStyle(document.body, '::-webkit-scrollbar').display,
        corner: getComputedStyle(document.body, '::-webkit-scrollbar-corner').display,
        canvasScrollbar: getComputedStyle(document.getElementById('canvas-container'), '::-webkit-scrollbar').display,
        editor: getComputedStyle(document.getElementById('app')).display,
        holderOverflow: getComputedStyle(holder).overflow, svgDisplay: style.display,
        width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y,
        viewBox: svg.getAttribute('viewBox'),
        rectangles: [...svg.children].filter(el => el.tagName === 'rect' && !el.hasAttribute('data-md-paper'))
          .map(el => Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(el.getAttribute(key))]))) };
    });
    assert.equal(print.htmlOverflow, 'visible');
    assert.equal(print.bodyOverflow, 'visible');
    assert.equal(print.scrollbarWidth, 'none');
    assert.equal(print.scrollbar, 'none');
    assert.equal(print.corner, 'none');
    assert.equal(print.canvasScrollbar, 'none');
    assert.equal(print.editor, 'none');
    assert.equal(print.holderOverflow, 'visible');
    assert.equal(print.svgDisplay, 'block');
    assert.equal(print.viewBox, `0 0 ${width} ${height}`);
    assert.equal(print.rectangles.length, 5);
    assert.deepEqual(print.rectangles.at(-1), drawn, 'Print keeps the scrolled drawing in page coordinates');
    for (const x of [12, width - 32]) for (const y of [12, height - 32]) {
      assert.ok(print.rectangles.some(rect => rect.x === x && rect.y === y && rect.width === 20 && rect.height === 20));
    }
    assert.ok(Math.abs(print.width - width * 96 / 72) < 0.1);
    assert.ok(Math.abs(print.height - height * 96 / 72) < 0.1);
    assert.equal(print.x, 0); assert.equal(print.y, 0);
    // Use the drawing's physical paper size and zero margins to inspect every
    // edge. Printer margins and headers remain the browser/user's choice.
    await page.pdf({ path: file(`${name}-after-scroll.pdf`), width: `${width / 72}in`,
      height: `${height / 72}in`, margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true });
    await page.screenshot({ path: file(`${name}-print.png`), fullPage: true });

    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 1100, height: 850 });
    await page.evaluate(() => { document.getElementById('print-drawing').replaceChildren(); });
    await settle(page);
    assert.deepEqual(await screen(), before, 'Screen scrolling returns after print media');
    await page.evaluate(() => { document.getElementById('canvas-container').scrollBy(-30, -40); });
    await settle(page);
    const after = await screen();
    assert.equal(after.x, before.x - 30); assert.equal(after.y, before.y - 40);
    results.push({ name, dpr, drawn, print, passed: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(file('results.json'), JSON.stringify({ browser: browser.version(), results, errors }, null, 2));
  console.log(`PASS: ${results.length} print scenes, including actual drawing after scrolling, Ctrl+P, full paper bounds, hidden native/custom scrollbar styling and corners, restored screen scrolling; no page errors.`);
} finally {
  await browser.close();
}
