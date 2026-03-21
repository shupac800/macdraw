import { Document } from '../model/Document.js';
import { createShape, resetIdCounter } from '../model/Shape.js';

const STORAGE_KEY = 'macdraw_document';
const SVG_NS = 'http://www.w3.org/2000/svg';
// MacDraw-specific attributes stored as data-md-* on SVG elements

// ─── JSON (localStorage autosave only) ───────────────────────────

export function saveToJSON(doc) {
  return JSON.stringify(doc.toJSON(), null, 2);
}

export function loadFromJSON(jsonString) {
  const data = JSON.parse(jsonString);
  return Document.fromJSON(data);
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

  // Store document metadata
  svg.setAttribute('data-md-unit', doc.unit);
  svg.setAttribute('data-md-snapToGrid', doc.snapToGrid);
  svg.setAttribute('data-md-gridSize', doc.gridSize);

  // Define patterns used by shapes
  const usedPatterns = new Set();
  for (const obj of doc.objects) {
    if (obj.fill?.type === 'pattern' && obj.fill.patternId != null) {
      usedPatterns.add(obj.fill.patternId);
    }
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

  // Collect groups
  const groupMap = new Map(); // groupId → <g> element
  for (const group of doc.groups) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('id', group.id);
    g.setAttribute('data-md-type', 'group');
    groupMap.set(group.id, g);
  }

  // Render each shape
  for (const obj of doc.objects) {
    const el = shapeToSVGElement(obj);
    if (!el) continue;

    if (obj.groupId && groupMap.has(obj.groupId)) {
      groupMap.get(obj.groupId).appendChild(el);
    } else {
      svg.appendChild(el);
    }
  }

  // Append group <g> elements
  for (const g of groupMap.values()) {
    if (g.childNodes.length > 0) {
      svg.appendChild(g);
    }
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
      if (shape.closed) {
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
      el = document.createElementNS(SVG_NS, 'text');
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
      el.setAttribute('y', shape.y + shape.fontSize);
      el.setAttribute('text-anchor', anchor);
      el.setAttribute('font-family', shape.fontFamily);
      el.setAttribute('font-size', shape.fontSize);
      if (shape.fontWeight !== 'normal') el.setAttribute('font-weight', shape.fontWeight);
      if (shape.fontStyle !== 'normal') el.setAttribute('font-style', shape.fontStyle);
      if (shape.textDecoration !== 'none') el.setAttribute('text-decoration', shape.textDecoration);

      // Store bounds for round-trip
      el.setAttribute('data-md-x', shape.x);
      el.setAttribute('data-md-y', shape.y);
      el.setAttribute('data-md-width', shape.width);
      el.setAttribute('data-md-height', shape.height);
      el.setAttribute('data-md-textAlign', shape.textAlign);

      // Multi-line: use <tspan> elements
      const lines = (shape.text || '').split('\n');
      const lineHeight = shape.fontSize * 1.3;
      lines.forEach((line, i) => {
        const tspan = document.createElementNS(SVG_NS, 'tspan');
        tspan.setAttribute('x', textX);
        if (i > 0) tspan.setAttribute('dy', lineHeight);
        tspan.textContent = line;
        el.appendChild(tspan);
      });
      break;
    }

    default:
      return null;
  }

  // Common attributes
  el.setAttribute('id', shape.id);
  applyStrokeFillAttrs(el, shape);

  if (transforms) el.setAttribute('transform', transforms);
  if (shape.locked) el.setAttribute('data-md-locked', 'true');

  return el;
}

function applyStrokeFillAttrs(el, shape) {
  // Stroke
  if (shape.stroke && shape.stroke.width > 0) {
    el.setAttribute('stroke', shape.stroke.color);
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
}

function buildTransform(shape) {
  const parts = [];
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;

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
  markerEnd.setAttribute('markerWidth', '12');
  markerEnd.setAttribute('markerHeight', '8');
  markerEnd.setAttribute('refX', '12');
  markerEnd.setAttribute('refY', '4');
  markerEnd.setAttribute('orient', 'auto');
  const pathEnd = document.createElementNS(SVG_NS, 'path');
  pathEnd.setAttribute('d', 'M 0 0 L 12 4 L 0 8 Z');
  pathEnd.setAttribute('fill', 'context-stroke');
  markerEnd.appendChild(pathEnd);

  const markerStart = document.createElementNS(SVG_NS, 'marker');
  markerStart.setAttribute('id', 'arrowhead-start');
  markerStart.setAttribute('markerWidth', '12');
  markerStart.setAttribute('markerHeight', '8');
  markerStart.setAttribute('refX', '0');
  markerStart.setAttribute('refY', '4');
  markerStart.setAttribute('orient', 'auto-start-reverse');
  const pathStart = document.createElementNS(SVG_NS, 'path');
  pathStart.setAttribute('d', 'M 12 0 L 0 4 L 12 8 Z');
  pathStart.setAttribute('fill', 'context-stroke');
  markerStart.appendChild(pathStart);

  frag.appendChild(markerEnd);
  frag.appendChild(markerStart);
  return frag;
}

function createSVGPatternDef(patternId) {
  // Patterns are procedural — we encode them as an SVG <pattern> with an <image>
  // referencing a data URI from the offscreen canvas.
  // This requires the PatternRegistry at save time, so we'll embed a simple
  // placeholder. The actual pattern rendering is handled by patternRegistry
  // if available at save time.
  const pat = document.createElementNS(SVG_NS, 'pattern');
  pat.setAttribute('id', `macdraw-pattern-${patternId}`);
  pat.setAttribute('width', '8');
  pat.setAttribute('height', '8');
  pat.setAttribute('patternUnits', 'userSpaceOnUse');
  // The actual pattern image will be injected by saveToSVGWithPatterns
  return pat;
}

/**
 * Save to SVG with pattern images embedded.
 * Call this from the app where patternRegistry is available.
 */
export function saveToSVGWithPatterns(doc, patternRegistry) {
  const svgString = saveToSVG(doc);

  if (!patternRegistry) return svgString;

  // Parse, inject pattern images, re-serialize
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = svgDoc.documentElement;

  // Find all pattern elements and inject their canvas data
  const patterns = svg.querySelectorAll('pattern[id^="macdraw-pattern-"]');
  for (const pat of patterns) {
    const id = parseInt(pat.getAttribute('id').replace('macdraw-pattern-', ''));
    const canvas = patternRegistry.getPatternCanvas(id);
    if (canvas) {
      const dataURL = canvas.toDataURL('image/png');
      const img = svgDoc.createElementNS(SVG_NS, 'image');
      img.setAttribute('href', dataURL);
      img.setAttribute('width', '8');
      img.setAttribute('height', '8');
      pat.appendChild(img);
    }
  }

  const serializer = new XMLSerializer();
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svg);
}

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

  // Parse groups
  const groups = [];
  const groupElements = svg.querySelectorAll('g[data-md-type="group"]');
  for (const gEl of groupElements) {
    const groupId = gEl.getAttribute('id');
    const memberIds = [];
    for (const child of gEl.children) {
      const shape = svgElementToShape(child);
      if (shape) {
        shape.groupId = groupId;
        doc.addObject(shape);
        memberIds.push(shape.id);
        maxId = Math.max(maxId, parseIdNum(shape.id));
      }
    }
    groups.push({ id: groupId, members: memberIds });
  }

  // Parse top-level shapes (not in groups)
  for (const child of svg.children) {
    if (child.tagName === 'defs') continue;
    if (child.tagName === 'g' && child.getAttribute('data-md-type') === 'group') continue;

    const shape = svgElementToShape(child);
    if (shape) {
      doc.addObject(shape);
      maxId = Math.max(maxId, parseIdNum(shape.id));
    }
  }

  doc.groups = groups;

  // Reset ID counter past existing IDs
  resetIdCounter(maxId + 1);

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
