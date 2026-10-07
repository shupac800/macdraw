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

// Map painted lines back to textarea offsets, including blank lines and wrapping.
// Selection and pointer positions use the same measurements as committed text.
export function textEditLayout(ctx, shape) {
  const layout = textLayout(ctx, shape);
  let offset = 0;
  const lines = layout.lines.map((text, index) => {
    const start = text ? shape.text.indexOf(text, offset) : offset;
    const end = Math.max(offset, start) + text.length;
    offset = end;
    if (shape.text[offset] === '\n') offset++;
    const width = ctx.measureText(text).width;
    const x = shape.x + (shape.textAlign === 'right' ? shape.width - width : shape.textAlign === 'center' ? (shape.width - width) / 2 : 0);
    return { text, start: Math.max(0, start), end, x, y: shape.y + index * layout.lineHeight };
  });
  return { ...layout, lines };
}

export function textOffsetAtPoint(ctx, shape, point) {
  const { lines, lineHeight } = textEditLayout(ctx, shape);
  const line = lines[Math.max(0, Math.min(lines.length - 1, Math.floor((point.y - shape.y) / lineHeight)))];
  for (let i = 0; i < line.text.length; i++) {
    const left = ctx.measureText(line.text.slice(0, i)).width;
    const right = ctx.measureText(line.text.slice(0, i + 1)).width;
    if (point.x < line.x + (left + right) / 2) return line.start + i;
  }
  return line.end;
}

export function textSelectionRects(ctx, draft) {
  const { shape, start, end, caret } = draft;
  const { lines, lineHeight } = textEditLayout(ctx, shape), rectangles = [];
  lines.forEach((line, index) => {
    if (start === end) {
      // At a soft wrap boundary the caret belongs to the following line.
      if (!caret || start < line.start || start > line.end || (start === line.end && lines[index + 1]?.start === start)) return;
      rectangles.push({ x: line.x + ctx.measureText(line.text.slice(0, start - line.start)).width, y: line.y, width: 0, height: lineHeight, caret: true });
    } else {
      const from = Math.max(start, line.start), to = Math.min(end, line.end);
      const newline = start <= line.end && end > line.end && shape.text[line.end] === '\n';
      if (to <= from && !newline) return;
      const left = ctx.measureText(line.text.slice(0, Math.max(0, from - line.start))).width;
      const right = ctx.measureText(line.text.slice(0, Math.max(0, to - line.start))).width;
      rectangles.push({ x: line.x + left, y: line.y, width: Math.max(0, right - left) + (newline ? 4 : 0), height: lineHeight });
    }
  });
  return rectangles;
}
