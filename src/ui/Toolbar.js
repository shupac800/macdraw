import { TOOLS } from '../util/constants.js';

const TOOL_DEFS = [
  { id: TOOLS.SELECT, label: 'Select', shortcut: 'V', icon: 'cursor' },
  { id: TOOLS.LINE, label: 'Line', shortcut: 'L', icon: 'line' },
  { id: TOOLS.RECT, label: 'Rectangle', shortcut: 'R', icon: 'rect' },
  { id: TOOLS.ROUND_RECT, label: 'Rounded Rect', shortcut: 'U', icon: 'roundRect' },
  { id: TOOLS.OVAL, label: 'Oval', shortcut: 'O', icon: 'oval' },
  { id: TOOLS.ARC, label: 'Arc', shortcut: 'A', icon: 'arc' },
  { id: TOOLS.POLYGON, label: 'Polygon', shortcut: 'P', icon: 'polygon' },
  { id: TOOLS.FREEHAND, label: 'Freehand', shortcut: 'F', icon: 'freehand' },
  { id: TOOLS.TEXT, label: 'Text', shortcut: 'T', icon: 'text' },
];

const ICONS = {
  cursor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 10-6 1-3 6z"/></svg>`,
  line: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/></svg>`,
  rect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="14"/></svg>`,
  roundRect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="4"/></svg>`,
  oval: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="8" ry="6"/></svg>`,
  arc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20 A16 16 0 0 1 20 4"/></svg>`,
  polygon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,3 21,10 18,21 6,21 3,10"/></svg>`,
  freehand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18c2-4 4-2 6-6s2-6 4-6 2 4 4 2 2-4 2-4"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h12M12 4v16M8 20h8"/></svg>`,
};

export class Toolbar {
  constructor(container, toolManager) {
    this.container = container;
    this.toolManager = toolManager;
    this._buttons = {};
    this._build();

    toolManager.onChange((toolName) => this._updateActive(toolName));
  }

  _build() {
    this.container.innerHTML = '';
    this.container.className = 'toolbar';

    for (const tool of TOOL_DEFS) {
      const btn = document.createElement('button');
      btn.className = 'toolbar-btn';
      btn.title = `${tool.label} (${tool.shortcut})`;
      btn.innerHTML = ICONS[tool.icon] || tool.label[0];
      btn.dataset.tool = tool.id;

      btn.addEventListener('click', () => {
        this.toolManager.setActiveTool(tool.id);
      });

      this._buttons[tool.id] = btn;
      this.container.appendChild(btn);
    }
  }

  _updateActive(toolName) {
    for (const [id, btn] of Object.entries(this._buttons)) {
      btn.classList.toggle('active', id === toolName);
    }
  }
}
