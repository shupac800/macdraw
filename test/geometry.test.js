import { describe, it, expect } from 'vitest';
import {
  distance, pointInRect, pointInEllipse, pointNearLine,
  pointNearPolyline, pointInPolygon, rectsIntersect,
  rectContainsRect, normalizeRect, boundingBox,
  simplifyPoints, rotatePoint, getHandleAtPoint, getHandlePositions,
  distanceToLineSegment,
} from '../src/util/geometry.js';

describe('distance', () => {
  it('returns 0 for same point', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('calculates correct distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('handles negative coordinates', () => {
    expect(distance({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(5);
  });
});

describe('pointInRect', () => {
  const rect = { x: 10, y: 10, width: 100, height: 50 };

  it('returns true for point inside', () => {
    expect(pointInRect({ x: 50, y: 30 }, rect)).toBe(true);
  });

  it('returns true for point on edge', () => {
    expect(pointInRect({ x: 10, y: 10 }, rect)).toBe(true);
    expect(pointInRect({ x: 110, y: 60 }, rect)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(pointInRect({ x: 5, y: 30 }, rect)).toBe(false);
    expect(pointInRect({ x: 115, y: 30 }, rect)).toBe(false);
  });
});

describe('pointInEllipse', () => {
  it('returns true for point at center', () => {
    expect(pointInEllipse({ x: 50, y: 50 }, 50, 50, 30, 20)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(pointInEllipse({ x: 100, y: 100 }, 50, 50, 30, 20)).toBe(false);
  });

  it('returns true for point on boundary', () => {
    expect(pointInEllipse({ x: 80, y: 50 }, 50, 50, 30, 20)).toBe(true);
  });

  it('returns false for zero-radius ellipse', () => {
    expect(pointInEllipse({ x: 50, y: 50 }, 50, 50, 0, 20)).toBe(false);
  });
});

describe('pointNearLine', () => {
  it('returns true for point on line', () => {
    expect(pointNearLine({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 10 })).toBe(true);
  });

  it('returns true for point near line within threshold', () => {
    expect(pointNearLine({ x: 5, y: 7 }, { x: 0, y: 0 }, { x: 10, y: 10 }, 5)).toBe(true);
  });

  it('returns false for point far from line', () => {
    expect(pointNearLine({ x: 50, y: 50 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 5)).toBe(false);
  });
});

describe('distanceToLineSegment', () => {
  it('returns 0 for point on segment', () => {
    expect(distanceToLineSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });

  it('returns distance to nearest endpoint beyond segment', () => {
    const d = distanceToLineSegment({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(d).toBe(5);
  });

  it('returns perpendicular distance for point beside segment', () => {
    const d = distanceToLineSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(d).toBe(3);
  });
});

describe('pointNearPolyline', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  it('returns true for point near a segment', () => {
    expect(pointNearPolyline({ x: 5, y: 1 }, pts, 5)).toBe(true);
  });

  it('returns false for point far from all segments', () => {
    expect(pointNearPolyline({ x: 50, y: 50 }, pts, 5)).toBe(false);
  });
});

describe('pointInPolygon', () => {
  const triangle = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];

  it('returns true for point inside polygon', () => {
    expect(pointInPolygon({ x: 5, y: 3 }, triangle)).toBe(true);
  });

  it('returns false for point outside polygon', () => {
    expect(pointInPolygon({ x: 20, y: 20 }, triangle)).toBe(false);
  });
});

describe('rectsIntersect', () => {
  it('returns true for overlapping rects', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 }
    )).toBe(true);
  });

  it('returns false for non-overlapping rects', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 }
    )).toBe(false);
  });

  it('returns false for edge-touching rects', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 }
    )).toBe(false);
  });
});

describe('rectContainsRect', () => {
  it('returns true when outer contains inner', () => {
    expect(rectContainsRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 10, y: 10, width: 20, height: 20 }
    )).toBe(true);
  });

  it('returns false when inner extends beyond outer', () => {
    expect(rectContainsRect(
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 40, y: 40, width: 20, height: 20 }
    )).toBe(false);
  });
});

describe('normalizeRect', () => {
  it('handles positive dimensions', () => {
    expect(normalizeRect(10, 20, 30, 40)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('normalizes negative width', () => {
    expect(normalizeRect(40, 20, -30, 40)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('normalizes negative height', () => {
    expect(normalizeRect(10, 60, 30, -40)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('normalizes both negative', () => {
    expect(normalizeRect(40, 60, -30, -40)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });
});

describe('boundingBox', () => {
  it('returns bounding box of points', () => {
    const pts = [{ x: 5, y: 10 }, { x: 20, y: 3 }, { x: 15, y: 25 }];
    expect(boundingBox(pts)).toEqual({ x: 5, y: 3, width: 15, height: 22 });
  });

  it('returns zero rect for empty array', () => {
    expect(boundingBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('handles single point', () => {
    expect(boundingBox([{ x: 5, y: 10 }])).toEqual({ x: 5, y: 10, width: 0, height: 0 });
  });
});

describe('simplifyPoints', () => {
  it('returns same points if 2 or fewer', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    expect(simplifyPoints(pts)).toEqual(pts);
  });

  it('simplifies collinear points', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
    ];
    const result = simplifyPoints(pts, 1);
    expect(result.length).toBeLessThan(pts.length);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 5, y: 0 });
  });

  it('preserves significant corners', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 50 },
    ];
    const result = simplifyPoints(pts, 2);
    expect(result.length).toBe(4);
  });
});

describe('rotatePoint', () => {
  it('rotates point 90 degrees', () => {
    const result = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(10, 5);
  });

  it('returns same point for 0 rotation', () => {
    const result = rotatePoint({ x: 5, y: 3 }, { x: 0, y: 0 }, 0);
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(3, 5);
  });
});

describe('getHandlePositions', () => {
  it('returns 8 handles for a rect', () => {
    const handles = getHandlePositions({ x: 10, y: 20, width: 100, height: 50 });
    expect(Object.keys(handles)).toHaveLength(8);
    expect(handles.nw).toEqual({ x: 10, y: 20 });
    expect(handles.se).toEqual({ x: 110, y: 70 });
    expect(handles.n).toEqual({ x: 60, y: 20 });
  });
});

describe('getHandleAtPoint', () => {
  const bounds = { x: 10, y: 20, width: 100, height: 50 };

  it('detects NW handle', () => {
    expect(getHandleAtPoint({ x: 10, y: 20 }, bounds, 8)).toBe('nw');
  });

  it('detects SE handle', () => {
    expect(getHandleAtPoint({ x: 110, y: 70 }, bounds, 8)).toBe('se');
  });

  it('returns null for point not on handle', () => {
    expect(getHandleAtPoint({ x: 60, y: 45 }, bounds, 8)).toBeNull();
  });
});
