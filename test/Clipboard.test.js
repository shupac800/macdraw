import { describe, it, expect, beforeEach } from 'vitest';
import { Clipboard } from '../src/model/Clipboard.js';
import { createShape, resetIdCounter } from '../src/model/Shape.js';

describe('Clipboard', () => {
  let clipboard;

  beforeEach(() => {
    resetIdCounter();
    clipboard = new Clipboard();
  });

  it('copy and paste clones shapes with new IDs', () => {
    const rect = createShape('rect', { x: 10, y: 20, width: 100, height: 50 });
    clipboard.copy([rect]);

    const { shapes } = clipboard.paste();
    expect(shapes).toHaveLength(1);
    expect(shapes[0].id).not.toBe(rect.id);
    expect(shapes[0].x).toBe(10);
    expect(shapes[0].width).toBe(100);
  });

  it('pasted group gets a new groupId distinct from the original', () => {
    const a = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    const b = createShape('rect', { x: 60, y: 0, width: 50, height: 50 });
    a.groupId = 'group_1';
    b.groupId = 'group_1';

    clipboard.copy([a, b]);
    const { shapes, groups } = clipboard.paste();

    // Both pasted shapes should share the same NEW groupId
    expect(shapes[0].groupId).toBe(shapes[1].groupId);
    // The new groupId must differ from the original
    expect(shapes[0].groupId).not.toBe('group_1');

    // A group entry should be returned for registration
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(shapes[0].groupId);
    expect(groups[0].members).toContain(shapes[0].id);
    expect(groups[0].members).toContain(shapes[1].id);
  });

  it('multiple pastes produce distinct groupIds each time', () => {
    const a = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    a.groupId = 'group_1';

    clipboard.copy([a]);
    const { shapes: first } = clipboard.paste();
    const { shapes: second } = clipboard.paste();

    expect(first[0].groupId).not.toBe(second[0].groupId);
  });

  it('ungrouped shapes paste with null groupId and no groups', () => {
    const a = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    clipboard.copy([a]);

    const { shapes, groups } = clipboard.paste();
    expect(shapes[0].groupId).toBeNull();
    expect(groups).toHaveLength(0);
  });

  it('mixed grouped and ungrouped shapes paste correctly', () => {
    const a = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    const b = createShape('rect', { x: 60, y: 0, width: 50, height: 50 });
    const c = createShape('rect', { x: 120, y: 0, width: 50, height: 50 });
    a.groupId = 'group_1';
    b.groupId = 'group_1';
    // c is ungrouped

    clipboard.copy([a, b, c]);
    const { shapes, groups } = clipboard.paste();

    expect(shapes[0].groupId).toBe(shapes[1].groupId);
    expect(shapes[0].groupId).not.toBe('group_1');
    expect(shapes[2].groupId).toBeNull();
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });
});
