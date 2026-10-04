import { DEFAULT_STROKE, DEFAULT_FILL, ARC_TYPES, ARROW_TYPES } from '../util/constants.js';
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
      base.startAngle = props.startAngle ?? 0;
      base.endAngle = props.endAngle ?? Math.PI / 2;
      base.arcType = props.arcType || ARC_TYPES.OPEN;
      break;
    case 'polygon':
    case 'freehand':
      base.points = props.points || [];
      base.closed = props.closed ?? (type === 'polygon');
      break;
    case 'roundRect':
      base.cornerRadius = props.cornerRadius ?? 12;
      break;
    case 'text':
      base.text = props.text || '';
      base.fontFamily = props.fontFamily || 'Helvetica, Arial, sans-serif';
      base.fontSize = props.fontSize || 14;
      base.fontWeight = props.fontWeight || 'normal';
      base.fontStyle = props.fontStyle || 'normal';
      base.textDecoration = props.textDecoration || 'none';
      base.textAlign = props.textAlign || 'left';
      base.fill = { type: 'solid', color: '#000000', patternId: null };
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

/**
 * Compute the unified bounding box of multiple shapes.
 */
export function getMultiBounds(shapes) {
  if (!shapes || shapes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of shapes) {
    const b = getBounds(shape);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function hitTest(shape, point, threshold = 5) {
  const bounds = getBounds(shape);

  if (shape.type === 'text' && (shape.rotation || shape.flipH || shape.flipV)) {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const angle = shape.rotation || 0;
    // Invert the canvas rotation and flips before testing the text box.
    point = {
      x: cx + (dx * Math.cos(angle) + dy * Math.sin(angle)) * (shape.flipH ? -1 : 1),
      y: cy + (-dx * Math.sin(angle) + dy * Math.cos(angle)) * (shape.flipV ? -1 : 1),
    };
  }

  switch (shape.type) {
    case 'rect':
    case 'roundRect':
    case 'text':
      return pointInRect(point, bounds);

    case 'oval':
      return pointInEllipse(
        point,
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
        bounds.width / 2,
        bounds.height / 2
      );

    case 'line':
      return pointNearLine(point, shape.points[0], shape.points[1], threshold);

    case 'polygon':
      if (shape.closed) {
        return pointInPolygon(point, shape.points) ||
          pointNearPolyline(point, [...shape.points, shape.points[0]], threshold);
      }
      return pointNearPolyline(point, shape.points, threshold);

    case 'freehand':
      if (shape.closed) {
        return pointInPolygon(point, shape.points) ||
          pointNearPolyline(point, [...shape.points, shape.points[0]], threshold);
      }
      return pointNearPolyline(point, shape.points, threshold
      );

    case 'arc': {
      // Simplified: hit test bounding rect
      return pointInRect(point, bounds);
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

  switch (shape.type) {
    case 'rect':
      renderRect(ctx, shape, patternRegistry);
      break;
    case 'roundRect':
      renderRoundRect(ctx, shape, patternRegistry);
      break;
    case 'oval':
      renderOval(ctx, shape, patternRegistry);
      break;
    case 'line':
      renderLine(ctx, shape);
      break;
    case 'arc':
      renderArc(ctx, shape, patternRegistry);
      break;
    case 'polygon':
    case 'freehand':
      renderPolygon(ctx, shape, patternRegistry);
      break;
    case 'text':
      renderText(ctx, shape);
      break;
  }

  ctx.restore();
}

function applyFill(ctx, shape, patternRegistry) {
  if (shape.fill.type === 'solid') {
    ctx.fillStyle = shape.fill.color;
    ctx.fill();
  } else if (shape.fill.type === 'pattern' && patternRegistry) {
    const pattern = patternRegistry.getPattern(shape.fill.patternId);
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fill();
    }
  }
}

function applyStroke(ctx, shape) {
  if (shape.stroke.width > 0) {
    ctx.strokeStyle = shape.stroke.color;
    ctx.lineWidth = shape.stroke.width;
    ctx.lineCap = shape.stroke.cap;
    ctx.lineJoin = shape.stroke.join;
    if (shape.stroke.dash && shape.stroke.dash.length > 0) {
      ctx.setLineDash(shape.stroke.dash);
    }
    ctx.stroke();
  }
}

function renderRect(ctx, shape, patternRegistry) {
  ctx.beginPath();
  ctx.rect(shape.x, shape.y, shape.width, shape.height);
  applyFill(ctx, shape, patternRegistry);
  applyStroke(ctx, shape);
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
  applyStroke(ctx, shape);
}

function renderOval(ctx, shape, patternRegistry) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.abs(shape.width / 2), Math.abs(shape.height / 2), 0, 0, Math.PI * 2);
  applyFill(ctx, shape, patternRegistry);
  applyStroke(ctx, shape);
}

function renderLine(ctx, shape) {
  const [p1, p2] = shape.points;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  applyStroke(ctx, shape);

  // Arrowheads
  if (shape.endArrow === 'arrow') {
    drawArrowhead(ctx, p1, p2, shape.stroke);
  }
  if (shape.startArrow === 'arrow') {
    drawArrowhead(ctx, p2, p1, shape.stroke);
  }
}

function drawArrowhead(ctx, from, to, stroke) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = 12;
  const spread = Math.PI / 6;
  ctx.save();
  ctx.fillStyle = stroke.color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - len * Math.cos(angle - spread), to.y - len * Math.sin(angle - spread));
  ctx.lineTo(to.x - len * Math.cos(angle + spread), to.y - len * Math.sin(angle + spread));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
  applyStroke(ctx, shape);
}

function renderPolygon(ctx, shape, patternRegistry) {
  if (!shape.points || shape.points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(shape.points[0].x, shape.points[0].y);
  for (let i = 1; i < shape.points.length; i++) {
    ctx.lineTo(shape.points[i].x, shape.points[i].y);
  }
  if (shape.closed) ctx.closePath();
  applyFill(ctx, shape, patternRegistry);
  applyStroke(ctx, shape);
}

function renderText(ctx, shape) {
  if (!shape.text) return;
  ctx.save();
  const style = shape.fontStyle === 'italic' ? 'italic ' : '';
  const weight = shape.fontWeight === 'bold' ? 'bold ' : '';
  ctx.font = `${style}${weight}${shape.fontSize}px ${shape.fontFamily}`;
  ctx.textAlign = shape.textAlign;
  ctx.textBaseline = 'top';

  if (shape.fill.type !== 'none') {
    ctx.fillStyle = shape.fill.color;
  } else {
    ctx.fillStyle = '#000000';
  }

  let textX = shape.x;
  if (shape.textAlign === 'center') textX = shape.x + shape.width / 2;
  else if (shape.textAlign === 'right') textX = shape.x + shape.width;

  const lines = shape.text.split('\n');
  const lineHeight = shape.fontSize * 1.3;
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, shape.y + i * lineHeight);
  });

  if (shape.textDecoration === 'underline') {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    lines.forEach((line, i) => {
      const metrics = ctx.measureText(line);
      const y = shape.y + i * lineHeight + shape.fontSize + 2;
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
