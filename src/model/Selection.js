export class Selection {
  constructor() {
    this._selectedIds = new Set();
    this._listeners = [];
  }

  get ids() {
    return [...this._selectedIds];
  }

  get count() {
    return this._selectedIds.size;
  }

  get isEmpty() {
    return this._selectedIds.size === 0;
  }

  has(id) {
    return this._selectedIds.has(id);
  }

  select(id) {
    this._selectedIds.clear();
    this._selectedIds.add(id);
    this._notify();
  }

  selectMultiple(ids) {
    this._selectedIds.clear();
    for (const id of ids) {
      this._selectedIds.add(id);
    }
    this._notify();
  }

  toggle(id) {
    if (this._selectedIds.has(id)) {
      this._selectedIds.delete(id);
    } else {
      this._selectedIds.add(id);
    }
    this._notify();
  }

  add(id) {
    this._selectedIds.add(id);
    this._notify();
  }

  deselect(id) {
    this._selectedIds.delete(id);
    this._notify();
  }

  clear() {
    if (this._selectedIds.size > 0) {
      this._selectedIds.clear();
      this._notify();
    }
  }

  getSelectedObjects(doc) {
    return this.ids
      .map(id => doc.getObjectById(id))
      .filter(Boolean);
  }

  onChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  _notify() {
    for (const listener of this._listeners) {
      listener(this.ids);
    }
  }
}
