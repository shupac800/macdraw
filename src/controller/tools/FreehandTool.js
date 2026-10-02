import { createShape } from '../../model/Shape.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { boundingBox, simplifyPoints } from '../../util/geometry.js';
import { TOOLS } from '../../util/constants.js';

export class FreehandTool {
  constructor() {
    this.manager = null;
    this.doc = null;
    this.selection = null;
    this.commandStack = null;
    this.overlay = null;
    this.cursor = null;
    this._drawing = false;
    this._points = [];
  }

  activate() { this.cursor?.setCrosshair(); }
  deactivate() { this._drawing = false; if (this.overlay) this.overlay.interactionPreview = null; }

  onMouseDown(point) {
    this._drawing = true;
    this._points = [{ ...point }];
    this.selection.clear();
  }

  onMouseMove(point) {
    if (!this._drawing) return;
    this._points.push({ ...point });
    if (this.overlay) {
      this.overlay.interactionPreview = {
        type: 'freehand',
        points: this._points,
      };
    }
    this.doc._notify('preview');
  }

  onMouseUp(point) {
    if (!this._drawing) return;
    this._drawing = false;
    if (this.overlay) this.overlay.interactionPreview = null;
    if (this._points.at(-1)?.x !== point.x || this._points.at(-1)?.y !== point.y) this._points.push({ ...point });
    if (this._points.length < 3) return;

    const simplified = simplifyPoints(this._points, 2);
    const bounds = boundingBox(simplified);

    const shape = createShape('freehand', {
      points: simplified,
      closed: true,
      ...bounds,
      stroke: { ...this.doc._defaultStroke },
      fill: { type: 'none', color: '#fff', patternId: null },
    });

    this.commandStack.execute(new AddShapeCommand(this.doc, shape));
    this.selection.select(shape.id);
    this.manager.setActiveTool(TOOLS.SELECT);
  }
}
