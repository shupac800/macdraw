import { createShape } from '../../model/Shape.js';
import { normalizeRect } from '../../util/geometry.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { MIN_SHAPE_SIZE, TOOLS } from '../../util/constants.js';

export class ArcTool {
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

  onMouseMove(point) {
    if (!this._drawing) return;
    const rect = normalizeRect(this._startPoint.x, this._startPoint.y, point.x - this._startPoint.x, point.y - this._startPoint.y);
    if (this.overlay) this.overlay.interactionPreview = { type: 'arc', ...rect };
    this.doc._notify('preview');
  }

  onMouseUp(point) {
    if (!this._drawing) return;
    this._drawing = false;
    if (this.overlay) this.overlay.interactionPreview = null;

    const rect = normalizeRect(this._startPoint.x, this._startPoint.y, point.x - this._startPoint.x, point.y - this._startPoint.y);
    if (rect.width < MIN_SHAPE_SIZE && rect.height < MIN_SHAPE_SIZE) return;

    const shape = createShape('arc', rect);
    this.commandStack.execute(new AddShapeCommand(this.doc, shape));
    this.selection.select(shape.id);
    this.manager.setActiveTool(TOOLS.SELECT);
  }
}
