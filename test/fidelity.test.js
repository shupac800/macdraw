import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Document } from '../src/model/Document.js';
import { Selection } from '../src/model/Selection.js';
import { Clipboard } from '../src/model/Clipboard.js';
import { createShape, getBounds, hitTest, resetIdCounter } from '../src/model/Shape.js';
import { CommandStack } from '../src/commands/CommandStack.js';
import { AddShapeCommand } from '../src/commands/AddShapeCommand.js';
import { EditorActions } from '../src/controller/EditorActions.js';
import { SelectTool } from '../src/controller/tools/SelectTool.js';
import { InputHandler } from '../src/controller/InputHandler.js';
import { LineTool } from '../src/controller/tools/LineTool.js';
import { RectTool } from '../src/controller/tools/RectTool.js';
import { PATTERN_ROWS, PatternRegistry, monochromePixels } from '../src/util/patterns.js';
import { screenGeometry } from '../src/view/MacScreen.js';
import { saveToJSON, loadFromJSON } from '../src/util/serialize.js';
import { textLayout } from '../src/util/text.js';

let app, actions;
const mods = { shiftKey: false };
beforeEach(() => {
  resetIdCounter(); Document.setShapeModule({ getBounds, hitTest });
  app = { doc: new Document({ snapToGrid: false, showRulers: true }), selection: new Selection(), clipboard: new Clipboard(), commandStack: new CommandStack(), finishText: vi.fn(), cancelInteraction: vi.fn(), toolManager: { chooseTool: vi.fn() } };
  actions = new EditorActions(app);
});
const add = (x = 10) => { const s = createShape('rect', { x, y: 10, width: 40, height: 40 }); app.doc.addObject(s); return s; };
const wire = tool => Object.assign(tool, { doc: app.doc, selection: app.selection, commandStack: app.commandStack, manager: { setActiveTool: vi.fn(), zoom: 1 }, overlay: { showRotationHandle: false } });

describe('pixel fidelity', () => {
  it('contains exactly 32 black and 32 white bits in 50% gray', () => {
    const bits = PATTERN_ROWS[2].flatMap(row => Array.from({ length: 8 }, (_, x) => !!(row & (128 >> x))));
    expect(bits.filter(Boolean)).toHaveLength(32);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) expect(bits[y * 8 + x]).toBe((x + y) % 2 === 0);
  });
  it.each([1, 1.25, 1.5, 1.6, 1.75, 2, 2.5])('uses integer physical scaling at DPR %s', dpr => {
    for (const preference of ['1','2','3']) {
      const g = screenGeometry(1400, 900, dpr, preference);
      expect(g.scale * dpr).toBeCloseTo(Number(preference), 12);
      expect(g.left * dpr).toBeCloseTo(Math.round(g.left * dpr), 10);
      expect(512 * g.scale * dpr).toBeCloseTo(512 * Number(preference), 10);
      expect(342 * g.scale * dpr).toBeCloseTo(342 * Number(preference), 10);
    }
  });
  it('never chooses an interpolated fit-to-window size', () => {
    expect(screenGeometry(900, 650, 1).pixels).toBe(1);
    expect(screenGeometry(1024, 684, 1).pixels).toBe(2);
    expect(screenGeometry(820, 550, 1.25).pixels).toBe(2);
    expect(screenGeometry(1536, 1026, 1).pixels).toBe(3);
    expect(screenGeometry(1600, 1025, 1).pixels).toBe(2);
    expect(screenGeometry(1280, 900, 1.25).pixels).toBe(3);
  });
  it('does not transform bitmap tiles with object geometry', () => {
    const inverse = { a: 2, d: 2 }, pattern = { setTransform: vi.fn() };
    const registry = new PatternRegistry(); registry._canvasPatterns.set(2, pattern);
    expect(registry.getPattern(2, { getTransform: () => ({ inverse: () => inverse }) })).toBe(pattern);
    expect(pattern.setTransform).not.toHaveBeenCalled();
  });
  it('produces only opaque black and white framebuffer pixels', () => {
    const result = monochromePixels({ data: new Uint8ClampedArray([0,0,0,255,127,127,127,100,128,128,128,255,255,255,255,0]) });
    expect([...result.data]).toEqual([0,0,0,255,0,0,0,255,255,255,255,255,255,255,255,255]);
  });
  it('converts pointer coordinates through screen scale, drawing zoom and scroll', () => {
    const input = Object.create(InputHandler.prototype);
    input.canvas = { clientWidth: 400, getBoundingClientRect: () => ({ left: 100, top: 50, width: 500 }), closest: () => ({ scrollLeft: 80, scrollTop: 20 }) };
    input.toolManager = { zoom: 0.5 };
    expect(input._getDocPoint({ clientX: 225, clientY: 175 })).toEqual({ x: 360, y: 240 });
  });
});

describe('classic editing regressions', () => {
  it('starts with Chicago 12, white fill, black pen and an eighth-inch grid', () => {
    expect(app.doc._defaultText.fontFamily).toMatch(/^Chicago/);
    expect(app.doc._defaultText.fontSize).toBe(12);
    expect(app.doc._defaultFill.color).toBe('#ffffff'); expect(app.doc.gridSize).toBe(9);
  });
  it('lets interior clicks pass through transparent rectangles and ovals', () => {
    for (const type of ['rect','oval']) {
      const shape = createShape(type, { width: 100, height: 100, fill: { type: 'none' } });
      expect(hitTest(shape, { x: 50, y: 50 })).toBe(false);
      expect(hitTest(shape, { x: 0, y: 50 })).toBe(true);
    }
  });
  it('selects arcs by their curve, not empty bounding-box space', () => {
    const shape = createShape('arc', { width: 100, height: 100 });
    expect(hitTest(shape, { x: 100, y: 50 })).toBe(true);
    expect(hitTest(shape, { x: 10, y: 10 })).toBe(false);
  });
  it('includes the mouse-up position when moving, and undo restores it exactly', () => {
    const shape = add(), tool = wire(new SelectTool());
    tool.onMouseDown({ x: 30, y: 30 }, mods); tool.onMouseMove({ x: 40, y: 35 }, mods); tool.onMouseUp({ x: 60, y: 50 }, mods);
    expect(shape.x).toBe(40); expect(shape.y).toBe(30);
    app.commandStack.undo(); expect(shape.x).toBe(10); expect(shape.y).toBe(10);
  });
  it('cancels a live move without committing or leaving displaced objects', () => {
    const shape = add(), tool = wire(new SelectTool());
    tool.onMouseDown({ x: 30, y: 30 }, mods); tool.onMouseMove({ x: 80, y: 80 }, mods); tool.deactivate();
    expect(shape.x).toBe(10); expect(app.commandStack.canUndo).toBe(false);
  });
  it('Shift-click selects and deselects whole groups', () => {
    const a = add(), b = add(100); a.groupId = b.groupId = 'g'; app.doc.addGroup({ id: 'g', members: [a.id,b.id] });
    const tool = wire(new SelectTool()), shift = { shiftKey: true };
    tool.onMouseDown({ x: 30, y: 30 }, shift); tool.onMouseUp({ x: 30, y: 30 }, shift); expect(app.selection.count).toBe(2);
    tool.onMouseDown({ x: 30, y: 30 }, shift); tool.onMouseUp({ x: 30, y: 30 }, shift); expect(app.selection.count).toBe(0);
  });
  it('selecting a box and its foreground text changes neither content nor stacking order', () => {
    const box = add(), text = createShape('text', { x: 20, y: 20, width: 24, height: 16, text: 'Label' });
    app.doc.addObject(text);
    const before = structuredClone(app.doc.toJSON()), tool = wire(new SelectTool());
    tool.onMouseDown({ x: 15, y: 45 }, mods); tool.onMouseUp({ x: 15, y: 45 }, mods);
    tool.onMouseDown({ x: 30, y: 25 }, { shiftKey: true }); tool.onMouseUp({ x: 30, y: 25 }, { shiftKey: true });
    expect(app.selection.ids).toEqual([box.id, text.id]);
    expect(app.doc.toJSON()).toEqual(before);
    expect(app.commandStack.canUndo).toBe(false);
  });
  it.each([false, true])('grouping preserves foreground text regardless of selection order (reversed: %s)', reversed => {
    const box = add(), text = createShape('text', { x: 20, y: 20, width: 24, height: 16, text: 'Label' });
    app.doc.addObject(text);
    const before = structuredClone(app.doc.toJSON());
    app.selection.selectMultiple(reversed ? [text.id, box.id] : [box.id, text.id]);
    actions.group();
    expect(app.doc.objects.map(s => s.id)).toEqual([box.id, text.id]);
    expect(app.doc.objects.at(-1).text).toBe('Label');
    actions.undo(); expect(app.doc.toJSON()).toEqual(before);
    actions.redo(); expect(app.doc.objects.map(s => s.id)).toEqual([box.id, text.id]);
    actions.ungroup(); expect(app.doc.objects.map(s => s.id)).toEqual([box.id, text.id]);
  });
  it.each(['copy', 'duplicate'])('%s keeps foreground text above its box when selected first', operation => {
    const box = add(), text = createShape('text', { x: 20, y: 20, width: 24, height: 16, text: 'Label' });
    app.doc.addObject(text); app.selection.selectMultiple([text.id, box.id]);
    if (operation === 'copy') { actions.copy(); actions.paste(); }
    else actions.duplicate();
    expect(app.doc.objects.slice(-2).map(s => s.type)).toEqual(['rect', 'text']);
    expect(app.doc.objects.at(-1).text).toBe('Label');
    actions.undo(); expect(app.doc.objects.map(s => s.id)).toEqual([box.id, text.id]);
    actions.redo(); expect(app.doc.objects.slice(-2).map(s => s.type)).toEqual(['rect', 'text']);
  });
  it('clearing selection after ungrouping a box and label lets a drag move just the box', () => {
    const box = add(), text = createShape('text', { x: 20, y: 20, width: 24, height: 16, text: 'Label' });
    app.doc.addObject(text); app.selection.selectMultiple([box.id, text.id]); actions.group(); actions.ungroup(); app.selection.clear();
    const tool = wire(new SelectTool());
    tool.onMouseDown({ x: 40, y: 40 }, mods); tool.onMouseMove({ x: 60, y: 70 }, mods); tool.onMouseUp({ x: 60, y: 70 }, mods);
    expect(box.x).toBe(30); expect(box.y).toBe(40);
    expect(text.x).toBe(20); expect(text.y).toBe(20);
    expect(app.selection.ids).toEqual([box.id]);
    app.commandStack.undo(); expect(box.x).toBe(10); expect(text.x).toBe(20);
  });
  it('clearing selection after ungrouping a box and label lets a drag move just the text', () => {
    const box = add(), text = createShape('text', { x: 20, y: 20, width: 24, height: 16, text: 'Label' });
    app.doc.addObject(text); app.selection.selectMultiple([box.id, text.id]); actions.group(); actions.ungroup(); app.selection.clear();
    const tool = wire(new SelectTool());
    tool.onMouseDown({ x: 30, y: 28 }, mods); tool.onMouseMove({ x: 50, y: 58 }, mods); tool.onMouseUp({ x: 50, y: 58 }, mods);
    expect(box.x).toBe(10); expect(box.y).toBe(10);
    expect(text.x).toBe(40); expect(text.y).toBe(50); expect(app.selection.ids).toEqual([text.id]);
    app.commandStack.undo(); expect(text.x).toBe(20); expect(box.x).toBe(10);
  });
  it('does not wrap an already-selected group in another identical group', () => {
    const a = add(), b = add(100); app.selection.selectMultiple([a.id, b.id]); actions.group();
    const groupId = a.groupId; actions.group();
    expect(app.doc.groups).toHaveLength(1); expect(a.groupId).toBe(groupId);
    actions.undo(); expect(app.doc.objects.every(s => !s.groupId)).toBe(true);
  });
  it('one Ungroup removes redundant identical wrappers from older drawings', () => {
    const a = add(), b = add(100); app.selection.selectMultiple([a.id, b.id]); actions.group();
    const inner = a.groupId;
    app.doc.addGroup({ id: 'redundant', members: [a.id, b.id], previousGroups: { [a.id]: inner, [b.id]: inner } });
    a.groupId = b.groupId = 'redundant'; actions.ungroup();
    expect(app.doc.objects.every(s => !s.groupId)).toBe(true); expect(app.doc.groups).toHaveLength(0);
    actions.undo(); expect(app.doc.objects.every(s => s.groupId === 'redundant')).toBe(true);
    actions.redo(); expect(app.doc.objects.every(s => !s.groupId)).toBe(true);
  });
  it('Ungroup without a selected group does not create an undo step', () => {
    const a = add(); app.selection.select(a.id); actions.ungroup(); expect(app.commandStack.canUndo).toBe(false);
  });
  it('makes paste undoable and does not replace the clipboard when duplicating', () => {
    const a = add(), b = add(100); app.selection.select(a.id); actions.copy(); app.selection.select(b.id); actions.duplicate();
    expect(app.clipboard.paste().shapes[0].x).toBe(a.x);
    expect(app.doc.objects).toHaveLength(3); actions.undo(); expect(app.doc.objects).toHaveLength(2); actions.redo(); expect(app.doc.objects).toHaveLength(3);
  });
  it('preserves nested groups when copying, pasting and ungrouping', () => {
    const a = add(), b = add(100), c = add(200); app.selection.selectMultiple([a.id,b.id]); actions.group(); const inner = a.groupId;
    app.selection.selectMultiple([a.id,b.id,c.id]); actions.group(); actions.copy(); actions.paste();
    const copied = actions.selected; actions.ungroup();
    const first = copied.find(s => s.x === a.x + 9), second = copied.find(s => s.x === b.x + 9), third = copied.find(s => s.x === c.x + 9);
    expect(first.groupId).toBe(second.groupId); expect(first.groupId).not.toBe(inner); expect(third.groupId).toBeNull();
    expect(app.doc.groups.find(g => g.id === first.groupId).members).toEqual([first.id,second.id]);
  });
  it('redoing an addition does not retain styles from a later undone edit', () => {
    const shape = createShape('rect', { width: 50, height: 50 }); app.commandStack.execute(new AddShapeCommand(app.doc, shape)); app.selection.select(shape.id);
    actions.style('fill', { type: 'pattern', color: '#000', patternId: 2 }); actions.undo(); actions.undo(); actions.redo();
    expect(app.doc.objects[0].fill.type).toBe('solid'); actions.redo(); expect(app.doc.objects[0].fill.patternId).toBe(2);
  });
  it('a perpendicular line is axis constrained', () => {
    const tool = wire(new LineTool(true)); tool.onMouseDown({ x: 20, y: 20 }); tool.onMouseUp({ x: 100, y: 50 }, mods);
    expect(app.doc.objects[0].points).toEqual([{ x: 20, y: 20 },{ x: 100, y: 20 }]);
  });
  it('Shift can create a square from a horizontal drag', () => {
    const tool = wire(new RectTool()); tool.onMouseDown({ x: 20, y: 20 }); tool.onMouseUp({ x: 80, y: 20 }, { shiftKey: true });
    expect(app.doc.objects[0].width).toBe(60); expect(app.doc.objects[0].height).toBe(60);
  });
  it('wrapping preserves explicit blank lines and line spacing', () => {
    const ctx = { measureText: text => ({ width: text.length * 6, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 4 }) };
    const result = textLayout(ctx, createShape('text', { text: 'abcd efgh\n\nlast', width: 24, wrap: true, lineSpacing: 2 }));
    expect(result.lines).toEqual(['abcd','efgh','','last']); expect(result.lineHeight).toBeCloseTo(31.2); expect(result.height).toBeCloseTo(109.6);
  });
});

describe('editable files', () => {
  it('round-trips defaults, ruler origins, text features and group metadata', () => {
    const shape = createShape('text', { text: 'Chicago', width: 50, height: 20, wrap: true, outline: true, shadow: true, lineSpacing: 2 }); app.doc.addObject(shape);
    app.doc.rulerOrigin = { x: 18, y: -9 }; app.doc._defaultStroke.patternId = 2; app.doc._endArrow = 'arrow';
    expect(loadFromJSON(saveToJSON(app.doc)).toJSON()).toEqual(app.doc.toJSON());
  });
  it('opening a drawing cannot reuse its existing object IDs', () => {
    add(); add(); resetIdCounter(); loadFromJSON(saveToJSON(app.doc)); expect(createShape('rect').id).toBe('shape_3');
  });
  it.each([
    d => { d.pageWidth = Infinity; }, d => { d.gridSize = 0; }, d => { d._defaultText = null; },
    d => { d.objects[0].stroke.dash = [-1]; }, d => { d.objects[0].groupId = 'missing'; },
    d => { d.groups = [{ id: 'bad', members: ['missing'] }]; }, d => { d.objects[0].fill = { type: 'pattern', patternId: 90 }; },
  ])('rejects malformed files without replacing the drawing', corrupt => {
    add(); const data = structuredClone(app.doc.toJSON()); corrupt(data); expect(() => loadFromJSON(JSON.stringify(data))).toThrow(); expect(app.doc.objects).toHaveLength(1);
  });
});
