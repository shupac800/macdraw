import { cloneShape } from './Shape.js';

let nextPasteGroupId = 1;

export class Clipboard {
  constructor() {
    this._contents = [];
  }

  get isEmpty() {
    return this._contents.length === 0;
  }

  copy(shapes) {
    this._contents = shapes.map(s => JSON.parse(JSON.stringify(s)));
  }

  /**
   * Returns { shapes, groups } where groups is an array of { id, members }
   * for any groups that need to be registered on the document.
   */
  paste() {
    const groupIdMap = {};
    const clones = this._contents.map(s => {
      const clone = cloneShape(s);
      if (clone.groupId) {
        if (!groupIdMap[clone.groupId]) {
          groupIdMap[clone.groupId] = `paste_group_${nextPasteGroupId++}`;
        }
        clone.groupId = groupIdMap[clone.groupId];
      }
      return clone;
    });

    const groups = Object.values(groupIdMap).map(newGroupId => ({
      id: newGroupId,
      members: clones.filter(s => s.groupId === newGroupId).map(s => s.id),
    }));

    return { shapes: clones, groups };
  }

  clear() {
    this._contents = [];
  }
}
