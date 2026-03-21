import { describe, it, expect, beforeEach } from 'vitest';
import { CommandStack } from '../src/commands/CommandStack.js';

describe('CommandStack', () => {
  let stack;

  beforeEach(() => {
    stack = new CommandStack();
  });

  function mockCommand(label = 'test') {
    return {
      label,
      executed: false,
      undone: false,
      execute() { this.executed = true; this.undone = false; },
      undo() { this.undone = true; this.executed = false; },
    };
  }

  it('starts empty', () => {
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it('executes a command', () => {
    const cmd = mockCommand();
    stack.execute(cmd);
    expect(cmd.executed).toBe(true);
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it('undoes a command', () => {
    const cmd = mockCommand();
    stack.execute(cmd);
    const result = stack.undo();
    expect(result).toBe(true);
    expect(cmd.undone).toBe(true);
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(true);
  });

  it('redo re-executes', () => {
    const cmd = mockCommand();
    stack.execute(cmd);
    stack.undo();
    const result = stack.redo();
    expect(result).toBe(true);
    expect(cmd.executed).toBe(true);
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it('undo returns false when empty', () => {
    expect(stack.undo()).toBe(false);
  });

  it('redo returns false when empty', () => {
    expect(stack.redo()).toBe(false);
  });

  it('new command clears redo stack', () => {
    stack.execute(mockCommand('a'));
    stack.undo();
    expect(stack.canRedo).toBe(true);
    stack.execute(mockCommand('b'));
    expect(stack.canRedo).toBe(false);
  });

  it('undoLabel and redoLabel', () => {
    expect(stack.undoLabel).toBeNull();
    expect(stack.redoLabel).toBeNull();

    stack.execute(mockCommand('Move'));
    expect(stack.undoLabel).toBe('Move');

    stack.undo();
    expect(stack.redoLabel).toBe('Move');
  });

  it('clear resets stacks', () => {
    stack.execute(mockCommand());
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it('notifies on changes', () => {
    let count = 0;
    stack.onChange(() => count++);
    stack.execute(mockCommand());
    stack.undo();
    stack.redo();
    expect(count).toBe(3);
  });

  it('multiple undo/redo', () => {
    const a = mockCommand('a');
    const b = mockCommand('b');
    const c = mockCommand('c');
    stack.execute(a);
    stack.execute(b);
    stack.execute(c);

    stack.undo(); // undo c
    stack.undo(); // undo b
    expect(stack.undoLabel).toBe('a');
    expect(stack.redoLabel).toBe('b');

    stack.redo(); // redo b
    expect(stack.undoLabel).toBe('b');
  });
});
