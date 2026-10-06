import { renderShape, getMultiBounds } from '../model/Shape.js';
import { monochromePixels } from '../util/patterns.js';

export class Renderer {
  constructor(canvas, doc, selection, patternRegistry) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.container = document.getElementById('canvas-container');
    this.doc = doc;
    this.selection = selection;
    this.patternRegistry = patternRegistry || null;
    this.selectionOverlay = null;
    this._animFrame = null;
    this._dirty = true;
    this.zoom = 1;

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

    // Clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Native one-bit Macintosh pixels; only the outer screen is enlarged.
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(-this.container.scrollLeft, -this.container.scrollTop);
    ctx.scale(this.zoom, this.zoom);

    // Draw page background
    this._renderPage(ctx);

    // Draw grid if enabled
    if (this.doc.showGrid) {
      this._renderGrid(ctx);
    }
    if (this.doc.showRulerLines) this._renderRulerLines(ctx);

    // Draw all objects
    for (const obj of this.doc.objects) {
      if (obj.id === this.doc._editingId) continue;
      const original = this.selectionOverlay?.trackingIds?.includes(obj.id) && this.selectionOverlay.trackingOriginals?.get(obj.id);
      renderShape(ctx, original || obj, this.patternRegistry);
    }
    // Tracking frames invert the completed background, including objects
    // above the selection, so the pointer feedback cannot be hidden by fills.
    const tracked = (this.selectionOverlay?.trackingIds || []).map(id => this.doc.getObjectById(id)).filter(Boolean);
    if (this.selectionOverlay?.trackingOutlines) {
      tracked.forEach(obj => this.selectionOverlay.renderTrackingObject(ctx, obj, this.patternRegistry));
    } else {
      const units = new Map();
      for (const obj of tracked) {
        const key = obj.groupId || obj.id;
        if (!units.has(key)) units.set(key, []);
        units.get(key).push(obj);
      }
      for (const objects of units.values()) this.selectionOverlay.renderTrackingBounds(ctx, getMultiBounds(objects));
    }

    // Draw selection overlay
    if (this.selectionOverlay) {
      this.selectionOverlay.render(ctx);
    }

    ctx.restore();
    ctx.putImageData(monochromePixels(ctx.getImageData(0, 0, canvas.width, canvas.height)), 0, 0);
  }

  _renderPage(ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.doc.pageWidth, this.doc.pageHeight);

    // Page border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.strokeRect(0.5, 0.5, this.doc.pageWidth - 1, this.doc.pageHeight - 1);
    ctx.setLineDash([]);
  }

  _renderGrid(ctx) {
    ctx.save();
    ctx.fillStyle = '#000';

    const gs = this.doc.gridSize * Math.max(1, Math.ceil(4 / (this.doc.gridSize * this.zoom)));
    for (let x = gs; x < this.doc.pageWidth; x += gs) for (let y = gs; y < this.doc.pageHeight; y += gs) ctx.fillRect(x, y, 1 / this.zoom, 1 / this.zoom);
    ctx.restore();
  }

  resizeCanvas() {
    const container = this.container;
    const w = Math.max(1, Math.floor(container.clientWidth));
    const h = Math.max(1, Math.floor(container.clientHeight));
    this.canvas.parentElement.style.width = `${Math.max(w, Math.ceil(this.doc.pageWidth * this.zoom))}px`;
    this.canvas.parentElement.style.height = `${Math.max(h, Math.ceil(this.doc.pageHeight * this.zoom))}px`;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.requestRender();
  }

  _renderRulerLines(ctx) {
    const perUnit = this.doc.unit === 'cm' ? 72 / 2.54 : this.doc.unit === 'points' ? 1 : 72;
    const spacing = perUnit * this.doc.rulerMajor;
    const major = spacing * Math.max(1, Math.ceil(8 / (spacing * this.zoom)));
    ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5 / this.zoom; ctx.setLineDash([1 / this.zoom, 5 / this.zoom]);
    const origin = this.doc.rulerOrigin;
    for (let x = ((origin.x % major) + major) % major || major; x < this.doc.pageWidth; x += major) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.doc.pageHeight); ctx.stroke(); }
    for (let y = ((origin.y % major) + major) % major || major; y < this.doc.pageHeight; y += major) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.doc.pageWidth, y); ctx.stroke(); }
    ctx.restore();
  }
}
