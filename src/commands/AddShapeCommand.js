export class AddShapeCommand {
  constructor(doc, shape) {
    this.doc = doc;
    this.shape = shape;
    this.label = 'Add Shape';
  }

  execute() {
    this.doc.addObject(this.shape);
  }

  undo() {
    this.doc.removeObject(this.shape.id);
  }
}
