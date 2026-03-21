const HANDLE_CURSORS = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

export class CursorManager {
  constructor(canvas) {
    this.canvas = canvas;
    this._current = 'default';
  }

  set(cursor) {
    if (cursor !== this._current) {
      this._current = cursor;
      this.canvas.style.cursor = cursor;
    }
  }

  setForHandle(handleName) {
    this.set(HANDLE_CURSORS[handleName] || 'default');
  }

  setCrosshair() {
    this.set('crosshair');
  }

  setDefault() {
    this.set('default');
  }

  setMove() {
    this.set('move');
  }

  setGrab() {
    this.set('grab');
  }

  setText() {
    this.set('text');
  }

  setRotate() {
    this.set('grab');
  }

  reset() {
    this.set('default');
  }
}
