export class EditTextCommand {
  constructor(doc, shapeId, newText, dimensions = null) {
    this.doc = doc;
    this.shapeId = shapeId;
    this.newText = newText;
    const shape = doc.getObjectById(shapeId);
    this.oldText = shape ? shape.text : '';
    this.oldDimensions = shape ? { width: shape.width, height: shape.height } : null;
    this.newDimensions = dimensions ? { ...dimensions } : null;
    this.label = 'Edit Text';
  }

  execute() {
    const shape = this.doc.getObjectById(this.shapeId);
    if (shape) {
      shape.text = this.newText;
      if (this.newDimensions) Object.assign(shape, this.newDimensions);
      this.doc._notify('editText');
    }
  }

  undo() {
    const shape = this.doc.getObjectById(this.shapeId);
    if (shape) {
      shape.text = this.oldText;
      if (this.newDimensions && this.oldDimensions) Object.assign(shape, this.oldDimensions);
      this.doc._notify('editText');
    }
  }
}
