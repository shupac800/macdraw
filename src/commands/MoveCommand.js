export class MoveCommand {
  constructor(doc, shapeIds, dx, dy) {
    this.doc = doc;
    this.shapeIds = [...shapeIds];
    this.dx = dx;
    this.dy = dy;
    this.label = 'Move';
  }

  execute() {
    for (const id of this.shapeIds) {
      const shape = this.doc.getObjectById(id);
      if (!shape) continue;

      if (shape.type === 'line' || shape.type === 'polygon' || shape.type === 'freehand') {
        if (shape.points) {
          shape.points = shape.points.map(p => ({ x: p.x + this.dx, y: p.y + this.dy }));
        }
      }
      shape.x += this.dx;
      shape.y += this.dy;
    }
    this.doc._notify('move');
  }

  undo() {
    for (const id of this.shapeIds) {
      const shape = this.doc.getObjectById(id);
      if (!shape) continue;

      if (shape.type === 'line' || shape.type === 'polygon' || shape.type === 'freehand') {
        if (shape.points) {
          shape.points = shape.points.map(p => ({ x: p.x - this.dx, y: p.y - this.dy }));
        }
      }
      shape.x -= this.dx;
      shape.y -= this.dy;
    }
    this.doc._notify('move');
  }
}
