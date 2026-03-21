let nextGroupId = 1;

export class GroupCommand {
  constructor(doc, shapeIds) {
    this.doc = doc;
    this.shapeIds = [...shapeIds];
    this.groupId = `group_${nextGroupId++}`;
    this.previousGroupIds = {};
    this.label = 'Group';

    for (const id of this.shapeIds) {
      const shape = doc.getObjectById(id);
      if (shape) {
        this.previousGroupIds[id] = shape.groupId;
      }
    }
  }

  execute() {
    for (const id of this.shapeIds) {
      const shape = this.doc.getObjectById(id);
      if (shape) shape.groupId = this.groupId;
    }
    this.doc.addGroup({ id: this.groupId, members: this.shapeIds });
    this.doc._notify('group');
  }

  undo() {
    for (const id of this.shapeIds) {
      const shape = this.doc.getObjectById(id);
      if (shape) shape.groupId = this.previousGroupIds[id] || null;
    }
    this.doc.removeGroup(this.groupId);
    this.doc._notify('ungroup');
  }
}

export class UngroupCommand {
  constructor(doc, groupId) {
    this.doc = doc;
    this.groupId = groupId;
    this.memberIds = doc.getGroupMembers(groupId).map(m => m.id);
    this.group = doc.groups.find(g => g.id === groupId);
    this.label = 'Ungroup';
  }

  execute() {
    for (const id of this.memberIds) {
      const shape = this.doc.getObjectById(id);
      if (shape) shape.groupId = null;
    }
    this.doc.removeGroup(this.groupId);
    this.doc._notify('ungroup');
  }

  undo() {
    for (const id of this.memberIds) {
      const shape = this.doc.getObjectById(id);
      if (shape) shape.groupId = this.groupId;
    }
    if (this.group) {
      this.doc.addGroup({ ...this.group });
    }
    this.doc._notify('group');
  }
}
