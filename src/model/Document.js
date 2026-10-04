import { DEFAULT_PAGE, DEFAULT_STROKE, DEFAULT_FILL, FONTS } from '../util/constants.js';
import { resetIdCounter } from './Shape.js';

export class Document {
  constructor(options = {}) {
    this.pageWidth = options.pageWidth || DEFAULT_PAGE.width;
    this.pageHeight = options.pageHeight || DEFAULT_PAGE.height;
    this.unit = options.unit || 'inches';
    this.objects = [];
    this.groups = [];
    this._listeners = [];
    this.snapToGrid = false;
    this.gridSize = 9;
    this.name = 'Untitled';
    this.showGrid = false;
    this.showRulers = true;
    this.showRulerLines = true;
    this.showSize = false;
    this.rulerOrigin = { x: 0, y: 0 };
    this.rulerMajor = 1;
    this.rulerDivisions = 8;
    this.rulerIncrement = 1;
    this._defaultStroke = { ...DEFAULT_STROKE, patternId: null };
    this._defaultFill = { ...DEFAULT_FILL };
    this._defaultText = { fontFamily: FONTS[0].value, fontSize: 12, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', lineSpacing: 1, outline: false, shadow: false };
  }

  addObject(shape) {
    this.objects.push(shape);
    this._notify('add', shape);
  }

  removeObject(id) {
    const index = this.objects.findIndex(o => o.id === id);
    if (index !== -1) {
      const [removed] = this.objects.splice(index, 1);
      this._notify('remove', removed);
      return removed;
    }
    return null;
  }

  getObjectById(id) {
    return this.objects.find(o => o.id === id) || null;
  }

  getObjectsInRect(rect) {
    const { getBounds } = require_getBounds();
    return this.objects.filter(obj => {
      const b = getBounds(obj);
      return (
        b.x >= rect.x &&
        b.y >= rect.y &&
        b.x + b.width <= rect.x + rect.width &&
        b.y + b.height <= rect.y + rect.height
      );
    });
  }

  getObjectAtPoint(point, threshold = 5) {
    // Search from top (last) to bottom (first) for z-order
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      const { hitTest } = require_hitTest();
      if (hitTest(obj, point, threshold)) {
        return obj;
      }
    }
    return null;
  }

  moveToFront(id) {
    const index = this.objects.findIndex(o => o.id === id);
    if (index !== -1 && index < this.objects.length - 1) {
      const [obj] = this.objects.splice(index, 1);
      this.objects.push(obj);
      this._notify('reorder');
    }
  }

  moveToBack(id) {
    const index = this.objects.findIndex(o => o.id === id);
    if (index > 0) {
      const [obj] = this.objects.splice(index, 1);
      this.objects.unshift(obj);
      this._notify('reorder');
    }
  }

  moveForward(id) {
    const index = this.objects.findIndex(o => o.id === id);
    if (index !== -1 && index < this.objects.length - 1) {
      [this.objects[index], this.objects[index + 1]] =
        [this.objects[index + 1], this.objects[index]];
      this._notify('reorder');
    }
  }

  moveBackward(id) {
    const index = this.objects.findIndex(o => o.id === id);
    if (index > 0) {
      [this.objects[index], this.objects[index - 1]] =
        [this.objects[index - 1], this.objects[index]];
      this._notify('reorder');
    }
  }

  insertObjectAt(shape, index) {
    this.objects.splice(index, 0, shape);
    this._notify('add', shape);
  }

  getObjectIndex(id) {
    return this.objects.findIndex(o => o.id === id);
  }

  addGroup(group) {
    this.groups.push(group);
    this._notify('group');
  }

  removeGroup(groupId) {
    const index = this.groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
      this.groups.splice(index, 1);
      this._notify('ungroup');
    }
  }

  getGroupMembers(groupId) {
    return this.objects.filter(o => o.groupId === groupId);
  }

  clear() {
    this.objects = [];
    this.groups = [];
    this._notify('clear');
  }

  onChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  _notify(type, data) {
    for (const listener of this._listeners) {
      listener(type, data);
    }
  }

  toJSON() {
    return {
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      unit: this.unit,
      objects: this.objects.map(o => ({ ...o })),
      groups: [...this.groups],
      snapToGrid: this.snapToGrid,
      gridSize: this.gridSize,
      name: this.name,
      showGrid: this.showGrid,
      showRulers: this.showRulers,
      showRulerLines: this.showRulerLines,
      showSize: this.showSize,
      rulerOrigin: { ...this.rulerOrigin },
      rulerMajor: this.rulerMajor,
      rulerDivisions: this.rulerDivisions,
      rulerIncrement: this.rulerIncrement,
      _defaultStroke: this._defaultStroke,
      _defaultFill: this._defaultFill,
      _defaultText: this._defaultText,
      _cornerRadius: this._cornerRadius ?? 18,
      _startArrow: this._startArrow || 'none',
      _endArrow: this._endArrow || 'none',
    };
  }

  static fromJSON(data) {
    const doc = new Document({
      pageWidth: data.pageWidth,
      pageHeight: data.pageHeight,
      unit: data.unit,
    });
    doc.objects = data.objects || [];
    doc.groups = data.groups || [];
    doc.snapToGrid = data.snapToGrid || false;
    doc.gridSize = data.gridSize || 9;
    for (const key of ['name', 'showGrid', 'showRulers', 'showRulerLines', 'showSize', 'rulerOrigin', 'rulerMajor', 'rulerDivisions', 'rulerIncrement', '_defaultStroke', '_defaultFill', '_defaultText', '_cornerRadius', '_startArrow', '_endArrow']) {
      if (data[key] !== undefined) doc[key] = key.startsWith('_default') ? { ...doc[key], ...structuredClone(data[key]) } : structuredClone(data[key]);
    }
    resetIdCounter(Math.max(0, ...doc.objects.map(o => Number(/^shape_(\d+)$/.exec(o.id)?.[1]) || 0)) + 1);
    return doc;
  }
}

// Lazy imports to avoid circular dependencies
function require_getBounds() {
  return require_shape_module();
}

function require_hitTest() {
  return require_shape_module();
}

let _shapeModule = null;
function require_shape_module() {
  if (!_shapeModule) {
    // Dynamic import workaround — these will be set by app initialization
    _shapeModule = Document._shapeModule || { getBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }), hitTest: () => false };
  }
  return _shapeModule;
}

// Called during app init to wire up Shape functions
Document.setShapeModule = function(mod) {
  _shapeModule = mod;
  Document._shapeModule = mod;
};
