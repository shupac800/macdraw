import { TOOLS } from '../util/constants.js';

export class ToolManager {
  constructor(doc, selection, commandStack, selectionOverlay, cursorManager) {
    this.doc = doc;
    this.selection = selection;
    this.commandStack = commandStack;
    this.selectionOverlay = selectionOverlay;
    this.cursorManager = cursorManager;
    this._tools = {};
    this._activeTool = null;
    this._activeToolName = null;
    this._listeners = [];
  }

  registerTool(name, tool) {
    this._tools[name] = tool;
    tool.manager = this;
    tool.doc = this.doc;
    tool.selection = this.selection;
    tool.commandStack = this.commandStack;
    tool.overlay = this.selectionOverlay;
    tool.cursor = this.cursorManager;
  }

  setActiveTool(name) {
    if (this._activeTool && this._activeTool.deactivate) {
      this._activeTool.deactivate();
    }
    this._activeToolName = name;
    this._activeTool = this._tools[name] || null;
    if (this._activeTool && this._activeTool.activate) {
      this._activeTool.activate();
    }
    this._notifyListeners();
  }

  getActiveTool() {
    return this._activeToolName;
  }

  onMouseDown(point, modifiers) {
    if (this._activeTool?.onMouseDown) {
      this._activeTool.onMouseDown(point, modifiers);
    }
  }

  onMouseMove(point, modifiers) {
    if (this._activeTool?.onMouseMove) {
      this._activeTool.onMouseMove(point, modifiers);
    }
  }

  onMouseUp(point, modifiers) {
    if (this._activeTool?.onMouseUp) {
      this._activeTool.onMouseUp(point, modifiers);
    }
  }

  onDoubleClick(point, modifiers) {
    if (this._activeTool?.onDoubleClick) {
      this._activeTool.onDoubleClick(point, modifiers);
    }
  }

  onKeyDown(e) {
    if (this._activeTool?.onKeyDown) {
      this._activeTool.onKeyDown(e);
    }
  }

  onKeyUp(e) {
    if (this._activeTool?.onKeyUp) {
      this._activeTool.onKeyUp(e);
    }
  }

  onChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  _notifyListeners() {
    for (const l of this._listeners) {
      l(this._activeToolName);
    }
  }
}
