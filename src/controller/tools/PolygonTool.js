import { createShape } from '../../model/Shape.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { boundingBox, distance } from '../../util/geometry.js';
import { TOOLS } from '../../util/constants.js';

export class PolygonTool {
  constructor() {
    this.manager = null;
    this.doc = null;
    this.selection = null;
    this.commandStack = null;
    this.overlay = null;
    this.cursor = null;
    this._points = [];
    this._currentPoint = null;
  }

  activate() { this.cursor?.setCrosshair(); }
  deactivate() {
    this._points = [];
    this._currentPoint = null;
    if (this.overlay) this.overlay.interactionPreview = null;
  }

  onMouseDown(point) {
    if (this._points.length > 0) {
      // Close polygon if clicking near first point
      if (distance(point, this._points[0]) < 10) {
        this._finish(true);
        return;
      }
    }
    this._points.push({ ...point });
    this._updatePreview(point);
  }

  onMouseMove(point) {
    if (this._points.length === 0) return;
    this._currentPoint = { ...point };
    this._updatePreview(point);
  }

  onDoubleClick(point) {
    if (this._points.length >= 2) {
      this._finish(true);
    }
  }

  onKeyDown(e) {
    if (e.key === 'Escape' && this._points.length > 0) {
      this._points = [];
      this._currentPoint = null;
      if (this.overlay) this.overlay.interactionPreview = null;
      this.doc._notify('preview');
    } else if (e.key === 'Enter' && this._points.length >= 2) {
      this._finish(true);
    }
  }

  _updatePreview(point) {
    const previewPoints = [...this._points];
    if (this._currentPoint) previewPoints.push(this._currentPoint);
    if (this.overlay) {
      this.overlay.interactionPreview = {
        type: 'polygon',
        points: previewPoints,
      };
    }
    this.doc._notify('preview');
  }

  _finish(closed) {
    if (this._points.length < 2) return;
    if (this.overlay) this.overlay.interactionPreview = null;

    const bounds = boundingBox(this._points);
    const shape = createShape('polygon', {
      points: this._points.map(p => ({ ...p })),
      closed,
      ...bounds,
    });

    this.commandStack.execute(new AddShapeCommand(this.doc, shape));
    this.selection.select(shape.id);
    this._points = [];
    this._currentPoint = null;
    this.manager.setActiveTool(TOOLS.SELECT);
  }
}
