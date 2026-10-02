export function textFont(shape) {
  return `${shape.fontStyle === 'italic' ? 'italic ' : ''}${shape.fontWeight === 'bold' ? 'bold ' : ''}${shape.fontSize}px ${shape.fontFamily}`;
}

// Canvas and SVG use the same wrapping, including explicit blank lines.
export function layoutText(ctx, shape) {
  ctx.font = textFont(shape);
  const lines = [];
  for (const paragraph of (shape.text || '').split('\n')) {
    if (!shape.wrap || !shape.width) { lines.push(paragraph); continue; }
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (line && ctx.measureText(line + word).width > shape.width) { lines.push(line.trimEnd()); line = ''; }
      if (!line && !word.trim()) continue;
      for (const character of word) {
        if (line && ctx.measureText(line + character).width > shape.width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function textLayout(ctx, shape) {
  const lines = layoutText(ctx, shape);
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText('Mg');
  const ascent = metrics.fontBoundingBoxAscent ?? shape.fontSize;
  const descent = metrics.fontBoundingBoxDescent ?? shape.fontSize * 0.3;
  const lineHeight = shape.fontSize * 1.3 * (shape.lineSpacing || 1);
  return {
    lines, ascent, lineHeight,
    width: shape.wrap ? shape.width : Math.max(12, ...lines.map(line => ctx.measureText(line).width)),
    height: Math.max(lineHeight, (lines.length - 1) * lineHeight + ascent + descent),
  };
}
