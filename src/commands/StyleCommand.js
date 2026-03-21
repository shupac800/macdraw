export class StyleCommand {
  constructor(doc, shapeIds, property, newValue) {
    this.doc = doc;
    this.shapeIds = [...shapeIds];
    this.property = property;
    this.newValue = newValue;
    this.oldValues = {};
    this.label = 'Style Change';

    // Save old values
    for (const id of this.shapeIds) {
      const shape = doc.getObjectById(id);
      if (shape) {
        this.oldValues[id] = this._getValue(shape);
      }
    }
  }

  execute() {
    for (const id of this.shapeIds) {
      const shape = this.doc.getObjectById(id);
      if (shape) {
        this._setValue(shape, this.newValue);
      }
    }
    this.doc._notify('style');
  }

  undo() {
    for (const id of this.shapeIds) {
      const shape = this.doc.getObjectById(id);
      if (shape && this.oldValues[id] !== undefined) {
        this._setValue(shape, this.oldValues[id]);
      }
    }
    this.doc._notify('style');
  }

  _getValue(shape) {
    const parts = this.property.split('.');
    let val = shape;
    for (const part of parts) {
      val = val?.[part];
    }
    return typeof val === 'object' ? JSON.parse(JSON.stringify(val)) : val;
  }

  _setValue(shape, value) {
    const parts = this.property.split('.');
    let target = shape;
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
  }
}
