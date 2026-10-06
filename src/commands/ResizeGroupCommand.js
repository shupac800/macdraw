/**
 * Snapshot-based resize/rotate command for one or more shapes.
 * Stores complete before/after geometry snapshots so undo/redo is exact.
 */
export class ResizeGroupCommand {
  constructor(doc, oldSnapshots, newSnapshots) {
    this.doc = doc;
    this.oldSnapshots = oldSnapshots.map(s => ({ ...s, points: s.points ? s.points.map(p => ({ ...p })) : null }));
    this.newSnapshots = newSnapshots.map(s => ({ ...s, points: s.points ? s.points.map(p => ({ ...p })) : null }));
    this.label = 'Resize';
  }

  execute() {
    this._apply(this.newSnapshots);
  }

  undo() {
    this._apply(this.oldSnapshots);
  }

  _apply(snapshots) {
    for (const snap of snapshots) {
      const shape = this.doc.getObjectById(snap.id);
      if (!shape) continue;
      shape.x = snap.x;
      shape.y = snap.y;
      shape.width = snap.width;
      shape.height = snap.height;
      shape.rotation = snap.rotation;
      if ('flipH' in snap) shape.flipH = snap.flipH;
      if ('flipV' in snap) shape.flipV = snap.flipV;
      if (snap.points) {
        shape.points = snap.points.map(p => ({ ...p }));
      }
    }
    this.doc._notify('resize');
  }
}
