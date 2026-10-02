import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../src/model/Document.js';
import { Selection } from '../src/model/Selection.js';
import { CommandStack } from '../src/commands/CommandStack.js';
import { SelectionOverlay } from '../src/view/SelectionOverlay.js';
import { SelectTool } from '../src/controller/tools/SelectTool.js';
import { createShape, resetIdCounter, getBounds, hitTest } from '../src/model/Shape.js';

describe('SelectTool', () => {
  let doc, selection, commandStack, overlay, tool;

  beforeEach(() => {
    resetIdCounter();
    doc = new Document();
    Document.setShapeModule({ getBounds, hitTest });
    selection = new Selection();
    commandStack = new CommandStack();
    overlay = new SelectionOverlay(doc, selection);

    tool = new SelectTool();
    tool.doc = doc;
    tool.selection = selection;
    tool.commandStack = commandStack;
    tool.overlay = overlay;
    tool.cursor = null;
    tool.manager = { setActiveTool() {} };
  });

  it('selects a shape on click', () => {
    const rect = createShape('rect', { x: 10, y: 10, width: 80, height: 60 });
    doc.addObject(rect);

    tool.onMouseDown({ x: 50, y: 40 }, { shiftKey: false, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 50, y: 40 }, { shiftKey: false, ctrlKey: false, altKey: false });

    expect(selection.count).toBe(1);
    expect(selection.has(rect.id)).toBe(true);
  });

  it('shift-click adds a second shape to selection', () => {
    const a = createShape('rect', { x: 10, y: 10, width: 50, height: 50 });
    const b = createShape('rect', { x: 200, y: 200, width: 50, height: 50 });
    doc.addObject(a);
    doc.addObject(b);

    // Click first shape
    tool.onMouseDown({ x: 30, y: 30 }, { shiftKey: false, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 30, y: 30 }, { shiftKey: false, ctrlKey: false, altKey: false });
    expect(selection.count).toBe(1);
    expect(selection.has(a.id)).toBe(true);

    // Shift-click second shape
    tool.onMouseDown({ x: 220, y: 220 }, { shiftKey: true, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 220, y: 220 }, { shiftKey: true, ctrlKey: false, altKey: false });
    expect(selection.count).toBe(2);
    expect(selection.has(a.id)).toBe(true);
    expect(selection.has(b.id)).toBe(true);
  });

  it('shift-click toggles off an already-selected shape', () => {
    const a = createShape('rect', { x: 10, y: 10, width: 50, height: 50 });
    const b = createShape('rect', { x: 200, y: 200, width: 50, height: 50 });
    doc.addObject(a);
    doc.addObject(b);

    // Select both via shift-click
    tool.onMouseDown({ x: 30, y: 30 }, { shiftKey: false, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 30, y: 30 }, { shiftKey: false, ctrlKey: false, altKey: false });
    tool.onMouseDown({ x: 220, y: 220 }, { shiftKey: true, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 220, y: 220 }, { shiftKey: true, ctrlKey: false, altKey: false });
    expect(selection.count).toBe(2);

    // Shift-click first shape again to deselect it
    tool.onMouseDown({ x: 30, y: 30 }, { shiftKey: true, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 30, y: 30 }, { shiftKey: true, ctrlKey: false, altKey: false });
    expect(selection.count).toBe(1);
    expect(selection.has(a.id)).toBe(false);
    expect(selection.has(b.id)).toBe(true);
  });

  it('marquee selects multiple shapes', () => {
    const a = createShape('rect', { x: 10, y: 10, width: 30, height: 30 });
    const b = createShape('rect', { x: 50, y: 50, width: 30, height: 30 });
    const c = createShape('rect', { x: 500, y: 500, width: 30, height: 30 }); // outside marquee
    doc.addObject(a);
    doc.addObject(b);
    doc.addObject(c);

    // Drag marquee from (0,0) to (100,100)
    tool.onMouseDown({ x: 0, y: 0 }, { shiftKey: false, ctrlKey: false, altKey: false });
    tool.onMouseMove({ x: 100, y: 100 }, { shiftKey: false, ctrlKey: false, altKey: false, buttons: 1 });
    tool.onMouseUp({ x: 100, y: 100 }, { shiftKey: false, ctrlKey: false, altKey: false });

    expect(selection.count).toBe(2);
    expect(selection.has(a.id)).toBe(true);
    expect(selection.has(b.id)).toBe(true);
    expect(selection.has(c.id)).toBe(false);
  });

  it('shift-click near a handle still adds to selection', () => {
    // Shape A's SE handle is at (60, 60). Shape B starts at (56, 56).
    // Without the fix, clicking shape B's interior near A's handle
    // would start a resize instead of adding B to the selection.
    const a = createShape('rect', { x: 10, y: 10, width: 50, height: 50 });
    const b = createShape('rect', { x: 56, y: 56, width: 50, height: 50 });
    doc.addObject(a);
    doc.addObject(b);

    // Select A
    tool.onMouseDown({ x: 30, y: 30 }, { shiftKey: false, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 30, y: 30 }, { shiftKey: false, ctrlKey: false, altKey: false });
    expect(selection.count).toBe(1);
    expect(selection.has(a.id)).toBe(true);

    // Shift-click B near A's SE handle — should add B, not resize A
    tool.onMouseDown({ x: 60, y: 60 }, { shiftKey: true, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 60, y: 60 }, { shiftKey: true, ctrlKey: false, altKey: false });
    expect(selection.count).toBe(2);
    expect(selection.has(a.id)).toBe(true);
    expect(selection.has(b.id)).toBe(true);
  });

  it('clicking empty space deselects all', () => {
    const a = createShape('rect', { x: 10, y: 10, width: 30, height: 30 });
    doc.addObject(a);

    tool.onMouseDown({ x: 20, y: 20 }, { shiftKey: false, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 20, y: 20 }, { shiftKey: false, ctrlKey: false, altKey: false });
    expect(selection.count).toBe(1);

    // Click empty space
    tool.onMouseDown({ x: 400, y: 400 }, { shiftKey: false, ctrlKey: false, altKey: false });
    tool.onMouseUp({ x: 400, y: 400 }, { shiftKey: false, ctrlKey: false, altKey: false });
    expect(selection.count).toBe(0);
  });

  describe('group resize', () => {
    it('resizes multiple selected shapes proportionally via SE handle drag', () => {
      // Two shapes: A at (0,0,100,100) and B at (100,0,100,100)
      // Unified bounds: (0,0,200,100)
      // SE handle at (200,100)
      const a = createShape('rect', { x: 0, y: 0, width: 100, height: 100 });
      const b = createShape('rect', { x: 100, y: 0, width: 100, height: 100 });
      doc.addObject(a);
      doc.addObject(b);

      // Select both
      selection.selectMultiple([a.id, b.id]);

      // Drag SE handle from (200,100) to (400,200) — double the size
      const mods = { shiftKey: false, ctrlKey: false, altKey: false };
      tool.onMouseDown({ x: 200, y: 100 }, mods); // hits SE handle
      expect(tool._mode).toBe('resize');
      expect(tool._handle).toBe('se');

      tool.onMouseMove({ x: 400, y: 200 }, { ...mods, buttons: 1 });
      tool.onMouseUp({ x: 400, y: 200 }, mods);

      // Both shapes should be doubled in size
      expect(a.x).toBe(0);
      expect(a.y).toBe(0);
      expect(a.width).toBe(200);
      expect(a.height).toBe(200);
      expect(b.x).toBe(200);
      expect(b.y).toBe(0);
      expect(b.width).toBe(200);
      expect(b.height).toBe(200);
    });

    it('undo restores original geometry for all shapes', () => {
      const a = createShape('rect', { x: 0, y: 0, width: 100, height: 100 });
      const b = createShape('rect', { x: 100, y: 0, width: 100, height: 100 });
      doc.addObject(a);
      doc.addObject(b);
      selection.selectMultiple([a.id, b.id]);

      // Resize
      const mods = { shiftKey: false, ctrlKey: false, altKey: false };
      tool.onMouseDown({ x: 200, y: 100 }, mods);
      tool.onMouseMove({ x: 400, y: 200 }, { ...mods, buttons: 1 });
      tool.onMouseUp({ x: 400, y: 200 }, mods);

      // Undo
      commandStack.undo();
      expect(a.x).toBe(0);
      expect(a.width).toBe(100);
      expect(b.x).toBe(100);
      expect(b.width).toBe(100);
    });

    it('group resize works with grouped shapes', () => {
      const a = createShape('rect', { x: 10, y: 10, width: 80, height: 80 });
      const b = createShape('rect', { x: 110, y: 10, width: 80, height: 80 });
      a.groupId = 'g1';
      b.groupId = 'g1';
      doc.addObject(a);
      doc.addObject(b);
      doc.addGroup({ id: 'g1', members: [a.id, b.id] });

      // Click one member — should auto-select both (group behavior)
      const mods = { shiftKey: false, ctrlKey: false, altKey: false };
      tool.onMouseDown({ x: 50, y: 50 }, mods);
      tool.onMouseUp({ x: 50, y: 50 }, mods);
      expect(selection.count).toBe(2);

      // Unified bounds: (10,10,180,80), SE handle at (190, 90)
      tool.onMouseDown({ x: 190, y: 90 }, mods);
      expect(tool._mode).toBe('resize');

      // Drag to double width
      tool.onMouseMove({ x: 370, y: 90 }, { ...mods, buttons: 1 });
      tool.onMouseUp({ x: 370, y: 90 }, mods);

      // Width doubled (180 → 360), height unchanged
      expect(a.width).toBeCloseTo(160); // 80/180 * 360
      expect(b.width).toBeCloseTo(160);
      // a.x stays at 10, b.x moves proportionally
      expect(a.x).toBeCloseTo(10);
      expect(b.x).toBeCloseTo(210); // 10 + (100/180)*360
    });

    it('resizes polygon points proportionally with group', () => {
      const rect = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
      const poly = createShape('polygon', {
        points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 50 }],
        closed: true,
        x: 50, y: 0, width: 50, height: 50,
      });
      doc.addObject(rect);
      doc.addObject(poly);
      selection.selectMultiple([rect.id, poly.id]);

      // Unified bounds: (0,0,100,50), SE at (100,50)
      const mods = { shiftKey: false, ctrlKey: false, altKey: false };
      tool.onMouseDown({ x: 100, y: 50 }, mods);
      expect(tool._mode).toBe('resize');

      // Double everything
      tool.onMouseMove({ x: 200, y: 100 }, { ...mods, buttons: 1 });
      tool.onMouseUp({ x: 200, y: 100 }, mods);

      expect(rect.width).toBe(100);
      expect(rect.height).toBe(100);
      expect(poly.points[0].x).toBe(100);
      expect(poly.points[1].x).toBe(200);
      expect(poly.points[2].y).toBe(100);
    });
  });

  describe('group rotation', () => {
    it('rotates grouped shapes around the group center, not individually', () => {
      // Two polygons side by side
      // Polygon A: triangle on the left, center at (25, 25)
      // Polygon B: triangle on the right, center at (75, 25)
      const polyA = createShape('polygon', {
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 }],
        closed: true,
        x: 0, y: 0, width: 50, height: 50,
      });
      const polyB = createShape('polygon', {
        points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 50 }],
        closed: true,
        x: 50, y: 0, width: 50, height: 50,
      });
      polyA.groupId = 'g1';
      polyB.groupId = 'g1';
      doc.addObject(polyA);
      doc.addObject(polyB);
      doc.addGroup({ id: 'g1', members: [polyA.id, polyB.id] });

      // Select both (click one member of group)
      const mods = { shiftKey: false, ctrlKey: false, altKey: false };
      // Unfilled polygons are selected by their border, as in MacDraw.
      tool.onMouseDown({ x: 25, y: 0 }, mods);
      tool.onMouseUp({ x: 25, y: 0 }, mods);
      expect(selection.count).toBe(2);

      // Unified bounds: (0,0,100,50), center at (50,25)
      // Rotation handle is at (50, 0 - 24) = (50, -24)
      const cx = 50, cy = 25;
      const rotHandleY = -24; // top of bounds (y=0) minus ROTATION_HANDLE_DISTANCE (24)

      // Save original points
      const origA0 = { ...polyA.points[0] };
      const origB0 = { ...polyB.points[0] };

      // Start rotation
      tool.onMouseDown({ x: cx, y: rotHandleY }, mods);
      expect(tool._mode).toBe('rotate');

      // Drag to the right of center (90° CW)
      tool.onMouseMove({ x: cx + 50, y: cy }, { ...mods, buttons: 1 });
      tool.onMouseUp({ x: cx + 50, y: cy }, mods);

      // After 90° CW rotation around (50, 25):
      // Point (0,0) -> rotated around (50,25) by 90° -> (50+25, 25-50) = (75, -25)
      // Point (50,0) -> rotated around (50,25) by 90° -> (50+25, 25+0) = (75, 25)
      // The key assertion: shapes should NOT have just rotated around their own centers.
      // If they rotated independently, polyA.points[0] would still be near (0,0) area
      // and only shape.rotation would change. With group rotation, the points themselves move.

      // Verify points have been orbitally transformed (not just rotation property changed)
      const movedA = polyA.points[0];
      const movedB = polyB.points[0];

      // Points should have moved significantly from original positions
      const distA = Math.sqrt((movedA.x - origA0.x) ** 2 + (movedA.y - origA0.y) ** 2);
      const distB = Math.sqrt((movedB.x - origB0.x) ** 2 + (movedB.y - origB0.y) ** 2);
      expect(distA).toBeGreaterThan(10); // points moved, not just rotation property
      expect(distB).toBeGreaterThan(10);

      // Rotation property should NOT be set for polygon (points are rotated directly)
      expect(polyA.rotation).toBe(0);
      expect(polyB.rotation).toBe(0);
    });

    it('rotates rect-based shapes by orbiting around group center', () => {
      // Rect A at left, Rect B at right
      const rectA = createShape('rect', { x: 0, y: 0, width: 40, height: 40 });
      const rectB = createShape('rect', { x: 60, y: 0, width: 40, height: 40 });
      rectA.groupId = 'g2';
      rectB.groupId = 'g2';
      doc.addObject(rectA);
      doc.addObject(rectB);
      doc.addGroup({ id: 'g2', members: [rectA.id, rectB.id] });

      selection.selectMultiple([rectA.id, rectB.id]);

      // Unified bounds: (0,0,100,40), center at (50,20)
      // Rotation handle at (50, 0 - 24) = (50, -24)
      const cx = 50, cy = 20;

      const origAx = rectA.x;
      const origBx = rectB.x;

      // Start rotation at rotation handle
      const mods = { shiftKey: false, ctrlKey: false, altKey: false };
      tool.onMouseDown({ x: cx, y: -24 }, mods);
      expect(tool._mode).toBe('rotate');

      // Drag to right of center for ~90° CW
      tool.onMouseMove({ x: cx + 50, y: cy }, { ...mods, buttons: 1 });
      tool.onMouseUp({ x: cx + 50, y: cy }, mods);

      // Rect positions should have changed (orbited around group center)
      expect(rectA.x).not.toBeCloseTo(origAx, 0);
      expect(rectB.x).not.toBeCloseTo(origBx, 0);

      // Both should have rotation set
      expect(rectA.rotation).not.toBe(0);
      expect(rectB.rotation).not.toBe(0);
      // Both should have the same rotation angle
      expect(rectA.rotation).toBeCloseTo(rectB.rotation);
    });

    it('undo restores original positions after group rotation', () => {
      const polyA = createShape('polygon', {
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 }],
        closed: true, x: 0, y: 0, width: 50, height: 50,
      });
      const polyB = createShape('polygon', {
        points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 50 }],
        closed: true, x: 50, y: 0, width: 50, height: 50,
      });
      polyA.groupId = 'g1';
      polyB.groupId = 'g1';
      doc.addObject(polyA);
      doc.addObject(polyB);
      doc.addGroup({ id: 'g1', members: [polyA.id, polyB.id] });

      const mods = { shiftKey: false, ctrlKey: false, altKey: false };
      tool.onMouseDown({ x: 25, y: 25 }, mods);
      tool.onMouseUp({ x: 25, y: 25 }, mods);

      const origPoints = polyA.points.map(p => ({ ...p }));

      // Rotate - rotation handle at (50, 0 - 24) = (50, -24)
      tool.onMouseDown({ x: 50, y: -24 }, mods);
      tool.onMouseMove({ x: 100, y: 25 }, { ...mods, buttons: 1 });
      tool.onMouseUp({ x: 100, y: 25 }, mods);

      // Undo
      commandStack.undo();
      for (let i = 0; i < origPoints.length; i++) {
        expect(polyA.points[i].x).toBeCloseTo(origPoints[i].x);
        expect(polyA.points[i].y).toBeCloseTo(origPoints[i].y);
      }
    });
  });
});
