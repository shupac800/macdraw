export class EditTextCommand {
  constructor(doc, shapeId, newText) {
    this.doc = doc;
    this.shapeId = shapeId;
    this.newText = newText;
    const shape = doc.getObjectById(shapeId);
    this.oldText = shape ? shape.text : '';
    this.label = 'Edit Text';
  }

  execute() {
    const shape = this.doc.getObjectById(this.shapeId);
    if (shape) {
      shape.text = this.newText;
      this.doc._notify('editText');
    }
  }

  undo() {
    const shape = this.doc.getObjectById(this.shapeId);
    if (shape) {
      shape.text = this.oldText;
      this.doc._notify('editText');
    }
  }
}
