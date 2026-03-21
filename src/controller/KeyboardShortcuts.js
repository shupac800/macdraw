import { TOOLS, NUDGE_AMOUNT, NUDGE_LARGE_AMOUNT } from '../util/constants.js';
import { DeleteShapeCommand } from '../commands/DeleteShapeCommand.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { GroupCommand, UngroupCommand } from '../commands/GroupCommand.js';

export class KeyboardShortcuts {
  constructor(app) {
    this.app = app;
    this._handler = this._onKeyDown.bind(this);
    window.addEventListener('keydown', this._handler);
  }

  _onKeyDown(e) {
    // Don't intercept when typing in a textarea/input
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    const { doc, selection, commandStack, toolManager, clipboard } = this.app;
    const ctrl = e.ctrlKey || e.metaKey;

    // Undo/Redo
    if (ctrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      commandStack.undo();
      return;
    }
    if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      commandStack.redo();
      return;
    }

    // Delete
    if ((e.key === 'Delete' || e.key === 'Backspace') && !selection.isEmpty) {
      e.preventDefault();
      commandStack.execute(new DeleteShapeCommand(doc, selection.ids));
      selection.clear();
      return;
    }

    // Select All
    if (ctrl && e.key === 'a') {
      e.preventDefault();
      selection.selectMultiple(doc.objects.map(o => o.id));
      return;
    }

    // Copy/Cut/Paste
    if (ctrl && e.key === 'c' && !selection.isEmpty) {
      e.preventDefault();
      clipboard.copy(selection.getSelectedObjects(doc));
      return;
    }
    if (ctrl && e.key === 'x' && !selection.isEmpty) {
      e.preventDefault();
      clipboard.copy(selection.getSelectedObjects(doc));
      commandStack.execute(new DeleteShapeCommand(doc, selection.ids));
      selection.clear();
      return;
    }
    if (ctrl && e.key === 'v' && !clipboard.isEmpty) {
      e.preventDefault();
      const { shapes: pasted, groups } = clipboard.paste();
      // Offset pasted shapes slightly
      for (const shape of pasted) {
        shape.x += 10;
        shape.y += 10;
        if (shape.points) {
          shape.points = shape.points.map(p => ({ x: p.x + 10, y: p.y + 10 }));
        }
        doc.addObject(shape);
      }
      for (const group of groups) {
        doc.addGroup(group);
      }
      selection.selectMultiple(pasted.map(s => s.id));
      doc._notify('paste');
      return;
    }

    // Group / Ungroup
    if (ctrl && e.key === 'g' && !e.shiftKey && selection.count >= 2) {
      e.preventDefault();
      commandStack.execute(new GroupCommand(doc, selection.ids));
      return;
    }
    if (ctrl && e.key === 'g' && e.shiftKey && !selection.isEmpty) {
      e.preventDefault();
      const selected = selection.getSelectedObjects(doc);
      const groupIds = new Set(selected.map(s => s.groupId).filter(Boolean));
      for (const gid of groupIds) {
        commandStack.execute(new UngroupCommand(doc, gid));
      }
      return;
    }

    // Arrow keys for nudging
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !selection.isEmpty) {
      e.preventDefault();
      const amount = e.shiftKey ? NUDGE_LARGE_AMOUNT : NUDGE_AMOUNT;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = -amount;
      if (e.key === 'ArrowDown') dy = amount;
      if (e.key === 'ArrowLeft') dx = -amount;
      if (e.key === 'ArrowRight') dx = amount;
      commandStack.execute(new MoveCommand(doc, selection.ids, dx, dy));
      return;
    }

    // Tool shortcuts
    if (!ctrl) {
      switch (e.key.toLowerCase()) {
        case 'v': toolManager.setActiveTool(TOOLS.SELECT); break;
        case 'r': toolManager.setActiveTool(TOOLS.RECT); break;
        case 'u': toolManager.setActiveTool(TOOLS.ROUND_RECT); break;
        case 'o': toolManager.setActiveTool(TOOLS.OVAL); break;
        case 'l': toolManager.setActiveTool(TOOLS.LINE); break;
        case 'a': toolManager.setActiveTool(TOOLS.ARC); break;
        case 'p': toolManager.setActiveTool(TOOLS.POLYGON); break;
        case 'f': toolManager.setActiveTool(TOOLS.FREEHAND); break;
        case 't': toolManager.setActiveTool(TOOLS.TEXT); break;
        case 'escape':
          selection.clear();
          toolManager.setActiveTool(TOOLS.SELECT);
          break;
      }
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._handler);
  }
}
