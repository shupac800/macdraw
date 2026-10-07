import glyphs from '../../assets/bitmaps/chicago-12-ruler.json';

// Original Chicago bitmap rows. Font loading and browser text rasterization
// never enter this path; MacScreen enlarges these logical pixels as a bitmap.
export function drawRulerNumber(ctx, value, center, horizontal) {
  const characters = [...value].map(character => glyphs[character]);
  if (characters.some(glyph => !glyph)) return;
  const width = characters.reduce((sum, glyph) => sum + glyph.advance, 0);
  let left = Math.round(center - width / 2);
  for (const glyph of characters) {
    for (let row = 0; row < glyph.height; row++) {
      const bits = parseInt(glyph.rows[row], 16);
      for (let column = 0; column < glyph.width; column++) {
        if (!(bits & (1 << (glyph.rows[row].length * 4 - 1 - column)))) continue;
        const x = left + glyph.x + column;
        const y = 10 - glyph.height - glyph.y + row;
        // Rotate pixel coordinates exactly 90 degrees, without a canvas
        // transform or fractional coordinates that could blend source bits.
        if (horizontal) ctx.fillRect(x, y, 1, 1);
        else ctx.fillRect(15 - y, x, 1, 1);
      }
    }
    left += glyph.advance;
  }
}
