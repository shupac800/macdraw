import { RULER_SIZE } from '../util/constants.js';
import { drawRulerNumber } from '../util/bitmapText.js';

export class RulerRenderer {
  constructor(hCanvas, vCanvas, doc) {
    Object.assign(this, { hCanvas, vCanvas, doc, zoom: 1, mousePos: { x: -1, y: -1 } });
    this.container = document.getElementById('canvas-container');
  }
  setMousePos(x, y) { this.mousePos = { x, y }; }
  resize() {
    this.hCanvas.width = this.container.clientWidth; this.hCanvas.height = RULER_SIZE;
    this.vCanvas.width = RULER_SIZE; this.vCanvas.height = this.container.clientHeight;
  }
  render() { this._draw(this.hCanvas, true); this._draw(this.vCanvas, false); }
  _draw(canvas, horizontal) {
    if (!this.doc.showRulers) return;
    const ctx = canvas.getContext('2d');
    const length = horizontal ? canvas.width : canvas.height;
    const scroll = horizontal ? this.container.scrollLeft : this.container.scrollTop;
    const origin = this.doc.rulerOrigin?.[horizontal ? 'x' : 'y'] || 0;
    const pointsPerUnit = this.doc.unit === 'cm' ? 72 / 2.54 : this.doc.unit === 'points' ? 1 : 72;
    const major = pointsPerUnit * this.doc.rulerMajor;
    const divisions = this.doc.rulerDivisions;
    const minor = major / divisions;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.imageSmoothingEnabled = false;
    const start = Math.floor((scroll / this.zoom - origin) / minor);
    const end = Math.ceil(((scroll + length) / this.zoom - origin) / minor);
    // Skip minor ticks when reduced far enough that they would merge.
    const step = Math.max(1, Math.ceil(3 / (minor * this.zoom)));
    const tickAt = (i, tick) => {
      const p = Math.round((i * minor + origin) * this.zoom - scroll) + 0.5;
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(p, RULER_SIZE - tick); ctx.lineTo(p, RULER_SIZE); }
      else { ctx.moveTo(RULER_SIZE - tick, p); ctx.lineTo(RULER_SIZE, p); }
      ctx.stroke(); return p - 0.5;
    };
    for (let i = Math.ceil(start / step) * step; i <= end; i += step) {
      if (i % divisions !== 0) tickAt(i, i % (divisions / 2) === 0 ? 6 : 3);
    }
    // Sampling minor ticks must not discard major ticks or their numerals.
    const majorStep = Math.max(1, Math.ceil(12 / (major * this.zoom)));
    for (let n = Math.ceil(start / divisions / majorStep) * majorStep; n <= end / divisions; n += majorStep) {
      const p = tickAt(n * divisions, 9);
      if (n !== 0) drawRulerNumber(ctx, String(n * this.doc.rulerIncrement), p, horizontal);
    }
    const pointer = (horizontal ? this.mousePos.x : this.mousePos.y) * this.zoom - scroll;
    if (pointer >= 0 && pointer <= length) {
      ctx.setLineDash([1, 1]); ctx.beginPath();
      if (horizontal) { ctx.moveTo(pointer, 0); ctx.lineTo(pointer, 20); }
      else { ctx.moveTo(0, pointer); ctx.lineTo(20, pointer); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); if (horizontal) { ctx.moveTo(0, 19.5); ctx.lineTo(length, 19.5); } else { ctx.moveTo(19.5, 0); ctx.lineTo(19.5, length); } ctx.stroke();
  }
}
