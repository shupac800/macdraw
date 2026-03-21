export class DeleteShapeCommand {
  constructor(doc, shapeIds) {
    this.doc = doc;
    this.shapeIds = [...shapeIds];
    this.removedShapes = [];
    this.removedIndices = [];
    this.label = 'Delete';
  }

  execute() {
    this.removedShapes = [];
    this.removedIndices = [];
    // Remove from end to preserve indices
    const sorted = this.shapeIds
      .map(id => ({ id, index: this.doc.getObjectIndex(id) }))
      .filter(e => e.index !== -1)
      .sort((a, b) => b.index - a.index);

    for (const { id, index } of sorted) {
      const shape = this.doc.removeObject(id);
      if (shape) {
        this.removedShapes.unshift(shape);
        this.removedIndices.unshift(index);
      }
    }
  }

  undo() {
    for (let i = 0; i < this.removedShapes.length; i++) {
      this.doc.insertObjectAt(this.removedShapes[i], this.removedIndices[i]);
    }
  }
}
