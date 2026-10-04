import { RULER_SIZE } from '../util/constants.js';

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
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  _setup() {
    const on = (el, event, handler) => {
      const bound = handler.bind(this);
      this._bound[event] = bound;
      el.addEventListener(event, bound);
    };

    on(this.canvas, 'mousedown', this._onMouseDown);
    on(this.canvas, 'mousemove', this._onMouseMove);
    on(this.canvas, 'mouseup', this._onMouseUp);
    on(this.canvas, 'dblclick', this._onDoubleClick);
    on(window, 'keydown', this._onKeyDown);
    on(window, 'keyup', this._onKeyUp);

    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onMouseDown(e) {
    // Tools manage focus; the canvas default must not blur a newly opened editor.
    e.preventDefault();
    const point = this._getDocPoint(e);
    this.toolManager.onMouseDown(point, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      altKey: e.altKey,
      button: e.button,
    });
  }

  _onMouseMove(e) {
    const point = this._getDocPoint(e);
    this.toolManager.onMouseMove(point, {
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
    const point = this._getDocPoint(e);
    this.toolManager.onMouseUp(point, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      altKey: e.altKey,
      button: e.button,
    });
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
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
    this.toolManager.onKeyDown(e);
  }

  _onKeyUp(e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
    this.toolManager.onKeyUp(e);
  }

  destroy() {
    // Clean up if needed
  }
}
