export class CommandStack {
  constructor() {
    this._undoStack = [];
    this._redoStack = [];
    this._listeners = [];
  }

  execute(command) {
    command.execute();
    this._undoStack.push(command);
    this._redoStack = [];
    this._notify();
  }

  undo() {
    if (this._undoStack.length === 0) return false;
    const command = this._undoStack.pop();
    command.undo();
    this._redoStack.push(command);
    this._notify();
    return true;
  }

  redo() {
    if (this._redoStack.length === 0) return false;
    const command = this._redoStack.pop();
    command.execute();
    this._undoStack.push(command);
    this._notify();
    return true;
  }

  get canUndo() {
    return this._undoStack.length > 0;
  }

  get canRedo() {
    return this._redoStack.length > 0;
  }

  get undoLabel() {
    if (this._undoStack.length === 0) return null;
    return this._undoStack[this._undoStack.length - 1].label || 'Undo';
  }

  get redoLabel() {
    if (this._redoStack.length === 0) return null;
    return this._redoStack[this._redoStack.length - 1].label || 'Redo';
  }

  clear() {
    this._undoStack = [];
    this._redoStack = [];
    this._notify();
  }

  onChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  _notify() {
    for (const listener of this._listeners) {
      listener();
    }
  }
}
