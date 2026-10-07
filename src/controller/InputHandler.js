export class InputHandler {
  constructor(canvas, toolManager, rulerRenderer) {
    this.canvas = canvas;
    this.toolManager = toolManager;
    this.rulerRenderer = rulerRenderer || null;
    this._bound = {};
    this._setup();
  }

  _getDocPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenScale = rect.width / this.canvas.clientWidth || 1;
    const viewport = this.canvas.closest('#canvas-container');
    return {
      x: ((e.clientX - rect.left) / screenScale + (viewport?.scrollLeft || 0)) / (this.toolManager.zoom || 1),
      y: ((e.clientY - rect.top) / screenScale + (viewport?.scrollTop || 0)) / (this.toolManager.zoom || 1),
    };
  }

  _setup() {
    const on = (el, event, handler) => {
      const bound = handler.bind(this);
      this._bound[event] = bound;
      el.addEventListener(event, bound);
    };

    on(this.canvas, 'pointerdown', this._onMouseDown);
    on(this.canvas, 'pointermove', this._onMouseMove);
    on(this.canvas, 'pointerup', this._onMouseUp);
    on(this.canvas, 'pointercancel', () => { this._stopAutoScroll(); this.toolManager._activeTool?.cancel?.(); this.toolManager._activeTool?.deactivate?.(); this.toolManager.doc._notify('preview'); });
    on(this.canvas, 'dblclick', this._onDoubleClick);
    on(window, 'keydown', this._onKeyDown);
    on(window, 'keyup', this._onKeyUp);

    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = this._getDocPoint(e), doc = this.toolManager.doc;
    if (raw.x < 0 || raw.y < 0 || raw.x > doc.pageWidth || raw.y > doc.pageHeight) return;
    // Keep the browser's default focus from closing a newly opened text editor.
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const point = this._snap(raw);
    this.toolManager.onMouseDown(point, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      altKey: e.altKey,
      button: e.button,
    });
    if (!this.toolManager._activeTool?._textarea) this.canvas.focus({ preventScroll: true });
  }

  _onMouseMove(e) {
    this._lastPointer = e;
    if (e.buttons === 1 && !this._scrollFrame) this._scrollFrame = requestAnimationFrame(() => this._autoScroll());
    const point = this._getDocPoint(e);
    this.toolManager.onMouseMove(this.toolManager.getActiveTool() === 'select' ? point : this._snap(point), {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      altKey: e.altKey,
      buttons: e.buttons,
    });

    // Update ruler position
    if (this.rulerRenderer) {
      this.rulerRenderer.setMousePos(point.x, point.y);
      this.rulerRenderer.render();
    }
  }

  _onMouseUp(e) {
    if (e.button !== 0) return;
    this._stopAutoScroll();
    const raw = this._getDocPoint(e);
    const point = this.toolManager.getActiveTool() === 'select' ? raw : this._snap(raw);
    this.toolManager.onMouseUp(point, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      altKey: e.altKey,
      button: e.button,
    });
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
  }

  _onDoubleClick(e) {
    const point = this._getDocPoint(e);
    this.toolManager.onDoubleClick(point, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      altKey: e.altKey,
    });
  }

  _onKeyDown(e) {
    if (e.target.matches('input, textarea, select, [contenteditable], dialog *')) return;
    this.toolManager.onKeyDown(e);
  }

  _onKeyUp(e) {
    if (e.target.matches('input, textarea, select, [contenteditable], dialog *')) return;
    this.toolManager.onKeyUp(e);
  }

  _snap(point) {
    const doc = this.toolManager.doc;
    if (this.toolManager.getActiveTool() === 'select') return point;
    if (doc.snapToGrid && this.toolManager.getActiveTool() !== 'freehand') point = { x: Math.round(point.x / doc.gridSize) * doc.gridSize, y: Math.round(point.y / doc.gridSize) * doc.gridSize };
    return { x: Math.max(0, Math.min(doc.pageWidth, point.x)), y: Math.max(0, Math.min(doc.pageHeight, point.y)) };
  }

  _autoScroll() {
    this._scrollFrame = null;
    const event = this._lastPointer, tool = this.toolManager._activeTool;
    if (!event || event.buttons !== 1 || (!tool?._dragging && !tool?._drawing)) return;
    const viewport = this.canvas.closest('#canvas-container');
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect(), scale = bounds.width / viewport.clientWidth || 1;
    const speed = (value, start, end) => value < start + 12 * scale ? -8 : value > end - 12 * scale ? 8 : 0;
    const oldX = viewport.scrollLeft, oldY = viewport.scrollTop;
    viewport.scrollLeft += speed(event.clientX, bounds.left, bounds.right);
    viewport.scrollTop += speed(event.clientY, bounds.top, bounds.bottom);
    if (oldX !== viewport.scrollLeft || oldY !== viewport.scrollTop) {
      const raw = this._getDocPoint(event), point = this.toolManager.getActiveTool() === 'select' ? raw : this._snap(raw);
      this.toolManager.onMouseMove(point, { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey || event.metaKey, altKey: event.altKey, buttons: event.buttons });
      this.toolManager.doc._notify('preview');
      this.rulerRenderer?.setMousePos(raw.x, raw.y);
      this.rulerRenderer?.render();
    }
    if (speed(event.clientX, bounds.left, bounds.right) || speed(event.clientY, bounds.top, bounds.bottom)) this._scrollFrame = requestAnimationFrame(() => this._autoScroll());
  }

  _stopAutoScroll() {
    if (this._scrollFrame) cancelAnimationFrame(this._scrollFrame);
    this._scrollFrame = null;
    this._lastPointer = null;
  }

  destroy() {
    this._stopAutoScroll();
    for (const [event, handler] of Object.entries(this._bound)) {
      (event.startsWith('key') ? window : this.canvas).removeEventListener(event, handler);
    }
  }
}
