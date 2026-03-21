import { createShape } from '../../model/Shape.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { TOOLS } from '../../util/constants.js';

export class LineTool {
  constructor() {
    this.manager = null;
    this.doc = null;
    this.selection = null;
    this.commandStack = null;
    this.overlay = null;
    this.cursor = null;
    this._drawing = false;
    this._startPoint = null;
  }

  activate() { this.cursor?.setCrosshair(); }
  deactivate() { this._drawing = false; if (this.overlay) this.overlay.interactionPreview = null; }

  onMouseDown(point) {
    this._drawing = true;
    this._startPoint = { ...point };
    this.selection.clear();
  }

  onMouseMove(point, modifiers) {
    if (!this._drawing) return;
    let endPoint = { ...point };

    // Shift constrains to 45-degree angles
    if (modifiers?.shiftKey) {
      endPoint = this._constrainAngle(this._startPoint, endPoint);
    }

    if (this.overlay) {
      this.overlay.interactionPreview = {
        type: 'line',
        points: [this._startPoint, endPoint],
      };
    }
    this.doc._notify('preview');
  }

  onMouseUp(point, modifiers) {
    if (!this._drawing) return;
    this._drawing = false;
    if (this.overlay) this.overlay.interactionPreview = null;

    let endPoint = { ...point };
    if (modifiers?.shiftKey) {
      endPoint = this._constrainAngle(this._startPoint, endPoint);
    }

    const dx = endPoint.x - this._startPoint.x;
    const dy = endPoint.y - this._startPoint.y;
    if (Math.sqrt(dx * dx + dy * dy) < 3) return;

    const shape = createShape('line', {
      points: [{ ...this._startPoint }, endPoint],
      x: Math.min(this._startPoint.x, endPoint.x),
      y: Math.min(this._startPoint.y, endPoint.y),
      width: Math.abs(dx),
      height: Math.abs(dy),
    });

    this.commandStack.execute(new AddShapeCommand(this.doc, shape));
    this.selection.select(shape.id);
    this.manager.setActiveTool(TOOLS.SELECT);
  }

  _constrainAngle(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      x: start.x + len * Math.cos(snapped),
      y: start.y + len * Math.sin(snapped),
    };
  }
}
