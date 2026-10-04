// Eight by eight, one-bit tiles. A zero bit is opaque white, never transparent.
// IDs 0 and 1 remain black and white for compatibility with saved drawings.
export const PATTERN_ROWS = [
  [255,255,255,255,255,255,255,255], [0,0,0,0,0,0,0,0],
  [170,85,170,85,170,85,170,85], [136,34,136,34,136,34,136,34],
  [119,221,119,221,119,221,119,221], [255,0,255,0,255,0,255,0],
  [170,170,170,170,170,170,170,170], [1,2,4,8,16,32,64,128],
  [128,64,32,16,8,4,2,1], [255,136,136,136,255,136,136,136],
  [129,66,36,24,24,36,66,129], [255,0,0,0,255,0,0,0],
  [136,136,136,136,136,136,136,136], [128,0,0,0,0,0,0,0],
  [128,0,0,0,8,0,0,0], [255,128,128,128,255,8,8,8],
  [240,0,0,0,15,0,0,0], [128,128,128,128,8,8,8,8],
  [17,34,68,136,136,68,34,17], [0,102,153,0,0,102,153,0],
  [16,56,108,198,255,0,0,0], [136,0,34,0,136,0,34,0],
  [60,66,129,129,129,129,66,60], [255,255,0,0,255,255,0,0],
  [204,204,204,204,204,204,204,204], [3,6,12,24,48,96,192,129],
  [192,96,48,24,12,6,3,129], [0,96,0,4,4,0,24,1],
  [0,16,56,16,0,1,131,1], [60,66,129,129,129,129,66,60],
  [16,40,68,130,1,130,68,40], [0,0,24,36,66,129,0,0],
  [17,34,68,136,17,34,68,136], [85,170,0,0,85,170,0,0],
  [128,0,8,0,32,0,2,0], [192,0,12,0,48,0,3,0],
];
export const PATTERN_NAMES = [
  'Black', 'White', '50% gray', '25% gray', '75% gray', 'Horizontal lines',
  'Vertical lines', 'Diagonal left', 'Diagonal right', 'Crosshatch', 'Diagonal crosshatch',
  'Fine horizontal', 'Fine vertical', 'Sparse dots', 'Dots', 'Brick', 'Horizontal dashes',
  'Vertical dashes', 'Herringbone', 'Waves', 'Triangles', 'Fine dots', 'Hexagons',
  'Thick horizontal', 'Thick vertical', 'Thick diagonal left', 'Thick diagonal right',
  'Confetti', 'Crosses', 'Circles', 'Diamonds', 'Scales', 'Dense diagonal', 'Zigzag',
  'Light stipple', 'Heavy stipple',
];

export function patternSVG(id) {
  const rows = PATTERN_ROWS[id] || PATTERN_ROWS[0];
  let pixels = '<rect width="8" height="8" fill="#fff"/>';
  rows.forEach((row, y) => {
    for (let x = 0; x < 8; x++) if (row & (128 >> x)) pixels += `<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>`;
  });
  return pixels;
}

export class PatternRegistry {
  constructor() { this._patterns = new Map(); this._canvasPatterns = new Map(); }
  init(targetCtx) {
    PATTERN_ROWS.forEach((rows, id) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 8;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 8, 8);
      ctx.fillStyle = '#000';
      rows.forEach((row, y) => { for (let x = 0; x < 8; x++) if (row & (128 >> x)) ctx.fillRect(x, y, 1, 1); });
      this._patterns.set(id, canvas);
      this._canvasPatterns.set(id, targetCtx.createPattern(canvas, 'repeat'));
    });
  }
  getPattern(id) { return this._canvasPatterns.get(id) || null; }
  strokeMask(width, height) {
    this._strokeMask ||= document.createElement('canvas');
    this._strokeMask.width = width; this._strokeMask.height = height;
    return this._strokeMask;
  }
  getPatternCanvas(id) { return this._patterns.get(id) || null; }
  get count() { return PATTERN_ROWS.length; }
}

export function monochromePixels(imageData) {
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const value = pixels[i] < 128 ? 0 : 255;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value; pixels[i + 3] = 255;
  }
  return imageData;
}
