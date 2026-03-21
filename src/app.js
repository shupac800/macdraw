import { Document } from './model/Document.js';
import { Selection } from './model/Selection.js';
import { Clipboard } from './model/Clipboard.js';
import { getBounds, hitTest } from './model/Shape.js';
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
import { PropertyPanel } from './ui/PropertyPanel.js';
import { PatternPicker } from './ui/PatternPicker.js';
import { PatternRegistry } from './util/patterns.js';
import { TOOLS } from './util/constants.js';
import { loadFromLocalStorage, saveToLocalStorage } from './util/serialize.js';

class MacDraw {
  constructor() {
    // Try to load saved document
    const saved = loadFromLocalStorage();
    this.doc = saved || new Document();
    this.selection = new Selection();
    this.clipboard = new Clipboard();
    this.commandStack = new CommandStack();

    // Wire up Shape module for Document
    Document.setShapeModule({ getBounds, hitTest });

    // Canvas
    this.canvas = document.getElementById('drawing-canvas');
    this.cursorManager = new CursorManager(this.canvas);
    this.selectionOverlay = new SelectionOverlay(this.doc, this.selection);

    // Patterns
    this.patternRegistry = new PatternRegistry();
    this.patternRegistry.init(this.canvas.getContext('2d'));

    // Renderer
    this.renderer = new Renderer(this.canvas, this.doc, this.selection, this.patternRegistry);
    this.renderer.setSelectionOverlay(this.selectionOverlay);

    // Tools
    this.toolManager = new ToolManager(
      this.doc, this.selection, this.commandStack,
      this.selectionOverlay, this.cursorManager
    );

    this._registerTools();

    // Rulers
    const hRuler = document.getElementById('h-ruler');
    const vRuler = document.getElementById('v-ruler');
    this.rulerRenderer = new RulerRenderer(hRuler, vRuler, this.doc);

    // Input
    this.inputHandler = new InputHandler(this.canvas, this.toolManager, this.rulerRenderer);
    this.shortcuts = new KeyboardShortcuts(this);

    // UI
    this.toolbar = new Toolbar(document.getElementById('toolbar'), this.toolManager);
    this.menuBar = new MenuBar(document.getElementById('menubar'), this);
    this.propertyPanel = new PropertyPanel(document.getElementById('property-panel'), this);

    // Pattern picker
    this.patternPicker = new PatternPicker(this, this.patternRegistry);
    this.propertyPanel.setPatternPicker(this.patternPicker);

    // Set default tool
    this.toolManager.setActiveTool(TOOLS.SELECT);

    // Auto-save
    this.doc.onChange(() => {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => saveToLocalStorage(this.doc), 2000);
    });

    // Start
    this._handleResize();
    window.addEventListener('resize', () => this._handleResize());
    this.renderer.startRenderLoop();
    this.rulerRenderer.render();
  }

  _registerTools() {
    this.toolManager.registerTool(TOOLS.SELECT, new SelectTool());
    this.toolManager.registerTool(TOOLS.RECT, new RectTool());
    this.toolManager.registerTool(TOOLS.OVAL, new OvalTool());
    this.toolManager.registerTool(TOOLS.ROUND_RECT, new RoundRectTool());
    this.toolManager.registerTool(TOOLS.LINE, new LineTool());
    this.toolManager.registerTool(TOOLS.ARC, new ArcTool());
    this.toolManager.registerTool(TOOLS.POLYGON, new PolygonTool());
    this.toolManager.registerTool(TOOLS.FREEHAND, new FreehandTool());
    this.toolManager.registerTool(TOOLS.TEXT, new TextTool());
  }

  _handleResize() {
    this.renderer.resizeCanvas();
    this.rulerRenderer.resize();
    this.rulerRenderer.render();
  }

  loadDocument(doc) {
    this.doc.clear();
    this.doc.pageWidth = doc.pageWidth;
    this.doc.pageHeight = doc.pageHeight;
    this.doc.unit = doc.unit;
    this.doc.objects = doc.objects;
    this.doc.groups = doc.groups;
    this.doc.snapToGrid = doc.snapToGrid;
    this.doc.gridSize = doc.gridSize;

    this.selection.clear();
    this.commandStack.clear();
    this.doc._notify('load');
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.app = new MacDraw();
});
