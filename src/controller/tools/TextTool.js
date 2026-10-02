import { createShape } from '../../model/Shape.js';
import { AddShapeCommand } from '../../commands/AddShapeCommand.js';
import { DocumentCommand } from '../../commands/DocumentCommand.js';
import { textLayout } from '../../util/text.js';

export class TextTool {
  activate() { this.cursor?.setText(); }
  deactivate() { this.finishEditing(); this._drawing = false; if (this.overlay) this.overlay.interactionPreview = null; }
  onMouseDown(point) {
    this.finishEditing();
    const hit = this.doc.getObjectAtPoint(point);
    if (hit?.type === 'text' && !hit.locked && !hit.rotation && !hit.flipH && !hit.flipV && !hit.groupId) { this.selection.select(hit.id); this.startEditing(hit); return; }
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
    if (shape.locked || shape.rotation || shape.flipH || shape.flipV || shape.groupId) return;
    this.finishEditing();
    const canvas = this.cursor?.canvas; if (!canvas) return;
    this._editingShape = shape; this._isNew = isNew; this.doc._editingId = shape.id;
    const textarea = document.createElement('textarea'); textarea.className = 'text-editor'; textarea.setAttribute('aria-label', 'Edit drawing text'); textarea.value = shape.text;
    const zoom = this.manager.zoom || 1;
    Object.assign(textarea.style, { left: `${shape.x * zoom}px`, top: `${shape.y * zoom}px`, width: `${shape.width * zoom}px`, minHeight: `${Math.max(20, shape.height) * zoom}px`, fontFamily: shape.fontFamily, fontSize: `${shape.fontSize * zoom}px`, fontWeight: shape.fontWeight, fontStyle: shape.fontStyle, textDecoration: shape.textDecoration, textAlign: shape.textAlign, lineHeight: String(1.3 * (shape.lineSpacing || 1)) });
    textarea.wrap = shape.wrap ? 'soft' : 'off'; canvas.parentElement.append(textarea); this._textarea = textarea;
    const resize = () => { textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight + 2}px`; };
    textarea.addEventListener('input', resize);
    textarea.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); this.finishEditing(true); this.manager.chooseTool('select'); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.finishEditing(); this.manager.chooseTool('select'); } });
    textarea.addEventListener('blur', () => this.finishEditing());
    textarea.focus({ preventScroll: true }); textarea.select(); resize(); this.doc._notify('preview');
  }
  finishEditing(cancel = false) {
    if (!this._textarea) return;
    const textarea = this._textarea, shape = this._editingShape, isNew = this._isNew;
    const value = textarea.value;
    this._textarea = null; this._editingShape = null; delete this.doc._editingId;
    textarea.remove();
    if (!cancel && value.trim()) {
      const ctx = this.cursor.canvas.getContext('2d'), proposed = { ...shape, text: value };
      const { width, height } = textLayout(ctx, proposed);
      if (isNew) { Object.assign(shape, { text: value, width, height }); this.commandStack.execute(new AddShapeCommand(this.doc, shape)); }
      else if (value !== shape.text || width !== shape.width || height !== shape.height) this.commandStack.execute(new DocumentCommand(this.doc, 'Edit Text', () => Object.assign(shape, { text: value, width, height })));
      this.selection.select(shape.id);
    } else if (!cancel && !isNew && value !== shape.text) this.commandStack.execute(new DocumentCommand(this.doc, 'Edit Text', () => { shape.text = value; }));
    this.doc._notify('change');
  }
  _finishEditing() { this.finishEditing(); }
}
