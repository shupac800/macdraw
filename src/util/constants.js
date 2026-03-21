// Page sizes in points (72 points/inch)
export const PAGE_SIZES = {
  LETTER: { width: 612, height: 792, label: 'US Letter' },
  A4: { width: 595, height: 842, label: 'A4' },
  LEGAL: { width: 612, height: 1008, label: 'US Legal' },
};

export const DEFAULT_PAGE = PAGE_SIZES.LETTER;

export const UNITS = {
  INCHES: { label: 'Inches', perPoint: 1 / 72 },
  CM: { label: 'Centimeters', perPoint: 2.54 / 72 },
  POINTS: { label: 'Points', perPoint: 1 },
};

export const DEFAULT_STROKE = {
  color: '#000000',
  width: 1,
  dash: [],
  cap: 'round',
  join: 'round',
};

export const DEFAULT_FILL = {
  type: 'none', // 'none', 'solid', 'pattern'
  color: '#ffffff',
  patternId: null,
};

export const HANDLE_SIZE = 8;
export const ROTATION_HANDLE_DISTANCE = 24;
export const MIN_SHAPE_SIZE = 2;
export const GRID_SIZE = 18; // 1/4 inch
export const SNAP_THRESHOLD = 6;
export const NUDGE_AMOUNT = 1;
export const NUDGE_LARGE_AMOUNT = 10;

export const RULER_SIZE = 20;

export const TOOLS = {
  SELECT: 'select',
  RECT: 'rect',
  ROUND_RECT: 'roundRect',
  OVAL: 'oval',
  LINE: 'line',
  ARC: 'arc',
  POLYGON: 'polygon',
  FREEHAND: 'freehand',
  TEXT: 'text',
};

export const ARROW_TYPES = {
  NONE: 'none',
  ARROW: 'arrow',
};

export const ARC_TYPES = {
  OPEN: 'open',
  CLOSED: 'closed',
  PIE: 'pie',
};

export const Z_ORDER = {
  FRONT: 'front',
  BACK: 'back',
  FORWARD: 'forward',
  BACKWARD: 'backward',
};
