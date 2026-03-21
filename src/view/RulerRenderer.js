import { RULER_SIZE, UNITS } from '../util/constants.js';

export class RulerRenderer {
  constructor(horizontalCanvas, verticalCanvas, doc) {
    this.hCanvas = horizontalCanvas;
    this.vCanvas = verticalCanvas;
    this.doc = doc;
    this.hCtx = horizontalCanvas.getContext('2d');
    this.vCtx = verticalCanvas.getContext('2d');
    this.mousePos = { x: 0, y: 0 };
    this.unit = UNITS.INCHES;
  }

  setMousePos(x, y) {
    this.mousePos = { x, y };
  }

  setUnit(unit) {
    this.unit = unit;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.hCanvas.parentElement;

    this.hCanvas.width = parent.clientWidth * dpr;
    this.hCanvas.height = RULER_SIZE * dpr;
    this.hCanvas.style.height = `${RULER_SIZE}px`;

    this.vCanvas.width = RULER_SIZE * dpr;
    this.vCanvas.height = parent.clientHeight * dpr;
    this.vCanvas.style.width = `${RULER_SIZE}px`;
  }

  render() {
    this._renderHorizontal();
    this._renderVertical();
  }

  _renderHorizontal() {
    const { hCtx: ctx, hCanvas: canvas } = this;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const w = canvas.width / dpr;
    const h = RULER_SIZE;

    // Background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
    ctx.stroke();

    // Ticks
    const perPoint = this.unit.perPoint;
    const majorInterval = 1 / perPoint; // Points per unit
    const minorDivisions = this.unit === UNITS.CM ? 10 : 8;
    const minorInterval = majorInterval / minorDivisions;

    ctx.fillStyle = '#666';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = '#999';

    const offset = RULER_SIZE; // Offset for ruler corner
    for (let pt = 0; pt <= this.doc.pageWidth; pt += minorInterval) {
      const x = pt + offset;
      const unitVal = pt * perPoint;
      const isMajor = Math.abs(unitVal - Math.round(unitVal)) < 0.01;

      ctx.beginPath();
      if (isMajor) {
        ctx.moveTo(x, h * 0.3);
        ctx.lineTo(x, h);
        ctx.stroke();
        if (Math.round(unitVal) > 0) {
          ctx.fillText(`${Math.round(unitVal)}`, x, 2);
        }
      } else {
        const tickHeight = h * 0.6;
        ctx.moveTo(x, tickHeight);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }

    // Mouse position marker
    if (this.mousePos.x > 0) {
      const mx = this.mousePos.x + offset;
      ctx.fillStyle = '#2196F3';
      ctx.beginPath();
      ctx.moveTo(mx, h);
      ctx.lineTo(mx - 4, h - 6);
      ctx.lineTo(mx + 4, h - 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  _renderVertical() {
    const { vCtx: ctx, vCanvas: canvas } = this;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const w = RULER_SIZE;
    const h = canvas.height / dpr;

    // Background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w - 0.5, 0);
    ctx.lineTo(w - 0.5, h);
    ctx.stroke();

    // Ticks
    const perPoint = this.unit.perPoint;
    const majorInterval = 1 / perPoint;
    const minorDivisions = this.unit === UNITS.CM ? 10 : 8;
    const minorInterval = majorInterval / minorDivisions;

    ctx.fillStyle = '#666';
    ctx.font = '9px system-ui, sans-serif';
    ctx.strokeStyle = '#999';

    const offset = RULER_SIZE;
    for (let pt = 0; pt <= this.doc.pageHeight; pt += minorInterval) {
      const y = pt + offset;
      const unitVal = pt * perPoint;
      const isMajor = Math.abs(unitVal - Math.round(unitVal)) < 0.01;

      ctx.beginPath();
      if (isMajor) {
        ctx.moveTo(w * 0.3, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        if (Math.round(unitVal) > 0) {
          ctx.save();
          ctx.translate(8, y);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${Math.round(unitVal)}`, 0, 0);
          ctx.restore();
        }
      } else {
        const tickStart = w * 0.6;
        ctx.moveTo(tickStart, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    // Mouse position marker
    if (this.mousePos.y > 0) {
      const my = this.mousePos.y + offset;
      ctx.fillStyle = '#2196F3';
      ctx.beginPath();
      ctx.moveTo(w, my);
      ctx.lineTo(w - 6, my - 4);
      ctx.lineTo(w - 6, my + 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
