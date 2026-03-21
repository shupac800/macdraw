/**
 * Procedural fill patterns — ~36 MacDraw-style patterns
 * Each pattern is drawn on a tiny offscreen canvas and converted to a CanvasPattern.
 */

const PATTERN_SIZE = 8;

const PATTERN_DEFS = [
  // 0: solid black
  (ctx) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 8, 8); },
  // 1: solid white (effectively "none" in some contexts but included for completeness)
  (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 8, 8); },
  // 2: 50% checkerboard
  (ctx) => {
    ctx.fillStyle = '#000';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x, y, 1, 1);
    }
  },
  // 3: 25% dots
  (ctx) => {
    ctx.fillStyle = '#000';
    for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x += 4) {
      ctx.fillRect(x + (y % 4 === 0 ? 0 : 2), y, 1, 1);
    }
  },
  // 4: 75% fill
  (ctx) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = '#fff';
    for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x += 4) {
      ctx.fillRect(x + (y % 4 === 0 ? 0 : 2), y, 1, 1);
    }
  },
  // 5: horizontal lines
  (ctx) => { ctx.fillStyle = '#000'; for (let y = 0; y < 8; y += 2) ctx.fillRect(0, y, 8, 1); },
  // 6: vertical lines
  (ctx) => { ctx.fillStyle = '#000'; for (let x = 0; x < 8; x += 2) ctx.fillRect(x, 0, 1, 8); },
  // 7: diagonal lines (forward)
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 8); ctx.lineTo(8, 0);
    ctx.moveTo(-2, 2); ctx.lineTo(2, -2);
    ctx.moveTo(6, 10); ctx.lineTo(10, 6);
    ctx.stroke();
  },
  // 8: diagonal lines (back)
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(8, 8);
    ctx.moveTo(-2, 6); ctx.lineTo(2, 10);
    ctx.moveTo(6, -2); ctx.lineTo(10, 2);
    ctx.stroke();
  },
  // 9: crosshatch
  (ctx) => {
    ctx.fillStyle = '#000';
    for (let y = 0; y < 8; y += 4) ctx.fillRect(0, y, 8, 1);
    for (let x = 0; x < 8; x += 4) ctx.fillRect(x, 0, 1, 8);
  },
  // 10: diagonal crosshatch
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(8, 8);
    ctx.moveTo(0, 8); ctx.lineTo(8, 0);
    ctx.stroke();
  },
  // 11: fine horizontal lines
  (ctx) => { ctx.fillStyle = '#000'; for (let y = 0; y < 8; y += 4) ctx.fillRect(0, y, 8, 1); },
  // 12: fine vertical lines
  (ctx) => { ctx.fillStyle = '#000'; for (let x = 0; x < 8; x += 4) ctx.fillRect(x, 0, 1, 8); },
  // 13: dots sparse
  (ctx) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1, 1); },
  // 14: dots dense
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(4, 4, 1, 1);
  },
  // 15: bricks
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 4, 8, 1);
    ctx.fillRect(0, 0, 1, 4);
    ctx.fillRect(4, 4, 1, 4);
  },
  // 16: horizontal dashes
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 4, 1);
    ctx.fillRect(4, 4, 4, 1);
  },
  // 17: vertical dashes
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 4);
    ctx.fillRect(4, 4, 1, 4);
  },
  // 18: herringbone
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 4); ctx.lineTo(4, 0); ctx.lineTo(8, 4);
    ctx.moveTo(0, 8); ctx.lineTo(4, 4); ctx.lineTo(8, 8);
    ctx.stroke();
  },
  // 19: wave
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.quadraticCurveTo(2, 0, 4, 4);
    ctx.quadraticCurveTo(6, 8, 8, 4);
    ctx.stroke();
  },
  // 20: triangles
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(8, 8); ctx.lineTo(0, 8); ctx.closePath();
    ctx.stroke();
  },
  // 21: 12.5% dots
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(4, 4, 1, 1);
  },
  // 22: hex pattern
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, 0); ctx.lineTo(6, 0); ctx.lineTo(8, 4);
    ctx.lineTo(6, 8); ctx.lineTo(2, 8); ctx.lineTo(0, 4); ctx.closePath();
    ctx.stroke();
  },
  // 23: thick horizontal
  (ctx) => { ctx.fillStyle = '#000'; for (let y = 0; y < 8; y += 4) ctx.fillRect(0, y, 8, 2); },
  // 24: thick vertical
  (ctx) => { ctx.fillStyle = '#000'; for (let x = 0; x < 8; x += 4) ctx.fillRect(x, 0, 2, 8); },
  // 25: thick diagonal forward
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1, 9); ctx.lineTo(9, -1);
    ctx.stroke();
  },
  // 26: thick diagonal back
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1, -1); ctx.lineTo(9, 9);
    ctx.stroke();
  },
  // 27: confetti
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(1, 1, 2, 1);
    ctx.fillRect(5, 3, 1, 2);
    ctx.fillRect(3, 6, 2, 1);
    ctx.fillRect(7, 7, 1, 1);
  },
  // 28: plus signs
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(3, 1, 2, 1);
    ctx.fillRect(3, 3, 2, 1);
    ctx.fillRect(2, 2, 4, 1);
  },
  // 29: circles
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(4, 4, 3, 0, Math.PI * 2); ctx.stroke();
  },
  // 30: diamonds
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(8, 4); ctx.lineTo(4, 8); ctx.lineTo(0, 4); ctx.closePath();
    ctx.stroke();
  },
  // 31: scales
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(4, 8, 4, Math.PI, 0);
    ctx.arc(0, 4, 4, 0, -Math.PI / 2, true);
    ctx.stroke();
  },
  // 32: dense diagonal
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    for (let i = -8; i < 16; i += 3) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 8, 8); ctx.stroke();
    }
  },
  // 33: zigzag
  (ctx) => {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 2); ctx.lineTo(2, 0); ctx.lineTo(4, 2);
    ctx.lineTo(6, 0); ctx.lineTo(8, 2);
    ctx.moveTo(0, 6); ctx.lineTo(2, 4); ctx.lineTo(4, 6);
    ctx.lineTo(6, 4); ctx.lineTo(8, 6);
    ctx.stroke();
  },
  // 34: stipple light
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillRect(5, 2, 1, 1);
    ctx.fillRect(3, 4, 1, 1);
    ctx.fillRect(7, 6, 1, 1);
  },
  // 35: stipple heavy
  (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 2, 1); ctx.fillRect(4, 2, 2, 1);
    ctx.fillRect(2, 4, 2, 1); ctx.fillRect(6, 6, 2, 1);
  },
];

export class PatternRegistry {
  constructor() {
    this._patterns = new Map();
    this._canvasPatterns = new Map();
  }

  init(targetCtx) {
    for (let i = 0; i < PATTERN_DEFS.length; i++) {
      const offscreen = document.createElement('canvas');
      offscreen.width = PATTERN_SIZE;
      offscreen.height = PATTERN_SIZE;
      const ctx = offscreen.getContext('2d');
      ctx.clearRect(0, 0, PATTERN_SIZE, PATTERN_SIZE);
      PATTERN_DEFS[i](ctx);
      this._patterns.set(i, offscreen);

      const pattern = targetCtx.createPattern(offscreen, 'repeat');
      this._canvasPatterns.set(i, pattern);
    }
  }

  getPattern(id) {
    return this._canvasPatterns.get(id) || null;
  }

  getPatternCanvas(id) {
    return this._patterns.get(id) || null;
  }

  get count() {
    return PATTERN_DEFS.length;
  }
}
