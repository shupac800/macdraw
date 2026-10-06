import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { Document } from '../src/model/Document.js';
import { createShape, resetIdCounter, getBounds, hitTest } from '../src/model/Shape.js';
import { saveToJSON, loadFromJSON } from '../src/util/serialize.js';

// SVG serialization needs DOM APIs (DOMParser, XMLSerializer, document.createElementNS).
// Set up a jsdom environment for those tests.
function setupDOM() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    contentType: 'text/html',
  });
  global.document = dom.window.document;
  global.DOMParser = dom.window.DOMParser;
  global.XMLSerializer = dom.window.XMLSerializer;
}

describe('JSON serialize', () => {
  beforeEach(() => {
    resetIdCounter();
    Document.setShapeModule({ getBounds, hitTest });
  });

  it('round-trips a document', () => {
    const doc = new Document({ pageWidth: 800, pageHeight: 600 });
    doc.unit = 'cm';
    doc.snapToGrid = true;
    doc.gridSize = 24;

    const rect = createShape('rect', { x: 10, y: 20, width: 100, height: 50 });
    rect.stroke.color = '#ff0000';
    rect.fill = { type: 'solid', color: '#00ff00', patternId: null };
    doc.addObject(rect);

    const line = createShape('line', {
      points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
      endArrow: 'arrow',
    });
    doc.addObject(line);

    const text = createShape('text', {
      x: 100, y: 100, width: 200, height: 30,
      text: 'Hello World', fontSize: 20, fontWeight: 'bold',
    });
    doc.addObject(text);

    doc.addGroup({ id: 'g1', members: [rect.id, line.id] });

    const json = saveToJSON(doc);
    const restored = loadFromJSON(json);

    expect(restored.pageWidth).toBe(800);
    expect(restored.pageHeight).toBe(600);
    expect(restored.unit).toBe('cm');
    expect(restored.snapToGrid).toBe(true);
    expect(restored.gridSize).toBe(24);
    expect(restored.objects).toHaveLength(3);
    expect(restored.groups).toHaveLength(1);

    const restoredRect = restored.objects[0];
    expect(restoredRect.type).toBe('rect');
    expect(restoredRect.stroke.color).toBe('#ff0000');
    expect(restoredRect.fill.type).toBe('solid');

    const restoredLine = restored.objects[1];
    expect(restoredLine.type).toBe('line');
    expect(restoredLine.endArrow).toBe('arrow');

    const restoredText = restored.objects[2];
    expect(restoredText.text).toBe('Hello World');
    expect(restoredText.fontSize).toBe(20);
    expect(restoredText.fontWeight).toBe('bold');
  });

  it('handles empty document', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const json = saveToJSON(doc);
    const restored = loadFromJSON(json);
    expect(restored.objects).toHaveLength(0);
    expect(restored.groups).toHaveLength(0);
  });

  it('throws on invalid JSON', () => {
    expect(() => loadFromJSON('not json')).toThrow();
  });
});

describe('SVG serialize', () => {
  let saveToSVG, loadFromSVG;

  beforeEach(async () => {
    resetIdCounter();
    Document.setShapeModule({ getBounds, hitTest });
    setupDOM();
    // Dynamic import after DOM is set up
    const mod = await import('../src/util/serialize.js');
    saveToSVG = mod.saveToSVG;
    loadFromSVG = mod.loadFromSVG;
  });

  it('round-trips a rect', () => {
    const doc = new Document({ pageWidth: 800, pageHeight: 600 });
    const rect = createShape('rect', { x: 10, y: 20, width: 100, height: 50 });
    rect.stroke.color = '#ff0000';
    rect.stroke.width = 2;
    rect.fill = { type: 'solid', color: '#00ff00', patternId: null };
    doc.addObject(rect);

    const svg = saveToSVG(doc);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('width="100"');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.pageWidth).toBe(800);
    expect(restored.objects).toHaveLength(1);
    const r = restored.objects[0];
    expect(r.type).toBe('rect');
    expect(r.x).toBe(10);
    expect(r.y).toBe(20);
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
    expect(r.stroke.color).toBe('#ff0000');
    expect(r.stroke.width).toBe(2);
    expect(r.fill.type).toBe('solid');
    expect(r.fill.color).toBe('#00ff00');
  });

  it('round-trips an oval', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const oval = createShape('oval', { x: 10, y: 20, width: 60, height: 40 });
    doc.addObject(oval);

    const svg = saveToSVG(doc);
    expect(svg).toContain('<ellipse');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    const o = restored.objects[0];
    expect(o.type).toBe('oval');
    expect(o.x).toBe(10);
    expect(o.y).toBe(20);
    expect(o.width).toBe(60);
    expect(o.height).toBe(40);
  });

  it('round-trips a roundRect', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const rr = createShape('roundRect', { x: 5, y: 5, width: 80, height: 40, cornerRadius: 10 });
    doc.addObject(rr);

    const svg = saveToSVG(doc);
    expect(svg).toContain('rx="10"');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    const r = restored.objects[0];
    expect(r.type).toBe('roundRect');
    expect(r.cornerRadius).toBe(10);
  });

  it('round-trips a line with arrows', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const line = createShape('line', {
      points: [{ x: 10, y: 20 }, { x: 100, y: 80 }],
      endArrow: 'arrow',
    });
    doc.addObject(line);

    const svg = saveToSVG(doc);
    expect(svg).toContain('<line');
    expect(svg).toContain('marker-end');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    const l = restored.objects[0];
    expect(l.type).toBe('line');
    expect(l.points[0].x).toBe(10);
    expect(l.points[1].x).toBe(100);
    expect(l.endArrow).toBe('arrow');
  });

  it('round-trips an arc', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const arc = createShape('arc', {
      x: 10, y: 10, width: 80, height: 60,
      startAngle: 0, endAngle: Math.PI, arcType: 'pie',
    });
    doc.addObject(arc);

    const svg = saveToSVG(doc);
    expect(svg).toContain('data-md-type="arc"');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    const a = restored.objects[0];
    expect(a.type).toBe('arc');
    expect(a.arcType).toBe('pie');
    expect(a.startAngle).toBe(0);
    expect(a.endAngle).toBeCloseTo(Math.PI);
  });

  it('round-trips a closed polygon', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const poly = createShape('polygon', {
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 40 }],
      closed: true,
    });
    doc.addObject(poly);

    const svg = saveToSVG(doc);
    expect(svg).toContain('<polygon');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    const p = restored.objects[0];
    expect(p.type).toBe('polygon');
    expect(p.closed).toBe(true);
    expect(p.points).toHaveLength(3);
    expect(p.points[1].x).toBe(50);
  });

  it('round-trips a freehand polyline', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const fh = createShape('freehand', {
      points: [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }],
      closed: false,
    });
    doc.addObject(fh);

    const svg = saveToSVG(doc);
    expect(svg).toContain('<polyline');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    const f = restored.objects[0];
    expect(f.type).toBe('freehand');
    expect(f.closed).toBe(false);
    expect(f.points).toHaveLength(3);
  });

  it('round-trips text', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const text = createShape('text', {
      x: 50, y: 100, width: 200, height: 30,
      text: 'Hello\nWorld', fontSize: 18, fontWeight: 'bold',
      fontStyle: 'italic', textAlign: 'center',
    });
    doc.addObject(text);

    const svg = saveToSVG(doc);
    expect(svg).toContain('<text');
    expect(svg).toContain('Hello');
    expect(svg).toContain('<tspan');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    const t = restored.objects[0];
    expect(t.type).toBe('text');
    expect(t.text).toBe('Hello\nWorld');
    expect(t.fontSize).toBe(18);
    expect(t.fontWeight).toBe('bold');
    expect(t.fontStyle).toBe('italic');
    expect(t.textAlign).toBe('center');
    expect(t.x).toBe(50);
    expect(t.y).toBe(100);
  });

  it('round-trips document metadata', () => {
    const doc = new Document({ pageWidth: 595, pageHeight: 842 });
    doc.unit = 'cm';
    doc.snapToGrid = true;
    doc.gridSize = 24;

    const svg = saveToSVG(doc);
    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.pageWidth).toBe(595);
    expect(restored.pageHeight).toBe(842);
    expect(restored.unit).toBe('cm');
    expect(restored.snapToGrid).toBe(true);
    expect(restored.gridSize).toBe(24);
  });

  it('round-trips stroke dash pattern', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const rect = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    rect.stroke.dash = [4, 4];
    doc.addObject(rect);

    const svg = saveToSVG(doc);
    expect(svg).toContain('stroke-dasharray="4,4"');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.objects[0].stroke.dash).toEqual([4, 4]);
  });

  it('round-trips rotation', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const rect = createShape('rect', { x: 10, y: 10, width: 100, height: 50 });
    rect.rotation = Math.PI / 4;
    doc.addObject(rect);

    const svg = saveToSVG(doc);
    expect(svg).toContain('rotate(');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.objects[0].rotation).toBeCloseTo(Math.PI / 4, 3);
  });

  it('round-trips locked state', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const rect = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    rect.locked = true;
    doc.addObject(rect);

    const svg = saveToSVG(doc);
    expect(svg).toContain('data-md-locked="true"');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.objects[0].locked).toBe(true);
  });

  it('preserves shape IDs', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const rect = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    const origId = rect.id;
    doc.addObject(rect);

    const svg = saveToSVG(doc);
    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.objects[0].id).toBe(origId);
  });

  it('round-trips empty document', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const svg = saveToSVG(doc);
    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.objects).toHaveLength(0);
  });

  it('rejects invalid SVG', () => {
    // DOMParser may wrap errors differently across environments,
    // but a non-svg root should be caught
    expect(() => loadFromSVG('<html><body>not svg</body></html>')).toThrow();
  });

  it('round-trips pattern fill metadata', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    const rect = createShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    rect.fill = { type: 'pattern', color: '#000000', patternId: 5 };
    doc.addObject(rect);

    const svg = saveToSVG(doc);
    expect(svg).toContain('data-md-patternId="5"');

    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.objects[0].fill.type).toBe('pattern');
    expect(restored.objects[0].fill.patternId).toBe(5);
  });

  it('round-trips multiple shapes in order', () => {
    const doc = new Document({ snapToGrid: false, showRulers: true });
    doc.addObject(createShape('rect', { x: 0, y: 0, width: 10, height: 10 }));
    doc.addObject(createShape('oval', { x: 20, y: 20, width: 30, height: 30 }));
    doc.addObject(createShape('line', { points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] }));

    const svg = saveToSVG(doc);
    resetIdCounter();
    const restored = loadFromSVG(svg);
    expect(restored.objects).toHaveLength(3);
    expect(restored.objects[0].type).toBe('rect');
    expect(restored.objects[1].type).toBe('oval');
    expect(restored.objects[2].type).toBe('line');
  });
});
