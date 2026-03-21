export class ArrangeCommand {
  constructor(doc, shapeId, direction) {
    this.doc = doc;
    this.shapeId = shapeId;
    this.direction = direction; // 'front', 'back', 'forward', 'backward'
    this.oldIndex = doc.getObjectIndex(shapeId);
    this.label = `Bring ${direction}`;
  }

  execute() {
    switch (this.direction) {
      case 'front': this.doc.moveToFront(this.shapeId); break;
      case 'back': this.doc.moveToBack(this.shapeId); break;
      case 'forward': this.doc.moveForward(this.shapeId); break;
      case 'backward': this.doc.moveBackward(this.shapeId); break;
    }
  }

  undo() {
    // Remove and reinsert at original index
    const shape = this.doc.removeObject(this.shapeId);
    if (shape) {
      this.doc.insertObjectAt(shape, this.oldIndex);
    }
  }
}
