import { TOOLS } from '../util/constants.js';
import dimensions from '../../assets/bitmaps/macdraw-1.9-tools.json';
const DEFS = [
  [TOOLS.SELECT, 'Selection arrow', 'V'],
  [TOOLS.TEXT, 'Text', 'T'],
  [TOOLS.PERPENDICULAR, 'Perpendicular lines', 'H'],
  [TOOLS.LINE, 'Diagonal lines', 'L'],
  [TOOLS.RECT, 'Rectangle', 'R'],
  [TOOLS.ROUND_RECT, 'Round-corner rectangle', 'U'],
  [TOOLS.OVAL, 'Circle / oval', 'O'],
  [TOOLS.ARC, 'Arc', 'A'],
  [TOOLS.FREEHAND, 'Freehand shape', 'F'],
  [TOOLS.POLYGON, 'Polygon', 'P'],
];

export class Toolbar {
  constructor(container, manager) {
    container.className = 'toolbar'; container.setAttribute('role', 'toolbar'); container.setAttribute('aria-label', 'Drawing tools');
    this.buttons = new Map(); this.manager = manager;
    for (const [id, name, key] of DEFS) {
      const button = document.createElement('button'); button.className = 'toolbar-btn';
      button.title = `${name} (${key})`;
      button.setAttribute('aria-label', `${name} (${key})`); button.dataset.tool = id;
      // Paint the native cell together, avoiding filtered image layers.
      const canvas = document.createElement('canvas');
      canvas.width = 24; canvas.height = 16;
      canvas.setAttribute('aria-hidden', 'true'); button.append(canvas);
      button.addEventListener('click', () => { manager.chooseTool(id); this.update(); });
      button.addEventListener('dblclick', () => { manager.chooseTool(id, true); this.update(); });
      this.buttons.set(id, button); container.append(button);
    }
    const preview = document.getElementById('style-preview');
    if (preview) container.append(preview);
    manager.onChange(() => this.update());
  }
  update() {
    for (const [id, button] of this.buttons) {
      const active = id === this.manager.getActiveTool();
      button.classList.toggle('active', active); button.classList.toggle('locked', id === this.manager.lockedTool);
      button.setAttribute('aria-pressed', String(active));
      const ctx = button.firstElementChild.getContext('2d');
      ctx.fillStyle = active ? '#000' : '#fff'; ctx.fillRect(0, 0, 24, 16);
      ctx.fillStyle = active ? '#fff' : '#000';
      // QuickDraw places the ink after the font's left bearing, not directly
      // at the palette's four-pixel character origin.
      const glyph = dimensions[id], left = 4 + glyph.bearing + glyph.sourceCrop[0], top = 2 + glyph.sourceCrop[1];
      glyph.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '1') ctx.fillRect(left + x, top + y, 1, 1);
      });
    }
  }
}
