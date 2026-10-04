export class AddShapeCommand {
  constructor(doc, shape) {
    this.doc = doc;
    this.shape = shape;
    this.initial = structuredClone(shape);
    this.executed = false;
    this.label = 'Add Shape';
  }

  execute() {
    if (this.executed) Object.assign(this.shape, structuredClone(this.initial));
    this.doc.addObject(this.shape);
    this.executed = true;
  }

  undo() {
    this.doc.removeObject(this.shape.id);
  }
}
