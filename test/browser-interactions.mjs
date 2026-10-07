// Run against the local fidelity checkout's Vite origin. Seed scenes through
// the model, then exercise real pointer/keyboard events through InputHandler.
// PLAYWRIGHT_MODULE may name an installed Playwright module as a file URL.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const origin = process.env.MACDRAW_TEST_ORIGIN || 'http://127.0.0.1:5174';
const output = new URL('../output/interaction-qa/', import.meta.url);
await mkdir(output, { recursive: true });
const results = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/test/pixel-rendering.html`);
  await page.waitForSelector('#summary[data-failures]');
  assert.equal(await page.locator('#summary').getAttribute('data-failures'), '0');
  results.push(await page.locator('#summary').textContent());
  await page.goto(origin);
  await page.waitForFunction(() => !!window.app);
  assert.deepEqual(await page.evaluate(()=>[app.doc.snapToGrid,app.doc.showRulers]),[true,false]);
  results.push('PASS: new document starts with alignment grid on and rulers hidden');
  assert.equal(await page.evaluate(async () => {
    const [{Document},{Selection},{createShape},{Renderer},{SelectionOverlay}] = await Promise.all([
      import('/src/model/Document.js'), import('/src/model/Selection.js'), import('/src/model/Shape.js'), import('/src/view/Renderer.js'), import('/src/view/SelectionOverlay.js')]);
    const doc=new Document({snapToGrid:false,showRulers:true}), selection=new Selection(), canvas=document.createElement('canvas'); canvas.width=canvas.height=128;
    doc.showRulerLines=false;
    const ghost=createShape('rect',{x:20,y:20,width:80,height:80,stroke:{width:2,color:'#000'}});
    doc.addObject(ghost); doc.addObject(createShape('rect',{width:128,height:128,fill:{type:'solid',color:'#000'},stroke:{width:0}}));
    const renderer=new Renderer(canvas,doc,selection), overlay=new SelectionOverlay(doc,selection);
    overlay.trackingIds=[ghost.id]; renderer.setSelectionOverlay(overlay); renderer.render();
    const ctx=canvas.getContext('2d'); return ctx.getImageData(20,50,1,1).data[0]===255 && ctx.getImageData(50,50,1,1).data[0]===0;
  }),true);
  results.push('PASS: tracking outline inverts a foreground black fill and reveals the background inside');
  await page.evaluate(async () => {
    const { createShape } = await import('/src/model/Shape.js');
    const a = window.app; a.doc.clear(); a.selection.clear(); a.commandStack.clear(); a.doc.showRulerLines = false; a.doc.snapToGrid = false; a.doc.showRulers = true; a._handleResize();
    const box = createShape('rect', {x:60,y:40,width:100,height:70});
    const text = createShape('text', {x:80,y:60,width:72,height:16,text:'Lisa feel'});
    const other = createShape('oval', {x:220,y:40,width:60,height:70});
    a.doc.addObject(box); a.doc.addObject(text); a.doc.addObject(other);
    a.selection.selectMultiple([box.id,text.id]); a.actions.group(); a.selection.clear(); a.commandStack.clear();
    window.testIds = {box:box.id,text:text.id,other:other.id};
  });
  const point = async (x,y) => page.evaluate(({x,y}) => {
    const c = document.getElementById('drawing-canvas'), r = c.getBoundingClientRect(), v = c.closest('#canvas-container'), scale = r.width/c.clientWidth;
    return {x:r.left+(x*app.zoom-v.scrollLeft)*scale,y:r.top+(y*app.zoom-v.scrollTop)*scale};
  }, {x,y});
  const click = async (x,y) => {const p=await point(x,y); await page.mouse.click(p.x,p.y);};
  const drag = async (x,y,tx,ty) => {const from=await point(x,y),to=await point(tx,ty); await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(to.x,to.y,{steps:8}); await page.mouse.up();};
  const state = () => page.evaluate(() => ({objects:structuredClone(app.doc.objects),selected:[...app.selection.ids],canUndo:app.commandStack.canUndo}));
  await click(70,80);
  let s=await state(); assert.equal(s.selected.length,2);
  const before = structuredClone(s.objects), testBox = s.objects.find(o=>o.type==='rect');
  await page.keyboard.down('Shift'); await drag(10,10,310,130); await page.keyboard.up('Shift');
  s=await state(); assert.deepEqual(s.selected,[s.objects.find(o=>o.type==='oval').id]); assert.deepEqual(s.objects,before); assert.equal(s.canUndo,false);
  results.push('PASS: pointer Shift marquee toggles the group off and the oval on without changing geometry');
  await click(70,80);
  const from=await point(70,80),to=await point(100,100); await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(to.x,to.y,{steps:5});
  await page.waitForFunction(() => !!app.selectionOverlay.trackingIds);
  await page.screenshot({path:new URL('drag-ghost.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await page.keyboard.press('Escape'); await page.mouse.up();
  assert.deepEqual((await state()).objects,before); assert.equal((await state()).canUndo,false);
  results.push('PASS: Escape cancels a captured grouped drag and clears the ghost');
  await drag(70,80,100,100);
  s=await state(); assert.equal(s.objects.find(o=>o.id===testBox.id).x,testBox.x+30);
  assert.equal(s.objects.find(o=>o.type==='text').x,before.find(o=>o.type==='text').x+30);
  await page.keyboard.press('Control+z'); assert.deepEqual((await state()).objects,before);
  await page.keyboard.press('Control+Shift+z'); assert.equal((await state()).objects.find(o=>o.type==='text').x,110);
  results.push('PASS: grouped pointer drag, Ctrl+Z and Ctrl+Shift+Z are atomic');
  await page.evaluate(() => {app.actions.ungroup(); app.commandStack.clear();});
  const labelPoint=await point(115,85); await page.mouse.dblclick(labelPoint.x,labelPoint.y);
  await page.locator('.text-editor').waitFor(); await page.locator('.text-editor').fill('draft cancelled'); await page.keyboard.press('Escape');
  assert.equal((await state()).objects.find(o=>o.type==='text').text,'Lisa feel');
  results.push('PASS: double-click text draft cancels without overwriting the label');
  // Create and commit text using actual tool selection, click and keyboard.
  await page.locator('[data-tool="text"]').click(); await click(300,160); await page.locator('.text-editor').waitFor();
  await page.locator('.text-editor').fill('New text'); await page.keyboard.press('Control+Enter');
  assert.equal((await state()).objects.filter(o=>o.type==='text').length,2);
  await page.screenshot({path:new URL('text-selection.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  results.push('PASS: new text commits and displays padded selection handles');
  await page.keyboard.type('Paragraph'); await page.locator('.text-editor').waitFor();
  assert.equal(await page.locator('.text-editor').inputValue(),'Paragraph');
  await page.keyboard.press('Control+Enter');
  assert.equal((await state()).objects.at(-1).wrap,true);
  results.push('PASS: typing over a selection creates a paragraph matching its boundary');
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(async()=>{
    const {createShape}=await import('/src/model/Shape.js');
    const width=app.doc.pageWidth,height=app.doc.pageHeight;
    app.doc.pageWidth=app.doc.pageHeight=1200;
    const marker=createShape('rect',{x:650,y:700,width:40,height:40});app.doc.addObject(marker);app.selection.select(marker.id);
    app.setZoom(0.5);app.setZoom(1);
    const viewport=document.getElementById('canvas-container');
    const centered=Math.abs(viewport.scrollLeft+viewport.clientWidth/2-670)<=1 && Math.abs(viewport.scrollTop+viewport.clientHeight/2-720)<=1;
    app.doc.removeObject(marker.id);app.selection.clear();app.doc.pageWidth=width;app.doc.pageHeight=height;app._handleResize();viewport.scrollTo(0,0);
    return centered;
  }),true);
  results.push('PASS: Normal Size centers the selected object in the viewport');
  // A stationary held pointer continues scrolling at the viewport edge.
  await page.evaluate(() => {app.selection.clear(); app.setZoom(1); document.getElementById('canvas-container').scrollTo(0,0);});
  const edge=await page.locator('#canvas-container').boundingBox();
  const start=await point(10,180); await page.mouse.move(start.x,start.y); await page.mouse.down(); await page.mouse.move(edge.x+edge.width-3,edge.y+edge.height-3);
  await page.waitForFunction(() => document.getElementById('canvas-container').scrollTop > 24);
  await page.keyboard.press('Escape'); await page.mouse.up();
  const scroll=await page.evaluate(() => document.getElementById('canvas-container').scrollTop);
  await page.waitForTimeout(100); assert.equal(await page.evaluate(() => document.getElementById('canvas-container').scrollTop),scroll);
  results.push('PASS: stationary edge pointer autoscrolls and Escape stops it');
  await page.evaluate(() => {document.getElementById('canvas-container').scrollTo(0,0); app.selection.clear(); app.selection.selectMultiple(app.doc.objects.filter(o=>o.type==='rect'||o.text==='Lisa feel').map(o=>o.id)); app.actions.alignObjects('center','middle');});
  await page.screenshot({path:new URL('centered-label.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  assert.deepEqual(errors,[]);
  results.push('PASS: no uncaught browser errors');
  await writeFile(new URL('results.json',output),JSON.stringify({browser:await browser.version(),origin,results,errors},null,2));
  console.log(results.join('\n'));
} finally {await browser.close();}
