import { createShape } from '../../model/Shape.js';
import { normalizeRect } from '../../util/geometry.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { MIN_SHAPE_SIZE, TOOLS } from '../../util/constants.js';

export class RectTool {
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

  activate() {
    this.cursor?.setCrosshair();
  }

  deactivate() {
    this._drawing = false;
    if (this.overlay) this.overlay.interactionPreview = null;
  }

  onMouseDown(point) {
    this._drawing = true;
    this._startPoint = { ...point };
    this.selection.clear();
  }

  onMouseMove(point, modifiers) {
    if (!this._drawing) return;

    let width = point.x - this._startPoint.x;
    let height = point.y - this._startPoint.y;

    // Shift for square
    if (modifiers?.shiftKey) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = Math.sign(width) * size;
      height = Math.sign(height) * size;
    }

    const rect = normalizeRect(this._startPoint.x, this._startPoint.y, width, height);
    if (this.overlay) {
      this.overlay.interactionPreview = { type: 'rect', ...rect };
    }
    this.doc._notify('preview');
  }

  onMouseUp(point, modifiers) {
    if (!this._drawing) return;
    this._drawing = false;
    if (this.overlay) this.overlay.interactionPreview = null;

    let width = point.x - this._startPoint.x;
    let height = point.y - this._startPoint.y;

    if (modifiers?.shiftKey) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = Math.sign(width) * size;
      height = Math.sign(height) * size;
    }

    const rect = normalizeRect(this._startPoint.x, this._startPoint.y, width, height);

    if (rect.width < MIN_SHAPE_SIZE && rect.height < MIN_SHAPE_SIZE) return;

    const shape = createShape('rect', {
      ...rect,
      stroke: { ...this.doc._defaultStroke || { color: '#000000', width: 1, dash: [], cap: 'round', join: 'round' } },
      fill: { ...this.doc._defaultFill || { type: 'none', color: '#ffffff', patternId: null } },
    });

    this.commandStack.execute(new AddShapeCommand(this.doc, shape));
    this.selection.select(shape.id);
    this.manager.setActiveTool(TOOLS.SELECT);
  }
}
