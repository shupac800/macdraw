import { HANDLE_SIZE, ROTATION_HANDLE_DISTANCE } from '../util/constants.js';
import { getVisualBounds as getBounds, getMultiBounds, renderShape } from '../model/Shape.js';
import { getHandlePositions, getSelectionHandleBounds } from '../util/geometry.js';

export class SelectionOverlay {
  constructor(doc, selection) {
    this.doc = doc;
    this.selection = selection;
    this.marquee = null; // {x, y, width, height} during marquee select
    this.interactionPreview = null; // preview shape during drawing
    this.showRotationHandle = true;
    this.zoom = 1;
    this.trackingIds = null;
  }

  render(ctx) {
    const selectedObjects = this.selection.getSelectedObjects(this.doc).map(obj => this.trackingOriginals?.get(obj.id) || obj);
    const units = new Map();
    for (const obj of selectedObjects) {
      const key = obj.groupId || obj.id;
      if (!units.has(key)) units.set(key, []);
      units.get(key).push(obj);
    }
    for (const objects of units.values()) {
      const shape = objects[0];
      this._renderSelectionBox(ctx, getMultiBounds(objects), objects.length === 1 && shape.type === 'text',
        objects.length === 1 && !shape.groupId && shape.type === 'line' ? shape.points : null);
    }

    if (this.marquee) {
      this._renderMarquee(ctx);
    }

    if (this.interactionPreview) {
      this._renderPreview(ctx);
    }
  }

  /**
   * Dashed outline for individual members of a multi-selection.
   */
  _renderMemberOutline(ctx, bounds) {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);
    ctx.strokeRect(bounds.x - 0.5, bounds.y - 0.5, bounds.width + 1, bounds.height + 1);
    ctx.restore();
  }

  /**
   * Solid outline with resize/rotation handles.
   */
  _renderSelectionBox(ctx, bounds, text = false, endpoints = null) {
    ctx.save();

    // Black square handles, as on the monochrome Macintosh.
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([]);

    // Resize handles
    const handles = endpoints ? Object.fromEntries(endpoints.map((point, index) => [index, point])) : getHandlePositions(getSelectionHandleBounds(bounds, this.zoom, text));
    const transform = ctx.getTransform();

    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;

    // Paint the five-pixel bitmaps in framebuffer coordinates. Fractional
    // object bounds, drawing zoom and scrolling must not antialias their edges.
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const pos of Object.values(handles)) {
      const x = transform.a * pos.x + transform.c * pos.y + transform.e;
      const y = transform.b * pos.x + transform.d * pos.y + transform.f;
      ctx.fillRect(Math.round(x - HANDLE_SIZE / 2), Math.round(y - HANDLE_SIZE / 2), HANDLE_SIZE, HANDLE_SIZE);
    }
    ctx.restore();

    if (!this.showRotationHandle || endpoints) { ctx.restore(); return; }

    // Rotation handle
    const topCenter = handles.n;
    const rotY = topCenter.y - ROTATION_HANDLE_DISTANCE;

    ctx.beginPath();
    ctx.moveTo(topCenter.x, topCenter.y);
    ctx.lineTo(topCenter.x, rotY);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(topCenter.x, rotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  _renderMarquee(ctx) {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(this.marquee.x, this.marquee.y, this.marquee.width, this.marquee.height);
    ctx.restore();
  }

  _renderPreview(ctx) {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([4, 4]);

    const p = this.interactionPreview;
    if (p.type !== 'text') {
      const shape = { ...p, rotation: 0, stroke: { color: '#000', width: 1 / this.zoom, cap: 'butt', join: 'miter', dash: [] }, fill: { type: 'none' }, cornerRadius: 18, startAngle: Math.PI, endAngle: Math.PI * 1.5 };
      renderShape(ctx, shape);
      ctx.restore(); return;
    }
    if (p.type === 'rect' || p.type === 'roundRect' || p.type === 'oval' || p.type === 'arc' || p.type === 'text') {
      ctx.strokeRect(p.x, p.y, p.width, p.height);
    } else if (p.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      ctx.lineTo(p.points[1].x, p.points[1].y);
      ctx.stroke();
    } else if ((p.type === 'polygon' || p.type === 'freehand') && p.points?.length > 1) {
      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  renderTrackingBounds(ctx, bounds) {
    ctx.save(); ctx.globalCompositeOperation = 'difference';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 / this.zoom; ctx.setLineDash([]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height); ctx.restore();
  }

  renderTrackingObject(ctx, shape, patternRegistry) {
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    if (shape.type === 'text') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 / this.zoom;
      const b = getBounds(shape);
      ctx.strokeRect(b.x, b.y, b.width, b.height);
    } else {
      renderShape(ctx, { ...shape, fill: { type: 'none' }, stroke: { ...shape.stroke, width: Math.max(1 / this.zoom, shape.stroke.width), color: '#fff', patternId: null } }, patternRegistry);
    }
    ctx.restore();
  }
}
