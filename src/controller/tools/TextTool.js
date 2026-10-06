import { createShape } from '../../model/Shape.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { DocumentCommand } from '../../commands/DocumentCommand.js';
import { textLayout } from '../../util/text.js';

export class TextTool {
  constructor() {
    this._textarea = null;
    this._editingShape = null;
    this._isNew = false;
    this._drawing = false;
  }
  activate() { this.cursor?.setText(); }
  deactivate() { this.finishEditing(); this._drawing = false; if (this.overlay) this.overlay.interactionPreview = null; }
  onMouseDown(point) {
    const wasEditing = !!this._textarea;
    this.finishEditing();
    const hit = this.doc.getObjectAtPoint(point);
    if (hit?.type === 'text') {
      if (hit.groupId) { this.selection.selectMultiple(this.doc.getGroupMembers(hit.groupId).map(s => s.id)); return; }
      this.selection.select(hit.id);
      this.startEditing(hit);
      return;
    }
    // Finish on click-away without turning that same click into a new object.
    if (wasEditing) return;
    this._drawing = true; this._startPoint = { ...point }; this.selection.clear();
  }
  onMouseMove(point) {
    if (!this._drawing) return;
    this.overlay.interactionPreview = { type: 'text', x: Math.min(point.x, this._startPoint.x), y: Math.min(point.y, this._startPoint.y), width: Math.abs(point.x - this._startPoint.x), height: Math.abs(point.y - this._startPoint.y) };
    this.doc._notify('preview');
  }
  onMouseUp(point) {
    if (!this._drawing) return;
    this._drawing = false; this.overlay.interactionPreview = null;
    const wrap = Math.abs(point.x - this._startPoint.x) > 10;
    const shape = createShape('text', { x: Math.min(point.x, this._startPoint.x), y: Math.min(point.y, this._startPoint.y), width: wrap ? Math.abs(point.x - this._startPoint.x) : 160, height: 20, wrap, ...this.doc._defaultText });
    this.startEditing(shape, true);
  }
  startEditing(shape, isNew = false) {
    if (shape.groupId || shape.rotation || shape.flipH || shape.flipV) return;
    if (this._editingShape === shape && this._textarea) {
      this._textarea.focus({ preventScroll: true });
      return;
    }
    this.finishEditing();
    const canvas = this.cursor?.canvas; if (!canvas) return;
    this._editingShape = shape; this._isNew = isNew; this.doc._editingId = shape.id;
    const textarea = document.createElement('textarea'); textarea.className = 'text-editor'; textarea.setAttribute('aria-label', 'Edit drawing text'); textarea.value = shape.text;
    textarea.title = 'Enter: new line. Ctrl+Enter: finish. Escape: cancel.';
    const zoom = this.manager.zoom || 1;
    Object.assign(textarea.style, {
      left: `${shape.x * zoom}px`, top: `${shape.y * zoom}px`, minWidth: '0',
      border: '0', outline: '1px dotted #000',
      fontFamily: shape.fontFamily, fontSize: `${shape.fontSize * zoom}px`,
      fontWeight: shape.fontWeight, fontStyle: shape.fontStyle,
      textDecoration: shape.textDecoration, textAlign: shape.textAlign,
      lineHeight: String(1.3 * (shape.lineSpacing || 1)),
      transform: `rotate(${shape.rotation || 0}rad) scale(${shape.flipH ? -1 : 1}, ${shape.flipV ? -1 : 1})`,
      color: shape.outline ? '#fff' : '#000',
      WebkitTextStroke: shape.outline ? `${zoom}px #000` : '0',
      textShadow: shape.shadow ? `${2 * zoom}px ${2 * zoom}px 0 #000` : 'none',
    });
    textarea.wrap = shape.wrap ? 'soft' : 'off'; canvas.parentElement.append(textarea); this._textarea = textarea;
    textarea.addEventListener('input', () => this._resizeEditor());
    textarea.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        e.preventDefault(); this.finishEditing(true); this.manager.chooseTool('select');
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); this.finishEditing(); this.manager.chooseTool('select');
      }
    });
    textarea.addEventListener('keyup', e => e.stopPropagation());
    textarea.addEventListener('blur', () => this.finishEditing());
    this._resizeEditor();
    textarea.focus({ preventScroll: true }); textarea.select(); this.doc._notify('preview');
  }
  _textDimensions(shape, value) {
    const ctx = this.cursor.canvas.getContext('2d');
    ctx.save();
    const { width, height } = textLayout(ctx, { ...shape, text: value });
    ctx.restore();
    return { width, height };
  }
  _resizeEditor() {
    const shape = this._editingShape, textarea = this._textarea;
    const zoom = this.manager.zoom || 1;
    const { width, height } = !shape.locked && textarea.value !== shape.text && textarea.value.trim()
      ? this._textDimensions(shape, textarea.value) : shape;
    textarea.style.width = `${width * zoom}px`;
    // Match the text bounds so the editing frame and side handles share a center.
    textarea.style.height = `${height * zoom}px`;
    textarea.style.transformOrigin = `${width * zoom / 2}px ${height * zoom / 2}px`;
  }
  finishEditing(cancel = false) {
    if (!this._textarea) return;
    const textarea = this._textarea, shape = this._editingShape, isNew = this._isNew;
    const value = textarea.value;
    this._textarea = null; this._editingShape = null; this._isNew = false; delete this.doc._editingId;
    textarea.remove();
    // Do not write into an object removed or replaced while its draft was open.
    if (!cancel && !isNew && this.doc.getObjectById(shape.id) !== shape) cancel = true;
    if (!cancel && value.trim() && (isNew || value !== shape.text)) {
      const { width, height } = this._textDimensions(shape, value);
      if (isNew) { Object.assign(shape, { text: value, width, height }); this.commandStack.execute(new AddShapeCommand(this.doc, shape)); }
      else this.commandStack.execute(new DocumentCommand(this.doc, 'Edit Text', () => Object.assign(shape, shape.locked ? { text: value } : { text: value, width, height })));
      this.selection.select(shape.id);
    } else if (!cancel && !isNew && value !== shape.text) this.commandStack.execute(new DocumentCommand(this.doc, 'Edit Text', () => { shape.text = value; }));
    this.doc._notify('preview');
  }
  _finishEditing() { this.finishEditing(); }
}
