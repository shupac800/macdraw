export class TransformCommand {
  constructor(doc, shapeIds, property, newValue) {
    this.doc = doc;
    this.shapeIds = [...shapeIds];
    this.property = property; // 'rotation', 'flipH', 'flipV'
    this.newValue = newValue;
    this.oldValues = {};
    this.label = 'Transform';

    for (const id of this.shapeIds) {
      const shape = doc.getObjectById(id);
      if (shape) {
        this.oldValues[id] = shape[property];
      }
    }
  }

  execute() {
    for (const id of this.shapeIds) {
      const shape = this.doc.getObjectById(id);
      if (shape) {
        if (this.property === 'rotation' && typeof this.newValue === 'function') {
          shape.rotation = this.newValue(shape.rotation);
        } else {
          shape[this.property] = this.newValue;
        }
      }
    }
    this.doc._notify('transform');
  }

  undo() {
    for (const id of this.shapeIds) {
      const shape = this.doc.getObjectById(id);
      if (shape && this.oldValues[id] !== undefined) {
        shape[this.property] = this.oldValues[id];
      }
    }
    this.doc._notify('transform');
  }
}
