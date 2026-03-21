/**
 * Geometry utility functions for hit testing, point/rect math.
 */

export function distance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function pointInEllipse(point, cx, cy, rx, ry) {
  if (rx === 0 || ry === 0) return false;
  const dx = (point.x - cx) / rx;
  const dy = (point.y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

export function pointNearLine(point, p1, p2, threshold = 5) {
  const d = distanceToLineSegment(point, p1, p2);
  return d <= threshold;
}

export function distanceToLineSegment(point, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return distance(point, p1);

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  return distance(point, {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
  });
}

export function pointNearPolyline(point, points, threshold = 5) {
  for (let i = 0; i < points.length - 1; i++) {
    if (pointNearLine(point, points[i], points[i + 1], threshold)) {
      return true;
    }
  }
  return false;
}

export function pointInPolygon(point, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function rectContainsRect(outer, inner) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function normalizeRect(x, y, width, height) {
  return {
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

export function boundingBox(points) {
  if (!points || points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function simplifyPoints(points, tolerance = 2) {
  if (points.length <= 2) return points;
  return ramerDouglasPeucker(points, tolerance);
}

function ramerDouglasPeucker(points, epsilon) {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToLineSegment(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

export function rotatePoint(point, center, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getHandleAtPoint(point, bounds, handleSize) {
  const half = handleSize / 2;
  const handles = getHandlePositions(bounds);

  for (const [name, pos] of Object.entries(handles)) {
    if (
      point.x >= pos.x - half &&
      point.x <= pos.x + half &&
      point.y >= pos.y - half &&
      point.y <= pos.y + half
    ) {
      return name;
    }
  }
  return null;
}

export function getHandlePositions(bounds) {
  const { x, y, width, height } = bounds;
  const mx = x + width / 2;
  const my = y + height / 2;
  return {
    nw: { x, y },
    n: { x: mx, y },
    ne: { x: x + width, y },
    e: { x: x + width, y: my },
    se: { x: x + width, y: y + height },
    s: { x: mx, y: y + height },
    sw: { x, y: y + height },
    w: { x, y: my },
  };
}
