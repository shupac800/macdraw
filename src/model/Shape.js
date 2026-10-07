import { DEFAULT_STROKE, DEFAULT_FILL, ARC_TYPES, ARROW_TYPES } from '../util/constants.js';
import { textLayout, textFont } from '../util/text.js';
import {
  pointInRect, pointInEllipse, pointNearLine, pointNearPolyline,
  pointInPolygon, boundingBox, normalizeRect,
} from '../util/geometry.js';

let nextId = 1;

export function resetIdCounter(val = 1) {
  nextId = val;
}

function generateId() {
  return `shape_${nextId++}`;
}

export function createShape(type, props = {}) {
  const base = {
    id: generateId(),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
    locked: false,
    groupId: null,
    stroke: { ...DEFAULT_STROKE },
    fill: { ...DEFAULT_FILL },
    ...props,
  };

  // Type-specific defaults
  switch (type) {
    case 'line':
      base.points = props.points || [{ x: 0, y: 0 }, { x: 0, y: 0 }];
      base.startArrow = props.startArrow || ARROW_TYPES.NONE;
      base.endArrow = props.endArrow || ARROW_TYPES.NONE;
      base.fill = { type: 'none', color: '#ffffff', patternId: null };
      break;
    case 'arc':
      if (!props.fill) base.fill = { type: 'none', color: '#ffffff', patternId: null };
      base.startAngle = props.startAngle ?? 0;
      base.endAngle = props.endAngle ?? Math.PI / 2;
      base.arcType = props.arcType || ARC_TYPES.OPEN;
      break;
    case 'polygon':
    case 'freehand':
      if (!props.fill) base.fill = { type: 'none', color: '#ffffff', patternId: null };
      base.points = props.points || [];
      base.closed = props.closed ?? (type === 'polygon');
      break;
    case 'roundRect':
      base.cornerRadius = props.cornerRadius ?? 18;
      break;
    case 'text':
      base.text = props.text || '';
      base.fontFamily = props.fontFamily || 'Chicago, Charcoal, Arial, sans-serif';
      base.fontSize = props.fontSize || 12;
      base.fontWeight = props.fontWeight || 'normal';
      base.fontStyle = props.fontStyle || 'normal';
      base.textDecoration = props.textDecoration || 'none';
      base.textAlign = props.textAlign || 'left';
      base.fill = { type: 'none', color: '#ffffff', patternId: null };
      base.wrap = props.wrap ?? false;
      base.lineSpacing = props.lineSpacing ?? 1;
      base.stroke = { ...DEFAULT_STROKE, width: 0 };
      break;
  }

  // Override stroke/fill if explicitly provided
  if (props.stroke) base.stroke = { ...base.stroke, ...props.stroke };
  if (props.fill) base.fill = { ...base.fill, ...props.fill };

  return base;
}

export function cloneShape(shape) {
  const clone = JSON.parse(JSON.stringify(shape));
  clone.id = generateId();
  return clone;
}

export function getBounds(shape) {
  if (shape.type === 'line' || shape.type === 'polygon' || shape.type === 'freehand') {
    if (shape.points && shape.points.length > 0) {
      return boundingBox(shape.points);
    }
  }
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}

export function getVisualBounds(shape) {
  const b = getBounds(shape);
  if (!shape.rotation) return b;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const width = Math.abs(b.width * Math.cos(shape.rotation)) + Math.abs(b.height * Math.sin(shape.rotation));
  const height = Math.abs(b.width * Math.sin(shape.rotation)) + Math.abs(b.height * Math.cos(shape.rotation));
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/**
 * Compute the unified bounding box of multiple shapes.
 */
export function getMultiBounds(shapes) {
  if (!shapes || shapes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of shapes) {
    const b = getVisualBounds(shape);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function hitTest(shape, point, threshold = 5) {
  const bounds = getBounds(shape);
  if (shape.rotation || shape.flipH || shape.flipV) {
    const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
    const a = -(shape.rotation || 0), dx = point.x - cx, dy = point.y - cy;
    point = { x: cx + (dx * Math.cos(a) - dy * Math.sin(a)) * (shape.flipH ? -1 : 1), y: cy + (dx * Math.sin(a) + dy * Math.cos(a)) * (shape.flipV ? -1 : 1) };
  }
  threshold = Math.max(threshold, (shape.stroke?.width || 0) / 2 + 2);
  const filled = shape.fill?.type !== 'none';

  switch (shape.type) {
    case 'rect':
      if (filled && pointInRect(point, bounds)) return true;
      return point.x >= bounds.x - threshold && point.x <= bounds.x + bounds.width + threshold &&
        point.y >= bounds.y - threshold && point.y <= bounds.y + bounds.height + threshold &&
        (Math.abs(point.x - bounds.x) <= threshold || Math.abs(point.x - bounds.x - bounds.width) <= threshold ||
         Math.abs(point.y - bounds.y) <= threshold || Math.abs(point.y - bounds.y - bounds.height) <= threshold);
    case 'roundRect': {
      // Signed distance to the same rounded boundary used by shapePath.
      // Empty square corners must pass through to objects behind them.
      const radius = Math.max(0, Math.min(shape.cornerRadius, bounds.width / 2, bounds.height / 2));
      const qx = Math.abs(point.x - bounds.x - bounds.width / 2) - bounds.width / 2 + radius;
      const qy = Math.abs(point.y - bounds.y - bounds.height / 2) - bounds.height / 2 + radius;
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      return (filled && distance <= 0) || Math.abs(distance) <= threshold;
    }
    case 'text': return pointInRect(point, bounds);

    case 'oval':
      if (filled) return pointInEllipse(
        point,
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
        bounds.width / 2,
        bounds.height / 2
      );
      return pointInEllipse(point, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width / 2 + threshold, bounds.height / 2 + threshold) &&
        !pointInEllipse(point, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, Math.max(0, bounds.width / 2 - threshold), Math.max(0, bounds.height / 2 - threshold));

    case 'line':
      return pointNearLine(point, shape.points[0], shape.points[1], threshold);

    case 'polygon':
      if (shape.closed) {
        return (filled && pointInPolygon(point, shape.points)) ||
          pointNearPolyline(point, [...shape.points, shape.points[0]], threshold);
      }
      return pointNearPolyline(point, shape.points, threshold);

    case 'freehand':
      if (shape.closed) {
        return (filled && pointInPolygon(point, shape.points)) ||
          pointNearPolyline(point, [...shape.points, shape.points[0]], threshold);
      }
      return pointNearPolyline(point, shape.points, threshold
      );

    case 'arc': {
      const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
      const rx = bounds.width / 2, ry = bounds.height / 2;
      if (!rx || !ry) return false;
      let sweep = shape.endAngle - shape.startAngle;
      if (sweep < 0) sweep = (sweep % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      sweep = Math.min(sweep, 2 * Math.PI);
      const steps = Math.min(2048, Math.max(8, Math.ceil(sweep * Math.max(rx, ry) / 4)));
      const points = Array.from({ length: steps + 1 }, (_, i) => ({ x: cx + rx * Math.cos(shape.startAngle + sweep * i / steps), y: cy + ry * Math.sin(shape.startAngle + sweep * i / steps) }));
      if (shape.arcType === 'pie') points.push({ x: cx, y: cy });
      if (shape.arcType !== 'open') points.push(points[0]);
      return pointNearPolyline(point, points, threshold) || (filled && pointInPolygon(point, points));
    }

    default:
      return pointInRect(point, bounds);
  }
}

export function renderShape(ctx, shape, patternRegistry) {
  ctx.save();

  // Apply rotation
  if (shape.rotation) {
    const bounds = getBounds(shape);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(shape.rotation);
    ctx.translate(-cx, -cy);
  }

  // Apply flips
  if (shape.flipH || shape.flipV) {
    const bounds = getBounds(shape);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(shape.flipH ? -1 : 1, shape.flipV ? -1 : 1);
    ctx.translate(-cx, -cy);
  }

  if (shape.type === 'text') renderText(ctx, shape, patternRegistry);
  else {
    const path = shapePath(shape);
    applyFill(ctx, shape, patternRegistry, path);
    applyStroke(ctx, shape, patternRegistry, path);
    if (shape.type === 'line' && shape.stroke.width > 0) {
      if (shape.endArrow === 'arrow') drawArrowhead(ctx, shape.points[0], shape.points[1], shape.stroke, patternRegistry);
      if (shape.startArrow === 'arrow') drawArrowhead(ctx, shape.points[1], shape.points[0], shape.stroke, patternRegistry);
    }
  }

  ctx.restore();
}

function applyFill(ctx, shape, patternRegistry, path) {
  if (shape.fill.type === 'solid') {
    ctx.fillStyle = shape.fill.color;
    path ? ctx.fill(path) : ctx.fill();
  } else if (shape.fill.type === 'pattern' && patternRegistry) {
    const pattern = patternRegistry.getPattern(shape.fill.patternId);
    if (pattern) {
      // Clip geometry first, then paint exact native screen-space bits. An
      // inverse pattern matrix can still accumulate Skia rounding errors.
      ctx.save();
      path ? ctx.clip(path) : ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
  }
}

function applyStroke(ctx, shape, patternRegistry, path) {
  if (shape.stroke.width > 0) {
    const pattern = patternRegistry?.getPattern(shape.stroke.patternId);
    if (pattern && path) {
      const mask = patternRegistry.strokeMask(ctx.canvas.width, ctx.canvas.height), maskCtx = mask.getContext('2d');
      maskCtx.setTransform(ctx.getTransform());
      maskCtx.strokeStyle = '#000'; maskCtx.lineWidth = shape.stroke.width;
      maskCtx.lineCap = shape.stroke.cap; maskCtx.lineJoin = shape.stroke.join; maskCtx.setLineDash(shape.stroke.dash || []);
      maskCtx.stroke(path);
      maskCtx.setTransform(1, 0, 0, 1, 0, 0); maskCtx.globalCompositeOperation = 'source-in';
      maskCtx.fillStyle = pattern; maskCtx.fillRect(0, 0, mask.width, mask.height);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(mask, 0, 0); ctx.restore();
      return;
    }
    ctx.strokeStyle = shape.stroke.color;
    ctx.lineWidth = shape.stroke.width;
    ctx.lineCap = shape.stroke.cap;
    ctx.lineJoin = shape.stroke.join;
    if (shape.stroke.dash && shape.stroke.dash.length > 0) {
      ctx.setLineDash(shape.stroke.dash);
    }
    path ? ctx.stroke(path) : ctx.stroke();
  }
}

function renderRect(ctx, shape, patternRegistry) {
  ctx.beginPath();
  ctx.rect(shape.x, shape.y, shape.width, shape.height);
  applyFill(ctx, shape, patternRegistry);
  applyStroke(ctx, shape, patternRegistry);
}

function renderRoundRect(ctx, shape, patternRegistry) {
  const r = Math.min(shape.cornerRadius, shape.width / 2, shape.height / 2);
  ctx.beginPath();
  ctx.moveTo(shape.x + r, shape.y);
  ctx.lineTo(shape.x + shape.width - r, shape.y);
  ctx.arcTo(shape.x + shape.width, shape.y, shape.x + shape.width, shape.y + r, r);
  ctx.lineTo(shape.x + shape.width, shape.y + shape.height - r);
  ctx.arcTo(shape.x + shape.width, shape.y + shape.height, shape.x + shape.width - r, shape.y + shape.height, r);
  ctx.lineTo(shape.x + r, shape.y + shape.height);
  ctx.arcTo(shape.x, shape.y + shape.height, shape.x, shape.y + shape.height - r, r);
  ctx.lineTo(shape.x, shape.y + r);
  ctx.arcTo(shape.x, shape.y, shape.x + r, shape.y, r);
  ctx.closePath();
  applyFill(ctx, shape, patternRegistry);
  applyStroke(ctx, shape, patternRegistry);
}

function renderOval(ctx, shape, patternRegistry) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.abs(shape.width / 2), Math.abs(shape.height / 2), 0, 0, Math.PI * 2);
  applyFill(ctx, shape, patternRegistry);
  applyStroke(ctx, shape, patternRegistry);
}

function renderLine(ctx, shape, patternRegistry) {
  const [p1, p2] = shape.points;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  applyStroke(ctx, shape, patternRegistry);

  // Arrowheads
  if (shape.endArrow === 'arrow') {
    drawArrowhead(ctx, p1, p2, shape.stroke, patternRegistry);
  }
  if (shape.startArrow === 'arrow') {
    drawArrowhead(ctx, p2, p1, shape.stroke, patternRegistry);
  }
}

function drawArrowhead(ctx, from, to, stroke, patternRegistry) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = 12;
  const spread = Math.PI / 6;
  ctx.save();
  const path = new Path2D();
  path.moveTo(to.x, to.y);
  path.lineTo(to.x - len * Math.cos(angle - spread), to.y - len * Math.sin(angle - spread));
  path.lineTo(to.x - len * Math.cos(angle + spread), to.y - len * Math.sin(angle + spread));
  path.closePath();
  applyFill(ctx, { fill: { type: stroke.patternId != null ? 'pattern' : 'solid', patternId: stroke.patternId, color: stroke.color } }, patternRegistry, path);
  ctx.restore();
}

function shapePath(shape) {
  const path = new Path2D();
  if (shape.type === 'rect') path.rect(shape.x, shape.y, shape.width, shape.height);
  else if (shape.type === 'roundRect') path.roundRect(shape.x, shape.y, shape.width, shape.height, Math.min(shape.cornerRadius, shape.width / 2, shape.height / 2));
  else if (shape.type === 'oval') path.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, shape.width / 2, shape.height / 2, 0, 0, Math.PI * 2);
  else if (shape.type === 'arc') {
    const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;
    if (shape.arcType === 'pie') path.moveTo(cx, cy);
    path.ellipse(cx, cy, shape.width / 2, shape.height / 2, 0, shape.startAngle, shape.endAngle);
    if (shape.arcType !== 'open') path.closePath();
  } else if (shape.points?.length) {
    const pts = shape.points, last = pts.at(-1);
    const start = shape.smooth && shape.closed ? { x: (last.x + pts[0].x) / 2, y: (last.y + pts[0].y) / 2 } : pts[0];
    path.moveTo(start.x, start.y);
    if (shape.smooth && pts.length > 2) {
      for (let i = shape.closed ? 0 : 1; i < pts.length; i++) {
        const next = pts[(i + 1) % pts.length];
        const end = !shape.closed && i === pts.length - 1 ? pts[i] : { x: (pts[i].x + next.x) / 2, y: (pts[i].y + next.y) / 2 };
        path.quadraticCurveTo(pts[i].x, pts[i].y, end.x, end.y);
      }
    } else for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
    if (shape.closed && shape.type !== 'line') path.closePath();
  }
  return path;
}

function renderArc(ctx, shape, patternRegistry) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rx = Math.abs(shape.width / 2);
  const ry = Math.abs(shape.height / 2);
  ctx.beginPath();
  if (shape.arcType === ARC_TYPES.PIE) {
    ctx.moveTo(cx, cy);
  }
  ctx.ellipse(cx, cy, rx, ry, 0, shape.startAngle, shape.endAngle);
  if (shape.arcType === ARC_TYPES.PIE) {
    ctx.closePath();
  } else if (shape.arcType === ARC_TYPES.CLOSED) {
    ctx.closePath();
  }
  applyFill(ctx, shape, patternRegistry);
  applyStroke(ctx, shape, patternRegistry);
}

function renderPolygon(ctx, shape, patternRegistry) {
  if (!shape.points || shape.points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(shape.points[0].x, shape.points[0].y);
  if (shape.smooth && shape.points.length > 2) {
    const pts = shape.points;
    const start = shape.closed ? { x: (pts[pts.length - 1].x + pts[0].x) / 2, y: (pts[pts.length - 1].y + pts[0].y) / 2 } : pts[0];
    ctx.moveTo(start.x, start.y);
    for (let i = shape.closed ? 0 : 1; i < pts.length; i++) {
      const next = pts[(i + 1) % pts.length];
      const end = !shape.closed && i === pts.length - 1 ? pts[i] : { x: (pts[i].x + next.x) / 2, y: (pts[i].y + next.y) / 2 };
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, end.x, end.y);
    }
  } else for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y);
  if (shape.closed) ctx.closePath();
  applyFill(ctx, shape, patternRegistry);
  applyStroke(ctx, shape, patternRegistry);
}

function renderText(ctx, shape, patternRegistry) {
  if (!shape.text) return;
  ctx.save();
  ctx.font = textFont(shape);
  ctx.textAlign = shape.textAlign;
  ctx.textBaseline = 'alphabetic';

  if (shape.fill.type !== 'none') {
    ctx.beginPath(); ctx.rect(shape.x, shape.y, shape.width, shape.height);
    applyFill(ctx, shape, patternRegistry);
  }
  ctx.fillStyle = '#000000';

  let textX = shape.x;
  if (shape.textAlign === 'center') textX = shape.x + shape.width / 2;
  else if (shape.textAlign === 'right') textX = shape.x + shape.width;

  const { lines, ascent, lineHeight } = textLayout(ctx, shape);
  lines.forEach((line, i) => {
    const y = shape.y + ascent + i * lineHeight;
    if (shape.shadow) { ctx.fillText(line, textX + 2, y + 2); ctx.fillStyle = '#fff'; ctx.fillText(line, textX + 1, y + 1); ctx.fillStyle = '#000'; }
    if (shape.outline) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeText(line, textX, y); }
    else ctx.fillText(line, textX, y);
  });

  if (shape.textDecoration === 'underline') {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    lines.forEach((line, i) => {
      const metrics = ctx.measureText(line);
      const y = shape.y + i * lineHeight + ascent + 2;
      let lx = textX;
      if (shape.textAlign === 'center') lx -= metrics.width / 2;
      else if (shape.textAlign === 'right') lx -= metrics.width;
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx + metrics.width, y);
      ctx.stroke();
    });
  }

  ctx.restore();
}
