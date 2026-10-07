import glyphs from '../../assets/bitmaps/macdraw-1.9-ruler.json';
import { RULER_SIZE } from './constants.js';

// MacDraw 1.9 FONT 31881, family 249 at 9 points. The original ruler routine
// right-aligns upright numerals before the tick on both axes.
export function drawRulerNumber(ctx, value, position, horizontal) {
  const characters = [...value].map(character => glyphs[character]);
  if (characters.some(glyph => !glyph)) return;
  const width = characters.reduce((sum, glyph) => sum + glyph.advance, 0);
  let left = Math.round((horizontal ? position : RULER_SIZE) - width - 1);
  const baseline = Math.round(horizontal ? RULER_SIZE - 6 : position - 1);
  for (const glyph of characters) {
    for (let row = 0; row < glyph.height; row++) {
      const bits = parseInt(glyph.rows[row], 16);
      for (let column = 0; column < glyph.width; column++) {
        if (bits & (1 << (glyph.rows[row].length * 4 - 1 - column))) {
          ctx.fillRect(left + glyph.x + column, baseline - glyph.height - glyph.y + row, 1, 1);
        }
      }
    }
    left += glyph.advance;
  }
}
