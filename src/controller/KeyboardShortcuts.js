import { TOOLS } from '../util/constants.js';

export class KeyboardShortcuts {
  constructor(app) { this.app = app; this.handler = e => this._onKeyDown(e); window.addEventListener('keydown', this.handler); }
  _onKeyDown(e) {
    if (e.target.closest('input, textarea, select, [contenteditable], dialog')) return;
    const key = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey, app = this.app;
    if (app.menuBar.handleKey(e)) return;
    const commands = {
      z: () => e.shiftKey ? app.actions.redo() : app.actions.undo(), y: () => app.actions.redo(),
      c: () => app.actions.copy(), x: () => app.actions.cut(), v: () => app.actions.paste(),
      a: () => app.actions.selectAll(), d: () => app.actions.duplicate(),
      g: () => e.shiftKey ? app.actions.ungroup() : app.actions.group(),
      n: () => app.files.newDocument(), o: () => app.files.open(), s: () => app.files.save(e.shiftKey), p: () => app.files.print(),
      '0': () => app.fitDrawing(), '1': () => app.setZoom(1), '=': () => app.setZoom(app.zoom * 2), '+': () => app.setZoom(app.zoom * 2), '-': () => app.setZoom(app.zoom / 2),
    };
    if (ctrl && commands[key]) { e.preventDefault(); commands[key](); return; }
    if (ctrl || e.altKey) return;
    if (key === 'delete' || key === 'backspace') { e.preventDefault(); app.actions.remove(); return; }
    if (key.startsWith('arrow') && !app.selection.isEmpty) {
      e.preventDefault(); const n = e.shiftKey ? 10 : 1; app.actions.nudge(key === 'arrowleft' ? -n : key === 'arrowright' ? n : 0, key === 'arrowup' ? -n : key === 'arrowdown' ? n : 0); return;
    }
    if (key === 'escape') { app.finishText(); app.cancelInteraction(); app.selection.clear(); return; }
    const tools = { v: TOOLS.SELECT, t: TOOLS.TEXT, h: TOOLS.PERPENDICULAR, l: TOOLS.LINE, r: TOOLS.RECT, u: TOOLS.ROUND_RECT, o: TOOLS.OVAL, a: TOOLS.ARC, p: TOOLS.POLYGON, f: TOOLS.FREEHAND };
    if (tools[key]) { e.preventDefault(); app.toolManager.chooseTool(tools[key]); }
  }
  destroy() { window.removeEventListener('keydown', this.handler); }
}
