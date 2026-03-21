import { getBounds } from '../model/Shape.js';

export class ResizeCommand {
  constructor(doc, shapeId, oldBounds, newBounds) {
    this.doc = doc;
    this.shapeId = shapeId;
    this.oldBounds = { ...oldBounds };
    this.newBounds = { ...newBounds };
    // Snapshot original points for undo of point-based shapes
    const shape = doc.getObjectById(shapeId);
    this._oldPoints = shape?.points ? shape.points.map(p => ({ ...p })) : null;
    this.label = 'Resize';
  }

  execute() {
    this._applyBounds(this.oldBounds, this.newBounds);
  }

  undo() {
    // Restore original points directly for perfect undo
    const shape = this.doc.getObjectById(this.shapeId);
    if (!shape) return;
    if (this._oldPoints) {
      shape.points = this._oldPoints.map(p => ({ ...p }));
    }
    shape.x = this.oldBounds.x;
    shape.y = this.oldBounds.y;
    shape.width = this.oldBounds.width;
    shape.height = this.oldBounds.height;
    this.doc._notify('resize');
  }

  _applyBounds(fromBounds, toBounds) {
    const shape = this.doc.getObjectById(this.shapeId);
    if (!shape) return;

    // Rescale points for point-based shapes
    if (shape.points && shape.points.length > 0) {
      const ob = getBounds(shape);
      if (ob.width > 0 && ob.height > 0) {
        shape.points = shape.points.map(p => ({
          x: toBounds.x + ((p.x - ob.x) / ob.width) * toBounds.width,
          y: toBounds.y + ((p.y - ob.y) / ob.height) * toBounds.height,
        }));
      } else if (ob.width > 0) {
        shape.points = shape.points.map(p => ({
          x: toBounds.x + ((p.x - ob.x) / ob.width) * toBounds.width,
          y: toBounds.y,
        }));
      } else if (ob.height > 0) {
        shape.points = shape.points.map(p => ({
          x: toBounds.x,
          y: toBounds.y + ((p.y - ob.y) / ob.height) * toBounds.height,
        }));
      }
    }

    shape.x = toBounds.x;
    shape.y = toBounds.y;
    shape.width = toBounds.width;
    shape.height = toBounds.height;
    this.doc._notify('resize');
  }
}
