import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../src/model/Document.js';
import { createShape, resetIdCounter, getBounds, hitTest } from '../src/model/Shape.js';

describe('Document', () => {
  let doc;

  beforeEach(() => {
    resetIdCounter();
    doc = new Document();
    Document.setShapeModule({ getBounds, hitTest });
  });

  it('creates with default page size', () => {
    expect(doc.pageWidth).toBe(612);
    expect(doc.pageHeight).toBe(792);
  });

  it('creates with custom page size', () => {
    const d = new Document({ pageWidth: 100, pageHeight: 200 });
    expect(d.pageWidth).toBe(100);
    expect(d.pageHeight).toBe(200);
  });

  describe('object CRUD', () => {
    it('adds and retrieves objects', () => {
      const shape = createShape('rect', { x: 10, y: 20, width: 50, height: 30 });
      doc.addObject(shape);
      expect(doc.objects).toHaveLength(1);
      expect(doc.getObjectById(shape.id)).toBe(shape);
    });

    it('removes objects by id', () => {
      const shape = createShape('rect');
      doc.addObject(shape);
      const removed = doc.removeObject(shape.id);
      expect(removed).toBe(shape);
      expect(doc.objects).toHaveLength(0);
    });

    it('returns null for non-existent id', () => {
      expect(doc.getObjectById('nope')).toBeNull();
    });

    it('removeObject returns null for missing id', () => {
      expect(doc.removeObject('nope')).toBeNull();
    });

    it('insertObjectAt places at specific index', () => {
      const a = createShape('rect');
      const b = createShape('rect');
      const c = createShape('rect');
      doc.addObject(a);
      doc.addObject(c);
      doc.insertObjectAt(b, 1);
      expect(doc.objects[0]).toBe(a);
      expect(doc.objects[1]).toBe(b);
      expect(doc.objects[2]).toBe(c);
    });
  });

  describe('z-order', () => {
    let a, b, c;

    beforeEach(() => {
      a = createShape('rect');
      b = createShape('rect');
      c = createShape('rect');
      doc.addObject(a);
      doc.addObject(b);
      doc.addObject(c);
    });

    it('moveToFront moves object to end', () => {
      doc.moveToFront(a.id);
      expect(doc.objects[2]).toBe(a);
    });

    it('moveToBack moves object to start', () => {
      doc.moveToBack(c.id);
      expect(doc.objects[0]).toBe(c);
    });

    it('moveForward swaps with next', () => {
      doc.moveForward(a.id);
      expect(doc.objects[0]).toBe(b);
      expect(doc.objects[1]).toBe(a);
    });

    it('moveBackward swaps with previous', () => {
      doc.moveBackward(c.id);
      expect(doc.objects[1]).toBe(c);
      expect(doc.objects[2]).toBe(b);
    });

    it('moveToFront does nothing for last item', () => {
      doc.moveToFront(c.id);
      expect(doc.objects[2]).toBe(c);
    });

    it('moveToBack does nothing for first item', () => {
      doc.moveToBack(a.id);
      expect(doc.objects[0]).toBe(a);
    });
  });

  describe('hit testing', () => {
    it('getObjectAtPoint returns topmost shape', () => {
      const a = createShape('rect', { x: 0, y: 0, width: 100, height: 100 });
      const b = createShape('rect', { x: 50, y: 50, width: 100, height: 100 });
      doc.addObject(a);
      doc.addObject(b);
      expect(doc.getObjectAtPoint({ x: 75, y: 75 })).toBe(b);
    });

    it('getObjectAtPoint returns null for empty space', () => {
      expect(doc.getObjectAtPoint({ x: 500, y: 500 })).toBeNull();
    });
  });

  describe('groups', () => {
    it('manages groups', () => {
      const group = { id: 'g1', members: ['a', 'b'] };
      doc.addGroup(group);
      expect(doc.groups).toHaveLength(1);
      doc.removeGroup('g1');
      expect(doc.groups).toHaveLength(0);
    });

    it('getGroupMembers returns matching shapes', () => {
      const a = createShape('rect');
      a.groupId = 'g1';
      const b = createShape('rect');
      b.groupId = 'g1';
      const c = createShape('rect');
      doc.addObject(a);
      doc.addObject(b);
      doc.addObject(c);
      expect(doc.getGroupMembers('g1')).toHaveLength(2);
    });
  });

  describe('change events', () => {
    it('notifies listeners on add', () => {
      let called = false;
      doc.onChange((type) => { if (type === 'add') called = true; });
      doc.addObject(createShape('rect'));
      expect(called).toBe(true);
    });

    it('allows unsubscribing', () => {
      let count = 0;
      const unsub = doc.onChange(() => count++);
      doc.addObject(createShape('rect'));
      expect(count).toBe(1);
      unsub();
      doc.addObject(createShape('rect'));
      expect(count).toBe(1);
    });
  });

  describe('serialization', () => {
    it('round-trips via toJSON/fromJSON', () => {
      doc.addObject(createShape('rect', { x: 10, y: 20, width: 30, height: 40 }));
      doc.snapToGrid = true;
      const json = doc.toJSON();
      const restored = Document.fromJSON(json);
      expect(restored.pageWidth).toBe(612);
      expect(restored.objects).toHaveLength(1);
      expect(restored.objects[0].x).toBe(10);
      expect(restored.snapToGrid).toBe(true);
    });
  });

  describe('clear', () => {
    it('removes all objects and groups', () => {
      doc.addObject(createShape('rect'));
      doc.addGroup({ id: 'g1', members: [] });
      doc.clear();
      expect(doc.objects).toHaveLength(0);
      expect(doc.groups).toHaveLength(0);
    });
  });
});
