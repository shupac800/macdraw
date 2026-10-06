import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Document } from '../src/model/Document.js';
import { Selection } from '../src/model/Selection.js';
import { createShape, getBounds, hitTest, resetIdCounter } from '../src/model/Shape.js';
import { CommandStack } from '../src/commands/CommandStack.js';
import { ToolManager } from '../src/controller/ToolManager.js';
import { InputHandler } from '../src/controller/InputHandler.js';
import { KeyboardShortcuts } from '../src/controller/KeyboardShortcuts.js';
import { TextTool } from '../src/controller/tools/TextTool.js';
import { SelectTool } from '../src/controller/tools/SelectTool.js';
import { saveToJSON, loadFromJSON, saveToSVG, loadFromSVG } from '../src/util/serialize.js';
import { SelectionOverlay } from '../src/view/SelectionOverlay.js';
import { getHandlePositions, getSelectionHandleBounds } from '../src/util/geometry.js';
import { TOOLS } from '../src/util/constants.js';

describe('TextTool editing', () => {
  let dom, doc, selection, stack, manager, tool, canvas;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><canvas tabindex="0"></canvas><button>Other tool</button>', { url: 'http://localhost' });
    for (const name of ['window', 'document', 'DOMParser', 'XMLSerializer']) {
      vi.stubGlobal(name, dom.window[name]);
    }
    resetIdCounter();
    Document.setShapeModule({ getBounds, hitTest });
    doc = new Document({ snapToGrid: false, showRulers: true });
    selection = new Selection();
    stack = new CommandStack();
    canvas = document.querySelector('canvas');
    canvas.getBoundingClientRect = () => ({ left: 50, top: 80 });
    canvas.getContext = () => ({ save() {}, restore() {}, measureText: text => ({ width: text.length * 10 }) });
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = () => false;
    manager = new ToolManager(doc, selection, stack, {}, { canvas, setText() {}, setDefault() {} });
    tool = new TextTool();
    manager.registerTool(TOOLS.TEXT, tool);
    manager.registerTool(TOOLS.SELECT, new SelectTool());
    manager.setActiveTool(TOOLS.TEXT);
  });

  afterEach(() => {
    tool.finishEditing(true);
    dom.window.close();
    vi.unstubAllGlobals();
  });

  function addText(props = {}) {
    const shape = createShape('text', { x: 10, y: 20, width: 100, height: 24, text: 'Original', ...props });
    doc.addObject(shape);
    return shape;
  }

  function edit(shape, value) {
    manager.onMouseDown({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }, {});
    tool._textarea.value = value;
    tool._textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    return tool._textarea;
  }

  function key(editor, key, options = {}) {
    const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
    editor.dispatchEvent(event);
    return event;
  }

  function finish(editor) { return key(editor, 'Enter', { ctrlKey: true }); }
  function current(shape) { return doc.getObjectById(shape.id); }

  it.each([0.125, 0.5, 1, 1.25, 2, 4])('centers a short text editing frame between clear handles at zoom %s', zoom => {
    manager.zoom = zoom;
    const shape = addText({ text: 'dfdf', width: 30, height: 16 });
    const editor = edit(shape, shape.text);
    expect(editor.style.height).toBe(`${shape.height * zoom}px`);
    expect(editor.style.width).toBe(`${shape.width * zoom}px`);
    expect(editor.style.transformOrigin).toBe(`${shape.width * zoom / 2}px ${shape.height * zoom / 2}px`);
    const handles = getHandlePositions(getSelectionHandleBounds(getBounds(shape), zoom, true));
    expect(handles.w.y).toBe(shape.y + shape.height / 2);
    expect(handles.e.y).toBe(handles.w.y);
    // Each five-pixel handle leaves room for the one-pixel outline and a white gap.
    expect((shape.x - handles.w.x) * zoom - 2.5 - 1).toBeGreaterThanOrEqual(1 - 1e-10);
    expect((handles.e.x - shape.x - shape.width) * zoom - 2.5 - 1).toBeCloseTo((shape.x - handles.w.x) * zoom - 2.5 - 1);
    expect((shape.y - handles.n.y) * zoom - 2.5 - 1).toBeGreaterThanOrEqual(1 - 1e-10);
    expect((handles.s.y - shape.y - shape.height) * zoom - 2.5 - 1).toBeCloseTo((shape.y - handles.n.y) * zoom - 2.5 - 1);
    finish(editor);
    expect(current(shape).height).toBe(16);
  });

  it('reopens the selected original with its text and styling', () => {
    const shape = addText({ fontFamily: 'Courier New', fontSize: 20, fontWeight: 'bold',
      fontStyle: 'italic', textDecoration: 'underline', textAlign: 'right',
      fill: { color: '#123456' } });
    const before = structuredClone(shape);
    const editor = edit(shape, 'Replacement');
    expect(document.activeElement).toBe(editor);
    expect(editor.style.left).toBe('10px');
    expect(editor.style.top).toBe('20px');
    expect(editor.style.fontFamily.replaceAll('"', '')).toBe('Courier New');
    expect(editor.style.fontWeight).toBe('bold');
    expect(editor.style.fontStyle).toBe('italic');
    expect(editor.style.textDecoration).toBe('underline');
    expect(editor.style.textAlign).toBe('right');
    expect(editor.style.color).toBe('rgb(0, 0, 0)');
    expect(editor.style.transform).toContain('scale(1, 1)');
    expect(editor.wrap).toBe('off');
    expect(shape).toEqual(before);
    finish(editor);
    expect(doc.objects).toEqual([shape]);
    expect(shape).toMatchObject({ ...before, text: 'Replacement', width: 110, height: 26 });
    expect(selection.ids).toEqual([shape.id]);
  });

  it('prefills and selects existing text like a newly entered text object', () => {
    const shape = addText({ text: 'First\nSecond' });
    manager.onMouseDown({ x: 30, y: 30 }, {});
    expect(tool._textarea.value).toBe(shape.text);
    expect(tool._textarea.selectionStart).toBe(0);
    expect(tool._textarea.selectionEnd).toBe(shape.text.length);
    expect(stack.canUndo).toBe(false);
  });

  it('prevents default canvas focus from taking focus away from a reopened editor', () => {
    addText();
    new InputHandler(canvas, manager);
    const event = new window.MouseEvent('pointerdown', {
      clientX: 80, clientY: 110, bubbles: true, cancelable: true,
    });
    canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(tool._textarea);
    expect(tool._textarea.value).toBe('Original');
  });

  it('commits on blur and tool switching exactly once', () => {
    const shape = addText();
    const editor = edit(shape, 'Blurred');
    document.querySelector('button').focus();
    expect(current(shape).text).toBe('Blurred');
    expect(editor.isConnected).toBe(false);
    expect(tool._textarea).toBeNull();
    edit(shape, 'Switched');
    manager.setActiveTool(TOOLS.SELECT);
    expect(shape.text).toBe('Switched');
    stack.undo();
    expect(current(shape).text).toBe('Blurred');
    stack.undo();
    expect(current(shape).text).toBe('Original');
    expect(stack.canUndo).toBe(false);
  });

  it('click-away finishes without creating a duplicate; the next blank click creates text', () => {
    const shape = addText();
    edit(shape, 'Finished');
    manager.onMouseDown({ x: 300, y: 300 }, {});
    manager.onMouseUp({ x: 300, y: 300 }, {});
    expect(shape.text).toBe('Finished');
    expect(doc.objects).toHaveLength(1);
    manager.onMouseDown({ x: 300, y: 300 }, {});
    manager.onMouseUp({ x: 300, y: 300 }, {});
    expect(doc.objects).toHaveLength(1);
    expect(tool._textarea.value).toBe('');
    expect(tool._editingShape).toMatchObject({ x: 300, y: 300, width: 160, height: 20 });
    tool._textarea.value = 'Fresh';
    finish(tool._textarea);
    expect(doc.objects).toHaveLength(2);
  });

  it('clicking another text commits and opens that object in one click', () => {
    const first = addText();
    const second = addText({ x: 250, text: 'Second' });
    edit(first, 'Edited');
    manager.onMouseDown({ x: 260, y: 30 }, {});
    expect(first.text).toBe('Edited');
    expect(tool._editingShape).toBe(second);
    expect(tool._textarea.value).toBe('Second');
    expect(doc.objects).toHaveLength(2);
  });

  it('supports repeated edits with atomic text and bounds undo/redo', () => {
    const shape = addText();
    const originalBounds = getBounds(shape);
    const observed = [];
    doc.onChange(type => { if (type === 'change') observed.push(getBounds(current(shape))); });
    finish(edit(shape, 'A much longer first line\nSecond\nThird'));
    const firstBounds = getBounds(shape);
    expect(firstBounds.width).toBe(240);
    expect(firstBounds.height).toBeCloseTo(46.8);
    expect(observed).toEqual([firstBounds]);
    expect(doc.getObjectAtPoint({ x: 245, y: 65 })).toBe(shape);
    manager.setActiveTool(TOOLS.TEXT);
    finish(edit(shape, 'Again'));
    stack.undo();
    expect(current(shape).text).toBe('A much longer first line\nSecond\nThird');
    expect(getBounds(current(shape))).toEqual(firstBounds);
    stack.undo();
    expect(current(shape).text).toBe('Original');
    expect(getBounds(current(shape))).toEqual(originalBounds);
    stack.redo();
    stack.redo();
    expect(current(shape).text).toBe('Again');
    expect(current(shape)).toMatchObject({ x: 10, y: 20, width: 50 });
    expect(current(shape).height).toBeCloseTo(15.6);
    expect(doc.objects.map(s => s.id)).toEqual([shape.id]);
  });

  it('keeps Enter multiline, ignores composing exit keys and finishes with Ctrl+Enter', () => {
    const shape = addText();
    const editor = edit(shape, 'Line 1\nLine 2');
    expect(key(editor, 'Enter').defaultPrevented).toBe(false);
    expect(key(editor, 'Escape', { isComposing: true }).defaultPrevented).toBe(false);
    expect(tool._textarea).toBe(editor);
    expect(finish(editor).defaultPrevented).toBe(true);
    expect(shape.text).toBe('Line 1\nLine 2');
    expect(manager.getActiveTool()).toBe(TOOLS.SELECT);
  });

  it('cancels a draft with Escape without changing text or bounds', () => {
    const shape = addText();
    const before = structuredClone(shape);
    key(edit(shape, 'Discard this\nand this'), 'Escape');
    expect(shape).toEqual(before);
    expect(stack.canUndo).toBe(false);
    expect(tool._textarea).toBeNull();
  });

  it('retains empty objects and original bounds, with Undo restoring their text', () => {
    const shape = addText();
    finish(edit(shape, ''));
    expect(shape).toMatchObject({ text: '', width: 100, height: 24 });
    expect(doc.objects).toEqual([shape]);
    expect(doc.getObjectAtPoint({ x: 30, y: 30 })).toBe(shape);
    stack.undo();
    expect(current(shape).text).toBe('Original');
    stack.redo();
    manager.setActiveTool(TOOLS.TEXT);
    expect(edit(current(shape), 'Restored').isConnected).toBe(true);
  });

  it('does not add an undo entry or resize when unchanged', () => {
    const shape = addText({ width: 30, height: 10 });
    const before = structuredClone(shape);
    finish(edit(shape, shape.text));
    expect(stack.canUndo).toBe(false);
    expect(shape).toEqual(before);
  });

  it('uses document z-order regardless of a previous overlapping selection', () => {
    const bottom = addText({ text: 'Bottom' });
    const top = addText({ text: 'Top' });
    selection.select(bottom.id);
    manager.onMouseDown({ x: 30, y: 30 }, {});
    expect(tool._editingShape).toBe(top);
    expect(selection.ids).toEqual([top.id]);
    tool.finishEditing(true);
    doc.addObject(createShape('rect', { x: 10, y: 20, width: 100, height: 24 }));
    manager.onMouseDown({ x: 30, y: 30 }, {});
    expect(tool._textarea).toBeNull();
  });

  it('requires restoring orientation before editing rotated and flipped text', () => {
    const shape = addText({ width: 160, height: 24, rotation: Math.PI / 2, flipH: true, flipV: true });
    expect(hitTest(shape, { x: 90, y: 100 })).toBe(true);
    expect(hitTest(shape, { x: 20, y: 30 })).toBe(false);
    manager.onMouseDown({ x: 90, y: 100 }, {});
    expect(tool._editingShape).toBeNull();
  });

  it('does not leak editors when editing starts again or canvas is unavailable', () => {
    const shape = addText();
    tool.startEditing(shape);
    const editor = tool._textarea;
    tool.startEditing(shape);
    expect(tool._textarea).toBe(editor);
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
    tool.finishEditing(true);
    tool.cursor = null;
    tool.startEditing(shape);
    expect(tool._editingShape).toBeNull();
  });

  it('does not commit a stale editor after replacing the document', () => {
    const shape = addText();
    edit(shape, 'Stale');
    doc.clear();
    const replacement = addText({ id: shape.id, text: 'Loaded' });
    tool._finishEditing();
    expect(replacement.text).toBe('Loaded');
    expect(stack.canUndo).toBe(false);
  });

  it('preserves pointer click-away without premature focus creating another draft', () => {
    const shape = addText();
    new InputHandler(canvas, manager);
    edit(shape, 'Finished');
    canvas.dispatchEvent(new window.MouseEvent('pointerdown', {
      clientX: 350, clientY: 380, bubbles: true, cancelable: true,
    }));
    canvas.dispatchEvent(new window.MouseEvent('pointerup', {
      clientX: 350, clientY: 380, bubbles: true, cancelable: true,
    }));
    expect(shape.text).toBe('Finished');
    expect(tool._textarea).toBeNull();
    expect(tool._drawing).toBe(false);
    expect(doc.objects).toHaveLength(1);
  });

  it('requires ungrouping before editing a text child', () => {
    const shape = addText({ groupId: 'group1' });
    const before = structuredClone(doc.toJSON()); tool.startEditing(shape);
    expect(tool._textarea).toBeNull(); expect(doc.toJSON()).toEqual(before); expect(stack.canUndo).toBe(false);
    const sibling=createShape('rect',{x:200,y:200,width:40,height:40,groupId:'group1'}); doc.addObject(sibling);
    tool.onMouseDown({x:30,y:30}); expect(selection.ids).toEqual([shape.id,sibling.id]); expect(tool._textarea).toBeNull();
  });

  it.each([0.5, 2])('retains wrapping, line spacing and document coordinates at zoom %s', zoom => {
    manager.zoom = zoom;
    const shape = addText({ width: 40, wrap: true, lineSpacing: 2, outline: true, shadow: true });
    const editor = edit(shape, 'abcd efgh\n\nlast');
    expect(editor.wrap).toBe('soft');
    expect(editor.style.left).toBe(`${10 * zoom}px`);
    expect(editor.style.top).toBe(`${20 * zoom}px`);
    expect(editor.style.fontSize).toBe(`${12 * zoom}px`);
    expect(editor.style.width).toBe(`${40 * zoom}px`);
    expect(editor.style.lineHeight).toBe('2.6');
    expect(editor.style.textShadow).not.toBe('none');
    finish(editor);
    expect(shape).toMatchObject({ x: 10, y: 20, width: 40, wrap: true, lineSpacing: 2,
      outline: true, shadow: true, text: 'abcd efgh\n\nlast' });
    expect(shape.height).toBeCloseTo(109.2);
  });

  it('edits locked text content while keeping its position, dimensions and style', () => {
    const shape = addText({ locked: true }), before = structuredClone(shape);
    finish(edit(shape, 'A longer locked caption'));
    expect(shape).toEqual({ ...before, text:'A longer locked caption' });
    stack.undo(); expect(current(shape)).toEqual(before);
  });

  it('cancels new text and omits new empty drafts without an undo entry', () => {
    manager.onMouseDown({ x: 200, y: 200 }, {});
    manager.onMouseUp({ x: 200, y: 200 }, {});
    tool._textarea.value = 'Canceled new text';
    key(tool._textarea, 'Escape');
    expect(doc.objects).toHaveLength(0);
    expect(stack.canUndo).toBe(false);
    manager.chooseTool(TOOLS.TEXT);
    manager.onMouseDown({ x: 200, y: 200 }, {});
    manager.onMouseUp({ x: 200, y: 200 }, {});
    finish(tool._textarea);
    expect(doc.objects).toHaveLength(0);
    expect(stack.canUndo).toBe(false);
  });

  it('keeps typed shortcuts, deletion, arrows and text undo away from canvas tools', () => {
    const shape = addText();
    new InputHandler(canvas, manager);
    const shortcuts = new KeyboardShortcuts({ doc, selection, commandStack: stack, toolManager: manager });
    const down = vi.spyOn(manager, 'onKeyDown');
    const up = vi.spyOn(manager, 'onKeyUp');
    const editor = edit(shape, 'Typing');
    for (const letter of ['v', 't', 'r', 'Delete', 'Backspace', 'ArrowLeft', 'a', 'z']) {
      expect(key(editor, letter, { ctrlKey: ['a', 'z'].includes(letter) }).defaultPrevented).toBe(false);
      editor.dispatchEvent(new window.KeyboardEvent('keyup', { key: letter, bubbles: true }));
    }
    expect(down).not.toHaveBeenCalled();
    expect(up).not.toHaveBeenCalled();
    expect(doc.objects).toEqual([shape]);
    expect(shape.text).toBe('Original');
    expect(manager.getActiveTool()).toBe(TOOLS.TEXT);
    // InputHandler also protects other editable fields from active tool handlers.
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    input.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    expect(down).not.toHaveBeenCalled();
    expect(up).not.toHaveBeenCalled();
    shortcuts.destroy();
  });

  it('preserves edited multiline text, identity, style, transform and bounds in JSON and SVG', () => {
    const shape = addText({ fontWeight: 'bold',
      fontStyle: 'italic', textDecoration: 'underline', textAlign: 'center', fill: { color: '#123456' } });
    finish(edit(shape, 'Edited <text> & symbols\nSecond line'));
    const jsonShape = loadFromJSON(saveToJSON(doc)).getObjectById(shape.id);
    expect(jsonShape).toEqual(shape);
    const svg = saveToSVG(doc);
    expect(svg).toContain('Edited &lt;text&gt; &amp; symbols');
    const svgShape = loadFromSVG(svg).getObjectById(shape.id);
    expect(svgShape).toMatchObject({ text: shape.text, x: shape.x, y: shape.y,
      width: shape.width, height: shape.height, rotation: shape.rotation,
      flipV: shape.flipV, fontWeight: shape.fontWeight, fontStyle: shape.fontStyle,
      textDecoration: shape.textDecoration, textAlign: shape.textAlign, fill: shape.fill });
  });
  it.each([0.125, 0.5, 1, 1.25, 2, 4])('keeps new text selection, drag and padded resize handles aligned at zoom %s', zoom => {
    manager.zoom = zoom;
    const overlay = new SelectionOverlay(doc, selection); overlay.zoom = zoom; overlay.showRotationHandle = false;
    tool.overlay = overlay; const select = manager._tools[TOOLS.SELECT]; select.overlay = overlay; select.cursor = null;
    manager.onMouseDown({ x: 100, y: 100 }, {}); manager.onMouseUp({ x: 100, y: 100 }, {});
    const editor = tool._textarea; editor.value = 'Text label'; finish(editor);
    let shape = doc.objects[0]; const original = structuredClone(shape);
    expect(document.querySelector('.text-editor')).toBeNull(); expect(doc._editingId).toBeUndefined();
    expect(selection.ids).toEqual([shape.id]); expect(manager.getActiveTool()).toBe(TOOLS.SELECT);
    const mods = { shiftKey: false };
    const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
    select.onMouseDown(center, mods); expect(select._mode).toBe('move');
    select.onMouseUp({ x: center.x + 20, y: center.y + 10 }, mods);
    expect(shape).toMatchObject({ x: original.x + 20, y: original.y + 10, width: original.width, height: original.height, text: original.text });
    stack.undo(); shape = doc.getObjectById(shape.id); expect(shape).toEqual(original);
    const bounds = getSelectionHandleBounds(getBounds(shape), zoom, true), handle = getHandlePositions(bounds).se;
    select.cursor = { setForHandle: vi.fn(), setMove: vi.fn(), setDefault: vi.fn() };
    select._updateHoverCursor(handle); expect(select.cursor.setForHandle).toHaveBeenCalledWith('se');
    select.onMouseDown(handle, mods); expect(select._mode).toBe('resize'); expect(select._handle).toBe('se');
    select.onMouseUp({ x: handle.x + 20, y: handle.y + 10 }, mods);
    expect(shape).toMatchObject({ x: original.x, y: original.y, text: original.text });
    expect(shape.width).toBeCloseTo(original.width + 20);
    expect(shape.height).toBeCloseTo(original.height + 10);
    stack.undo(); expect(doc.getObjectById(shape.id)).toEqual(original);
    expect(selection.ids).toEqual([shape.id]);
  });

});
