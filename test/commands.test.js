import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../src/model/Document.js';
import { createShape, resetIdCounter, getBounds, hitTest } from '../src/model/Shape.js';
import { AddShapeCommand } from '../src/commands/AddShapeCommand.js';
import { DeleteShapeCommand } from '../src/commands/DeleteShapeCommand.js';
import { MoveCommand } from '../src/commands/MoveCommand.js';
import { ResizeCommand } from '../src/commands/ResizeCommand.js';
import { StyleCommand } from '../src/commands/StyleCommand.js';
import { EditTextCommand } from '../src/commands/EditTextCommand.js';
import { ArrangeCommand } from '../src/commands/ArrangeCommand.js';
import { ResizeGroupCommand } from '../src/commands/ResizeGroupCommand.js';
import { TransformCommand } from '../src/commands/TransformCommand.js';

describe('Commands', () => {
  let doc;

  beforeEach(() => {
    resetIdCounter();
    doc = new Document();
    Document.setShapeModule({ getBounds, hitTest });
  });

  describe('AddShapeCommand', () => {
    it('adds shape on execute, removes on undo', () => {
      const shape = createShape('rect', { x: 10, y: 10, width: 50, height: 50 });
      const cmd = new AddShapeCommand(doc, shape);
      cmd.execute();
      expect(doc.objects).toHaveLength(1);
      cmd.undo();
      expect(doc.objects).toHaveLength(0);
    });
  });

  describe('DeleteShapeCommand', () => {
    it('removes shapes on execute, restores on undo', () => {
      const a = createShape('rect');
      const b = createShape('rect');
      doc.addObject(a);
      doc.addObject(b);

      const cmd = new DeleteShapeCommand(doc, [a.id]);
      cmd.execute();
      expect(doc.objects).toHaveLength(1);
      expect(doc.objects[0]).toBe(b);

      cmd.undo();
      expect(doc.objects).toHaveLength(2);
      expect(doc.objects[0]).toBe(a);
    });

    it('restores at correct indices', () => {
      const a = createShape('rect');
      const b = createShape('rect');
      const c = createShape('rect');
      doc.addObject(a);
      doc.addObject(b);
      doc.addObject(c);

      const cmd = new DeleteShapeCommand(doc, [b.id]);
      cmd.execute();
      expect(doc.objects).toEqual([a, c]);

      cmd.undo();
      expect(doc.objects).toEqual([a, b, c]);
    });

    it('handles deleting multiple', () => {
      const a = createShape('rect');
      const b = createShape('rect');
      const c = createShape('rect');
      doc.addObject(a);
      doc.addObject(b);
      doc.addObject(c);

      const cmd = new DeleteShapeCommand(doc, [a.id, c.id]);
      cmd.execute();
      expect(doc.objects).toEqual([b]);

      cmd.undo();
      expect(doc.objects).toHaveLength(3);
    });
  });

  describe('MoveCommand', () => {
    it('moves shape and undoes', () => {
      const shape = createShape('rect', { x: 10, y: 20, width: 50, height: 50 });
      doc.addObject(shape);

      const cmd = new MoveCommand(doc, [shape.id], 30, 40);
      cmd.execute();
      expect(shape.x).toBe(40);
      expect(shape.y).toBe(60);

      cmd.undo();
      expect(shape.x).toBe(10);
      expect(shape.y).toBe(20);
    });

    it('moves line points', () => {
      const shape = createShape('line', {
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      });
      doc.addObject(shape);

      const cmd = new MoveCommand(doc, [shape.id], 10, 20);
      cmd.execute();
      expect(shape.points[0]).toEqual({ x: 10, y: 20 });
      expect(shape.points[1]).toEqual({ x: 110, y: 120 });

      cmd.undo();
      expect(shape.points[0]).toEqual({ x: 0, y: 0 });
    });

    it('moves multiple shapes', () => {
      const a = createShape('rect', { x: 0, y: 0 });
      const b = createShape('rect', { x: 50, y: 50 });
      doc.addObject(a);
      doc.addObject(b);

      const cmd = new MoveCommand(doc, [a.id, b.id], 10, 10);
      cmd.execute();
      expect(a.x).toBe(10);
      expect(b.x).toBe(60);
    });
  });

  describe('ResizeCommand', () => {
    it('resizes and undoes', () => {
      const shape = createShape('rect', { x: 10, y: 10, width: 100, height: 50 });
      doc.addObject(shape);

      const oldBounds = { x: 10, y: 10, width: 100, height: 50 };
      const newBounds = { x: 10, y: 10, width: 200, height: 100 };
      const cmd = new ResizeCommand(doc, shape.id, oldBounds, newBounds);

      cmd.execute();
      expect(shape.width).toBe(200);
      expect(shape.height).toBe(100);

      cmd.undo();
      expect(shape.width).toBe(100);
      expect(shape.height).toBe(50);
    });

    it('resizes polygon by rescaling points', () => {
      const shape = createShape('polygon', {
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }],
        closed: true,
        x: 0, y: 0, width: 100, height: 80,
      });
      doc.addObject(shape);

      const oldBounds = { x: 0, y: 0, width: 100, height: 80 };
      const newBounds = { x: 0, y: 0, width: 200, height: 160 };
      const cmd = new ResizeCommand(doc, shape.id, oldBounds, newBounds);

      cmd.execute();
      expect(shape.points[1].x).toBe(200);
      expect(shape.points[2].x).toBe(100);
      expect(shape.points[2].y).toBe(160);
      expect(shape.width).toBe(200);

      cmd.undo();
      expect(shape.points[1].x).toBe(100);
      expect(shape.points[2].y).toBe(80);
      expect(shape.width).toBe(100);
    });

    it('resizes line by rescaling points', () => {
      const shape = createShape('line', {
        points: [{ x: 10, y: 20 }, { x: 110, y: 100 }],
        x: 10, y: 20, width: 100, height: 80,
      });
      doc.addObject(shape);

      const oldBounds = { x: 10, y: 20, width: 100, height: 80 };
      const newBounds = { x: 10, y: 20, width: 200, height: 160 };
      const cmd = new ResizeCommand(doc, shape.id, oldBounds, newBounds);

      cmd.execute();
      expect(shape.points[0]).toEqual({ x: 10, y: 20 });
      expect(shape.points[1]).toEqual({ x: 210, y: 180 });

      cmd.undo();
      expect(shape.points[0]).toEqual({ x: 10, y: 20 });
      expect(shape.points[1]).toEqual({ x: 110, y: 100 });
    });
  });

  describe('StyleCommand', () => {
    it('changes flat property', () => {
      const shape = createShape('text', { x: 0, y: 0, text: 'hi', fontFamily: 'Arial' });
      doc.addObject(shape);

      const cmd = new StyleCommand(doc, [shape.id], 'fontSize', 24);
      cmd.execute();
      expect(shape.fontSize).toBe(24);

      cmd.undo();
      expect(shape.fontSize).toBe(14); // default
    });

    it('changes nested property', () => {
      const shape = createShape('rect', { x: 0, y: 0 });
      doc.addObject(shape);

      const cmd = new StyleCommand(doc, [shape.id], 'stroke.color', '#ff0000');
      cmd.execute();
      expect(shape.stroke.color).toBe('#ff0000');

      cmd.undo();
      expect(shape.stroke.color).toBe('#000000');
    });

    it('applies to multiple shapes', () => {
      const a = createShape('rect');
      const b = createShape('rect');
      doc.addObject(a);
      doc.addObject(b);

      const cmd = new StyleCommand(doc, [a.id, b.id], 'stroke.width', 5);
      cmd.execute();
      expect(a.stroke.width).toBe(5);
      expect(b.stroke.width).toBe(5);
    });
  });

  describe('EditTextCommand', () => {
    it('edits text and undoes', () => {
      const shape = createShape('text', { text: 'Hello' });
      doc.addObject(shape);

      const cmd = new EditTextCommand(doc, shape.id, 'World');
      cmd.execute();
      expect(shape.text).toBe('World');

      cmd.undo();
      expect(shape.text).toBe('Hello');
    });
  });

  describe('ArrangeCommand', () => {
    it('moves to front and undoes', () => {
      const a = createShape('rect');
      const b = createShape('rect');
      const c = createShape('rect');
      doc.addObject(a);
      doc.addObject(b);
      doc.addObject(c);

      const cmd = new ArrangeCommand(doc, a.id, 'front');
      cmd.execute();
      expect(doc.objects[2]).toBe(a);

      cmd.undo();
      expect(doc.objects[0]).toBe(a);
    });
  });

  describe('ResizeGroupCommand', () => {
    it('applies and undoes multi-shape resize', () => {
      const a = createShape('rect', { x: 0, y: 0, width: 100, height: 100 });
      const b = createShape('rect', { x: 100, y: 0, width: 100, height: 100 });
      doc.addObject(a);
      doc.addObject(b);

      const oldSnaps = [
        { id: a.id, x: 0, y: 0, width: 100, height: 100, rotation: 0, points: null },
        { id: b.id, x: 100, y: 0, width: 100, height: 100, rotation: 0, points: null },
      ];
      const newSnaps = [
        { id: a.id, x: 0, y: 0, width: 200, height: 200, rotation: 0, points: null },
        { id: b.id, x: 200, y: 0, width: 200, height: 200, rotation: 0, points: null },
      ];

      const cmd = new ResizeGroupCommand(doc, oldSnaps, newSnaps);
      cmd.execute();
      expect(a.width).toBe(200);
      expect(b.x).toBe(200);
      expect(b.width).toBe(200);

      cmd.undo();
      expect(a.width).toBe(100);
      expect(b.x).toBe(100);
      expect(b.width).toBe(100);

      cmd.execute();
      expect(a.width).toBe(200);
    });

    it('handles polygon points in snapshots', () => {
      const poly = createShape('polygon', {
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 40 }],
        closed: true, x: 0, y: 0, width: 50, height: 40,
      });
      doc.addObject(poly);

      const oldSnaps = [
        { id: poly.id, x: 0, y: 0, width: 50, height: 40, rotation: 0,
          points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 40 }] },
      ];
      const newSnaps = [
        { id: poly.id, x: 0, y: 0, width: 100, height: 80, rotation: 0,
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }] },
      ];

      const cmd = new ResizeGroupCommand(doc, oldSnaps, newSnaps);
      cmd.execute();
      expect(poly.points[1].x).toBe(100);
      expect(poly.points[2].y).toBe(80);

      cmd.undo();
      expect(poly.points[1].x).toBe(50);
      expect(poly.points[2].y).toBe(40);
    });
  });

  describe('TransformCommand', () => {
    it('sets rotation and undoes', () => {
      const shape = createShape('rect');
      shape.rotation = 0;
      doc.addObject(shape);

      const cmd = new TransformCommand(doc, [shape.id], 'rotation', Math.PI / 4);
      cmd.execute();
      expect(shape.rotation).toBe(Math.PI / 4);

      cmd.undo();
      expect(shape.rotation).toBe(0);
    });

    it('toggles flip', () => {
      const shape = createShape('rect');
      doc.addObject(shape);

      const cmd = new TransformCommand(doc, [shape.id], 'flipH', true);
      cmd.execute();
      expect(shape.flipH).toBe(true);

      cmd.undo();
      expect(shape.flipH).toBe(false);
    });
  });
});
