import { HANDLE_SIZE, ROTATION_HANDLE_DISTANCE } from '../util/constants.js';
import { getBounds, getMultiBounds } from '../model/Shape.js';
import { getHandlePositions } from '../util/geometry.js';

export class SelectionOverlay {
  constructor(doc, selection) {
    this.doc = doc;
    this.selection = selection;
    this.marquee = null; // {x, y, width, height} during marquee select
    this.interactionPreview = null; // preview shape during drawing
  }

  render(ctx) {
    const selectedObjects = this.selection.getSelectedObjects(this.doc);
    if (selectedObjects.length === 1) {
      // Single shape: draw handles on its own bounds
      this._renderSelectionBox(ctx, getBounds(selectedObjects[0]));
    } else if (selectedObjects.length > 1) {
      // Multiple shapes: draw dashed outlines on each, handles on unified bounds
      for (const obj of selectedObjects) {
        this._renderMemberOutline(ctx, getBounds(obj));
      }
      this._renderSelectionBox(ctx, getMultiBounds(selectedObjects));
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
    ctx.strokeStyle = '#90CAF9';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(bounds.x - 0.5, bounds.y - 0.5, bounds.width + 1, bounds.height + 1);
    ctx.restore();
  }

  /**
   * Solid outline with resize/rotation handles.
   */
  _renderSelectionBox(ctx, bounds) {
    ctx.save();

    // Blue selection outline
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(bounds.x - 0.5, bounds.y - 0.5, bounds.width + 1, bounds.height + 1);

    // Resize handles
    const handles = getHandlePositions(bounds);
    const half = HANDLE_SIZE / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 1.5;

    for (const pos of Object.values(handles)) {
      ctx.fillRect(pos.x - half, pos.y - half, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(pos.x - half, pos.y - half, HANDLE_SIZE, HANDLE_SIZE);
    }

    // Rotation handle
    const topCenter = handles.n;
    const rotY = topCenter.y - ROTATION_HANDLE_DISTANCE;

    ctx.beginPath();
    ctx.moveTo(topCenter.x, topCenter.y);
    ctx.lineTo(topCenter.x, rotY);
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(topCenter.x, rotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  _renderMarquee(ctx) {
    ctx.save();
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillStyle = 'rgba(33, 150, 243, 0.08)';
    ctx.fillRect(this.marquee.x, this.marquee.y, this.marquee.width, this.marquee.height);
    ctx.strokeRect(this.marquee.x, this.marquee.y, this.marquee.width, this.marquee.height);
    ctx.restore();
  }

  _renderPreview(ctx) {
    ctx.save();
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const p = this.interactionPreview;
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
}
