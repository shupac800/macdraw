import { cloneShape } from './Shape.js';

const newGroupId = () => `paste_group_${crypto.randomUUID()}`;

export class Clipboard {
  constructor() {
    this._contents = [];
    this._groups = [];
  }

  get isEmpty() {
    return this._contents.length === 0;
  }

  copy(shapes, groups = []) {
    this._contents = shapes.map(s => JSON.parse(JSON.stringify(s)));
    const ids = new Set(shapes.map(s => s.id));
    this._groups = structuredClone(groups.filter(g => g.members.every(id => ids.has(id))));
  }

  /**
   * Returns { shapes, groups } where groups is an array of { id, members }
   * for any groups that need to be registered on the document.
   */
  paste() {
    const groupIdMap = Object.fromEntries(this._groups.map(g => [g.id, newGroupId()]));
    const clones = this._contents.map(s => {
      const clone = cloneShape(s);
      if (clone.groupId) {
        if (!groupIdMap[clone.groupId]) {
          groupIdMap[clone.groupId] = newGroupId();
        }
        clone.groupId = groupIdMap[clone.groupId];
      }
      return clone;
    });

    const shapeIds = Object.fromEntries(this._contents.map((s, i) => [s.id, clones[i].id]));
    const groups = Object.entries(groupIdMap).map(([oldId, newGroupId]) => {
      const original = this._groups.find(g => g.id === oldId);
      return {
        id: newGroupId,
        members: original ? original.members.map(id => shapeIds[id]) : clones.filter(s => s.groupId === newGroupId).map(s => s.id),
        ...(original?.previousGroups ? { previousGroups: Object.fromEntries(Object.entries(original.previousGroups).map(([shapeId, groupId]) => [shapeIds[shapeId], groupIdMap[groupId] || null])) } : {}),
      };
    });

    return { shapes: clones, groups };
  }

  clear() {
    this._contents = [];
    this._groups = [];
  }
}
