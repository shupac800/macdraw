import { TOOLS } from '../util/constants.js';

const DEFS = [
  [TOOLS.SELECT, 'Selection arrow', 'V', '<path fill="currentColor" d="M4 2v17l4-5 4 7 3-2-4-7h7z"/>'],
  [TOOLS.TEXT, 'Text', 'T', '<path d="M4 4h14M11 4v15M7 19h8"/>'],
  [TOOLS.PERPENDICULAR, 'Perpendicular lines', 'H', '<path d="M11 3v16M3 11h16"/>'],
  [TOOLS.LINE, 'Diagonal lines', 'L', '<path d="M4 4l14 14"/>'],
  [TOOLS.RECT, 'Rectangle', 'R', '<rect x="3" y="5" width="16" height="12"/>'],
  [TOOLS.ROUND_RECT, 'Round-corner rectangle', 'U', '<rect x="3" y="5" width="16" height="12" rx="4"/>'],
  [TOOLS.OVAL, 'Circle / oval', 'O', '<ellipse cx="11" cy="11" rx="8" ry="6"/>'],
  [TOOLS.ARC, 'Arc', 'A', '<path d="M3 4a15 15 0 0 1 15 15"/>'],
  [TOOLS.FREEHAND, 'Freehand shape', 'F', '<path d="M3 17c15 5 12-15 6-13s1 14 10 13"/>'],
  [TOOLS.POLYGON, 'Polygon', 'P', '<path d="M3 5l7 5 9-6-4 14-11-3z"/>'],
];

export class Toolbar {
  constructor(container, manager) {
    container.className = 'toolbar'; container.setAttribute('role', 'toolbar'); container.setAttribute('aria-label', 'Drawing tools');
    this.buttons = new Map(); this.manager = manager;
    for (const [id, name, key, icon] of DEFS) {
      const button = document.createElement('button'); button.className = 'toolbar-btn';
      button.title = `${name} (${key}) — double-click to keep drawing`;
      button.setAttribute('aria-label', `${name} (${key})`); button.dataset.tool = id;
      button.innerHTML = `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${icon}</svg>`;
      button.addEventListener('click', () => { manager.chooseTool(id); this.update(); });
      button.addEventListener('dblclick', () => { manager.chooseTool(id, true); this.update(); });
      this.buttons.set(id, button); container.append(button);
    }
    manager.onChange(() => this.update());
  }
  update() {
    for (const [id, button] of this.buttons) {
      const active = id === this.manager.getActiveTool();
      button.classList.toggle('active', active); button.classList.toggle('locked', id === this.manager.lockedTool);
      button.setAttribute('aria-pressed', String(active));
    }
  }
}
