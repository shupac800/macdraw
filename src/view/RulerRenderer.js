import { RULER_SIZE } from '../util/constants.js';

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
    ctx.fillStyle = ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.font = '12px Chicago'; ctx.textAlign = 'center';
    const start = Math.floor((scroll / this.zoom - origin) / minor);
    const end = Math.ceil(((scroll + length) / this.zoom - origin) / minor);
    // Skip minor ticks when reduced far enough that they would merge.
    const step = Math.max(1, Math.ceil(3 / (minor * this.zoom)));
    // Sampling bounds work for very fine custom units without enormous loops.
    for (let i = Math.ceil(start / step) * step; i <= end; i += step) {
      const isMajor = i % divisions === 0;
      if (!isMajor && i % step) continue;
      const p = Math.round((i * minor + origin) * this.zoom - scroll) + 0.5;
      const tick = isMajor ? 9 : i % (divisions / 2) === 0 ? 6 : 3;
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(p, 20 - tick); ctx.lineTo(p, 20); }
      else { ctx.moveTo(20 - tick, p); ctx.lineTo(20, p); }
      ctx.stroke();
      if (isMajor && Math.abs(i) > 0) {
        const value = String(i / divisions * this.doc.rulerIncrement);
        if (horizontal) ctx.fillText(value, p, 10);
        else { ctx.save(); ctx.translate(8, p); ctx.rotate(-Math.PI / 2); ctx.fillText(value, 0, 3); ctx.restore(); }
      }
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
