import { TOOLS } from '../util/constants.js';
import dimensions from '../../assets/bitmaps/macdraw-1.9-tools.json';
import selectBitmap from '../../assets/bitmaps/tool-select.png';
import textBitmap from '../../assets/bitmaps/tool-text.png';
import perpendicularBitmap from '../../assets/bitmaps/tool-perpendicular.png';
import lineBitmap from '../../assets/bitmaps/tool-line.png';
import rectBitmap from '../../assets/bitmaps/tool-rect.png';
import roundRectBitmap from '../../assets/bitmaps/tool-roundRect.png';
import ovalBitmap from '../../assets/bitmaps/tool-oval.png';
import arcBitmap from '../../assets/bitmaps/tool-arc.png';
import freehandBitmap from '../../assets/bitmaps/tool-freehand.png';
import polygonBitmap from '../../assets/bitmaps/tool-polygon.png';

const DEFS = [
  [TOOLS.SELECT, 'Selection arrow', 'V', selectBitmap],
  [TOOLS.TEXT, 'Text', 'T', textBitmap],
  [TOOLS.PERPENDICULAR, 'Perpendicular lines', 'H', perpendicularBitmap],
  [TOOLS.LINE, 'Diagonal lines', 'L', lineBitmap],
  [TOOLS.RECT, 'Rectangle', 'R', rectBitmap],
  [TOOLS.ROUND_RECT, 'Round-corner rectangle', 'U', roundRectBitmap],
  [TOOLS.OVAL, 'Circle / oval', 'O', ovalBitmap],
  [TOOLS.ARC, 'Arc', 'A', arcBitmap],
  [TOOLS.FREEHAND, 'Freehand shape', 'F', freehandBitmap],
  [TOOLS.POLYGON, 'Polygon', 'P', polygonBitmap],
];

export class Toolbar {
  constructor(container, manager) {
    container.className = 'toolbar'; container.setAttribute('role', 'toolbar'); container.setAttribute('aria-label', 'Drawing tools');
    this.buttons = new Map(); this.manager = manager;
    for (const [id, name, key, icon] of DEFS) {
      const button = document.createElement('button'); button.className = 'toolbar-btn';
      button.title = `${name} (${key}) — double-click to keep drawing`;
      button.setAttribute('aria-label', `${name} (${key})`); button.dataset.tool = id;
      const image = document.createElement('img'); image.src = icon;
      image.width = dimensions[id].width; image.height = dimensions[id].height;
      // The tool font baseline is three rows above the cell bottom.
      image.style.top = `${2 + dimensions[id].sourceCrop[1]}px`;
      image.alt = ''; image.setAttribute('aria-hidden', 'true'); button.append(image);
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
