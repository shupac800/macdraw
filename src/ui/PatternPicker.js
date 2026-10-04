import { PATTERN_NAMES } from '../util/patterns.js';

export class PatternPicker {
  constructor(app, registry) { this.app = app; this.registry = registry; }
  build(container, target, onChoose) {
    const grid = document.createElement('div'); grid.className = 'pattern-picker'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', `${target} patterns`);
    const current = this.app.currentStyle(target);
    for (let id = 0; id < this.registry.count; id++) {
      const button = document.createElement('button'); button.className = 'pattern-swatch';
      button.setAttribute('aria-label', `${target}: ${PATTERN_NAMES[id]}`); button.title = PATTERN_NAMES[id];
      const selected = current?.patternId === id || (current?.type === 'solid' && id === (current.color === '#000000' ? 0 : 1));
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
      const canvas = document.createElement('canvas'); canvas.width = 22; canvas.height = 18;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = ctx.createPattern(this.registry.getPatternCanvas(id), 'repeat'); ctx.fillRect(0, 0, 22, 18);
      button.append(canvas); button.addEventListener('click', () => { this.app.applyPattern(target, id); onChoose(); }); grid.append(button);
    }
    container.append(grid);
  }
}
