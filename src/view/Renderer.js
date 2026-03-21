import { renderShape } from '../model/Shape.js';

export class Renderer {
  constructor(canvas, doc, selection, patternRegistry) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.doc = doc;
    this.selection = selection;
    this.patternRegistry = patternRegistry || null;
    this.selectionOverlay = null;
    this._animFrame = null;
    this._dirty = true;

    // Track changes
    this.doc.onChange(() => this.requestRender());
    this.selection.onChange(() => this.requestRender());
  }

  setSelectionOverlay(overlay) {
    this.selectionOverlay = overlay;
  }

  requestRender() {
    this._dirty = true;
  }

  startRenderLoop() {
    const loop = () => {
      if (this._dirty) {
        this.render();
        this._dirty = false;
      }
      this._animFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  stopRenderLoop() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  render() {
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;

    // Clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Scale for DPR
    ctx.save();
    ctx.scale(dpr, dpr);

    // Draw page background
    this._renderPage(ctx);

    // Draw grid if enabled
    if (this.doc.snapToGrid) {
      this._renderGrid(ctx);
    }

    // Draw all objects
    for (const obj of this.doc.objects) {
      renderShape(ctx, obj, this.patternRegistry);
    }

    // Draw selection overlay
    if (this.selectionOverlay) {
      this.selectionOverlay.render(ctx);
    }

    ctx.restore();
  }

  _renderPage(ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.doc.pageWidth, this.doc.pageHeight);

    // Page border
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, this.doc.pageWidth - 1, this.doc.pageHeight - 1);
  }

  _renderGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 0.5;

    const gs = this.doc.gridSize;
    for (let x = gs; x < this.doc.pageWidth; x += gs) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.doc.pageHeight);
      ctx.stroke();
    }
    for (let y = gs; y < this.doc.pageHeight; y += gs) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.doc.pageWidth, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const container = this.canvas.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.requestRender();
  }
}
