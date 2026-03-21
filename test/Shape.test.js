import { describe, it, expect, beforeEach } from 'vitest';
import {
  createShape, cloneShape, getBounds, getMultiBounds, hitTest, resetIdCounter,
} from '../src/model/Shape.js';

describe('createShape', () => {
  beforeEach(() => resetIdCounter());

  it('creates rect with defaults', () => {
    const shape = createShape('rect');
    expect(shape.type).toBe('rect');
    expect(shape.id).toMatch(/^shape_/);
    expect(shape.x).toBe(0);
    expect(shape.stroke.color).toBe('#000000');
    expect(shape.fill.type).toBe('none');
  });

  it('creates rect with overrides', () => {
    const shape = createShape('rect', { x: 10, y: 20, width: 100, height: 50 });
    expect(shape.x).toBe(10);
    expect(shape.width).toBe(100);
  });

  it('creates line with default points', () => {
    const shape = createShape('line');
    expect(shape.points).toHaveLength(2);
    expect(shape.startArrow).toBe('none');
    expect(shape.endArrow).toBe('none');
  });

  it('creates line with custom points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 100 }];
    const shape = createShape('line', { points: pts });
    expect(shape.points).toEqual(pts);
  });

  it('creates arc with defaults', () => {
    const shape = createShape('arc');
    expect(shape.startAngle).toBe(0);
    expect(shape.endAngle).toBe(Math.PI / 2);
    expect(shape.arcType).toBe('open');
  });

  it('creates polygon with default points', () => {
    const shape = createShape('polygon');
    expect(shape.points).toEqual([]);
    expect(shape.closed).toBe(true);
  });

  it('creates freehand with default closed=false', () => {
    const shape = createShape('freehand');
    expect(shape.closed).toBe(false);
  });

  it('creates roundRect with cornerRadius', () => {
    const shape = createShape('roundRect');
    expect(shape.cornerRadius).toBe(12);
  });

  it('creates text with defaults', () => {
    const shape = createShape('text');
    expect(shape.text).toBe('');
    expect(shape.fontFamily).toMatch(/Helvetica/);
    expect(shape.fontSize).toBe(14);
    expect(shape.fill.type).toBe('solid');
  });

  it('generates unique ids', () => {
    const a = createShape('rect');
    const b = createShape('rect');
    expect(a.id).not.toBe(b.id);
  });
});

describe('cloneShape', () => {
  beforeEach(() => resetIdCounter());

  it('creates deep copy with new id', () => {
    const original = createShape('rect', { x: 10, y: 20 });
    const clone = cloneShape(original);
    expect(clone.id).not.toBe(original.id);
    expect(clone.x).toBe(10);
    expect(clone.y).toBe(20);
    expect(clone.type).toBe('rect');
  });

  it('does not share references', () => {
    const original = createShape('rect');
    const clone = cloneShape(original);
    clone.stroke.color = '#ff0000';
    expect(original.stroke.color).toBe('#000000');
  });
});

describe('getBounds', () => {
  beforeEach(() => resetIdCounter());

  it('returns shape bounds for rect', () => {
    const shape = createShape('rect', { x: 10, y: 20, width: 100, height: 50 });
    expect(getBounds(shape)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('computes bounds from points for line', () => {
    const shape = createShape('line', {
      points: [{ x: 10, y: 20 }, { x: 50, y: 80 }],
    });
    const bounds = getBounds(shape);
    expect(bounds.x).toBe(10);
    expect(bounds.y).toBe(20);
    expect(bounds.width).toBe(40);
    expect(bounds.height).toBe(60);
  });

  it('computes bounds from points for polygon', () => {
    const shape = createShape('polygon', {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }],
    });
    const bounds = getBounds(shape);
    expect(bounds.x).toBe(0);
    expect(bounds.width).toBe(100);
    expect(bounds.height).toBe(80);
  });
});

describe('getMultiBounds', () => {
  beforeEach(() => resetIdCounter());

  it('returns bounds of empty array', () => {
    expect(getMultiBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('returns same as getBounds for single shape', () => {
    const s = createShape('rect', { x: 10, y: 20, width: 100, height: 50 });
    expect(getMultiBounds([s])).toEqual(getBounds(s));
  });

  it('computes union of two non-overlapping shapes', () => {
    const a = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    const b = createShape('rect', { x: 100, y: 100, width: 50, height: 50 });
    const bounds = getMultiBounds([a, b]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 150, height: 150 });
  });

  it('computes union of overlapping shapes', () => {
    const a = createShape('rect', { x: 0, y: 0, width: 80, height: 80 });
    const b = createShape('rect', { x: 40, y: 40, width: 80, height: 80 });
    const bounds = getMultiBounds([a, b]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 120, height: 120 });
  });

  it('includes point-based shapes', () => {
    const rect = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    const line = createShape('line', { points: [{ x: 60, y: 10 }, { x: 200, y: 80 }] });
    const bounds = getMultiBounds([rect, line]);
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    expect(bounds.width).toBe(200);
    expect(bounds.height).toBe(80);
  });
});

describe('hitTest', () => {
  beforeEach(() => resetIdCounter());

  it('rect: hit inside', () => {
    const shape = createShape('rect', { x: 10, y: 10, width: 100, height: 50 });
    expect(hitTest(shape, { x: 50, y: 30 })).toBe(true);
  });

  it('rect: miss outside', () => {
    const shape = createShape('rect', { x: 10, y: 10, width: 100, height: 50 });
    expect(hitTest(shape, { x: 200, y: 200 })).toBe(false);
  });

  it('oval: hit inside', () => {
    const shape = createShape('oval', { x: 10, y: 10, width: 100, height: 60 });
    expect(hitTest(shape, { x: 60, y: 40 })).toBe(true);
  });

  it('oval: miss at corner of bounding box', () => {
    const shape = createShape('oval', { x: 0, y: 0, width: 100, height: 100 });
    expect(hitTest(shape, { x: 2, y: 2 })).toBe(false);
  });

  it('line: hit near line', () => {
    const shape = createShape('line', {
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    });
    expect(hitTest(shape, { x: 50, y: 52 }, 5)).toBe(true);
  });

  it('line: miss far from line', () => {
    const shape = createShape('line', {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    });
    expect(hitTest(shape, { x: 50, y: 50 }, 5)).toBe(false);
  });

  it('polygon closed with fill: hit inside', () => {
    const shape = createShape('polygon', {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }],
      closed: true,
      fill: { type: 'solid', color: '#000', patternId: null },
    });
    expect(hitTest(shape, { x: 50, y: 30 })).toBe(true);
  });

  it('polygon closed without fill: hit inside', () => {
    const shape = createShape('polygon', {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }],
      closed: true,
    });
    // Should be selectable by clicking interior even with no fill
    expect(hitTest(shape, { x: 50, y: 30 })).toBe(true);
  });

  it('polygon closed: hit on edge', () => {
    const shape = createShape('polygon', {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }],
      closed: true,
    });
    expect(hitTest(shape, { x: 50, y: 1 }, 5)).toBe(true);
  });

  it('polygon open: hit near edge', () => {
    const shape = createShape('polygon', {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }],
      closed: false,
    });
    expect(hitTest(shape, { x: 50, y: 1 }, 5)).toBe(true);
  });

  it('freehand: hit near path', () => {
    const shape = createShape('freehand', {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
    });
    expect(hitTest(shape, { x: 5, y: 2 }, 5)).toBe(true);
  });

  it('text: hit inside bounds', () => {
    const shape = createShape('text', { x: 10, y: 10, width: 100, height: 30, text: 'Hello' });
    expect(hitTest(shape, { x: 50, y: 25 })).toBe(true);
  });

  it('roundRect: hit inside', () => {
    const shape = createShape('roundRect', { x: 0, y: 0, width: 100, height: 50 });
    expect(hitTest(shape, { x: 50, y: 25 })).toBe(true);
  });
});
