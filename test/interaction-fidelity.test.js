import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Document } from '../src/model/Document.js';
import { Selection } from '../src/model/Selection.js';
import { createShape, getBounds, hitTest } from '../src/model/Shape.js';
import { CommandStack } from '../src/commands/CommandStack.js';
import { SelectTool } from '../src/controller/tools/SelectTool.js';
import { EditorActions } from '../src/controller/EditorActions.js';

const normal = { shiftKey: false }, shift = { shiftKey: true };
let app, tool, actions;
beforeEach(() => {
  Document.setShapeModule({ getBounds, hitTest });
  app = { doc: new Document({ snapToGrid: false, showRulers: true }), selection: new Selection(), commandStack: new CommandStack(), finishText: vi.fn(), cancelInteraction: vi.fn() };
  tool = Object.assign(new SelectTool(), { doc: app.doc, selection: app.selection, commandStack: app.commandStack, overlay: { showRotationHandle: false }, manager: { zoom: 1, setActiveTool: vi.fn() } });
  actions = new EditorActions(app);
});
const add = (x = 20, y = 20, width = 40, height = 40, type = 'rect', props = {}) => {
  const shape = createShape(type, { x, y, width, height, ...props }); app.doc.addObject(shape); return shape;
};
const gesture = (from, to, modifiers = normal) => {
  tool.onMouseDown(from, modifiers); tool.onMouseMove(to, modifiers); tool.onMouseUp(to, modifiers);
};
const group = (...shapes) => {
  app.selection.selectMultiple(shapes.map(s => s.id)); actions.group(); app.commandStack.clear(); app.selection.clear();
};

describe('source-evidenced selection gestures', () => {
  it('Shift marquee toggles enclosed units once, leaving outside selection intact', () => {
    const a = add(), b = add(100), c = add(200);
    app.selection.selectMultiple([a.id, c.id]);
    gesture({ x: 5, y: 5 }, { x: 160, y: 80 }, shift);
    expect(app.selection.ids).toEqual([b.id, c.id]);
    expect(app.commandStack.canUndo).toBe(false);
  });
  it('Shift drag beginning over an object frames selection without moving anything', () => {
    const a = add(), b = add(100,40); const before = structuredClone(app.doc.toJSON());
    gesture({ x: 35, y: 35 }, { x: 160, y: 80 }, shift);
    expect(app.selection.ids).toEqual([b.id]); expect(app.doc.toJSON()).toEqual(before);
  });
  it('Shift click uses the modifier at mouse-down even if released before mouse-up', () => {
    const a = add(); app.selection.select(a.id);
    tool.onMouseDown({ x: 40, y: 40 }, shift); tool.onMouseUp({ x: 40, y: 40 }, normal);
    expect(app.selection.isEmpty).toBe(true);
  });
  it('marquee enclosing one child does not select a partly enclosed group', () => {
    const a = add(), b = add(100); group(a, b);
    gesture({ x: 5, y: 5 }, { x: 80, y: 80 }); expect(app.selection.isEmpty).toBe(true);
    gesture({ x: 5, y: 5 }, { x: 160, y: 80 }); expect(app.selection.count).toBe(2);
    gesture({ x: 5, y: 5 }, { x: 160, y: 80 }, shift); expect(app.selection.isEmpty).toBe(true);
  });
  it('group empty space is not a hit and does not move the group', () => {
    const a = add(), b = add(140); group(a, b);
    gesture({ x: 100, y: 40 }, { x: 110, y: 45 });
    expect(a.x).toBe(20); expect(b.x).toBe(140); expect(app.selection.isEmpty).toBe(true);
  });
  it('rounded corners and clear interiors pass through to objects behind them', () => {
    const back=add(0,0,100,100), front=add(0,0,100,100,'roundRect',{cornerRadius:40});
    expect(app.doc.getObjectAtPoint({x:0,y:0},1).id).toBe(back.id);
    front.fill.type='none'; expect(app.doc.getObjectAtPoint({x:50,y:50},1).id).toBe(back.id);
    expect(app.doc.getObjectAtPoint({x:50,y:0},1).id).toBe(front.id);
  });
  it('cancel restores the selection that existed before a replacing marquee', () => {
    const a = add(); app.selection.select(a.id);
    tool.onMouseDown({ x: 200, y: 200 }, normal); tool.onMouseMove({ x: 250, y: 250 }, normal); tool.deactivate();
    expect(app.selection.ids).toEqual([a.id]); expect(tool.overlay.marquee).toBeNull();
  });
  it('a pointer-up without pointer-move still completes a marquee', () => {
    const a = add(); tool.onMouseDown({ x: 5, y: 5 }, normal); tool.onMouseUp({ x: 80, y: 80 }, normal);
    expect(app.selection.ids).toEqual([a.id]);
  });
});

describe('drag, resize, undo and cancellation', () => {
  it('click jitter with grid on changes no geometry and creates no undo entry', () => {
    const a = add(23, 23); app.doc.snapToGrid = true;
    gesture({ x: 42, y: 42 }, { x: 43, y: 43 });
    expect(a.x).toBe(23); expect(a.y).toBe(23); expect(app.commandStack.canUndo).toBe(false);
  });
  it('the click threshold is measured in drawing pixels at reduced zoom', () => {
    const a = add(); tool.manager.zoom = 0.5;
    gesture({ x: 40, y: 40 }, { x: 43, y: 43 }); expect(a.x).toBe(20);
  });
  it('text moves to the half-grid after starting an off-grid drag', () => {
    const a = add(23, 23, 50, 20, 'text', { text: 'label' }); app.doc.snapToGrid = true;
    gesture({ x: 45, y: 32 }, { x: 50, y: 32 });
    expect(a.x).toBe(27); expect(a.y).toBe(22.5); app.commandStack.undo(); expect(a.x).toBe(23);
  });
  it('Shift pressed during a move constrains the axis without snapping the other axis', () => {
    const a = add(23, 23); app.doc.snapToGrid = true;
    tool.onMouseDown({ x: 42, y: 42 }, normal); tool.onMouseMove({ x: 65, y: 47 }, shift); tool.onMouseUp({ x: 65, y: 47 }, shift);
    expect(a.x).toBe(45); expect(a.y).toBe(23);
  });
  it('drag clamps the entire selection to drawing edges and undoes exactly', () => {
    const a = add(), b = add(100); app.selection.selectMultiple([a.id,b.id]);
    gesture({ x: 40, y: 40 }, { x: -200, y: -200 });
    expect(a.x).toBe(0); expect(b.x).toBe(80); expect(a.y).toBe(0);
    app.commandStack.undo(); expect(a.x).toBe(20); expect(b.x).toBe(100);
  });
  it('clicking a locked selected object does not drag other selected objects', () => {
    const a = add(), b = add(100, 20, 40, 40, 'rect', { locked: true }); app.selection.selectMultiple([a.id,b.id]);
    gesture({ x: 120, y: 40 }, { x: 140, y: 80 }); expect(a.x).toBe(20); expect(b.x).toBe(100);
  });
  it('dragging another selected unit does not split a group with a locked child', () => {
    const a = add(), b = add(100), c = add(200); group(a,b); b.locked = true; app.selection.selectMultiple([a.id,b.id,c.id]);
    gesture({x:220,y:40},{x:240,y:50}); expect(a.x).toBe(20); expect(b.x).toBe(100); expect(c.x).toBe(220);
  });
  it.each(['nw','ne','sw','se'])('proportional %s resize keeps the opposite corner fixed', handle => {
    const a = add(100, 100, 80, 40); app.selection.select(a.id);
    const from = { x: handle.includes('w') ? 100 : 180, y: handle.includes('n') ? 100 : 140 };
    const anchor = { x: handle.includes('w') ? 180 : 100, y: handle.includes('n') ? 140 : 100 };
    const to = { x: from.x + (handle.includes('w') ? -40 : 40), y: from.y + (handle.includes('n') ? -40 : 40) };
    tool.onMouseDown(from, normal); tool.onMouseMove(to, shift); tool.onMouseUp(to, shift);
    expect(a.width / a.height).toBeCloseTo(2);
    expect(handle.includes('w') ? a.x + a.width : a.x).toBeCloseTo(anchor.x);
    expect(handle.includes('n') ? a.y + a.height : a.y).toBeCloseTo(anchor.y);
    app.commandStack.undo(); expect([a.x,a.y,a.width,a.height]).toEqual([100,100,80,40]);
  });
  it('resize grid snaps the dragged edge without shifting the fixed corner', () => {
    const a = add(23, 23, 40, 40); app.selection.select(a.id); app.doc.snapToGrid = true;
    gesture({ x: 63, y: 63 }, { x: 77, y: 80 }); expect([a.x,a.y,a.width,a.height]).toEqual([23,23,58,58]);
  });
  it('resize cannot extend the selected geometry beyond the drawing', () => {
    const a = add(); app.selection.select(a.id); gesture({x:60,y:60},{x:2000,y:2000});
    expect(a.x+a.width).toBe(app.doc.pageWidth); expect(a.y+a.height).toBe(app.doc.pageHeight);
  });
  it('crossing a resize anchor mirrors point geometry and undo/redo retains it', () => {
    const a = add(20,20,40,40,'polygon',{ points: [{x:20,y:20},{x:60,y:20},{x:30,y:60}], closed:true }); app.selection.select(a.id);
    gesture({x:60,y:60},{x:0,y:80});
    expect(a.points).toEqual([{x:20,y:20},{x:0,y:20},{x:15,y:80}]); expect(a.width).toBe(20);
    const after = structuredClone(a); app.commandStack.undo(); expect(a.points[1].x).toBe(60);
    app.commandStack.redo(); expect(a).toEqual(after);
  });
  it('cancelling crossed text resize restores mirror flags, dimensions and content', () => {
    const a = add(20,20,40,20,'text',{text:'unchanged'}); app.selection.select(a.id);
    tool.onMouseDown({x:64.5,y:44.5},normal); tool.onMouseMove({x:0,y:60},normal); expect(a.flipH).toBe(true);
    tool.deactivate(); expect([a.x,a.y,a.width,a.height,a.flipH,a.text]).toEqual([20,20,40,20,false,'unchanged']); expect(app.commandStack.canUndo).toBe(false);
  });
  it('clicking a resize handle without moving does not create an undo entry', () => {
    const a = add(); app.selection.select(a.id); gesture({x:60,y:60},{x:60,y:60}); expect(app.commandStack.canUndo).toBe(false);
  });
  it('double-click cannot edit grouped, rotated or mirrored text', () => {
    const a = add(20,20,80,30,'text',{text:'label',groupId:'g'});
    tool.onDoubleClick({x:40,y:30},normal); expect(tool.manager.setActiveTool).not.toHaveBeenCalled();
    a.groupId = null; a.flipH = true;
    tool.onDoubleClick({x:40,y:30},normal); expect(tool.manager.setActiveTool).not.toHaveBeenCalled();
  });
  it('resizing one independently selected object leaves the other selected object unchanged', () => {
    const a = add(), b = add(120); app.selection.selectMultiple([a.id,b.id]);
    gesture({x:160,y:60},{x:190,y:80}); expect([a.width,a.height,b.width,b.height]).toEqual([40,40,70,60]);
    expect(app.selection.ids).toEqual([a.id,b.id]); app.commandStack.undo(); expect(app.doc.getObjectById(b.id).width).toBe(40);
  });
  it('line endpoints can cross while the opposite endpoint stays fixed', () => {
    const line = add(20,20,40,40,'line',{points:[{x:20,y:20},{x:60,y:60}]}); app.selection.select(line.id);
    gesture({x:60,y:60},{x:10,y:50}); expect(line.points).toEqual([{x:20,y:20},{x:10,y:50}]);
    app.commandStack.undo(); expect(line.points).toEqual([{x:20,y:20},{x:60,y:60}]);
  });
  it('Shift pressed after a drag starts also constrains diagonal motion', () => {
    const a = add(); tool.onMouseDown({x:40,y:40},normal); tool.onMouseUp({x:65,y:63},shift);
    expect(a.x-20).toBeCloseTo(a.y-20); expect(a.x).toBeCloseTo(44);
  });

});

describe('groups, centers and stacking', () => {
  it('MacDraw grouping brings the group to the front while preserving child order', () => {
    const a = add(), middle = add(100), b = add(180), top = add(260); group(a,b);
    expect(app.doc.objects.map(s => s.id)).toEqual([middle.id,top.id,a.id,b.id]);
  });
  it('MacDraw grouping includes and unlocks locked units', () => {
    const a = add(), b = add(100), locked = add(200,20,40,40,'rect',{locked:true}); app.selection.selectMultiple([a.id,b.id,locked.id]); actions.group();
    expect(a.groupId).toBe(b.groupId); expect(locked.groupId).toBe(a.groupId); expect(locked.locked).toBe(false);
  });
  it('ungroup keeps members selected and their relative stacking order', () => {
    const a=add(), b=add(100); group(a,b); app.selection.selectMultiple([a.id,b.id]); actions.ungroup();
    expect(app.selection.ids).toEqual([a.id,b.id]); expect(a.groupId).toBeNull(); expect(b.groupId).toBeNull();
  });
  it('align-to-grid snaps both rectangle boundaries', () => {
    const a=add(23,23,40,40); app.selection.select(a.id); actions.alignToGrid();
    expect([a.x,a.y,a.width,a.height]).toEqual([27,27,36,36]);
  });
  it('one-step arrangement cannot interleave the children of another group', () => {
    const moving = add(), a = add(100), b = add(200); group(a,b); const top = add(300); app.selection.select(moving.id);
    actions.arrange('forward'); expect(app.doc.objects.map(s => s.id)).toEqual([a.id,b.id,moving.id,top.id]);
    actions.undo(); expect(app.doc.objects.map(s => s.id)).toEqual([moving.id,a.id,b.id,top.id]);
  });
  it('centering treats a group as one object and preserves child offsets', () => {
    const a = add(), b = add(100), other = add(220); group(a,b); app.selection.selectMultiple([a.id,b.id,other.id]);
    actions.alignObjects('center','middle'); expect(b.x-a.x).toBe(80); expect((a.x+b.x+b.width)/2).toBe(other.x+other.width/2);
    actions.undo(); expect(app.doc.objects.map(s=>s.x)).toEqual([220,20,100]);
  });
  it('horizontal centering respects a locked reference and keeps text justification', () => {
    const reference = add(100,20,100,40,'rect',{locked:true}), text = add(20,20,40,20,'text',{text:'label'});
    app.selection.selectMultiple([reference.id,text.id]); actions.alignObjects('center','none');
    expect(text.x+text.width/2).toBe(110); expect(text.textAlign).toBe('left'); expect(reference.x).toBe(100);
    actions.undo(); expect(app.doc.getObjectById(text.id).textAlign).toBe('left');
  });
  it('align-to-grid moves a group rigidly using the custom ruler origin', () => {
    const a = add(23,23), b = add(104,25); group(a,b); app.selection.selectMultiple([a.id,b.id]); app.doc.rulerOrigin = {x:2,y:2};
    actions.alignToGrid(); expect([a.x,a.y,b.x-a.x,b.y-a.y]).toEqual([20,20,81,2]);
  });
});
