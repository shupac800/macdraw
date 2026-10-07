// This manual browser regression suite uses the real Canvas implementation,
// not jsdom. Open /test/pixel-rendering.html on the development server.
import { PatternRegistry, monochromePixels } from '../src/util/patterns.js';
import { renderShape, createShape, getBounds, hitTest } from '../src/model/Shape.js';
import { Document } from '../src/model/Document.js';
import { Selection } from '../src/model/Selection.js';
import { Clipboard } from '../src/model/Clipboard.js';
import { CommandStack } from '../src/commands/CommandStack.js';
import { SelectTool } from '../src/controller/tools/SelectTool.js';
import { EditorActions } from '../src/controller/EditorActions.js';

await document.fonts.load('12px Chicago');

let passed = 0, failed = 0;
const results = document.getElementById('results');
function check(name, callback) {
  const row = document.createElement('li');
  try { callback(); passed++; row.textContent = `PASS: ${name}`; }
  catch (error) { failed++; row.textContent = `FAIL: ${name}: ${error.message}`; }
  results.append(row);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function checkerboard(canvas, magnification = 1) {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let black = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    const expected = (Math.floor(x / magnification) + Math.floor(y / magnification)) % 2 === 0 ? 0 : 255;
    assert(data[i] === expected && data[i + 1] === expected && data[i + 2] === expected && data[i + 3] === 255, `wrong bit at (${x}, ${y}): ${data[i]}, expected ${expected}`);
    if (data[i] === 0) black++;
  }
  assert(black === canvas.width * canvas.height / 2, 'density is not exactly 50%');
}

for (const zoom of [0.125, 0.5, 1, 1.25, 2, 4]) for (const angle of [0, Math.PI / 2, Math.PI / 7]) {
  check(`50% checkerboard: zoom ${zoom}, rotation ${Math.round(angle * 180 / Math.PI)}°`, () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const patterns = new PatternRegistry(); patterns.init(ctx);
    ctx.translate(64.25, 63.75); ctx.rotate(angle); ctx.scale(zoom, zoom);
    renderShape(ctx, createShape('rect', { x: -4096, y: -4096, width: 8192, height: 8192, stroke: { width: 0 }, fill: { type: 'pattern', color: '#000', patternId: 2 } }), patterns);
    // Check raw pixels before thresholding, so antialiasing cannot hide a failure.
    checkerboard(canvas);
    if (zoom === 1 && angle === 0) {
      for (const scale of [1, 2, 3]) {
        check(`nearest-neighbor ${scale}× preserves every original bit`, () => {
        const enlarged = document.createElement('canvas'); enlarged.width = enlarged.height = 128 * scale;
        const output = enlarged.getContext('2d'); output.imageSmoothingEnabled = false;
        output.drawImage(canvas, 0, 0, enlarged.width, enlarged.height);
        checkerboard(enlarged, scale);
        document.getElementById('samples').append(enlarged);
        });
      }
    }
  });
}
for (const zoom of [0.125, 0.5, 1, 1.25, 2, 4]) for (const angle of [0, Math.PI / 2, Math.PI / 7]) {
  check(`50% pen: zoom ${zoom}, rotation ${Math.round(angle * 180 / Math.PI)}°`, () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const patterns = new PatternRegistry(); patterns.init(ctx);
    ctx.translate(64.25, 63.75); ctx.rotate(angle); ctx.scale(zoom, zoom);
    renderShape(ctx, createShape('line', { points: [{ x: -4096, y: 0 },{ x: 4096, y: 0 }], stroke: { width: 8192, cap: 'butt', patternId: 2 } }), patterns);
    checkerboard(canvas);
  });
}
check('one-bit drawing framebuffer has no intermediate grays', () => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 128, 128);
  renderShape(ctx, createShape('oval', { x: 10, y: 10, width: 90, height: 50, rotation: 0.2 }));
  const pixels = monochromePixels(ctx.getImageData(0, 0, 128, 128)).data;
  for (let i = 0; i < pixels.length; i += 4) assert([0,255].includes(pixels[i]) && pixels[i] === pixels[i+1] && pixels[i] === pixels[i+2] && pixels[i+3] === 255, 'found a non-monochrome pixel');
});
// Compare actual text pixels, not just object presence: text hidden behind an
// opaque rectangle is still present in the model, but invisible to the user.
function labelScene() {
  const canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 120;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const app = { doc: new Document({ snapToGrid: false, showRulers: true }), selection: new Selection(), clipboard: new Clipboard(), commandStack: new CommandStack(), finishText() {}, cancelInteraction() {} };
  Document.setShapeModule({ getBounds, hitTest });
  const box = createShape('rect', { x: 16, y: 16, width: 240, height: 88 });
  const text = createShape('text', { x: 32, y: 32, width: 120, height: 24, text: 'Foreground label', fontFamily: 'Chicago' });
  app.doc.addObject(box); app.doc.addObject(text);
  const pixels = (dx = 0, dy = 0) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); app.doc.objects.forEach(s => renderShape(ctx, s)); return ctx.getImageData(32 + dx, 32 + dy, 150, 24).data; };
  const before = new Uint8ClampedArray(pixels());
  assert(before.some((v, i) => i % 4 === 0 && v < 128), 'test label did not render');
  const unchanged = (dx = 0, dy = 0) => { const after = pixels(dx, dy); assert(after.every((v, i) => v === before[i]), 'foreground text pixels disappeared or changed'); };
  return { app, box, text, canvas, unchanged };
}
check('select box, then Shift-select its text: every text pixel survives', () => {
  const { app, box, text, unchanged } = labelScene();
  const tool = new SelectTool(); Object.assign(tool, { doc: app.doc, selection: app.selection, commandStack: app.commandStack, manager: { zoom: 1 }, overlay: { showRotationHandle: false } });
  for (const [point, shiftKey] of [[{ x: 200, y: 80 }, false], [{ x: 60, y: 40 }, true]]) { tool.onMouseDown(point, { shiftKey }); tool.onMouseUp(point, { shiftKey }); }
  assert(app.selection.has(box.id) && app.selection.has(text.id), 'both objects were not selected'); unchanged();
});
for (const operation of ['group', 'copy', 'duplicate']) check(`${operation} with text selected first: foreground pixels and undo/redo survive`, () => {
  const { app, box, text, canvas, unchanged } = labelScene();
  app.selection.selectMultiple([text.id, box.id]); const actions = new EditorActions(app);
  if (operation === 'copy') { actions.copy(); actions.paste('front', false); }
  else actions[operation]();
  if (operation === 'duplicate') {
    assert(app.doc.objects.slice(-2).map(s => s.type).join(',') === 'rect,text', 'duplicate changed stacking order');
    unchanged(9, 9);
  } else unchanged();
  actions.undo(); unchanged(); actions.redo();
  if (operation === 'duplicate') unchanged(9, 9); else unchanged();
  if (operation === 'group') { actions.ungroup(); unchanged(); document.getElementById('samples').append(canvas); }
});
check('Ungroup then clear selection and drag the box: text stays in place, pixel for pixel', () => {
  const { app, box, text, unchanged } = labelScene();
  app.selection.selectMultiple([box.id, text.id]); const actions = new EditorActions(app);
  actions.group(); actions.ungroup(); app.selection.clear();
  const tool = new SelectTool(); Object.assign(tool, { doc: app.doc, selection: app.selection, commandStack: app.commandStack, manager: { zoom: 1 }, overlay: { showRotationHandle: false } });
  tool.onMouseDown({ x: 200, y: 80 }, { shiftKey: false }); tool.onMouseUp({ x: 400, y: 80 }, { shiftKey: false });
  assert(box.x === 216 && text.x === 32 && text.y === 32, 'ungrouped objects moved together');
  assert(app.selection.count === 1 && app.selection.has(box.id), 'box and text remained jointly selected');
  unchanged(); actions.undo(); unchanged(); actions.redo(); unchanged();
});
check('marquee-select a group and other objects, then drag the group: all pixels move together', () => {
  const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 150;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const doc = new Document({ snapToGrid: false, showRulers: true }), selection = new Selection(), commandStack = new CommandStack();
  Document.setShapeModule({ getBounds, hitTest });
  const box = createShape('rect', { x: 16, y: 16, width: 100, height: 60, groupId: 'labelled-box' });
  const text = createShape('text', { x: 32, y: 32, width: 70, height: 24, text: 'Label', fontFamily: 'Chicago', groupId: 'labelled-box' });
  const other = createShape('rect', { x: 200, y: 16, width: 100, height: 60 });
  const line = createShape('line', { x: 116, y: 46, width: 84, height: 0, points: [{ x: 116, y: 46 }, { x: 200, y: 46 }] });
  [box, text, other, line].forEach(s => doc.addObject(s)); doc.addGroup({ id: 'labelled-box', members: [box.id, text.id] });
  const pixels = (x = 0, y = 0) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); doc.objects.forEach(s => renderShape(ctx, s)); return ctx.getImageData(x, y, 330, 100).data; };
  const before = new Uint8ClampedArray(pixels());
  const tool = new SelectTool(); Object.assign(tool, { doc, selection, commandStack, manager: { zoom: 1 }, overlay: { showRotationHandle: false } });
  const mods = { shiftKey: false };
  tool.onMouseDown({ x: 0, y: 0 }, mods); tool.onMouseUp({ x: 330, y: 100 }, mods);
  assert(selection.count === 4, 'marquee did not select all objects');
  tool.onMouseDown({ x: 50, y: 65 }, mods); tool.onMouseMove({ x: 60, y: 80 }, mods); tool.onMouseUp({ x: 70, y: 95 }, mods);
  assert(selection.count === 4, 'drag collapsed the multi-selection');
  assert(pixels(20, 30).every((v, i) => v === before[i]), 'some selected pixels stayed behind');
  commandStack.undo(); assert(pixels().every((v, i) => v === before[i]), 'undo did not restore all objects');
  commandStack.redo(); assert(pixels(20, 30).every((v, i) => v === before[i]), 'redo did not move all objects');
  document.getElementById('samples').append(canvas);
});

import { RulerRenderer } from '../src/view/RulerRenderer.js';
import { drawRulerNumber } from '../src/util/bitmapText.js';
import appleMenuBitmap from '../assets/bitmaps/apple-menu.png';

function opaqueBinary(canvas) {
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  assert(pixels.some((v, i) => i % 4 === 0 && v === 0), 'bitmap has no black pixels');
  for (let i = 0; i < pixels.length; i += 4) {
    assert((pixels[i] === 0 || pixels[i] === 255) && pixels[i] === pixels[i+1] && pixels[i] === pixels[i+2] && pixels[i+3] === 255, `non-binary pixel at ${i/4}`);
  }
}
for (const zoom of [0.125, 0.5, 1, 1.25, 2, 4]) for (const unit of ['inches', 'cm', 'points']) {
  check(`bitmap rulers: ${unit}, zoom ${zoom}, signed decimal labels and scrolled origin`, () => {
    const hCanvas = document.createElement('canvas'), vCanvas = document.createElement('canvas');
    hCanvas.width = vCanvas.height = 320; hCanvas.height = vCanvas.width = 20;
    const doc = new Document({ snapToGrid: false, showRulers: true }); doc.unit = unit; doc.rulerMajor = unit === 'points' ? 36 : 1;
    doc.rulerIncrement = 0.5; doc.rulerOrigin = { x: 100, y: 100 };
    const renderer = Object.assign(Object.create(RulerRenderer.prototype), { hCanvas, vCanvas, doc, zoom, mousePos: { x: -1, y: -1 }, container: { scrollLeft: 13.5, scrollTop: 11.5 } });
    renderer.render();
    for (const canvas of [hCanvas, vCanvas]) {
      opaqueBinary(canvas);
      const source = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (const scale of [1, 2, 3]) {
        const enlarged = document.createElement('canvas'); enlarged.width = canvas.width * scale; enlarged.height = canvas.height * scale;
        const ctx = enlarged.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(canvas, 0, 0, enlarged.width, enlarged.height);
        const pixels = ctx.getImageData(0, 0, enlarged.width, enlarged.height).data;
        for (let y = 0; y < enlarged.height; y++) for (let x = 0; x < enlarged.width; x++) {
          const i = (y * enlarged.width + x) * 4, original = (Math.floor(y / scale) * canvas.width + Math.floor(x / scale)) * 4;
          for (let channel = 0; channel < 4; channel++) assert(pixels[i+channel] === source[original+channel], 'scaling changed a ruler bit');
        }
      }
    }
  });
}
check('MacDraw numeral 2 preserves the archived 7-row bitmap upright on both rulers', () => {
  const rows = [0x70,0x88,0x08,0x10,0x20,0x40,0xf8];
  for (const horizontal of [true, false]) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,100,100); ctx.fillStyle = '#000';
    ctx.fillText = () => { throw new Error('bitmap label called browser text rendering'); };
    drawRulerNumber(ctx, '2', 50, horizontal);
    const pixels = ctx.getImageData(horizontal ? 43 : 13, horizontal ? 7 : 42, 5, 7).data;
    for (let y=0;y<7;y++) for (let x=0;x<5;x++) assert(pixels[(y*5+x)*4] === ((rows[y] & (128 >> x)) ? 0 : 255), 'digit 2 differs from MacDraw FONT 31881');
  }
});
const apple = new Image(); apple.src = appleMenuBitmap; await apple.decode();
check('Apple menu PNG preserves every bit of the original 0x14 glyph', () => {
  assert(apple.naturalWidth === 9 && apple.naturalHeight === 11, 'wrong bitmap dimensions');
  const canvas = document.createElement('canvas'); canvas.width = 9; canvas.height = 11;
  const ctx = canvas.getContext('2d'); ctx.drawImage(apple, 0, 0); const pixels = ctx.getImageData(0,0,9,11).data;
  const rows = [0x0600,0x0c00,0x0800,0x7700,0xff80,0xfe00,0xfe00,0xff80,0xff80,0x7f00,0x3600];
  for (let y=0;y<11;y++) for (let x=0;x<9;x++) {
    const i=(y*9+x)*4; assert(pixels[i] === 0 && pixels[i+1] === 0 && pixels[i+2] === 0 && pixels[i+3] === ((rows[y] & (0x8000 >> x)) ? 255 : 0), 'Apple glyph differs from archived bits');
  }
});

import { SelectionOverlay } from '../src/view/SelectionOverlay.js';
for (const zoom of [0.125, 0.5, 1, 1.25, 2, 4]) check(`text handles: eight isolated 5x5 bitmaps at zoom ${zoom} with fractional bounds/scroll`, () => {
  const canvas = document.createElement('canvas'); canvas.width = 700; canvas.height = 350;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const doc = new Document({ snapToGrid: false, showRulers: true }), selection = new Selection();
  const shape = createShape('text', { x: 40.25 / zoom, y: 35.75 / zoom, width: 101.5, height: 24.25, text: '34u as' });
  doc.addObject(shape); selection.select(shape.id);
  const overlay = new SelectionOverlay(doc, selection); overlay.zoom = zoom; overlay.showRotationHandle = false;
  ctx.translate(-7.25, -3.5); ctx.scale(zoom, zoom); overlay.render(ctx);
  // Inspect raw pixels before monochromePixels can disguise antialiasing.
  opaqueBinary(canvas);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data, black=new Set();
  for(let i=0;i<pixels.length;i+=4) if(pixels[i]===0) black.add(i/4);
  const components=[];
  while(black.size){
    const start=black.values().next().value, queue=[start], points=[];black.delete(start);
    for(let n=0;n<queue.length;n++){
      const index=queue[n],x=index%canvas.width,y=Math.floor(index/canvas.width);points.push({x,y});
      for(const neighbor of [index-1,index+1,index-canvas.width,index+canvas.width])if(black.delete(neighbor))queue.push(neighbor);
    }
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs)+1,bottom=Math.max(...ys)+1;
    assert(points.length===25 && right-left===5 && bottom-top===5, 'handle is offset, doubled, overlapping or not a filled 5x5 square');
    const textLeft=shape.x*zoom-7.25,textTop=shape.y*zoom-3.5,textRight=textLeft+shape.width*zoom,textBottom=textTop+shape.height*zoom;
    assert(right<=textLeft || left>=textRight || bottom<=textTop || top>=textBottom, 'handle overlaps the text bounds');
    components.push(points);
  }
  assert(components.length===8, `expected eight handles, found ${components.length}`);
});

document.getElementById('summary').textContent = `${passed} passed; ${failed} failed. Raw 50% fill: equal black/white pixels, zero gray pixels, exact checkerboard parity.`;
document.getElementById('summary').dataset.failures = failed;
