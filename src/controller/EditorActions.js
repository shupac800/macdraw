import { DocumentCommand } from '../commands/DocumentCommand.js';
import { getVisualBounds as getBounds, getMultiBounds } from '../model/Shape.js';
import { rotatePoint, boundingBox } from '../util/geometry.js';
import { PAGE_SIZES } from '../util/constants.js';
import { textLayout } from '../util/text.js';
import { Clipboard } from '../model/Clipboard.js';

const translate = (shape, dx, dy) => {
  shape.x += dx; shape.y += dy;
  if (shape.points) shape.points = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
};

export class EditorActions {
  constructor(app) { this.app = app; }
  get selected() {
    // Commands that group or copy objects must use document stacking order,
    // never the order in which the user clicked them.
    const ids = new Set(this.app.selection.ids);
    for (const shape of this.app.doc.objects) if (ids.has(shape.id) && shape.groupId) this.app.doc.getGroupMembers(shape.groupId).forEach(s => ids.add(s.id));
    return this.app.doc.objects.filter(s => ids.has(s.id));
  }
  get editable() { return this.selected.filter(s => !s.locked && (!s.groupId || this.app.doc.getGroupMembers(s.groupId).every(m => !m.locked))); }
  get editableUnits() {
    const units = new Map();
    for (const shape of this.editable) {
      const key = shape.groupId || shape.id;
      if (!units.has(key)) units.set(key, []);
      units.get(key).push(shape);
    }
    return [...units.values()];
  }
  get canGroup() {
    // A selected group is one object, however many shapes it contains.
    return this._stackingUnits(this.selected).length > 1;
  }
  change(label, mutate) { this.app.finishText(); this.app.cancelInteraction(); this.app.commandStack.execute(new DocumentCommand(this.app.doc, label, mutate)); }
  undo() { this.app.finishText(); this.app.cancelInteraction(); this.app.commandStack.undo(); }
  redo() { this.app.finishText(); this.app.cancelInteraction(); this.app.commandStack.redo(); }
  copy() { this.app.finishText(); this.app.clipboard.copy(this.selected, this.app.doc.groups); }
  cut() { this.copy(); this.remove(); }
  remove() {
    if (!this.editable.length) return;
    this.change('Clear', () => { const ids = new Set(this.editable.map(s => s.id)); this.app.doc.objects = this.app.doc.objects.filter(s => !ids.has(s.id)); this._cleanGroups(); });
    this.app.selection.clear();
  }
  paste(position = 'front', offset = true) {
    if (this.app.clipboard.isEmpty) return;
    this.app.finishText();
    const { shapes, groups } = this.app.clipboard.paste();
    const selectedIds = new Set(this.app.selection.ids);
    this.change('Paste', () => {
      if (offset) shapes.forEach(shape => translate(shape, 9, 9));
      const indexes = this.app.doc.objects.flatMap((s, i) => selectedIds.has(s.id) ? [i] : []);
      const at = indexes.length ? (position === 'back' ? Math.min(...indexes) : Math.max(...indexes) + 1) : position === 'back' ? 0 : this.app.doc.objects.length;
      this.app.doc.objects.splice(at, 0, ...shapes); this.app.doc.groups.push(...groups);
    });
    this.app.selection.selectMultiple(shapes.map(s => s.id));
  }
  duplicate() {
    if (!this.editable.length) return;
    const original = this.app.clipboard;
    this.app.clipboard = new Clipboard();
    try { this.app.clipboard.copy(this.editable, this.app.doc.groups); this.paste(); }
    finally { this.app.clipboard = original; }
  }
  _measureText(shape) {
    const ctx = this.app.renderer?.canvas?.getContext('2d');
    if (ctx && shape.type === 'text') { const { width, height } = textLayout(ctx, shape); Object.assign(shape, { width, height }); }
  }
  selectAll() { this.app.finishText(); this.app.toolManager.chooseTool('select'); this.app.selection.selectMultiple(this.app.doc.objects.map(s => s.id)); }
  nudge(dx, dy) { if (this.editable.length) this.change('Move', () => this.editable.forEach(s => translate(s, dx, dy))); }
  style(property, value, label = 'Style') {
    this.app.finishText();
    const textProperty = !['fill', 'stroke'].includes(property.split('.')[0]);
    const shapes = this.editable.filter(s => textProperty ? s.type === 'text' : property.startsWith('stroke') ? s.type !== 'text' : s.type !== 'line');
    const assign = object => {
      const keys = property.split('.'); let target = object;
      for (const key of keys.slice(0, -1)) target = target[key];
      target[keys.at(-1)] = structuredClone(value);
    };
    if (shapes.length) this.change(label, () => shapes.forEach(shape => { assign(shape); if (textProperty) this._measureText(shape); }));
    else if (this.app.selection.isEmpty) {
      if (property === 'fill') this.app.doc._defaultFill = structuredClone(value);
      else if (property.startsWith('stroke.')) this.app.doc._defaultStroke[property.split('.')[1]] = structuredClone(value);
      else this.app.doc._defaultText[property] = structuredClone(value);
      this.app.doc._notify('defaults');
    }
  }
  toggleText(property, on, off) {
    const source = this.selected.find(s => s.type === 'text') || this.app.doc._defaultText;
    this.style(property, source[property] === on ? off : on);
  }
  plainText() { this.change('Plain Text', () => { const shapes = this.editable.filter(s => s.type === 'text'); (shapes.length ? shapes : [this.app.doc._defaultText]).forEach(s => { Object.assign(s, { fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', outline: false, shadow: false }); this._measureText(s); }); }); }
  textCase(kind) { this.change('Change Case', () => this.editable.filter(s => s.type === 'text').forEach(s => { s.text = kind === 'upper' ? s.text.toUpperCase() : kind === 'lower' ? s.text.toLowerCase() : s.text.replace(/\b\w/g, ch => ch.toUpperCase()); this._measureText(s); })); }
  arrows(start, end) {
    const lines = this.editable.filter(s => s.type === 'line');
    if (lines.length) this.change('Arrowheads', () => lines.forEach(s => { s.startArrow = start; s.endArrow = end; }));
    else if (this.app.selection.isEmpty) { this.app.doc._startArrow = start; this.app.doc._endArrow = end; this.app.doc._notify('defaults'); }
  }
  arrange(direction) {
    if (!this.editable.length) return;
    this.change('Arrange', () => {
      const ids = new Set(this.editable.map(s => s.id)), all = this.app.doc.objects;
      if (direction === 'front' || direction === 'back') {
        const selected = all.filter(s => ids.has(s.id)), rest = all.filter(s => !ids.has(s.id));
        this.app.doc.objects = direction === 'front' ? [...rest, ...selected] : [...selected, ...rest];
      } else if (direction === 'forward') {
        const units = this._stackingUnits(all);
        for (let i = units.length - 2; i >= 0; i--) if (ids.has(units[i][0].id) && !ids.has(units[i + 1][0].id)) [units[i], units[i + 1]] = [units[i + 1], units[i]];
        this.app.doc.objects = units.flat();
      } else {
        const units = this._stackingUnits(all);
        for (let i = 1; i < units.length; i++) if (ids.has(units[i][0].id) && !ids.has(units[i - 1][0].id)) [units[i], units[i - 1]] = [units[i - 1], units[i]];
        this.app.doc.objects = units.flat();
      }
    });
  }
  _stackingUnits(shapes) {
    const units = new Map();
    for (const shape of shapes) {
      const key = shape.groupId || shape.id;
      if (!units.has(key)) units.set(key, []);
      units.get(key).push(shape);
    }
    return [...units.values()];
  }
  group() {
    if (!this.canGroup) return;
    this.change('Group', () => {
      // Selection records click order, not paint order. Keep the latter so an
      // opaque box cannot jump in front of its text when they are grouped.
      const ids = new Set(this.selected.map(s => s.id));
      const members = this.app.doc.objects.filter(s => ids.has(s.id));
      const group = { id: `group_${crypto.randomUUID()}`, members: members.map(s => s.id), previousGroups: Object.fromEntries(members.map(s => [s.id, s.groupId])) };
      members.forEach(s => { s.groupId = group.id; s.locked = false; }); this.app.doc.groups.push(group);
      this.app.doc.objects = this.app.doc.objects.filter(s => !ids.has(s.id));
      this.app.doc.objects.push(...members);
    });
  }
  ungroup() {
    const ids = [...new Set(this.editable.map(s => s.groupId).filter(Boolean))];
    if (!ids.length) return;
    this.change('Ungroup', () => {
      const seen = new Set();
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const group = this.app.doc.groups.find(g => g.id === id);
        const members = this.app.doc.getGroupMembers(id);
        members.forEach(s => { s.groupId = group?.previousGroups?.[s.id] || null; });
        this.app.doc.groups = this.app.doc.groups.filter(g => g.id !== id);
        // Older drawings may have identical wrappers from repeatedly grouping
        // one group. Remove those too, but retain genuine nested subgroups.
        const restoredId = members[0]?.groupId;
        if (restoredId && members.every(s => s.groupId === restoredId)) {
          const restoredMembers = this.app.doc.getGroupMembers(restoredId);
          if (restoredMembers.length === members.length) ids.push(restoredId);
        }
      }
    });
    // MacDraw keeps the resulting individual objects/subgroups selected.
  }
  lock(value) { if (this.selected.length) this.change(value ? 'Lock' : 'Unlock', () => this.selected.forEach(s => { s.locked = value; })); }
  rotate(direction) {
    if (!this.editable.length) return;
    this.change('Rotate', () => {
      const bounds = getMultiBounds(this.editable), center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, angle = direction * Math.PI / 2;
      this.editable.forEach(shape => {
        if (shape.points) { shape.points = shape.points.map(p => rotatePoint(p, center, angle)); Object.assign(shape, boundingBox(shape.points)); }
        else {
          const c = rotatePoint({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }, center, angle);
          if (shape.type === 'text') { shape.rotation = (shape.rotation || 0) + angle; shape.x = c.x - shape.width / 2; shape.y = c.y - shape.height / 2; }
          else {
            [shape.width, shape.height] = [shape.height, shape.width]; shape.x = c.x - shape.width / 2; shape.y = c.y - shape.height / 2;
            if (shape.type === 'arc') { shape.startAngle += angle; shape.endAngle += angle; }
          }
        }
      });
    });
  }
  flip(horizontal) {
    if (!this.editable.length) return;
    this.change('Flip', () => {
      const b = getMultiBounds(this.editable), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      this.editable.forEach(s => {
        if (s.points) { s.points = s.points.map(p => ({ x: horizontal ? 2 * cx - p.x : p.x, y: horizontal ? p.y : 2 * cy - p.y })); Object.assign(s, boundingBox(s.points)); }
        else { if (horizontal) s.x = 2 * cx - s.x - s.width; else s.y = 2 * cy - s.y - s.height; s[horizontal ? 'flipH' : 'flipV'] = !s[horizontal ? 'flipH' : 'flipV']; }
      });
    });
  }
  toggle(setting) { this.app.doc[setting] = !this.app.doc[setting]; this.app.doc._notify('layout'); }
  alignToGrid() {
    if (!this.editable.length) return;
    this.change('Align to Grid', () => {
      const d = this.app.doc, snap = (n, origin) => origin + Math.round((n - origin) / d.gridSize) * d.gridSize;
      for (const unit of this.editableUnits) {
        const s = unit[0];
        if (unit.length === 1 && !s.groupId && (s.type === 'polygon' || s.type === 'line')) {
          s.points = s.points.map(p => ({ x: snap(p.x, d.rulerOrigin.x), y: snap(p.y, d.rulerOrigin.y) })); Object.assign(s, boundingBox(s.points));
        } else if (unit.length === 1 && !s.groupId && ['rect','roundRect','oval','arc'].includes(s.type) && !s.rotation) {
          const right = snap(s.x + s.width, d.rulerOrigin.x), bottom = snap(s.y + s.height, d.rulerOrigin.y);
          s.x = snap(s.x, d.rulerOrigin.x); s.y = snap(s.y, d.rulerOrigin.y);
          s.width = Math.max(d.gridSize, right - s.x); s.height = Math.max(d.gridSize, bottom - s.y);
        } else {
          const b = getMultiBounds(unit);
          const step = unit.length === 1 && !s.groupId && s.type === 'text' ? d.gridSize / 2 : d.gridSize;
          const textSnap = (n, origin) => origin + Math.round((n - origin) / step) * step;
          const dx = textSnap(b.x, d.rulerOrigin.x) - b.x, dy = textSnap(b.y, d.rulerOrigin.y) - b.y;
          unit.forEach(member => translate(member, dx, dy));
        }
      }
    });
  }
  async alignDialog() {
    const result = await this.app.dialog.show({ title: 'Align Objects', fields: [
      { name: 'horizontal', label: 'Horizontal alignment', value: 'none', options: [{ value: 'none', label: 'No change' }, { value: 'left', label: 'Left sides' }, { value: 'center', label: 'L/R centers' }, { value: 'right', label: 'Right sides' }] },
      { name: 'vertical', label: 'Vertical alignment', value: 'none', options: [{ value: 'none', label: 'No change' }, { value: 'top', label: 'Tops' }, { value: 'middle', label: 'T/B centers' }, { value: 'bottom', label: 'Bottoms' }] },
    ] });
    if (!result) return;
    this.alignObjects(result.horizontal, result.vertical);
  }
  alignObjects(horizontal, vertical) {
    if (!this.editable.length || (horizontal === 'none' && vertical === 'none')) return;
    this.change('Align Objects', () => {
      const b = getMultiBounds(this.selected), d = this.app.doc;
      const snap = (value, origin) => d.snapToGrid ? origin + Math.round((value - origin) / d.gridSize) * d.gridSize : value;
      const targetX = snap(horizontal === 'left' ? b.x : horizontal === 'right' ? b.x + b.width : b.x + b.width / 2, d.rulerOrigin.x);
      const targetY = snap(vertical === 'top' ? b.y : vertical === 'bottom' ? b.y + b.height : b.y + b.height / 2, d.rulerOrigin.y);
      for (const unit of this.editableUnits) {
        const r = getMultiBounds(unit);
        const dx = horizontal === 'left' ? targetX - r.x : horizontal === 'right' ? targetX - r.x - r.width : horizontal === 'center' ? targetX - r.x - r.width / 2 : 0;
        const dy = vertical === 'top' ? targetY - r.y : vertical === 'bottom' ? targetY - r.y - r.height : vertical === 'middle' ? targetY - r.y - r.height / 2 : 0;
        unit.forEach(s => translate(s, dx, dy));
      }
    });
  }
  async rulersDialog() {
    const d = this.app.doc;
    const result = await this.app.dialog.show({ title: 'Custom Rulers', fields: [
      { name: 'unit', label: 'Ruler units', value: d.unit, options: [{ value: 'inches', label: 'Inches' }, { value: 'cm', label: 'Centimeters' }, { value: 'points', label: 'Points' }] },
      { name: 'major', label: 'Major division spacing', value: d.rulerMajor, type: 'number', min: 0.1, max: 100, step: 0.1 },
      { name: 'divisions', label: 'Minor divisions', value: d.rulerDivisions, options: [1,2,3,4,5,6,8,10,12,16,24,32] },
      { name: 'increment', label: 'Numbering increment', value: d.rulerIncrement, type: 'number', min: 1, max: 100, step: 1 },
      { name: 'originX', label: 'Zero point X (points)', value: d.rulerOrigin.x, type: 'number', min: -5000, max: 5000, step: 1 },
      { name: 'originY', label: 'Zero point Y (points)', value: d.rulerOrigin.y, type: 'number', min: -5000, max: 5000, step: 1 },
    ] });
    if (result) this.change('Custom Rulers', () => { d.unit = result.unit; d.rulerMajor = result.major; d.rulerDivisions = Number(result.divisions); d.rulerIncrement = result.increment; d.rulerOrigin = { x: result.originX, y: result.originY }; d.gridSize = (d.unit === 'cm' ? 72 / 2.54 : d.unit === 'points' ? 1 : 72) * d.rulerMajor / d.rulerDivisions; });
  }
  async pageDialog() {
    const d = this.app.doc;
    const paper = Object.entries(PAGE_SIZES).find(([, s]) => Math.abs(Math.min(d.pageWidth, d.pageHeight) - s.width) < 1 && Math.abs(Math.max(d.pageWidth, d.pageHeight) - s.height) < 1)?.[0] || 'LETTER';
    const result = await this.app.dialog.show({ title: 'Page Setup', fields: [
      { name: 'size', label: 'Paper', value: paper, options: Object.entries(PAGE_SIZES).map(([value, s]) => ({ value, label: s.label })) },
      { name: 'orientation', label: 'Orientation', value: this.app.doc.pageWidth > this.app.doc.pageHeight ? 'wide' : 'tall', options: [{ value: 'tall', label: 'Tall' }, { value: 'wide', label: 'Wide' }] },
    ] });
    if (result) {
      const size = PAGE_SIZES[result.size], width = result.orientation === 'wide' ? size.height : size.width, height = result.orientation === 'wide' ? size.width : size.height;
      const b = getMultiBounds(d.objects);
      if (b.x + b.width > width || b.y + b.height > height) return this.app.dialog.alert('Page Setup', 'Objects would fall outside the new page. Move them first, or use a larger drawing.');
      this.change('Page Setup', () => { d.pageWidth = width; d.pageHeight = height; });
    }
  }
  async sizeDialog() {
    const d = this.app.doc, perUnit = d.unit === 'cm' ? 72 / 2.54 : d.unit === 'points' ? 1 : 72;
    const result = await this.app.dialog.show({ title: 'Drawing Size', fields: [
      { name: 'width', label: `Width (${d.unit})`, value: +(d.pageWidth / perUnit).toFixed(2), type: 'number', min: 1, max: Math.floor(6912 / perUnit), step: 0.01 },
      { name: 'height', label: `Height (${d.unit})`, value: +(d.pageHeight / perUnit).toFixed(2), type: 'number', min: 1, max: Math.floor(3456 / perUnit), step: 0.01 },
    ] });
    if (result) {
      const bounds = getMultiBounds(d.objects);
      if (bounds.x + bounds.width > result.width * perUnit || bounds.y + bounds.height > result.height * perUnit) return this.app.dialog.alert('Drawing Size', 'The smaller drawing would leave objects outside its edges. Move the objects first.');
      this.change('Drawing Size', () => { d.pageWidth = result.width * perUnit; d.pageHeight = result.height * perUnit; });
    }
  }
  async cornersDialog() {
    const result = await this.app.dialog.show({ title: 'Round Corners', fields: [{ name: 'radius', label: 'Corner radius', value: this.selected[0]?.cornerRadius ?? this.app.doc._cornerRadius ?? 18, options: [ { value: 0, label: 'Square' }, { value: 9, label: '1/8 inch' }, { value: 13.5, label: '3/16 inch' }, { value: 18, label: '1/4 inch' }, { value: 22.5, label: '5/16 inch' }, { value: 27, label: '3/8 inch' } ] }] });
    if (result) this.change('Round Corners', () => { this.app.doc._cornerRadius = Number(result.radius); this.editable.filter(s => ['rect', 'roundRect'].includes(s.type)).forEach(s => { s.type = result.radius == 0 ? 'rect' : 'roundRect'; s.cornerRadius = Number(result.radius); }); });
  }
  async zoomDialog() {
    const result = await this.app.dialog.show({ title: 'Drawing Scale', fields: [{ name: 'zoom', label: 'Scale (%)', value: Math.round(this.app.zoom * 100), type: 'number', min: 12.5, max: 400, step: 0.5 }] });
    if (result) this.app.setZoom(result.zoom / 100);
  }
  smooth(value) { this.change(value ? 'Smooth' : 'Unsmooth', () => this.editable.filter(s => s.points && s.type !== 'line').forEach(s => { s.smooth = value; })); }
  async reshapeDialog() {
    const shape = this.editable.find(s => s.type === 'arc'); if (!shape) return;
    const result = await this.app.dialog.show({ title: 'Reshape Arc', fields: [
      { name: 'start', label: 'Start angle (degrees)', value: Math.round(shape.startAngle * 180 / Math.PI), type: 'number', min: -360, max: 360, step: 1 },
      { name: 'end', label: 'End angle (degrees)', value: Math.round(shape.endAngle * 180 / Math.PI), type: 'number', min: -360, max: 720, step: 1 },
      { name: 'kind', label: 'Arc shape', value: shape.arcType, options: [{ value: 'open', label: 'Open arc' }, { value: 'closed', label: 'Chord' }, { value: 'pie', label: 'Pie slice' }] },
    ] });
    if (result) this.change('Reshape Arc', () => { shape.startAngle = result.start * Math.PI / 180; shape.endAngle = result.end * Math.PI / 180; shape.arcType = result.kind; });
  }
  _cleanGroups() { this.app.doc.groups.forEach(g => { g.members = g.members.filter(id => this.app.doc.getObjectById(id)); }); this.app.doc.groups = this.app.doc.groups.filter(g => g.members.length); }
}
