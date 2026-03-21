import { StyleCommand } from '../commands/StyleCommand.js';

export class PropertyPanel {
  constructor(container, app) {
    this.container = container;
    this.app = app;
    this._build();

    app.selection.onChange(() => this._update());
    app.doc.onChange(() => this._update());
  }

  _build() {
    this.container.innerHTML = '';
    this.container.className = 'property-panel';

    // Stroke section
    const strokeSection = this._createSection('Stroke');

    this._strokeColorInput = this._createColorInput('Color', '#000000', (val) => {
      this._applyStyle('stroke.color', val);
    });
    strokeSection.appendChild(this._strokeColorInput.wrapper);

    this._strokeWidthInput = this._createNumberInput('Width', 1, 0, 50, 0.5, (val) => {
      this._applyStyle('stroke.width', val);
    });
    strokeSection.appendChild(this._strokeWidthInput.wrapper);

    this._dashSelect = this._createSelect('Dash', [
      { value: '', label: 'Solid' },
      { value: '4,4', label: 'Dashed' },
      { value: '2,2', label: 'Dotted' },
      { value: '8,4,2,4', label: 'Dash-Dot' },
    ], (val) => {
      const dash = val ? val.split(',').map(Number) : [];
      this._applyStyle('stroke.dash', dash);
    });
    strokeSection.appendChild(this._dashSelect.wrapper);

    this.container.appendChild(strokeSection);

    // Fill section
    const fillSection = this._createSection('Fill');

    this._fillTypeSelect = this._createSelect('Type', [
      { value: 'none', label: 'None' },
      { value: 'solid', label: 'Solid' },
      { value: 'pattern', label: 'Pattern' },
    ], (val) => {
      this._applyStyle('fill.type', val);
    });
    fillSection.appendChild(this._fillTypeSelect.wrapper);

    this._fillColorInput = this._createColorInput('Color', '#ffffff', (val) => {
      this._applyStyle('fill.color', val);
    });
    fillSection.appendChild(this._fillColorInput.wrapper);

    this.container.appendChild(fillSection);

    // Pattern picker placeholder
    this._patternContainer = document.createElement('div');
    this._patternContainer.className = 'pattern-container';
    fillSection.appendChild(this._patternContainer);

    // Text section (shown only for text shapes)
    this._textSection = this._createSection('Text');
    this._textSection.style.display = 'none';

    this._fontSelect = this._createSelect('Font', [
      { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
      { value: 'Georgia, serif', label: 'Georgia' },
      { value: 'Courier New, monospace', label: 'Courier' },
      { value: 'Times New Roman, serif', label: 'Times' },
    ], (val) => {
      this._applyStyle('fontFamily', val);
    });
    this._textSection.appendChild(this._fontSelect.wrapper);

    this._fontSizeInput = this._createNumberInput('Size', 14, 6, 144, 1, (val) => {
      this._applyStyle('fontSize', val);
    });
    this._textSection.appendChild(this._fontSizeInput.wrapper);

    this._boldBtn = this._createToggleButton('B', 'font-weight: bold', () => {
      const shapes = this.app.selection.getSelectedObjects(this.app.doc);
      const isBold = shapes[0]?.fontWeight === 'bold';
      this._applyStyle('fontWeight', isBold ? 'normal' : 'bold');
    });
    this._italicBtn = this._createToggleButton('I', 'font-style: italic', () => {
      const shapes = this.app.selection.getSelectedObjects(this.app.doc);
      const isItalic = shapes[0]?.fontStyle === 'italic';
      this._applyStyle('fontStyle', isItalic ? 'normal' : 'italic');
    });
    this._underlineBtn = this._createToggleButton('U', 'text-decoration: underline', () => {
      const shapes = this.app.selection.getSelectedObjects(this.app.doc);
      const isUnderline = shapes[0]?.textDecoration === 'underline';
      this._applyStyle('textDecoration', isUnderline ? 'none' : 'underline');
    });

    const textFormatRow = document.createElement('div');
    textFormatRow.className = 'prop-row text-format-row';
    textFormatRow.appendChild(this._boldBtn);
    textFormatRow.appendChild(this._italicBtn);
    textFormatRow.appendChild(this._underlineBtn);
    this._textSection.appendChild(textFormatRow);

    this._alignSelect = this._createSelect('Align', [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ], (val) => {
      this._applyStyle('textAlign', val);
    });
    this._textSection.appendChild(this._alignSelect.wrapper);

    this.container.appendChild(this._textSection);
  }

  setPatternPicker(picker) {
    this._patternContainer.innerHTML = '';
    this._patternContainer.appendChild(picker.element);
  }

  _update() {
    const shapes = this.app.selection.getSelectedObjects(this.app.doc);
    if (shapes.length === 0) return;

    const shape = shapes[0];
    this._strokeColorInput.input.value = shape.stroke?.color || '#000000';
    this._strokeWidthInput.input.value = shape.stroke?.width ?? 1;

    const dashStr = (shape.stroke?.dash || []).join(',');
    this._dashSelect.input.value = dashStr;

    this._fillTypeSelect.input.value = shape.fill?.type || 'none';
    this._fillColorInput.input.value = shape.fill?.color || '#ffffff';

    // Show/hide text section
    const hasText = shapes.some(s => s.type === 'text');
    this._textSection.style.display = hasText ? '' : 'none';

    if (hasText) {
      this._fontSelect.input.value = shape.fontFamily || '';
      this._fontSizeInput.input.value = shape.fontSize || 14;
      this._boldBtn.classList.toggle('active', shape.fontWeight === 'bold');
      this._italicBtn.classList.toggle('active', shape.fontStyle === 'italic');
      this._underlineBtn.classList.toggle('active', shape.textDecoration === 'underline');
      this._alignSelect.input.value = shape.textAlign || 'left';
    }
  }

  _applyStyle(property, value) {
    if (this.app.selection.isEmpty) return;
    this.app.commandStack.execute(
      new StyleCommand(this.app.doc, this.app.selection.ids, property, value)
    );
  }

  _createSection(title) {
    const section = document.createElement('div');
    section.className = 'prop-section';
    const h = document.createElement('h3');
    h.textContent = title;
    section.appendChild(h);
    return section;
  }

  _createColorInput(label, defaultVal, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'prop-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = defaultVal;
    input.addEventListener('input', () => onChange(input.value));
    wrapper.appendChild(lbl);
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  _createNumberInput(label, defaultVal, min, max, step, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'prop-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = defaultVal;
    input.min = min;
    input.max = max;
    input.step = step;
    input.addEventListener('change', () => onChange(Number(input.value)));
    wrapper.appendChild(lbl);
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  _createSelect(label, options, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'prop-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const input = document.createElement('select');
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      input.appendChild(o);
    }
    input.addEventListener('change', () => onChange(input.value));
    wrapper.appendChild(lbl);
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  _createToggleButton(label, style, onClick) {
    const btn = document.createElement('button');
    btn.className = 'prop-toggle-btn';
    btn.textContent = label;
    btn.setAttribute('style', style);
    btn.addEventListener('click', onClick);
    return btn;
  }
}
