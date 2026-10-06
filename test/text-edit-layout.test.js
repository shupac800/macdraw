import { describe, expect, it } from 'vitest';
import { textEditLayout, textOffsetAtPoint, textSelectionRects } from '../src/util/text.js';

const ctx = { measureText: text => ({ width: text.length * 6, fontBoundingBoxAscent: 10, fontBoundingBoxDescent: 3 }) };
const shape = { x: 20, y: 30, width: 60, text: 'First\n\nSecond', fontSize: 10, fontFamily: 'Chicago', textAlign: 'left' };

describe('bitmap editor selection geometry', () => {
  it('preserves source offsets through explicit blank lines', () => {
    expect(textEditLayout(ctx, shape).lines.map(line => [line.start, line.end])).toEqual([[0, 5], [6, 6], [7, 13]]);
    expect(textOffsetAtPoint(ctx, shape, { x: 20, y: 56 })).toBe(7);
  });
  it('places caret and range against the same right-aligned glyphs', () => {
    const draft = { shape: { ...shape, text: 'ABC', textAlign: 'right' }, start: 1, end: 2, caret: true };
    expect(textSelectionRects(ctx, draft)).toEqual([{ x: 68, y: 30, width: 6, height: 13 }]);
    expect(textOffsetAtPoint(ctx, draft.shape, { x: 69, y: 30 })).toBe(1);
    expect(textSelectionRects(ctx, { ...draft, end: 1 })[0]).toMatchObject({ x: 68, width: 0, caret: true });
  });
  it('does not highlight earlier newlines for a later selection', () => {
    expect(textSelectionRects(ctx, { shape, start: 8, end: 10 })).toEqual([{ x: 26, y: 56, width: 12, height: 13 }]);
  });
  it('maps wrapped words and an end-of-text caret', () => {
    const paragraph = { ...shape, text: 'one two three', width: 24, wrap: true };
    expect(textEditLayout(ctx, paragraph).lines.map(line => [line.text, line.start])).toEqual([['one', 0], ['two', 4], ['thre', 8], ['e', 12]]);
    expect(textSelectionRects(ctx, { shape: paragraph, start: 13, end: 13, caret: true })[0]).toMatchObject({ x: 26, y: 69 });
  });
});
