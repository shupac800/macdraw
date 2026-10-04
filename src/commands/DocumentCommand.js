// An atomic edit for operations affecting several objects, groups, or settings.
// The snapshot is taken on first execution; redo never repeats the mutation.
export class DocumentCommand {
  constructor(doc, label, mutate) {
    this.doc = doc;
    this.label = label;
    this.mutate = mutate;
    this.before = structuredClone(doc.toJSON());
    this.after = null;
  }
  execute() {
    if (this.after) this._restore(this.after);
    else {
      this.mutate();
      this.after = structuredClone(this.doc.toJSON());
      this.doc._notify('change');
    }
  }
  undo() { this._restore(this.before); }
  _restore(data) {
    Object.assign(this.doc, structuredClone(data));
    this.doc._notify('change');
  }
}
