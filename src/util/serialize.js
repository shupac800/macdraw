import { Document } from '../model/Document.js';
import { createShape, resetIdCounter } from '../model/Shape.js';
import { patternSVG } from './patterns.js';
import { textLayout } from './text.js';

const STORAGE_KEY = 'macdraw_document';
const SVG_NS = 'http://www.w3.org/2000/svg';
// MacDraw-specific attributes stored as data-md-* on SVG elements

// ─── JSON (localStorage autosave only) ───────────────────────────

export function saveToJSON(doc) {
  return JSON.stringify({ format: 'macdraw-web', formatVersion: 1, ...doc.toJSON() }, null, 2);
}

export function loadFromJSON(jsonString) {
  const data = JSON.parse(jsonString);
  validateDocument(data);
  return Document.fromJSON(data);
}

export function validateDocument(data) {
  if (!data || !Array.isArray(data.objects) || !Array.isArray(data.groups)) throw new Error('This is not an editable MacDraw drawing.');
  if (data.formatVersion && data.formatVersion !== 1) throw new Error('This drawing uses an unsupported file version.');
  for (const key of ['pageWidth', 'pageHeight']) if (!Number.isFinite(data[key]) || data[key] <= 0 || data[key] > 8192) throw new Error('Invalid drawing dimensions.');
  if (data.objects.length > 10000) throw new Error('Too many objects in this drawing.');
  const ids = new Set();
  for (const shape of data.objects) {
    if (!shape || !['rect', 'roundRect', 'oval', 'line', 'arc', 'polygon', 'freehand', 'text'].includes(shape.type)) throw new Error('Invalid drawing object.');
    if (typeof shape.id !== 'string' || ids.has(shape.id)) throw new Error('Drawing object IDs must be unique.'); ids.add(shape.id);
    for (const key of ['x','y','width','height','rotation']) if (!Number.isFinite(shape[key])) throw new Error('Invalid object geometry.');
    if (shape.width < 0 || shape.height < 0 || shape.width > 100000 || shape.height > 100000 || Math.abs(shape.x) > 100000 || Math.abs(shape.y) > 100000) throw new Error('Invalid object bounds.');
    if (!shape.stroke || !Number.isFinite(shape.stroke.width) || shape.stroke.width < 0 || shape.stroke.width > 100 || !shape.fill) throw new Error('Invalid object appearance.');
    for (const style of [shape.stroke, shape.fill]) if (style.patternId != null && (!Number.isInteger(style.patternId) || style.patternId < 0 || style.patternId > 35)) throw new Error('Invalid pattern.');
    if (shape.points && (!Array.isArray(shape.points) || shape.points.length > 100000 || shape.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) throw new Error('Invalid drawing points.');
    if (shape.type === 'line' && shape.points?.length !== 2) throw new Error('A line must have two endpoints.');
    if (shape.type === 'text' && (typeof shape.text !== 'string' || !Number.isFinite(shape.fontSize) || shape.fontSize < 1 || shape.fontSize > 1000)) throw new Error('Invalid text object.');
  }
  if (data.gridSize !== undefined && (!Number.isFinite(data.gridSize) || data.gridSize < 0.01 || data.gridSize > 10000)) throw new Error('Invalid grid spacing.');
  if (data.rulerMajor !== undefined && (!Number.isFinite(data.rulerMajor) || data.rulerMajor <= 0)) throw new Error('Invalid ruler spacing.');
  if (data.rulerDivisions !== undefined && (!Number.isFinite(data.rulerDivisions) || data.rulerDivisions < 1 || data.rulerDivisions > 100)) throw new Error('Invalid ruler divisions.');
  if (data.unit !== undefined && !['inches','cm','points'].includes(data.unit)) throw new Error('Invalid ruler units.');
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 255)) throw new Error('Invalid drawing name.');
  for (const key of ['snapToGrid','showGrid','showRulers','showRulerLines','showSize']) if (data[key] !== undefined && typeof data[key] !== 'boolean') throw new Error('Invalid drawing settings.');
  if (data.rulerOrigin && (!Number.isFinite(data.rulerOrigin.x) || !Number.isFinite(data.rulerOrigin.y))) throw new Error('Invalid ruler zero point.');
  if (data.rulerIncrement !== undefined && (!Number.isFinite(data.rulerIncrement) || data.rulerIncrement <= 0)) throw new Error('Invalid ruler numbering.');
  const groupIds = new Set();
  for (const g of data.groups) {
    if (!g || typeof g.id !== 'string' || groupIds.has(g.id) || !Array.isArray(g.members) || g.members.some(id => !ids.has(id))) throw new Error('Invalid drawing group.');
    groupIds.add(g.id);
    if (g.previousGroups && (typeof g.previousGroups !== 'object' || Object.entries(g.previousGroups).some(([id, previous]) => !ids.has(id) || (previous != null && typeof previous !== 'string')))) throw new Error('Invalid nested group.');
  }
  for (const s of data.objects) {
    validateAppearance(s.stroke, s.fill);
    if (s.groupId != null && !groupIds.has(s.groupId)) throw new Error('Missing drawing group.');
    for (const key of ['cornerRadius','startAngle','endAngle']) if (s[key] !== undefined && !Number.isFinite(s[key])) throw new Error('Invalid object geometry.');
    if (s.type === 'text') validateText(s);
  }
  if (data._defaultStroke !== undefined) validateAppearance(data._defaultStroke, { type: 'none' });
  if (data._defaultFill !== undefined) validateAppearance({ width: 0 }, data._defaultFill);
  if (data._defaultText !== undefined) { if (!data._defaultText || typeof data._defaultText !== 'object') throw new Error('Invalid text defaults.'); validateText({ fontSize: 12, ...data._defaultText }); }
  if (data._cornerRadius !== undefined && (!Number.isFinite(data._cornerRadius) || data._cornerRadius < 0)) throw new Error('Invalid corner radius.');
}

function validateAppearance(stroke, fill) {
  if (!stroke || typeof stroke !== 'object' || !Number.isFinite(stroke.width) || stroke.width < 0 || stroke.width > 100 || !fill || !['none','solid','pattern'].includes(fill.type)) throw new Error('Invalid drawing appearance.');
  for (const style of [stroke, fill]) {
    if (style.color !== undefined && (typeof style.color !== 'string' || style.color.length > 100)) throw new Error('Invalid drawing color.');
    if (style.patternId != null && (!Number.isInteger(style.patternId) || style.patternId < 0 || style.patternId > 35)) throw new Error('Invalid drawing pattern.');
  }
  if (fill.type === 'pattern' && !Number.isInteger(fill.patternId)) throw new Error('Missing fill pattern.');
  if (stroke.dash !== undefined && (!Array.isArray(stroke.dash) || stroke.dash.length > 100 || stroke.dash.some(n => !Number.isFinite(n) || n < 0))) throw new Error('Invalid line style.');
}

function validateText(text) {
  if (!text || !Number.isFinite(text.fontSize) || text.fontSize < 1 || text.fontSize > 1000 || (text.fontFamily !== undefined && (typeof text.fontFamily !== 'string' || text.fontFamily.length > 200)) || (text.lineSpacing !== undefined && (!Number.isFinite(text.lineSpacing) || text.lineSpacing <= 0 || text.lineSpacing > 10))) throw new Error('Invalid text style.');
}

export function saveToLocalStorage(doc) {
  try {
    localStorage.setItem(STORAGE_KEY, saveToJSON(doc));
    return true;
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
    return false;
  }
}

export function loadFromLocalStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return loadFromJSON(data);
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    return null;
  }
}

export function clearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── SVG Save ─────────────────────────────────────────────────────

export function saveToSVG(doc) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  // xmlns is set automatically by createElementNS; don't duplicate it
  svg.setAttribute('width', doc.pageWidth);
  svg.setAttribute('height', doc.pageHeight);
  svg.setAttribute('viewBox', `0 0 ${doc.pageWidth} ${doc.pageHeight}`);
  const paper = document.createElementNS(SVG_NS, 'rect');
  paper.setAttribute('width', '100%'); paper.setAttribute('height', '100%'); paper.setAttribute('fill', '#fff'); paper.setAttribute('data-md-paper', 'true');
  svg.append(paper);

  // Store document metadata
  svg.setAttribute('data-md-unit', doc.unit);
  svg.setAttribute('data-md-snapToGrid', doc.snapToGrid);
  svg.setAttribute('data-md-gridSize', doc.gridSize);
  // A native snapshot preserves all editing information, without changing paint order.
  const metadata = document.createElementNS(SVG_NS, 'metadata'); metadata.setAttribute('id', 'macdraw-document'); metadata.textContent = saveToJSON(doc); svg.append(metadata);

  // Define patterns used by shapes
  const usedPatterns = new Set();
  for (const obj of doc.objects) {
    if (obj.fill?.type === 'pattern' && obj.fill.patternId != null) {
      usedPatterns.add(obj.fill.patternId);
    }
    if (obj.stroke?.patternId != null) usedPatterns.add(obj.stroke.patternId);
  }

  if (usedPatterns.size > 0) {
    const defs = document.createElementNS(SVG_NS, 'defs');
    for (const pid of usedPatterns) {
      const patternEl = createSVGPatternDef(pid);
      if (patternEl) defs.appendChild(patternEl);
    }
    // Arrowhead marker
    defs.appendChild(createArrowMarker());
    svg.appendChild(defs);
  } else {
    // Still may need arrowhead defs
    const needsArrows = doc.objects.some(
      o => o.startArrow === 'arrow' || o.endArrow === 'arrow'
    );
    if (needsArrows) {
      const defs = document.createElementNS(SVG_NS, 'defs');
      defs.appendChild(createArrowMarker());
      svg.appendChild(defs);
    }
  }

  // Paint every shape in document order. Group membership is editing metadata;
  // collecting SVG groups at the end used to change the exported stacking order.
  // Render each shape
  for (const obj of doc.objects) {
    const el = shapeToSVGElement(obj);
    if (!el) continue;

    svg.appendChild(el);
  }

  // Serialize to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svg);

  // Add XML declaration
  svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  return svgString;
}

function shapeToSVGElement(shape) {
  let el;

  const transforms = buildTransform(shape);

  switch (shape.type) {
    case 'rect':
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', shape.x);
      el.setAttribute('y', shape.y);
      el.setAttribute('width', shape.width);
      el.setAttribute('height', shape.height);
      break;

    case 'roundRect':
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', shape.x);
      el.setAttribute('y', shape.y);
      el.setAttribute('width', shape.width);
      el.setAttribute('height', shape.height);
      el.setAttribute('rx', shape.cornerRadius);
      el.setAttribute('ry', shape.cornerRadius);
      el.setAttribute('data-md-type', 'roundRect');
      break;

    case 'oval':
      el = document.createElementNS(SVG_NS, 'ellipse');
      el.setAttribute('cx', shape.x + shape.width / 2);
      el.setAttribute('cy', shape.y + shape.height / 2);
      el.setAttribute('rx', Math.abs(shape.width / 2));
      el.setAttribute('ry', Math.abs(shape.height / 2));
      break;

    case 'line':
      el = document.createElementNS(SVG_NS, 'line');
      el.setAttribute('x1', shape.points[0].x);
      el.setAttribute('y1', shape.points[0].y);
      el.setAttribute('x2', shape.points[1].x);
      el.setAttribute('y2', shape.points[1].y);
      if (shape.startArrow === 'arrow') {
        el.setAttribute('marker-start', 'url(#arrowhead-start)');
      }
      if (shape.endArrow === 'arrow') {
        el.setAttribute('marker-end', 'url(#arrowhead-end)');
      }
      if (shape.startArrow !== 'none') el.setAttribute('data-md-startArrow', shape.startArrow);
      if (shape.endArrow !== 'none') el.setAttribute('data-md-endArrow', shape.endArrow);
      break;

    case 'arc': {
      el = document.createElementNS(SVG_NS, 'path');
      const d = arcToSVGPath(shape);
      el.setAttribute('d', d);
      el.setAttribute('data-md-type', 'arc');
      el.setAttribute('data-md-startAngle', shape.startAngle);
      el.setAttribute('data-md-endAngle', shape.endAngle);
      el.setAttribute('data-md-arcType', shape.arcType);
      // Store bounding box for round-trip
      el.setAttribute('data-md-x', shape.x);
      el.setAttribute('data-md-y', shape.y);
      el.setAttribute('data-md-width', shape.width);
      el.setAttribute('data-md-height', shape.height);
      break;
    }

    case 'polygon':
    case 'freehand': {
      if (!shape.points || shape.points.length < 2) return null;
      if (shape.smooth && shape.points.length > 2) {
        el = document.createElementNS(SVG_NS, 'path');
        const pts = shape.points, last = pts.at(-1);
        const start = shape.closed ? { x: (last.x + pts[0].x) / 2, y: (last.y + pts[0].y) / 2 } : pts[0];
        let d = `M ${start.x} ${start.y}`;
        for (let i = shape.closed ? 0 : 1; i < pts.length; i++) {
          const next = pts[(i + 1) % pts.length];
          const end = !shape.closed && i === pts.length - 1 ? pts[i] : { x: (pts[i].x + next.x) / 2, y: (pts[i].y + next.y) / 2 };
          d += ` Q ${pts[i].x} ${pts[i].y} ${end.x} ${end.y}`;
        }
        el.setAttribute('d', d + (shape.closed ? ' Z' : ''));
      } else if (shape.closed) {
        el = document.createElementNS(SVG_NS, 'polygon');
        el.setAttribute('points', shape.points.map(p => `${p.x},${p.y}`).join(' '));
      } else {
        el = document.createElementNS(SVG_NS, 'polyline');
        el.setAttribute('points', shape.points.map(p => `${p.x},${p.y}`).join(' '));
      }
      el.setAttribute('data-md-type', shape.type);
      break;
    }

    case 'text': {
      const group = document.createElementNS(SVG_NS, 'g');
      const text = document.createElementNS(SVG_NS, 'text');
      el = text;
      // The same font metrics and wrapping drive the canvas and the exported SVG.
      const ctx = typeof window !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
      const fallback = { measureText: line => ({ width: line.length * shape.fontSize * 0.6 }) };
      const { lines, ascent, lineHeight } = textLayout(ctx || fallback, shape);
      let textX = shape.x;
      let anchor = 'start';
      if (shape.textAlign === 'center') {
        textX = shape.x + shape.width / 2;
        anchor = 'middle';
      } else if (shape.textAlign === 'right') {
        textX = shape.x + shape.width;
        anchor = 'end';
      }
      el.setAttribute('x', textX);
      el.setAttribute('y', shape.y + ascent);
      el.setAttribute('text-anchor', anchor);
      el.setAttribute('font-family', shape.fontFamily);
      el.setAttribute('font-size', shape.fontSize);
      if (shape.fontWeight !== 'normal') el.setAttribute('font-weight', shape.fontWeight);
      if (shape.fontStyle !== 'normal') el.setAttribute('font-style', shape.fontStyle);
      el.setAttribute('xml:space', 'preserve');

      // Store bounds for round-trip
      el.setAttribute('data-md-x', shape.x);
      el.setAttribute('data-md-y', shape.y);
      el.setAttribute('data-md-width', shape.width);
      el.setAttribute('data-md-height', shape.height);
      el.setAttribute('data-md-textAlign', shape.textAlign);

      // Multi-line: use <tspan> elements
      lines.forEach((line, i) => {
        const tspan = document.createElementNS(SVG_NS, 'tspan');
        tspan.setAttribute('x', textX);
        tspan.setAttribute('y', shape.y + ascent + i * lineHeight);
        tspan.textContent = line;
        el.appendChild(tspan);
      });
      applyStrokeFillAttrs(text, shape);
      if (shape.fill.type !== 'none') {
        const background = document.createElementNS(SVG_NS, 'rect');
        for (const key of ['x','y','width','height']) background.setAttribute(key, shape[key]);
        applyStrokeFillAttrs(background, { ...shape, type: 'rect', stroke: { width: 0 } }); group.append(background);
      }
      if (shape.shadow) {
        const shadow = text.cloneNode(true); shadow.setAttribute('fill', '#000'); shadow.setAttribute('stroke', 'none'); shadow.setAttribute('transform', 'translate(2 2)'); group.append(shadow);
        const gap = text.cloneNode(true); gap.setAttribute('fill', '#fff'); gap.setAttribute('stroke', 'none'); gap.setAttribute('transform', 'translate(1 1)'); group.append(gap);
      }
      group.append(text);
      if (shape.textDecoration === 'underline') lines.forEach((line, i) => {
        const width = (ctx || fallback).measureText(line).width;
        const x = textX - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
        const rule = document.createElementNS(SVG_NS, 'line');
        rule.setAttribute('x1', x); rule.setAttribute('x2', x + width); rule.setAttribute('y1', shape.y + ascent + i * lineHeight + 2); rule.setAttribute('y2', shape.y + ascent + i * lineHeight + 2); rule.setAttribute('stroke', '#000'); group.append(rule);
      });
      group.setAttribute('data-md-type', 'text');
      // Keep the old text primitive for simple exports; the wrapper is needed for
      // patterned backgrounds, shadows and hand-drawn underline positioning.
      if (shape.fill.type !== 'none' || shape.shadow || shape.textDecoration === 'underline') el = group;
      break;
    }

    default:
      return null;
  }

  // Common attributes
  el.setAttribute('id', shape.id);
  if (shape.type !== 'text' || el.localName === 'text') applyStrokeFillAttrs(el, shape);

  if (transforms) el.setAttribute('transform', transforms);
  if (shape.locked) el.setAttribute('data-md-locked', 'true');

  return el;
}

function applyStrokeFillAttrs(el, shape) {
  // Stroke
  if (shape.stroke && shape.stroke.width > 0) {
    el.setAttribute('stroke', shape.stroke.patternId != null ? `url(#macdraw-pattern-${shape.stroke.patternId})` : shape.stroke.color);
    el.setAttribute('stroke-width', shape.stroke.width);
    if (shape.stroke.cap !== 'butt') el.setAttribute('stroke-linecap', shape.stroke.cap);
    if (shape.stroke.join !== 'miter') el.setAttribute('stroke-linejoin', shape.stroke.join);
    if (shape.stroke.dash && shape.stroke.dash.length > 0) {
      el.setAttribute('stroke-dasharray', shape.stroke.dash.join(','));
    }
  } else {
    el.setAttribute('stroke', 'none');
  }

  // Fill
  if (!shape.fill || shape.fill.type === 'none') {
    el.setAttribute('fill', 'none');
  } else if (shape.fill.type === 'solid') {
    el.setAttribute('fill', shape.fill.color);
  } else if (shape.fill.type === 'pattern') {
    el.setAttribute('fill', `url(#macdraw-pattern-${shape.fill.patternId})`);
    el.setAttribute('data-md-fillType', 'pattern');
    el.setAttribute('data-md-patternId', shape.fill.patternId);
  }
  if (shape.type === 'text') { el.setAttribute('fill', '#000'); el.setAttribute('stroke', shape.outline ? '#000' : 'none'); if (shape.outline) { el.setAttribute('fill', 'none'); el.setAttribute('stroke-width', '1'); } }
}

function buildTransform(shape) {
  const parts = [];
  const xs = shape.points?.map(p => p.x), ys = shape.points?.map(p => p.y);
  const cx = xs?.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : shape.x + shape.width / 2;
  const cy = ys?.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : shape.y + shape.height / 2;

  if (shape.rotation) {
    const deg = shape.rotation * (180 / Math.PI);
    parts.push(`rotate(${deg} ${cx} ${cy})`);
  }
  if (shape.flipH || shape.flipV) {
    parts.push(`translate(${cx} ${cy})`);
    parts.push(`scale(${shape.flipH ? -1 : 1} ${shape.flipV ? -1 : 1})`);
    parts.push(`translate(${-cx} ${-cy})`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

function arcToSVGPath(shape) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rx = Math.abs(shape.width / 2);
  const ry = Math.abs(shape.height / 2);
  const start = shape.startAngle;
  const end = shape.endAngle;

  const x1 = cx + rx * Math.cos(start);
  const y1 = cy + ry * Math.sin(start);
  const x2 = cx + rx * Math.cos(end);
  const y2 = cy + ry * Math.sin(end);

  let sweep = end - start;
  if (sweep < 0) sweep += Math.PI * 2;
  const largeArc = sweep > Math.PI ? 1 : 0;

  let d = `M ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2}`;
  if (sweep >= Math.PI * 2 - 1e-8) {
    const mx = cx + rx * Math.cos(start + Math.PI), my = cy + ry * Math.sin(start + Math.PI);
    d = `M ${x1} ${y1} A ${rx} ${ry} 0 1 1 ${mx} ${my} A ${rx} ${ry} 0 1 1 ${x1} ${y1}`;
  }

  if (shape.arcType === 'pie') {
    d += ` L ${cx} ${cy} Z`;
  } else if (shape.arcType === 'closed') {
    d += ' Z';
  }

  return d;
}

function createArrowMarker() {
  const frag = document.createDocumentFragment();

  const markerEnd = document.createElementNS(SVG_NS, 'marker');
  markerEnd.setAttribute('id', 'arrowhead-end');
  markerEnd.setAttribute('markerUnits', 'userSpaceOnUse');
  markerEnd.setAttribute('markerWidth', '12');
  markerEnd.setAttribute('markerHeight', '12');
  markerEnd.setAttribute('refX', '10.392');
  markerEnd.setAttribute('refY', '6');
  markerEnd.setAttribute('orient', 'auto');
  const pathEnd = document.createElementNS(SVG_NS, 'path');
  pathEnd.setAttribute('d', 'M 0 0 L 10.392 6 L 0 12 Z');
  pathEnd.setAttribute('fill', 'context-stroke');
  markerEnd.appendChild(pathEnd);

  const markerStart = document.createElementNS(SVG_NS, 'marker');
  markerStart.setAttribute('id', 'arrowhead-start');
  markerStart.setAttribute('markerWidth', '12');
  markerStart.setAttribute('markerUnits', 'userSpaceOnUse');
  markerStart.setAttribute('markerHeight', '12');
  markerStart.setAttribute('refX', '10.392');
  markerStart.setAttribute('refY', '6');
  markerStart.setAttribute('orient', 'auto-start-reverse');
  const pathStart = document.createElementNS(SVG_NS, 'path');
  pathStart.setAttribute('d', 'M 0 0 L 10.392 6 L 0 12 Z');
  pathStart.setAttribute('fill', 'context-stroke');
  markerStart.appendChild(pathStart);

  frag.appendChild(markerEnd);
  frag.appendChild(markerStart);
  return frag;
}

function createSVGPatternDef(patternId) {
  // Pixel rectangles keep the tiles portable and exactly black-and-white.
  const pat = document.createElementNS(SVG_NS, 'pattern');
  pat.setAttribute('id', `macdraw-pattern-${patternId}`);
  pat.setAttribute('width', '8');
  pat.setAttribute('height', '8');
  pat.setAttribute('patternUnits', 'userSpaceOnUse');
  pat.setAttribute('shape-rendering', 'crispEdges');
  pat.innerHTML = patternSVG(patternId);
  return pat;
}

export function saveToSVGWithPatterns(doc) { return saveToSVG(doc); }

// ─── SVG Load ─────────────────────────────────────────────────────

export function loadFromSVG(svgString) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = svgDoc.documentElement;

  // Check for parse errors
  const parseError = svgDoc.querySelector('parsererror') || svg.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid SVG: ' + parseError.textContent);
  }
  // Also check if root element is not SVG (another sign of parse failure)
  if (svg.tagName !== 'svg' && svg.localName !== 'svg') {
    throw new Error('Invalid SVG: root element is not <svg>');
  }

  const metadata = svg.querySelector('metadata[id="macdraw-document"]');
  if (metadata) return loadFromJSON(metadata.textContent);

  const pageWidth = parseFloat(svg.getAttribute('width')) || 612;
  const pageHeight = parseFloat(svg.getAttribute('height')) || 792;
  const unit = svg.getAttribute('data-md-unit') || 'inches';
  const snapToGrid = svg.getAttribute('data-md-snapToGrid') === 'true';
  const gridSize = parseFloat(svg.getAttribute('data-md-gridSize')) || 18;

  const doc = new Document({ pageWidth, pageHeight });
  doc.unit = unit;
  doc.snapToGrid = snapToGrid;
  doc.gridSize = gridSize;

  // Track max shape id for counter reset
  let maxId = 0;

  const groups = [];
  const readChildren = (parent, group = null) => {
    for (const child of parent.children) {
      if (['defs','metadata','style'].includes(child.localName) || child.hasAttribute('data-md-paper')) continue;
      if (child.localName === 'g') {
        const current = child.getAttribute('data-md-type') === 'group' ? { id: child.getAttribute('id') || `group_${crypto.randomUUID()}`, members: [] } : group;
        if (current && current !== group) groups.push(current);
        readChildren(child, current);
        continue;
      }
      const shape = svgElementToShape(child);
      if (shape) { if (group) { shape.groupId = group.id; group.members.push(shape.id); } doc.addObject(shape); maxId = Math.max(maxId, parseIdNum(shape.id)); }
    }
  };
  readChildren(svg);

  doc.groups = groups;

  // Reset ID counter past existing IDs
  resetIdCounter(maxId + 1);
  validateDocument(doc.toJSON());
  return doc;
}

function parseIdNum(id) {
  const m = id.match(/shape_(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function svgElementToShape(el) {
  const tag = el.tagName;
  const id = el.getAttribute('id');
  const mdType = el.getAttribute('data-md-type');
  const locked = el.getAttribute('data-md-locked') === 'true';

  // Parse stroke/fill
  const stroke = parseStrokeAttrs(el);
  const fill = parseFillAttrs(el);
  const { rotation, flipH, flipV } = parseTransform(el);

  let shape;

  if (tag === 'rect' && mdType === 'roundRect') {
    shape = createShape('roundRect', {
      x: parseFloat(el.getAttribute('x')) || 0,
      y: parseFloat(el.getAttribute('y')) || 0,
      width: parseFloat(el.getAttribute('width')) || 0,
      height: parseFloat(el.getAttribute('height')) || 0,
      cornerRadius: parseFloat(el.getAttribute('rx')) || 12,
      stroke, fill, rotation, flipH, flipV, locked,
    });
  } else if (tag === 'rect') {
    shape = createShape('rect', {
      x: parseFloat(el.getAttribute('x')) || 0,
      y: parseFloat(el.getAttribute('y')) || 0,
      width: parseFloat(el.getAttribute('width')) || 0,
      height: parseFloat(el.getAttribute('height')) || 0,
      stroke, fill, rotation, flipH, flipV, locked,
    });
  } else if (tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx')) || 0;
    const cy = parseFloat(el.getAttribute('cy')) || 0;
    const rx = parseFloat(el.getAttribute('rx')) || 0;
    const ry = parseFloat(el.getAttribute('ry')) || 0;
    shape = createShape('oval', {
      x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2,
      stroke, fill, rotation, flipH, flipV, locked,
    });
  } else if (tag === 'line') {
    const p1 = { x: parseFloat(el.getAttribute('x1')) || 0, y: parseFloat(el.getAttribute('y1')) || 0 };
    const p2 = { x: parseFloat(el.getAttribute('x2')) || 0, y: parseFloat(el.getAttribute('y2')) || 0 };
    shape = createShape('line', {
      points: [p1, p2],
      x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
      width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y),
      startArrow: el.getAttribute('data-md-startArrow') || 'none',
      endArrow: el.getAttribute('data-md-endArrow') || 'none',
      stroke, fill, rotation, flipH, flipV, locked,
    });
  } else if (tag === 'path' && mdType === 'arc') {
    shape = createShape('arc', {
      x: parseFloat(el.getAttribute('data-md-x')) || 0,
      y: parseFloat(el.getAttribute('data-md-y')) || 0,
      width: parseFloat(el.getAttribute('data-md-width')) || 0,
      height: parseFloat(el.getAttribute('data-md-height')) || 0,
      startAngle: parseFloat(el.getAttribute('data-md-startAngle')) || 0,
      endAngle: parseFloat(el.getAttribute('data-md-endAngle')) || Math.PI / 2,
      arcType: el.getAttribute('data-md-arcType') || 'open',
      stroke, fill, rotation, flipH, flipV, locked,
    });
  } else if (tag === 'polygon' || tag === 'polyline') {
    const pointsStr = el.getAttribute('points') || '';
    const points = pointsStr.trim().split(/\s+/).map(pair => {
      const [x, y] = pair.split(',').map(Number);
      return { x, y };
    }).filter(p => !isNaN(p.x) && !isNaN(p.y));

    const type = mdType || (tag === 'polygon' ? 'polygon' : 'freehand');
    shape = createShape(type, {
      points,
      closed: tag === 'polygon',
      stroke, fill, rotation, flipH, flipV, locked,
    });
  } else if (tag === 'text') {
    const text = extractTextContent(el);
    const fontSize = parseFloat(el.getAttribute('font-size')) || 14;
    const fontFamily = el.getAttribute('font-family') || 'Helvetica, Arial, sans-serif';
    const fontWeight = el.getAttribute('font-weight') || 'normal';
    const fontStyle = el.getAttribute('font-style') || 'normal';
    const textDecoration = el.getAttribute('text-decoration') || 'none';
    const textAlign = el.getAttribute('data-md-textAlign') || anchorToAlign(el.getAttribute('text-anchor'));

    shape = createShape('text', {
      x: parseFloat(el.getAttribute('data-md-x') || el.getAttribute('x')) || 0,
      y: parseFloat(el.getAttribute('data-md-y')) || ((parseFloat(el.getAttribute('y')) || 0) - fontSize),
      width: parseFloat(el.getAttribute('data-md-width')) || 200,
      height: parseFloat(el.getAttribute('data-md-height')) || fontSize * 1.5,
      text, fontFamily, fontSize, fontWeight, fontStyle, textDecoration, textAlign,
      stroke, fill, rotation, flipH, flipV, locked,
    });
  } else {
    return null;
  }

  // Preserve original ID if it's a macdraw ID
  if (id && id.match(/^shape_\d+$/)) {
    shape.id = id;
  }

  return shape;
}

function parseStrokeAttrs(el) {
  const color = el.getAttribute('stroke');
  if (!color || color === 'none') {
    return { color: '#000000', width: 0, dash: [], cap: 'round', join: 'round' };
  }
  return {
    color,
    width: parseFloat(el.getAttribute('stroke-width')) || 1,
    dash: (el.getAttribute('stroke-dasharray') || '').split(',').map(Number).filter(n => !isNaN(n) && n > 0),
    cap: el.getAttribute('stroke-linecap') || 'round',
    join: el.getAttribute('stroke-linejoin') || 'round',
  };
}

function parseFillAttrs(el) {
  const fillAttr = el.getAttribute('fill');
  const mdFillType = el.getAttribute('data-md-fillType');

  if (mdFillType === 'pattern') {
    return {
      type: 'pattern',
      color: '#000000',
      patternId: parseInt(el.getAttribute('data-md-patternId')) || 0,
    };
  }

  if (!fillAttr || fillAttr === 'none') {
    return { type: 'none', color: '#ffffff', patternId: null };
  }

  return { type: 'solid', color: fillAttr, patternId: null };
}

function parseTransform(el) {
  const transform = el.getAttribute('transform') || '';
  let rotation = 0, flipH = false, flipV = false;

  const rotateMatch = transform.match(/rotate\(([-\d.]+)/);
  if (rotateMatch) {
    rotation = parseFloat(rotateMatch[1]) * (Math.PI / 180);
  }

  const scaleMatch = transform.match(/scale\(([-\d.]+)\s*,?\s*([-\d.]+)\)/);
  if (scaleMatch) {
    if (parseFloat(scaleMatch[1]) === -1) flipH = true;
    if (parseFloat(scaleMatch[2]) === -1) flipV = true;
  }

  return { rotation, flipH, flipV };
}

function extractTextContent(textEl) {
  const tspans = textEl.querySelectorAll('tspan');
  if (tspans.length > 0) {
    return Array.from(tspans).map(ts => ts.textContent).join('\n');
  }
  return textEl.textContent || '';
}

function anchorToAlign(anchor) {
  if (anchor === 'middle') return 'center';
  if (anchor === 'end') return 'right';
  return 'left';
}

// ─── SVG File I/O ─────────────────────────────────────────────────

export function downloadSVG(doc, patternRegistry, filename = 'drawing.svg') {
  const svg = patternRegistry ? saveToSVGWithPatterns(doc, patternRegistry) : saveToSVG(doc);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openSVGFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(loadFromSVG(reader.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    };
    input.click();
  });
}

// ─── Export to PDF ────────────────────────────────────────────────

export function exportToPDF(doc, patternRegistry) {
  // Use the SVG and print-to-PDF via a hidden iframe
  const svg = patternRegistry ? saveToSVGWithPatterns(doc, patternRegistry) : saveToSVG(doc);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;';
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
  iframe.src = url;
}
