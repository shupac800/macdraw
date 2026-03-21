import { StyleCommand } from '../commands/StyleCommand.js';

export class PatternPicker {
  constructor(app, patternRegistry) {
    this.app = app;
    this.patternRegistry = patternRegistry;
    this.element = document.createElement('div');
    this.element.className = 'pattern-picker';
    this._build();
  }

  _build() {
    this.element.innerHTML = '';
    const count = this.patternRegistry.count;

    for (let i = 0; i < count; i++) {
      const swatch = document.createElement('canvas');
      swatch.width = 24;
      swatch.height = 24;
      swatch.className = 'pattern-swatch';
      swatch.title = `Pattern ${i}`;

      const ctx = swatch.getContext('2d');
      const patternCanvas = this.patternRegistry.getPatternCanvas(i);
      if (patternCanvas) {
        const pattern = ctx.createPattern(patternCanvas, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, 24, 24);
      }

      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 23, 23);

      swatch.addEventListener('click', () => {
        if (this.app.selection.isEmpty) return;
        // Set fill to pattern
        this.app.commandStack.execute(
          new StyleCommand(this.app.doc, this.app.selection.ids, 'fill', {
            type: 'pattern',
            color: '#000000',
            patternId: i,
          })
        );
      });

      this.element.appendChild(swatch);
    }
  }
}
