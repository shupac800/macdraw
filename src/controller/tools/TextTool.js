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
    const wasEditing = !!this._textarea;
    if (wasEditing) {
      this._finishEditing();
    }

    // Check if clicking on existing text shape
    const hit = this.doc.getObjectAtPoint(point);
    if (hit?.type === 'text') {
      this.selection.select(hit.id);
      this.startEditing(hit);
      return;
    }

    // A click away finishes the draft without creating an accidental object.
    if (wasEditing) return;

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
    if (this._editingShape === shape && this._textarea) {
      this._textarea.focus();
      return;
    }
    this._finishEditing();

    const canvas = this.cursor?.canvas;
    if (!canvas) return;
    this._editingShape = shape;

    const canvasRect = canvas.getBoundingClientRect();
    const textarea = document.createElement('textarea');
    textarea.value = shape.text || '';
    textarea.wrap = 'off';
    textarea.setAttribute('aria-label', 'Edit text');
    textarea.title = 'Enter: new line. Escape or Ctrl+Enter: finish. Ctrl+Escape: cancel.';
    Object.assign(textarea.style, {
      position: 'fixed',
      left: `${canvasRect.left + shape.x}px`,
      top: `${canvasRect.top + shape.y}px`,
      width: `${Math.max(shape.width, 100)}px`,
      minHeight: `${Math.max(shape.height, 24)}px`,
      fontFamily: shape.fontFamily,
      fontSize: `${shape.fontSize}px`,
      fontWeight: shape.fontWeight,
      fontStyle: shape.fontStyle,
      textAlign: shape.textAlign,
      textDecoration: shape.textDecoration,
      color: shape.fill.type === 'none' ? '#000000' : shape.fill.color,
      transform: `rotate(${shape.rotation || 0}rad) scale(${shape.flipH ? -1 : 1}, ${shape.flipV ? -1 : 1})`,
      transformOrigin: 'center',
      border: 'none',
      outline: '2px solid #2196F3',
      background: 'rgba(255,255,255,0.95)',
      padding: '0',
      resize: 'none',
      overflow: 'hidden',
      zIndex: '1000',
      boxSizing: 'border-box',
      lineHeight: '1.3',
    });

    this._textarea = textarea;
    document.body.appendChild(textarea);
    this._resizeEditor();
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    // Auto-resize
    textarea.addEventListener('input', () => this._resizeEditor());

    textarea.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        // Keep Escape's existing finish behavior; Ctrl+Escape discards a draft.
        this._finishEditing(!(e.key === 'Escape' && (e.ctrlKey || e.metaKey)));
        this.manager.setActiveTool(TOOLS.SELECT);
      }
    });
    textarea.addEventListener('keyup', (e) => e.stopPropagation());
    textarea.addEventListener('blur', () => this._finishEditing());

    // Prevent canvas events while editing
    textarea.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  _resizeEditor() {
    const shape = this._editingShape;
    const textarea = this._textarea;
    const ctx = this.cursor.canvas.getContext('2d');
    const lines = textarea.value.split('\n');
    ctx.save();
    ctx.font = `${shape.fontStyle} ${shape.fontWeight} ${shape.fontSize}px ${shape.fontFamily}`;
    const textWidth = lines.reduce((width, line) => Math.max(width, ctx.measureText(line).width), 0);
    ctx.restore();
    // Canvas text does not wrap. Fit explicit lines so all visible text is hittable.
    textarea.style.width = `${Math.max(shape.width, 100, Math.ceil(textWidth) + 4)}px`;
    textarea.style.height = `${Math.max(shape.height, 24, Math.ceil(lines.length * shape.fontSize * 1.3) + 4)}px`;
  }

  _finishEditing(commit = true) {
    if (!this._textarea || !this._editingShape) return;

    const textarea = this._textarea;
    const newText = textarea.value;
    const shape = this._editingShape;

    // Clear state before removing the focused editor, which can trigger blur.
    this._textarea = null;
    this._editingShape = null;
    textarea.remove();

    if (commit && this.doc.getObjectById(shape.id) === shape && newText !== shape.text) {
      const dimensions = newText ? {
        width: parseFloat(textarea.style.width),
        height: parseFloat(textarea.style.height),
      } : { width: shape.width, height: shape.height };
      // Retain empty text objects so they can be edited again or restored by Undo.
      this.commandStack.execute(new EditTextCommand(this.doc, shape.id, newText, dimensions));
    }
  }
}
