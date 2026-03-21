import { createShape } from '../../model/Shape.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { EditTextCommand } from '../../commands/EditTextCommand.js';
import { TOOLS } from '../../util/constants.js';

export class TextTool {
  constructor() {
    this.manager = null;
    this.doc = null;
    this.selection = null;
    this.commandStack = null;
    this.overlay = null;
    this.cursor = null;
    this._textarea = null;
    this._editingShape = null;
    this._startPoint = null;
    this._drawing = false;
  }

  activate() { this.cursor?.setText(); }

  deactivate() {
    this._finishEditing();
    this._drawing = false;
    if (this.overlay) this.overlay.interactionPreview = null;
  }

  onMouseDown(point) {
    if (this._textarea) {
      this._finishEditing();
      return;
    }

    // Check if clicking on existing text shape
    const hit = this.doc.getObjectAtPoint(point);
    if (hit?.type === 'text') {
      this.selection.select(hit.id);
      this.startEditing(hit);
      return;
    }

    this._drawing = true;
    this._startPoint = { ...point };
  }

  onMouseMove(point) {
    if (!this._drawing) return;
    const w = point.x - this._startPoint.x;
    const h = point.y - this._startPoint.y;
    if (this.overlay) {
      this.overlay.interactionPreview = {
        type: 'text',
        x: Math.min(this._startPoint.x, point.x),
        y: Math.min(this._startPoint.y, point.y),
        width: Math.abs(w),
        height: Math.abs(h),
      };
    }
    this.doc._notify('preview');
  }

  onMouseUp(point) {
    if (!this._drawing) return;
    this._drawing = false;
    if (this.overlay) this.overlay.interactionPreview = null;

    const x = Math.min(this._startPoint.x, point.x);
    const y = Math.min(this._startPoint.y, point.y);
    const width = Math.max(Math.abs(point.x - this._startPoint.x), 100);
    const height = Math.max(Math.abs(point.y - this._startPoint.y), 24);

    const shape = createShape('text', { x, y, width, height });
    this.commandStack.execute(new AddShapeCommand(this.doc, shape));
    this.selection.select(shape.id);
    this.startEditing(shape);
  }

  startEditing(shape) {
    this._editingShape = shape;

    const canvas = this.cursor?.canvas;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const textarea = document.createElement('textarea');
    textarea.value = shape.text || '';
    textarea.style.cssText = `
      position: absolute;
      left: ${canvasRect.left + shape.x}px;
      top: ${canvasRect.top + shape.y}px;
      width: ${Math.max(shape.width, 100)}px;
      min-height: ${Math.max(shape.height, 24)}px;
      font-family: ${shape.fontFamily};
      font-size: ${shape.fontSize}px;
      font-weight: ${shape.fontWeight};
      font-style: ${shape.fontStyle};
      text-align: ${shape.textAlign};
      border: 2px solid #2196F3;
      outline: none;
      background: rgba(255,255,255,0.95);
      padding: 2px 4px;
      resize: none;
      overflow: hidden;
      z-index: 1000;
      box-sizing: border-box;
      line-height: 1.3;
    `;

    document.body.appendChild(textarea);
    textarea.focus();
    this._textarea = textarea;

    // Auto-resize
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._finishEditing();
        this.manager.setActiveTool(TOOLS.SELECT);
      }
    });

    // Prevent canvas events while editing
    textarea.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  _finishEditing() {
    if (!this._textarea || !this._editingShape) return;

    const newText = this._textarea.value;
    const shape = this._editingShape;

    if (newText !== shape.text) {
      this.commandStack.execute(new EditTextCommand(this.doc, shape.id, newText));
    }

    // Update shape dimensions based on text
    if (newText) {
      shape.width = Math.max(shape.width, parseInt(this._textarea.style.width));
      shape.height = Math.max(shape.height, this._textarea.scrollHeight);
    }

    this._textarea.remove();
    this._textarea = null;
    this._editingShape = null;
  }
}
