import { Document } from './model/Document.js';
import { Selection } from './model/Selection.js';
import { Clipboard } from './model/Clipboard.js';
import { getVisualBounds as getBounds, getMultiBounds, hitTest } from './model/Shape.js';
import { CommandStack } from './commands/CommandStack.js';
import { Renderer } from './view/Renderer.js';
import { SelectionOverlay } from './view/SelectionOverlay.js';
import { CursorManager } from './view/CursorManager.js';
import { RulerRenderer } from './view/RulerRenderer.js';
import { ToolManager } from './controller/ToolManager.js';
import { InputHandler } from './controller/InputHandler.js';
import { KeyboardShortcuts } from './controller/KeyboardShortcuts.js';
import { SelectTool } from './controller/tools/SelectTool.js';
import { RectTool } from './controller/tools/RectTool.js';
import { OvalTool } from './controller/tools/OvalTool.js';
import { RoundRectTool } from './controller/tools/RoundRectTool.js';
import { LineTool } from './controller/tools/LineTool.js';
import { ArcTool } from './controller/tools/ArcTool.js';
import { PolygonTool } from './controller/tools/PolygonTool.js';
import { FreehandTool } from './controller/tools/FreehandTool.js';
import { TextTool } from './controller/tools/TextTool.js';
import { Toolbar } from './ui/Toolbar.js';
import { MenuBar } from './ui/MenuBar.js';
import { Dialog } from './ui/Dialog.js';
import { PatternPicker } from './ui/PatternPicker.js';
import { PatternRegistry } from './util/patterns.js';
import { TOOLS } from './util/constants.js';
import { loadFromLocalStorage, saveToLocalStorage } from './util/serialize.js';
import { FileController } from './controller/FileController.js';
import { EditorActions } from './controller/EditorActions.js';
import { MacScreen } from './view/MacScreen.js';

export class MacDraw {
  constructor() {
    this.screen = new MacScreen(document.getElementById('app'));
    const saved = loadFromLocalStorage();
    this.doc = saved || new Document();
    this.monochrome();
    this.selection = new Selection(); this.clipboard = new Clipboard(); this.commandStack = new CommandStack(); this.dialog = new Dialog(); this.zoom = 1;
    Document.setShapeModule({ getBounds, hitTest });
    this.canvas = document.getElementById('drawing-canvas');
    this.cursorManager = new CursorManager(this.canvas);
    this.selectionOverlay = new SelectionOverlay(this.doc, this.selection); this.selectionOverlay.showRotationHandle = false;
    this.patternRegistry = new PatternRegistry(); this.patternRegistry.init(this.canvas.getContext('2d'));
    this.renderer = new Renderer(this.canvas, this.doc, this.selection, this.patternRegistry); this.renderer.setSelectionOverlay(this.selectionOverlay);
    this.toolManager = new ToolManager(this.doc, this.selection, this.commandStack, this.selectionOverlay, this.cursorManager);
    const tools = { select: new SelectTool(), rect: new RectTool(), oval: new OvalTool(), roundRect: new RoundRectTool(), line: new LineTool(), perpendicular: new LineTool(true), arc: new ArcTool(), polygon: new PolygonTool(), freehand: new FreehandTool(), text: new TextTool() };
    for (const [name, tool] of Object.entries(tools)) this.toolManager.registerTool(name, tool);
    this.rulerRenderer = new RulerRenderer(document.getElementById('h-ruler'), document.getElementById('v-ruler'), this.doc);
    this.inputHandler = new InputHandler(this.canvas, this.toolManager, this.rulerRenderer);
    this.actions = new EditorActions(this); this.files = new FileController(this, !!saved?.objects.length);
    this.patternPicker = new PatternPicker(this, this.patternRegistry);
    this.toolbar = new Toolbar(document.getElementById('toolbar'), this.toolManager);
    this.menuBar = new MenuBar(document.getElementById('menubar'), this); this.shortcuts = new KeyboardShortcuts(this);
    this.toolManager.chooseTool(TOOLS.SELECT);
    this.doc.onChange(type => {
      this.updateStatus();
      if (!['preview', 'marquee', 'move', 'resize', 'rotate'].includes(type)) {
        this._handleResize();
        clearTimeout(this._saveTimer); this._saveTimer = setTimeout(() => saveToLocalStorage(this.doc), 500);
      }
    });
    this.selection.onChange(() => this.updateStatus());
    this.commandStack.onChange(() => { this.selection.selectMultiple(this.selection.ids.filter(id => this.doc.getObjectById(id))); this.updateStatus(); });
    this.toolManager.onChange(() => this.updateStatus());
    const viewport = document.getElementById('canvas-container');
    viewport.addEventListener('scroll', () => { this.rulerRenderer.render(); this.renderer.requestRender(); });
    viewport.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY < 0 ? 1.25 : 0.8)); } }, { passive: false });
    document.getElementById('close-box').addEventListener('click', () => this.files.newDocument());
    document.getElementById('zoom-box').addEventListener('click', () => { document.getElementById('document-window').classList.toggle('expanded'); this._handleResize(); });
    document.getElementById('style-preview').addEventListener('click', () => this.menuBar.openByLabel('Fill'));
    document.getElementById('zoom-level').addEventListener('click', () => this.actions.zoomDialog());
    window.addEventListener('resize', () => { this.screen.update(); this._handleResize(); });
    window.addEventListener('beforeunload', e => { this.finishText(); saveToLocalStorage(this.doc); if (this.files.dirty) { e.preventDefault(); e.returnValue = ''; } });
    this._handleResize(); this.renderer.startRenderLoop(); this.updateStatus();
    // Wait for the bundled Chicago face before the first text measurements.
    document.fonts.ready.then(() => this.renderer.requestRender());
  }
  finishText() { this.toolManager._tools.text.finishEditing(); }
  cancelInteraction() { this.toolManager._tools.select.deactivate(); this.toolManager.chooseTool(TOOLS.SELECT); this.selectionOverlay.interactionPreview = null; this.renderer.requestRender(); }
  _handleResize() {
    document.getElementById('canvas-area').classList.toggle('no-rulers', !this.doc.showRulers);
    this.renderer.resizeCanvas(); this.rulerRenderer.resize(); this.rulerRenderer.render();
  }
  setZoom(value) {
    this.finishText();
    if (this.toolManager._activeTool?._dragging || this.toolManager._activeTool?._drawing) this.cancelInteraction();
    const viewport = document.getElementById('canvas-container'), old = this.zoom;
    const selected = this.selection.getSelectedObjects(this.doc);
    const bounds = selected.length ? getMultiBounds(selected) : null;
    const cx = bounds ? bounds.x + bounds.width / 2 : value === 1 ? this.doc.pageWidth / 2 : (viewport.scrollLeft + viewport.clientWidth / 2) / old;
    const cy = bounds ? bounds.y + bounds.height / 2 : value === 1 ? this.doc.pageHeight / 2 : (viewport.scrollTop + viewport.clientHeight / 2) / old;
    this.zoom = Math.max(0.125, Math.min(4, value));
    this.renderer.zoom = this.rulerRenderer.zoom = this.selectionOverlay.zoom = this.toolManager.zoom = this.zoom;
    this._handleResize(); viewport.scrollLeft = cx * this.zoom - viewport.clientWidth / 2; viewport.scrollTop = cy * this.zoom - viewport.clientHeight / 2;
    this.updateStatus();
  }
  fitDrawing() {
    const el = document.getElementById('canvas-container'); this.setZoom(Math.min(el.clientWidth / this.doc.pageWidth, el.clientHeight / this.doc.pageHeight)); el.scrollTo(0, 0);
  }
  loadDocument(doc) {
    this.cancelInteraction(); this.finishText();
    Object.assign(this.doc, structuredClone(doc.toJSON())); this.monochrome();
    this.selection.clear(); this.commandStack.clear(); this.zoom = 1;
    this.renderer.zoom = this.rulerRenderer.zoom = this.selectionOverlay.zoom = this.toolManager.zoom = 1;
    document.getElementById('canvas-container').scrollTo(0, 0); this.doc._notify('load');
  }
  monochrome() {
    // Existing colored drawings become black-and-white on entry to this editor.
    for (const shape of this.doc.objects) {
      shape.stroke.color = '#000000';
      if (shape.fill.type === 'solid') shape.fill.color = /^#f{3,6}$|^white$/i.test(shape.fill.color) ? '#ffffff' : '#000000';
    }
    this.doc._defaultStroke.color = '#000000';
    this.doc._defaultFill.color = this.doc._defaultFill.color === '#000000' ? '#000000' : '#ffffff';
  }
  currentStyle(target) {
    return this.selection.getSelectedObjects(this.doc)[0]?.[target === 'Fill' ? 'fill' : 'stroke'] || this.doc[target === 'Fill' ? '_defaultFill' : '_defaultStroke'];
  }
  applyPattern(target, id) {
    if (target === 'Fill') this.actions.style('fill', id === null ? { type: 'none', color: '#ffffff', patternId: null } : { type: 'pattern', color: '#000000', patternId: id });
    else this.actions.style('stroke.patternId', id);
  }
  updateStatus() {
    if (!this.files) return;
    const title = `${this.doc.name || 'Untitled'}${this.files.dirty ? ' •' : ''}`;
    document.getElementById('document-title').textContent = title; document.title = `${title} — MacDraw`;
    document.getElementById('zoom-level').textContent = `${Math.round(this.zoom * 100)}%`;
    const objects = this.selection.getSelectedObjects(this.doc), preview = this.selectionOverlay.interactionPreview;
    let status = objects.length ? `${objects.length} object${objects.length === 1 ? '' : 's'} selected${objects.some(o => o.locked) ? ' (locked)' : ''}` : 'Choose a tool. Double-click a tool to keep drawing.';
    if (this.doc.showSize && (preview || objects[0])) {
      const b = getBounds(preview || objects[0]), unit = this.doc.unit === 'cm' ? 72 / 2.54 : this.doc.unit === 'points' ? 1 : 72;
      status += `   X ${(b.x / unit).toFixed(2)}   Y ${(b.y / unit).toFixed(2)}   W ${(b.width / unit).toFixed(2)}   H ${(b.height / unit).toFixed(2)} ${this.doc.unit === 'inches' ? 'in' : this.doc.unit}`;
    }
    document.getElementById('status-text').textContent = status;
    const holder = document.getElementById('style-preview');
    let canvas = holder.querySelector('canvas'); if (!canvas) { canvas = document.createElement('canvas'); canvas.width = 22; canvas.height = 12; holder.append(canvas); }
    const ctx = canvas.getContext('2d'), fill = this.doc._defaultFill, pen = this.doc._defaultStroke;
    ctx.clearRect(0, 0, 22, 12); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 22, 12);
    ctx.fillStyle = fill.type === 'pattern' ? this.patternRegistry.getPattern(fill.patternId) : fill.color;
    if (fill.type !== 'none') ctx.fillRect(1, 1, 20, 10);
    ctx.strokeStyle = this.patternRegistry.getPattern(pen.patternId) || '#000'; ctx.lineWidth = Math.min(4, pen.width); if (pen.width) ctx.strokeRect(1.5, 1.5, 19, 9);
  }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new MacDraw(); });
