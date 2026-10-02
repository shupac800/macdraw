import { createShape } from '../../model/Shape.js';
import { normalizeRect } from '../../util/geometry.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { MIN_SHAPE_SIZE, TOOLS } from '../../util/constants.js';

export class OvalTool {
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
    let w = point.x - this._startPoint.x;
    let h = point.y - this._startPoint.y;
    if (modifiers?.shiftKey) {
      const s = Math.max(Math.abs(w), Math.abs(h));
      w = (Math.sign(w) || 1) * s; h = (Math.sign(h) || 1) * s;
    }
    const rect = normalizeRect(this._startPoint.x, this._startPoint.y, w, h);
    if (this.overlay) this.overlay.interactionPreview = { type: 'oval', ...rect };
    this.doc._notify('preview');
  }

  onMouseUp(point, modifiers) {
    if (!this._drawing) return;
    this._drawing = false;
    if (this.overlay) this.overlay.interactionPreview = null;
    let w = point.x - this._startPoint.x;
    let h = point.y - this._startPoint.y;
    if (modifiers?.shiftKey) {
      const s = Math.max(Math.abs(w), Math.abs(h));
      w = (Math.sign(w) || 1) * s; h = (Math.sign(h) || 1) * s;
    }
    const rect = normalizeRect(this._startPoint.x, this._startPoint.y, w, h);
    if (rect.width < MIN_SHAPE_SIZE && rect.height < MIN_SHAPE_SIZE) return;

    const shape = createShape('oval', { ...rect, stroke: { ...this.doc._defaultStroke }, fill: { ...this.doc._defaultFill } });
    this.commandStack.execute(new AddShapeCommand(this.doc, shape));
    this.selection.select(shape.id);
    this.manager.setActiveTool(TOOLS.SELECT);
  }
}
