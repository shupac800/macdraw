import { describe, it, expect, beforeEach } from 'vitest';
import { Selection } from '../src/model/Selection.js';

describe('Selection', () => {
  let sel;

  beforeEach(() => {
    sel = new Selection();
  });

  it('starts empty', () => {
    expect(sel.isEmpty).toBe(true);
    expect(sel.count).toBe(0);
    expect(sel.ids).toEqual([]);
  });

  it('selects a single item', () => {
    sel.select('a');
    expect(sel.has('a')).toBe(true);
    expect(sel.count).toBe(1);
  });

  it('select replaces previous selection', () => {
    sel.select('a');
    sel.select('b');
    expect(sel.has('a')).toBe(false);
    expect(sel.has('b')).toBe(true);
    expect(sel.count).toBe(1);
  });

  it('selectMultiple selects several items', () => {
    sel.selectMultiple(['a', 'b', 'c']);
    expect(sel.count).toBe(3);
    expect(sel.has('a')).toBe(true);
    expect(sel.has('c')).toBe(true);
  });

  it('toggle adds and removes', () => {
    sel.toggle('a');
    expect(sel.has('a')).toBe(true);
    sel.toggle('a');
    expect(sel.has('a')).toBe(false);
  });

  it('add does not clear existing', () => {
    sel.select('a');
    sel.add('b');
    expect(sel.count).toBe(2);
  });

  it('deselect removes one item', () => {
    sel.selectMultiple(['a', 'b', 'c']);
    sel.deselect('b');
    expect(sel.count).toBe(2);
    expect(sel.has('b')).toBe(false);
  });

  it('clear empties selection', () => {
    sel.selectMultiple(['a', 'b']);
    sel.clear();
    expect(sel.isEmpty).toBe(true);
  });

  it('clear on empty does not notify', () => {
    let called = false;
    sel.onChange(() => { called = true; });
    sel.clear();
    expect(called).toBe(false);
  });

  it('notifies on change', () => {
    let lastIds = null;
    sel.onChange((ids) => { lastIds = ids; });
    sel.select('x');
    expect(lastIds).toEqual(['x']);
  });

  it('unsubscribe works', () => {
    let count = 0;
    const unsub = sel.onChange(() => count++);
    sel.select('a');
    expect(count).toBe(1);
    unsub();
    sel.select('b');
    expect(count).toBe(1);
  });

  it('getSelectedObjects retrieves from doc', () => {
    const mockDoc = {
      getObjectById: (id) => id === 'a' ? { id: 'a', type: 'rect' } : null,
    };
    sel.selectMultiple(['a', 'missing']);
    const result = sel.getSelectedObjects(mockDoc);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });
});
