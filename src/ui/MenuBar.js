import { DeleteShapeCommand } from '../commands/DeleteShapeCommand.js';
import { ArrangeCommand } from '../commands/ArrangeCommand.js';
import { GroupCommand, UngroupCommand } from '../commands/GroupCommand.js';
import { TransformCommand } from '../commands/TransformCommand.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { getBounds } from '../model/Shape.js';
import { saveToLocalStorage, clearLocalStorage, downloadSVG, openSVGFile, exportToPDF } from '../util/serialize.js';

export class MenuBar {
  constructor(container, app) {
    this.container = container;
    this.app = app;
    this._openMenu = null;
    this._build();

    // Close menus on outside click
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this._closeAll();
      }
    });
  }

  _build() {
    this.container.innerHTML = '';
    this.container.className = 'menubar';

    const menus = this._getMenuDefs();
    for (const menu of menus) {
      const menuEl = this._createMenu(menu);
      this.container.appendChild(menuEl);
    }
  }

  _getMenuDefs() {
    return [
      {
        label: 'File', items: [
          { label: 'New', action: () => this._fileNew(), shortcut: 'Ctrl+N' },
          { type: 'separator' },
          { label: 'Open SVG…', action: () => this._fileOpen(), shortcut: 'Ctrl+O' },
          { label: 'Save SVG…', action: () => this._fileSave(), shortcut: 'Ctrl+S' },
          { type: 'separator' },
          { label: 'Export PDF…', action: () => this._exportPDF() },
        ]
      },
      {
        label: 'Edit', items: [
          { label: 'Undo', action: () => this.app.commandStack.undo(), shortcut: 'Ctrl+Z', enabled: () => this.app.commandStack.canUndo },
          { label: 'Redo', action: () => this.app.commandStack.redo(), shortcut: 'Ctrl+Y', enabled: () => this.app.commandStack.canRedo },
          { type: 'separator' },
          { label: 'Cut', action: () => this._cut(), shortcut: 'Ctrl+X', enabled: () => !this.app.selection.isEmpty },
          { label: 'Copy', action: () => this._copy(), shortcut: 'Ctrl+C', enabled: () => !this.app.selection.isEmpty },
          { label: 'Paste', action: () => this._paste(), shortcut: 'Ctrl+V', enabled: () => !this.app.clipboard.isEmpty },
          { type: 'separator' },
          { label: 'Delete', action: () => this._delete(), shortcut: 'Del', enabled: () => !this.app.selection.isEmpty },
          { label: 'Select All', action: () => this._selectAll(), shortcut: 'Ctrl+A' },
        ]
      },
      {
        label: 'Arrange', items: [
          { label: 'Bring to Front', action: () => this._arrange('front'), enabled: () => this.app.selection.count === 1 },
          { label: 'Bring Forward', action: () => this._arrange('forward'), enabled: () => this.app.selection.count === 1 },
          { label: 'Send Backward', action: () => this._arrange('backward'), enabled: () => this.app.selection.count === 1 },
          { label: 'Send to Back', action: () => this._arrange('back'), enabled: () => this.app.selection.count === 1 },
          { type: 'separator' },
          { label: 'Group', action: () => this._group(), shortcut: 'Ctrl+G', enabled: () => this.app.selection.count >= 2 },
          { label: 'Ungroup', action: () => this._ungroup(), shortcut: 'Ctrl+Shift+G', enabled: () => this._hasGroupSelected() },
          { type: 'separator' },
          { label: 'Flip Horizontal', action: () => this._flip('flipH'), enabled: () => !this.app.selection.isEmpty },
          { label: 'Flip Vertical', action: () => this._flip('flipV'), enabled: () => !this.app.selection.isEmpty },
          { type: 'separator' },
          { label: 'Align Left', action: () => this._align('left'), enabled: () => this.app.selection.count >= 2 },
          { label: 'Align Center', action: () => this._align('center'), enabled: () => this.app.selection.count >= 2 },
          { label: 'Align Right', action: () => this._align('right'), enabled: () => this.app.selection.count >= 2 },
          { label: 'Align Top', action: () => this._align('top'), enabled: () => this.app.selection.count >= 2 },
          { label: 'Align Middle', action: () => this._align('middle'), enabled: () => this.app.selection.count >= 2 },
          { label: 'Align Bottom', action: () => this._align('bottom'), enabled: () => this.app.selection.count >= 2 },
        ]
      },
      {
        label: 'View', items: [
          { label: 'Toggle Grid', action: () => this._toggleGrid() },
          { label: 'Toggle Snap to Grid', action: () => this._toggleSnap() },
        ]
      },
    ];
  }

  _createMenu(menu) {
    const wrapper = document.createElement('div');
    wrapper.className = 'menu-wrapper';

    const trigger = document.createElement('button');
    trigger.className = 'menu-trigger';
    trigger.textContent = menu.label;
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleMenu(wrapper, menu);
    });

    wrapper.appendChild(trigger);
    return wrapper;
  }

  _toggleMenu(wrapper, menu) {
    if (this._openMenu === wrapper) {
      this._closeAll();
      return;
    }
    this._closeAll();
    this._openMenu = wrapper;
    wrapper.classList.add('open');

    const dropdown = document.createElement('div');
    dropdown.className = 'menu-dropdown';

    for (const item of menu.items) {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'menu-separator';
        dropdown.appendChild(sep);
        continue;
      }

      const el = document.createElement('button');
      el.className = 'menu-item';
      const enabled = item.enabled ? item.enabled() : true;
      el.disabled = !enabled;

      const label = document.createElement('span');
      label.textContent = item.label;
      el.appendChild(label);

      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.className = 'menu-shortcut';
        shortcut.textContent = item.shortcut;
        el.appendChild(shortcut);
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closeAll();
        item.action();
      });

      dropdown.appendChild(el);
    }

    wrapper.appendChild(dropdown);
  }

  _closeAll() {
    if (this._openMenu) {
      this._openMenu.classList.remove('open');
      const dropdown = this._openMenu.querySelector('.menu-dropdown');
      if (dropdown) dropdown.remove();
      this._openMenu = null;
    }
  }

  // File actions
  _fileNew() {
    if (confirm('Create a new document? Unsaved changes will be lost.')) {
      this.app.doc.clear();
      this.app.selection.clear();
      this.app.commandStack.clear();
      clearLocalStorage();
    }
  }

  async _fileOpen() {
    try {
      const doc = await openSVGFile();
      if (doc) {
        this.app.loadDocument(doc);
      }
    } catch (e) {
      alert('Failed to open file: ' + e.message);
    }
  }

  _fileSave() {
    downloadSVG(this.app.doc, this.app.patternRegistry);
  }

  _exportPDF() {
    exportToPDF(this.app.doc, this.app.patternRegistry);
  }

  // Edit actions
  _cut() {
    this.app.clipboard.copy(this.app.selection.getSelectedObjects(this.app.doc));
    this.app.commandStack.execute(new DeleteShapeCommand(this.app.doc, this.app.selection.ids));
    this.app.selection.clear();
  }

  _copy() {
    this.app.clipboard.copy(this.app.selection.getSelectedObjects(this.app.doc));
  }

  _paste() {
    const { shapes: pasted, groups } = this.app.clipboard.paste();
    for (const shape of pasted) {
      shape.x += 10; shape.y += 10;
      if (shape.points) shape.points = shape.points.map(p => ({ x: p.x + 10, y: p.y + 10 }));
      this.app.doc.addObject(shape);
    }
    for (const group of groups) {
      this.app.doc.addGroup(group);
    }
    this.app.selection.selectMultiple(pasted.map(s => s.id));
  }

  _delete() {
    this.app.commandStack.execute(new DeleteShapeCommand(this.app.doc, this.app.selection.ids));
    this.app.selection.clear();
  }

  _selectAll() {
    this.app.selection.selectMultiple(this.app.doc.objects.map(o => o.id));
  }

  // Arrange actions
  _arrange(dir) {
    const id = this.app.selection.ids[0];
    this.app.commandStack.execute(new ArrangeCommand(this.app.doc, id, dir));
  }

  _group() {
    this.app.commandStack.execute(new GroupCommand(this.app.doc, this.app.selection.ids));
  }

  _ungroup() {
    const selected = this.app.selection.getSelectedObjects(this.app.doc);
    const groupIds = new Set(selected.map(s => s.groupId).filter(Boolean));
    for (const gid of groupIds) {
      this.app.commandStack.execute(new UngroupCommand(this.app.doc, gid));
    }
  }

  _hasGroupSelected() {
    const selected = this.app.selection.getSelectedObjects(this.app.doc);
    return selected.some(s => s.groupId);
  }

  _flip(prop) {
    for (const id of this.app.selection.ids) {
      const shape = this.app.doc.getObjectById(id);
      if (shape) {
        this.app.commandStack.execute(
          new TransformCommand(this.app.doc, [id], prop, !shape[prop])
        );
      }
    }
  }

  _align(direction) {
    const shapes = this.app.selection.getSelectedObjects(this.app.doc);
    if (shapes.length < 2) return;

    const allBounds = shapes.map(s => ({ id: s.id, bounds: getBounds(s) }));

    // Compute reference
    let ref;
    switch (direction) {
      case 'left': ref = Math.min(...allBounds.map(b => b.bounds.x)); break;
      case 'center': {
        const left = Math.min(...allBounds.map(b => b.bounds.x));
        const right = Math.max(...allBounds.map(b => b.bounds.x + b.bounds.width));
        ref = (left + right) / 2;
        break;
      }
      case 'right': ref = Math.max(...allBounds.map(b => b.bounds.x + b.bounds.width)); break;
      case 'top': ref = Math.min(...allBounds.map(b => b.bounds.y)); break;
      case 'middle': {
        const top = Math.min(...allBounds.map(b => b.bounds.y));
        const bottom = Math.max(...allBounds.map(b => b.bounds.y + b.bounds.height));
        ref = (top + bottom) / 2;
        break;
      }
      case 'bottom': ref = Math.max(...allBounds.map(b => b.bounds.y + b.bounds.height)); break;
    }

    for (const { id, bounds } of allBounds) {
      let dx = 0, dy = 0;
      switch (direction) {
        case 'left': dx = ref - bounds.x; break;
        case 'center': dx = ref - (bounds.x + bounds.width / 2); break;
        case 'right': dx = ref - (bounds.x + bounds.width); break;
        case 'top': dy = ref - bounds.y; break;
        case 'middle': dy = ref - (bounds.y + bounds.height / 2); break;
        case 'bottom': dy = ref - (bounds.y + bounds.height); break;
      }
      if (dx !== 0 || dy !== 0) {
        this.app.commandStack.execute(new MoveCommand(this.app.doc, [id], dx, dy));
      }
    }
  }

  _toggleGrid() {
    this.app.doc.snapToGrid = !this.app.doc.snapToGrid;
    this.app.doc._notify('grid');
  }

  _toggleSnap() {
    this.app.doc.snapToGrid = !this.app.doc.snapToGrid;
    this.app.doc._notify('snap');
  }
}
