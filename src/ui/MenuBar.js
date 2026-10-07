import { FONTS } from '../util/constants.js';
import appleMenuBitmap from '../../assets/bitmaps/apple-menu.png';
import chicagoLicense from '../../assets/fonts/LICENSE-Chicago-Kare.txt?raw';

const separator = { type: 'separator' };
export class MenuBar {
  constructor(container, app) {
    this.container = container; this.app = app; this.opened = null; this.menus = this.definitions();
    container.className = 'menubar'; container.setAttribute('role', 'menubar'); container.setAttribute('aria-label', 'MacDraw menus');
    this.menus.forEach(menu => {
      const wrapper = document.createElement('div'); wrapper.className = `menu-wrapper${menu.apple ? ' apple-menu' : ''}`;
      const trigger = document.createElement('button'); trigger.className = 'menu-trigger'; trigger.setAttribute('aria-haspopup', 'menu'); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-label', menu.label);
      if (menu.apple) {
        const image = document.createElement('img'); image.src = appleMenuBitmap;
        image.width = 9; image.height = 11; image.alt = ''; image.setAttribute('aria-hidden', 'true');
        trigger.append(image);
      }
      else trigger.textContent = menu.label;
      trigger.addEventListener('click', () => this.opened?.menu === menu ? this.close() : this.open(menu, wrapper));
      trigger.addEventListener('mouseenter', () => { if (this.opened && this.opened.menu !== menu) this.open(menu, wrapper); });
      wrapper.append(trigger); container.append(wrapper); menu.wrapper = wrapper; menu.trigger = trigger;
    });
    document.addEventListener('pointerdown', e => { if (!container.contains(e.target)) this.close(); });
  }
  definitions() {
    const app = this.app, a = app.actions, d = app.doc;
    const has = () => a.editable.length > 0, text = () => a.editable.some(s => s.type === 'text') || app.selection.isEmpty;
    const currentText = () => a.selected.find(s => s.type === 'text') || d._defaultText;
    const item = (label, action, enabled, shortcut, checked) => ({ label, action, enabled, shortcut, checked });
    return [
      { label: 'Apple', apple: true, items: [item('About MacDraw…', () => this.about()), separator, item('MacDraw Help…', () => this.help(), null, 'F1'), separator,
        item('Screen: Automatic', () => app.screen.setScale('auto'), null, null, () => app.screen.preference === 'auto'),
        item('Screen: 512 × 342 (1×)', () => app.screen.setScale('1'), null, null, () => app.screen.preference === '1'),
        item('Screen: 1024 × 684 (2×)', () => app.screen.setScale('2'), null, null, () => app.screen.preference === '2'),
        item('Screen: 1536 × 1026 (3×)', () => app.screen.setScale('3'), null, null, () => app.screen.preference === '3'),
      ] },
      { label: 'File', items: [
        item('New', () => app.files.newDocument(), null, 'Ctrl+N'), item('Open…', () => app.files.open(), null, 'Ctrl+O'), separator,
        item('Close', () => app.files.newDocument()), item('Save', () => app.files.save(), null, 'Ctrl+S'), item('Save As…', () => app.files.save(true), null, 'Ctrl+Shift+S'), item('Revert…', () => app.files.revert(), () => !!app.files.savedDocument), separator,
        item('Page Setup…', () => a.pageDialog()), item('Print…', () => app.files.print(), null, 'Ctrl+P'), separator,
        item('Export SVG…', () => app.files.exportSVG()), item('Export PNG…', () => app.files.exportPNG()), item('Download Drawing…', () => app.files.download()),
      ] },
      { label: 'Edit', items: [
        item(() => `Undo${app.commandStack.undoLabel ? ' ' + app.commandStack.undoLabel : ''}`, () => a.undo(), () => app.commandStack.canUndo, 'Ctrl+Z'), item(() => `Redo${app.commandStack.redoLabel ? ' ' + app.commandStack.redoLabel : ''}`, () => a.redo(), () => app.commandStack.canRedo, 'Ctrl+Y'), separator,
        item('Cut', () => a.cut(), has, 'Ctrl+X'), item('Copy', () => a.copy(), () => !app.selection.isEmpty, 'Ctrl+C'), item('Paste', () => a.paste(), () => !app.clipboard.isEmpty, 'Ctrl+V'), item('Clear', () => a.remove(), has, 'Del'), separator,
        item('Select All', () => a.selectAll(), () => d.objects.length > 0, 'Ctrl+A'), item('Duplicate', () => a.duplicate(), has, 'Ctrl+D'), separator,
        item('Reshape Arc…', () => a.reshapeDialog(), () => a.editable.some(s => s.type === 'arc')), item('Smooth', () => a.smooth(true), () => a.editable.some(s => ['polygon','freehand'].includes(s.type))), item('Unsmooth', () => a.smooth(false), () => a.editable.some(s => ['polygon','freehand'].includes(s.type))), item('Round Corners…', () => a.cornersDialog(), () => app.selection.isEmpty || a.editable.some(s => ['rect','roundRect'].includes(s.type))),
      ] },
      { label: 'Style', items: [
        item('Plain Text', () => a.plainText(), text), item('Bold', () => a.toggleText('fontWeight', 'bold', 'normal'), text, null, () => currentText().fontWeight === 'bold'), item('Italic', () => a.toggleText('fontStyle', 'italic', 'normal'), text, null, () => currentText().fontStyle === 'italic'), item('Underline', () => a.toggleText('textDecoration', 'underline', 'none'), text, null, () => currentText().textDecoration === 'underline'), item('Outline', () => a.toggleText('outline', true, false), text, null, () => currentText().outline), item('Shadow', () => a.toggleText('shadow', true, false), text, null, () => currentText().shadow), separator,
        ...['left','center','right'].map(value => item(value[0].toUpperCase() + value.slice(1), () => a.style('textAlign', value), text, null, () => currentText().textAlign === value)), separator,
        ...[[1,'Single Space'],[1.5,'1½ Space'],[2,'Double Space']].map(([value,label]) => item(label, () => a.style('lineSpacing', value), text, null, () => currentText().lineSpacing === value)), separator,
        item('Lowercase', () => a.textCase('lower'), () => a.editable.some(s => s.type === 'text')), item('Uppercase', () => a.textCase('upper'), () => a.editable.some(s => s.type === 'text')), item('Title', () => a.textCase('title'), () => a.editable.some(s => s.type === 'text')),
      ] },
      { label: 'Font', items: [
        ...FONTS.map(font => item(font.label, () => a.style('fontFamily', font.value, 'Font'), text, null, () => currentText().fontFamily === font.value)), separator,
        ...[9,10,12,14,18,24,36,48].map(size => item(`${size} point`, () => a.style('fontSize', size, 'Font Size'), text, null, () => currentText().fontSize === size)),
      ] },
      { label: 'Layout', items: [
        item(() => d.showRulers ? 'Hide Rulers' : 'Show Rulers', () => a.toggle('showRulers')), item('Custom Rulers…', () => a.rulersDialog()), item(() => d.showRulerLines ? 'Hide Ruler Lines' : 'Show Ruler Lines', () => a.toggle('showRulerLines')), separator,
        item(() => d.snapToGrid ? 'Turn Grid Off' : 'Turn Grid On', () => a.toggle('snapToGrid')), item('Show Alignment Grid', () => a.toggle('showGrid'), null, null, () => d.showGrid), item('Show Size', () => a.toggle('showSize'), null, null, () => d.showSize), separator,
        item('Actual Size', () => app.setZoom(1), null, 'Ctrl+1'), item('Reduce', () => app.setZoom(app.zoom / 2), () => app.zoom > 0.125), item('Enlarge', () => app.setZoom(app.zoom * 2), () => app.zoom < 4), item('View Entire Drawing', () => app.fitDrawing(), null, 'Ctrl+0'), item('Drawing Size…', () => a.sizeDialog()),
      ] },
      { label: 'Arrange', items: [
        item('Bring to Front', () => a.arrange('front'), has), item('Send to Back', () => a.arrange('back'), has), item('Bring Forward', () => a.arrange('forward'), has), item('Send Backward', () => a.arrange('backward'), has), separator,
        item('Paste in Front', () => a.paste('front', false), () => !app.clipboard.isEmpty), item('Paste in Back', () => a.paste('back', false), () => !app.clipboard.isEmpty), separator,
        item('Rotate Left', () => a.rotate(-1), has), item('Rotate Right', () => a.rotate(1), has), item('Flip Horizontal', () => a.flip(true), has), item('Flip Vertical', () => a.flip(false), has), separator,
        item('Group', () => a.group(), () => a.canGroup, 'Ctrl+G'), item('Ungroup', () => a.ungroup(), () => a.selected.some(s => s.groupId), 'Ctrl+Shift+G'), item('Lock', () => a.lock(true), has), item('Unlock', () => a.lock(false), () => a.selected.some(s => s.locked)), separator,
        item('Align to Grid', () => a.alignToGrid(), has), item('Align Objects…', () => a.alignDialog(), () => a.editable.length >= 2),
      ] },
      { label: 'Fill', pattern: 'Fill', items: [] },
      { label: 'Lines', items: [
        item('No Border', () => a.style('stroke.width', 0, 'Line Width'), null, null, () => app.currentStyle('Pen').width === 0),
        ...[1,2,3,4].map(width => ({ ...item(`${width} pixel${width === 1 ? '' : 's'}`, () => a.style('stroke.width', width, 'Line Width'), null, null, () => app.currentStyle('Pen').width === width), lineWidth: width })), separator,
        item('No Arrows', () => a.arrows('none','none')), item('Arrow at End →', () => a.arrows('none','arrow')), item('Arrow at Start ←', () => a.arrows('arrow','none')), item('Arrows at Both Ends ↔', () => a.arrows('arrow','arrow')),
      ] },
      { label: 'Pen', pattern: 'Pen', items: [] },
    ];
  }
  openByLabel(label) { const menu = this.menus.find(m => m.label === label); if (menu) this.open(menu, menu.wrapper); }
  open(menu, wrapper) {
    this.app.finishText(); this.close();
    this.opened = { menu, wrapper }; wrapper.classList.add('open'); menu.trigger.setAttribute('aria-expanded', 'true');
    const dropdown = document.createElement('div'); dropdown.className = 'menu-dropdown'; dropdown.setAttribute('role', 'menu'); dropdown.setAttribute('aria-label', menu.label);
    if (menu.pattern) {
      dropdown.classList.add('pattern-menu');
      if (menu.pattern === 'Fill') this.appendItem(dropdown, { label: 'None', action: () => this.app.applyPattern('Fill', null), checked: () => this.app.currentStyle('Fill').type === 'none' });
      const heading = document.createElement('div'); heading.className = 'pattern-heading'; heading.textContent = `${menu.pattern} patterns`; dropdown.append(heading);
      this.app.patternPicker.build(dropdown, menu.pattern, () => this.close());
    } else menu.items.forEach(item => this.appendItem(dropdown, item));
    wrapper.append(dropdown);
    const rootBounds = document.getElementById('app').getBoundingClientRect();
    const scale = rootBounds.width / 512;
    const overflow = (dropdown.getBoundingClientRect().right - rootBounds.right) / scale;
    if (overflow > 0) dropdown.style.left = `${-overflow - 3}px`;
  }
  appendItem(dropdown, item) {
    if (item.type === 'separator') { const sep = document.createElement('div'); sep.className = 'menu-separator'; sep.setAttribute('role','separator'); dropdown.append(sep); return; }
    const button = document.createElement('button'); button.className = 'menu-item'; button.setAttribute('role', item.checked ? 'menuitemcheckbox' : 'menuitem');
    const checked = !!item.checked?.(); if (item.checked) button.setAttribute('aria-checked', String(checked)); button.disabled = item.enabled ? !item.enabled() : false;
    const check = document.createElement('span'); check.className = 'menu-check'; check.textContent = checked ? '✓' : ''; check.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.className = 'menu-label'; label.textContent = typeof item.label === 'function' ? item.label() : item.label;
    if (item.lineWidth) { const sample = document.createElement('span'); sample.className = 'line-sample'; sample.style.setProperty('--line-width', `${item.lineWidth}px`); label.prepend(sample); }
    button.append(check, label);
    if (item.shortcut) { const shortcut = document.createElement('span'); shortcut.className = 'menu-shortcut'; shortcut.textContent = item.shortcut; button.append(shortcut); }
    button.addEventListener('click', () => { this.close(); Promise.resolve(item.action()).catch(error => this.app.dialog.alert('MacDraw', error.message)); }); dropdown.append(button);
  }
  close() { if (this.opened) { this.opened.wrapper.querySelector('.menu-dropdown')?.remove(); this.opened.wrapper.classList.remove('open'); this.opened.menu.trigger.setAttribute('aria-expanded', 'false'); this.opened = null; } }
  handleKey(e) {
    if (e.key === 'F1') { e.preventDefault(); this.help(); return true; }
    if (e.key === 'F10') { e.preventDefault(); this.open(this.menus[0], this.menus[0].wrapper); return true; }
    if (!this.opened) return false;
    if (e.key === 'Escape') { e.preventDefault(); const trigger = this.opened.menu.trigger; this.close(); trigger.focus(); return true; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const at = this.menus.indexOf(this.opened.menu), next = this.menus[(at + (e.key === 'ArrowRight' ? 1 : -1) + this.menus.length) % this.menus.length]; this.open(next, next.wrapper); next.wrapper.querySelector('.menu-dropdown button:not(:disabled)')?.focus(); return true; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const buttons = [...this.opened.wrapper.querySelectorAll('.menu-dropdown button:not(:disabled)')], at = buttons.indexOf(document.activeElement); buttons[(at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); return true; }
    return false;
  }
  about() {
    const credits = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = 'Chicago font license';
    const license = document.createElement('pre'); license.style.cssText = 'white-space:pre-wrap;font:10px monospace;'; license.textContent = chicagoLicense;
    credits.append(summary, license);
    this.app.dialog.show({ title: 'MacDraw', message: 'A monochrome recreation of classic Macintosh MacDraw, adapted for Chrome on Windows. Chicago Kare by Duane King reproduces Susan Kare’s bitmap Chicago. Editable .macdraw files are this web app’s format, not the original Macintosh binary format.', content: credits, buttons: [{ label: 'OK', value: 'ok', default: true }] });
  }
  help() {
    const table = document.createElement('table'); table.className = 'help-table';
    const rows = [ ['Drawing', 'Choose a tool and drag. The arrow returns after each object. Double-click a tool to keep drawing.'], ['Selection', 'Click an object; Shift-click to add or remove. Drag a box around objects. Drag a black handle to resize.'], ['Constraints', 'Shift makes squares/circles, constrains diagonal lines to 45°, and constrains moves. The + tool makes horizontal/vertical lines.'], ['Polygons', 'Click each vertex. Click the starting point to close; double-click to finish an open polygon. Enter closes. Escape cancels.'], ['Text', 'Click for a caption, or drag a paragraph width. Double-click text to edit. Escape cancels; Ctrl+Enter or clicking elsewhere commits.'], ['Appearance', 'Fill sets opaque black/white patterns or None. Pen sets the line pattern. Lines sets widths and arrowheads.'], ['Files', 'Save/Open use editable .macdraw files. Chrome offers Windows file dialogs. Download Drawing is the portable save option. SVG embeds Chicago; PNG is black-and-white.'], ['Shortcuts', 'Ctrl+Z/Y undo/redo; Ctrl+C/X/V clipboard; Ctrl+D duplicate; Ctrl+G group; Ctrl+Shift+G ungroup; arrows nudge.'], ['View', 'Ctrl+0 fits the drawing; Ctrl+1 shows actual size. Ctrl+mouse wheel zooms. Layout controls rulers, grid, and measurements.'] ];
    rows.forEach(([name, explanation]) => { const row = document.createElement('tr'); for (const text of [name, explanation]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); } table.append(row); });
    this.app.dialog.show({ title: 'MacDraw Help', content: table, buttons: [{ label: 'OK', value: 'ok', default: true }] });
  }
}
