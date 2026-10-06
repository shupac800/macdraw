import { getVisualBounds as getBounds, getMultiBounds } from '../../model/Shape.js';
import { getHandleAtPoint, getSelectionHandleBounds, normalizeRect, rotatePoint, boundingBox } from '../../util/geometry.js';
import { HANDLE_SIZE, ROTATION_HANDLE_DISTANCE, TOOLS } from '../../util/constants.js';
import { MoveCommand } from '../../commands/MoveCommand.js';
import { ResizeGroupCommand } from '../../commands/ResizeGroupCommand.js';

export class SelectTool {
  constructor() {
    this.manager = null;
    this.doc = null;
    this.selection = null;
    this.commandStack = null;
    this.overlay = null;
    this.cursor = null;

    this._dragging = false;
    this._mode = null; // 'move', 'resize', 'marquee', 'rotate'
    this._startPoint = null;
    this._lastPoint = null;
    this._handle = null;
    this._startBounds = null; // unified bounds for resize/rotate
    this._startSnapshots = null; // per-shape snapshots for undo
  }

  activate() {
    this.cursor?.setDefault();
  }

  _isMovable(shape) {
    return !!shape && !shape.locked && (!shape.groupId || this.doc.getGroupMembers(shape.groupId).every(member => !member.locked));
  }

  deactivate() {
    if (this._dragging && this._startSnapshots) this._restoreSnapshots(this._startSnapshots);
    if (this._mode === 'marquee' && this._selectionBefore) this.selection.selectMultiple(this._selectionBefore);
    this._dragging = false;
    this._mode = null;
    this._startSnapshots = null;
    if (this.overlay) { this.overlay.marquee = null; this.overlay.trackingIds = null; this.overlay.trackingOriginals = null; }
    this.doc?._notify('preview');
  }

  onMouseDown(point, modifiers = {}) {
    this._startPoint = { ...point };
    this._lastPoint = { ...point };
    this._startSnapshots = null;
    this._resizeIds = null;
    this._selectionBefore = [...this.selection.ids];
    this._marqueeShift = !!modifiers.shiftKey;
    this._trackingStarted = false;
    this._originalObjects = new Map(this.doc.objects.map(s => [s.id, structuredClone(s)]));

    // Shift starts a selection gesture even over an existing object. A short
    // gesture toggles the top hit; a dragged frame toggles enclosed units.
    if (modifiers.shiftKey) {
      this._dragging = true;
      this._mode = 'marquee';
      return;
    }

    // Check handles on unified selection bounds (skip when shift is held)
    if (!this.selection.isEmpty && !modifiers.shiftKey) {
      const selectedShapes = this.selection.getSelectedObjects(this.doc);
      const unifiedBounds = selectedShapes.length === 1
        ? getBounds(selectedShapes[0])
        : getMultiBounds(selectedShapes);

      // Check rotation handle
      const rotX = unifiedBounds.x + unifiedBounds.width / 2;
      const rotY = unifiedBounds.y - ROTATION_HANDLE_DISTANCE;
      if (selectedShapes.every(s => !s.locked) && this.overlay?.showRotationHandle !== false && Math.abs(point.x - rotX) < 8 && Math.abs(point.y - rotY) < 8) {
        this._dragging = true;
        this._mode = 'rotate';
        this._startBounds = { ...unifiedBounds };
        this._startSnapshots = this._snapshotShapes(selectedShapes);
        this.cursor?.setRotate();
        return;
      }

      const hit = this._handleHit(point);
      if (hit) {
        this._dragging = true; this._mode = 'resize'; this._handle = hit.handle;
        this._resizeIds = hit.objects.map(s => s.id);
        this._startBounds = getMultiBounds(hit.objects);
        this._startSnapshots = this._snapshotShapes(hit.objects);
        this.cursor?.setForHandle(hit.handle); return;
      }
    }

    // Check if clicking on a shape
    const clickedShape = this.doc.getObjectAtPoint(point, 5 / (this.manager?.zoom || 1));

    if (clickedShape) {
      const members = clickedShape.groupId ? this.doc.getGroupMembers(clickedShape.groupId) : [clickedShape];
      if (!this.selection.has(clickedShape.id)) {
        this.selection.selectMultiple(members.map(m => m.id));
      }

      // Expand a partial group selection without throwing away other selected
      // objects. A click on any selected member must drag the entire selection.
      if (clickedShape.groupId && !modifiers.shiftKey) {
        for (const member of members) {
          if (!this.selection.has(member.id)) this.selection.add(member.id);
        }
      }

      if (members.some(m => m.locked)) return;

      this._dragging = true;
      this._mode = 'move';
      this._startSnapshots = this._snapshotShapes(this.selection.getSelectedObjects(this.doc));
      this._moveDelta = { x: 0, y: 0 };
      this.cursor?.setMove();
    } else {
      // Start marquee selection
      if (!modifiers.shiftKey) {
        this.selection.clear();
      }
      this._dragging = true;
      this._mode = 'marquee';
    }
  }

  onMouseMove(point, modifiers) {
    if (!this._dragging) {
      this._updateHoverCursor(point);
      return;
    }

    // A few native drawing pixels of hand jitter are still a click.
    if (!this._trackingStarted) {
      const zoom = this.manager?.zoom || 1;
      if (Math.abs(point.x - this._startPoint.x) * zoom < 2 && Math.abs(point.y - this._startPoint.y) * zoom < 2) return;
      this._trackingStarted = true;
    }

    switch (this._mode) {
      case 'move':
        this._restoreSnapshots(this._startSnapshots);
        let dx = point.x - this._startPoint.x, dy = point.y - this._startPoint.y;
        if (modifiers?.shiftKey) {
          const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
          const distance = dx * Math.cos(angle) + dy * Math.sin(angle);
          dx = distance * Math.cos(angle); dy = distance * Math.sin(angle);
          if (Math.abs(dx) < 1e-8) dx = 0; if (Math.abs(dy) < 1e-8) dy = 0;
        }
        if (this.doc.snapToGrid) {
          const shapes = this.selection.getSelectedObjects(this.doc);
          const step = this.doc.gridSize / (shapes.every(s => s.type === 'text' && !s.groupId) ? 2 : 1);
          const origin = this.doc.rulerOrigin;
          const b = getMultiBounds(this._startSnapshots.filter(s => this._isMovable(this.doc.getObjectById(s.id))));
          const delta = (start, distance, zero) => zero + Math.round((start + distance - zero) / step) * step - start;
          dx = modifiers?.shiftKey && dx === 0 ? 0 : delta(b.x, dx, origin.x);
          dy = modifiers?.shiftKey && dy === 0 ? 0 : delta(b.y, dy, origin.y);
        }
        const b = getMultiBounds(this._startSnapshots.filter(s => this._isMovable(this.doc.getObjectById(s.id))));
        dx = Math.max(Math.min(0, -b.x), Math.min(Math.max(0, this.doc.pageWidth - b.x - b.width), dx));
        dy = Math.max(Math.min(0, -b.y), Math.min(Math.max(0, this.doc.pageHeight - b.y - b.height), dy));
        this._moveDelta = { x: dx, y: dy };
        if (this.overlay) {
          this.overlay.trackingIds = this.selection.ids.filter(id => this._isMovable(this.doc.getObjectById(id)));
          this.overlay.trackingOriginals = this._originalObjects;
          this.overlay.trackingOutlines = !!modifiers?.altKey;
        }
        this._handleMove(dx, dy);
        break;
      case 'resize':
        this._handleResize(point, modifiers);
        break;
      case 'marquee':
        this._handleMarquee(point);
        break;
      case 'rotate':
        this._handleRotate(point);
        break;
    }

    this._lastPoint = { ...point };
  }

  onMouseUp(point, modifiers = {}) {
    if (!this._dragging) return;

    switch (this._mode) {
      case 'move':
        this.onMouseMove(point, modifiers);
        if (this._moveDelta.x !== 0 || this._moveDelta.y !== 0) {
          this._restoreSnapshots(this._startSnapshots);
          const cmd = new MoveCommand(this.doc, this.selection.ids.filter(id => this._isMovable(this.doc.getObjectById(id))), this._moveDelta.x, this._moveDelta.y);
          this.commandStack.execute(cmd);
        }
        break;

      case 'resize':
        this.onMouseMove(point, modifiers);
        if (this._startSnapshots) {
          // Capture current state as the "new" state
          const selectedShapes = this._resizeIds ? this._resizeIds.map(id => this.doc.getObjectById(id)) : this.selection.getSelectedObjects(this.doc);
          const newSnapshots = this._snapshotShapes(selectedShapes);
          // Revert to start state
          this._restoreSnapshots(this._startSnapshots);
          // Execute command that goes from start → new
          const cmd = new ResizeGroupCommand(this.doc, this._startSnapshots, newSnapshots);
          if (JSON.stringify(this._startSnapshots) !== JSON.stringify(newSnapshots)) this.commandStack.execute(cmd);
        }
        break;

      case 'marquee':
        this.onMouseMove(point, modifiers);
        this._finishMarquee(point, modifiers);
        break;

      case 'rotate':
        this.onMouseMove(point, modifiers);
        if (this._startSnapshots) {
          const selectedShapes = this._resizeIds ? this._resizeIds.map(id => this.doc.getObjectById(id)) : this.selection.getSelectedObjects(this.doc);
          const newSnapshots = this._snapshotShapes(selectedShapes);
          this._restoreSnapshots(this._startSnapshots);
          const cmd = new ResizeGroupCommand(this.doc, this._startSnapshots, newSnapshots);
          cmd.label = 'Rotate';
          if (JSON.stringify(this._startSnapshots) !== JSON.stringify(newSnapshots)) this.commandStack.execute(cmd);
        }
        break;
    }

    this._dragging = false;
    this._mode = null;
    this._handle = null;
    this._startBounds = null;
    this._startSnapshots = null;
    this._startRotation = undefined;
    if (this.overlay) { this.overlay.marquee = null; this.overlay.trackingIds = null; this.overlay.trackingOriginals = null; }
    this.cursor?.setDefault();
    this.doc._notify('change');
  }

  onDoubleClick(point, modifiers) {
    const shape = this.doc.getObjectAtPoint(point);
    if (shape?.type === 'text' && !shape.groupId && !shape.rotation && !shape.flipH && !shape.flipV) {
      this.selection.select(shape.id);
      this.manager.setActiveTool(TOOLS.TEXT);
      const textTool = this.manager._tools[TOOLS.TEXT];
      if (textTool) {
        textTool.startEditing(shape);
      }
    }
  }

  // ─── Move ───────────────────────────────────────────────

  _handleMove(dx, dy) {
    for (const id of this.selection.ids) {
      const shape = this.doc.getObjectById(id);
      if (!this._isMovable(shape)) continue;

      if (shape.points) {
        shape.points = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
      }
      shape.x += dx;
      shape.y += dy;
    }
    this.doc._notify('move');
  }

  _undoLiveMove(totalDx, totalDy) {
    for (const id of this.selection.ids) {
      const shape = this.doc.getObjectById(id);
      if (!shape) continue;

      if (shape.points) {
        shape.points = shape.points.map(p => ({ x: p.x - totalDx, y: p.y - totalDy }));
      }
      shape.x -= totalDx;
      shape.y -= totalDy;
    }
  }

  // ─── Resize ─────────────────────────────────────────────

  _handleResize(point, modifiers) {
    if (this._handle === 'p0' || this._handle === 'p1') {
      const shape = this.doc.getObjectById(this._resizeIds[0]), index = Number(this._handle[1]);
      this._restoreSnapshots(this._startSnapshots);
      let endpoint = { ...point };
      if (modifiers?.shiftKey) {
        const fixed = shape.points[1 - index], dx = point.x - fixed.x, dy = point.y - fixed.y;
        const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
        const distance = dx * Math.cos(angle) + dy * Math.sin(angle);
        endpoint = { x: fixed.x + distance * Math.cos(angle), y: fixed.y + distance * Math.sin(angle) };
      }
      if (this.doc.snapToGrid) for (const axis of ['x','y']) endpoint[axis] = this.doc.rulerOrigin[axis] + Math.round((endpoint[axis] - this.doc.rulerOrigin[axis]) / this.doc.gridSize) * this.doc.gridSize;
      endpoint.x = Math.max(0, Math.min(this.doc.pageWidth, endpoint.x));
      endpoint.y = Math.max(0, Math.min(this.doc.pageHeight, endpoint.y));
      shape.points[index] = endpoint; Object.assign(shape, boundingBox(shape.points));
      if (this.overlay) { this.overlay.trackingIds = this._resizeIds; this.overlay.trackingOriginals = this._originalObjects; this.overlay.trackingOutlines = true; }
      this.doc._notify('resize'); return;
    }
    const sb = this._startBounds;
    let { x, y, width, height } = sb;

    let dx = point.x - this._startPoint.x;
    let dy = point.y - this._startPoint.y;
    if (this.doc.snapToGrid) {
      const snap = (value, origin) => origin + Math.round((value - origin) / this.doc.gridSize) * this.doc.gridSize;
      const edgeX = this._handle.includes('w') ? sb.x : sb.x + sb.width;
      const edgeY = this._handle.includes('n') ? sb.y : sb.y + sb.height;
      dx = snap(edgeX + dx, this.doc.rulerOrigin.x) - edgeX;
      dy = snap(edgeY + dy, this.doc.rulerOrigin.y) - edgeY;
    }

    switch (this._handle) {
      case 'se': width += dx; height += dy; break;
      case 'nw': x += dx; y += dy; width -= dx; height -= dy; break;
      case 'ne': y += dy; width += dx; height -= dy; break;
      case 'sw': x += dx; width -= dx; height += dy; break;
      case 'n': y += dy; height -= dy; break;
      case 's': height += dy; break;
      case 'e': width += dx; break;
      case 'w': x += dx; width -= dx; break;
    }

    const clampX = value => Math.max(0, Math.min(this.doc.pageWidth, value));
    const clampY = value => Math.max(0, Math.min(this.doc.pageHeight, value));
    if (this._handle.includes('w')) { x = clampX(x); width = sb.x + sb.width - x; }
    if (this._handle.includes('e')) width = clampX(x + width) - sb.x;
    if (this._handle.includes('n')) { y = clampY(y); height = sb.y + sb.height - y; }
    if (this._handle.includes('s')) height = clampY(y + height) - sb.y;

    // Constrain to proportional if shift held
    if (modifiers?.shiftKey && sb.width && sb.height && ['se', 'nw', 'ne', 'sw'].includes(this._handle)) {
      const aspect = sb.width / sb.height;
      if (Math.abs(width) / aspect < Math.abs(height)) {
        height = Math.sign(height) * Math.abs(width) / aspect;
      } else {
        width = Math.sign(width) * Math.abs(height) * aspect;
      }
      // Keep the opposite corner still after adjusting either dimension.
      if (this._handle.includes('w')) x = sb.x + sb.width - width;
      if (this._handle.includes('n')) y = sb.y + sb.height - height;
    }

    const newBounds = { x, y, width, height };

    // Restore from snapshots and proportionally map every shape
    this._restoreSnapshots(this._startSnapshots);
    this._mapAllShapes(sb, newBounds);
    if (this.overlay) { this.overlay.trackingIds = [...this._resizeIds]; this.overlay.trackingOriginals = this._originalObjects; this.overlay.trackingOutlines = true; }
    this.doc._notify('resize');
  }

  /**
   * Proportionally map all selected shapes from oldGroup bounds to newGroup bounds.
   */
  _mapAllShapes(oldGroup, newGroup) {
    for (const id of this._resizeIds || this.selection.ids) {
      const shape = this.doc.getObjectById(id);
      if (!shape) continue;

      const ob = getBounds(shape);
      if (shape.rotation && !shape.points) {
        const sx = oldGroup.width ? newGroup.width / oldGroup.width : 1, sy = oldGroup.height ? newGroup.height / oldGroup.height : 1;
        const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;
        const mappedX = newGroup.x + (cx - oldGroup.x) * sx, mappedY = newGroup.y + (cy - oldGroup.y) * sy;
        const c = Math.cos(shape.rotation), s = Math.sin(shape.rotation);
        shape.width *= Math.hypot(sx * c, sy * s); shape.height *= Math.hypot(sx * s, sy * c);
        shape.x = mappedX - shape.width / 2; shape.y = mappedY - shape.height / 2;
        continue;
      }

      // Map the shape's bounding box proportionally
      const nx = oldGroup.width !== 0
        ? newGroup.x + ((ob.x - oldGroup.x) / oldGroup.width) * newGroup.width
        : newGroup.x;
      const ny = oldGroup.height !== 0
        ? newGroup.y + ((ob.y - oldGroup.y) / oldGroup.height) * newGroup.height
        : newGroup.y;
      const nw = oldGroup.width !== 0
        ? (ob.width / oldGroup.width) * newGroup.width
        : ob.width;
      const nh = oldGroup.height !== 0
        ? (ob.height / oldGroup.height) * newGroup.height
        : ob.height;

      // For point-based shapes, rescale each point
      if (shape.points && shape.points.length > 0) {
        shape.points = shape.points.map(p => ({
          x: oldGroup.width ? newGroup.x + ((p.x - oldGroup.x) / oldGroup.width) * newGroup.width : newGroup.x,
          y: oldGroup.height ? newGroup.y + ((p.y - oldGroup.y) / oldGroup.height) * newGroup.height : newGroup.y,
        }));
        Object.assign(shape, boundingBox(shape.points));
      } else {
        Object.assign(shape, normalizeRect(nx, ny, nw, nh));
        if (nw < 0) shape.flipH = !shape.flipH;
        if (nh < 0) shape.flipV = !shape.flipV;
      }
    }
  }

  // ─── Rotate ─────────────────────────────────────────────

  _handleRotate(point) {
    const sb = this._startBounds;
    const cx = sb.x + sb.width / 2;
    const cy = sb.y + sb.height / 2;
    const angle = Math.atan2(point.y - cy, point.x - cx) + Math.PI / 2;

    // Restore from snapshots first
    this._restoreSnapshots(this._startSnapshots);

    const center = { x: cx, y: cy };

    // Rotate all selected shapes around the group center
    for (const id of this.selection.ids) {
      const shape = this.doc.getObjectById(id);
      if (!shape) continue;

      // For point-based shapes (polygon, freehand, line), rotate each point
      if (shape.points && shape.points.length > 0) {
        shape.points = shape.points.map(p => rotatePoint(p, center, angle));
        // Update x/y from new bounding box for point-based shapes
        const bb = shape.points.reduce(
          (acc, p) => ({
            minX: Math.min(acc.minX, p.x), minY: Math.min(acc.minY, p.y),
            maxX: Math.max(acc.maxX, p.x), maxY: Math.max(acc.maxY, p.y),
          }),
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        );
        shape.x = bb.minX;
        shape.y = bb.minY;
        shape.width = bb.maxX - bb.minX;
        shape.height = bb.maxY - bb.minY;
      } else {
        // For rect-based shapes, orbit the shape's center around the group center
        const shapeCx = shape.x + shape.width / 2;
        const shapeCy = shape.y + shape.height / 2;
        const rotated = rotatePoint({ x: shapeCx, y: shapeCy }, center, angle);
        shape.x = rotated.x - shape.width / 2;
        shape.y = rotated.y - shape.height / 2;
        shape.rotation = (shape.rotation || 0) + angle;
      }
    }
    this.doc._notify('rotate');
  }

  // ─── Marquee ────────────────────────────────────────────

  _handleMarquee(point) {
    const rect = normalizeRect(
      this._startPoint.x,
      this._startPoint.y,
      point.x - this._startPoint.x,
      point.y - this._startPoint.y
    );
    if (this.overlay) {
      this.overlay.marquee = rect;
    }
    this.doc._notify('marquee');
  }

  _finishMarquee(point, modifiers) {
    const rect = normalizeRect(
      this._startPoint.x,
      this._startPoint.y,
      point.x - this._startPoint.x,
      point.y - this._startPoint.y
    );

    let hits;
    if (!this._trackingStarted) {
      const hit = this.doc.getObjectAtPoint(this._startPoint, 5 / (this.manager?.zoom || 1));
      hits = hit ? (hit.groupId ? this.doc.getGroupMembers(hit.groupId) : [hit]) : [];
    } else {
      hits = this.doc.getObjectsInRect(rect);
    }
    if (this._marqueeShift) {
      const ids = new Set(this._selectionBefore);
      const units = new Map();
      for (const hit of hits) units.set(hit.groupId || hit.id, hit.groupId ? this.doc.getGroupMembers(hit.groupId) : [hit]);
      for (const members of units.values()) {
        const remove = members.every(m => ids.has(m.id));
        members.forEach(m => remove ? ids.delete(m.id) : ids.add(m.id));
      }
      this.selection.selectMultiple(this.doc.objects.filter(s => ids.has(s.id)).map(s => s.id));
    } else {
      this.selection.selectMultiple(hits.map(h => h.id));
    }
  }

  // ─── Cursor ─────────────────────────────────────────────

  _handleHit(point) {
    const zoom = this.manager?.zoom || 1, tolerance = Math.max(HANDLE_SIZE, 7) / zoom;
    const units = new Map();
    for (const shape of this.selection.getSelectedObjects(this.doc)) {
      const key = shape.groupId || shape.id;
      if (!units.has(key)) units.set(key, []);
      units.get(key).push(shape);
    }
    for (const objects of [...units.values()].reverse()) {
      if (!objects.every(s => this._isMovable(s))) continue;
      const shape = objects[0];
      if (objects.length === 1 && !shape.groupId && shape.type === 'line') {
        const index = shape.points.findIndex(p => Math.abs(p.x - point.x) <= tolerance / 2 && Math.abs(p.y - point.y) <= tolerance / 2);
        if (index >= 0) return { objects, handle: `p${index}` };
      } else {
        const bounds = getSelectionHandleBounds(getMultiBounds(objects), zoom, objects.length === 1 && shape.type === 'text');
        const handle = getHandleAtPoint(point, bounds, tolerance);
        if (handle) return { objects, handle };
      }
    }
    return null;
  }

  _updateHoverCursor(point) {
    const handle = this._handleHit(point);
    if (handle) { this.cursor?.setForHandle(handle.handle); return; }

    const hit = this.doc.getObjectAtPoint(point, 5 / (this.manager?.zoom || 1));
    if (hit) {
      this.cursor?.setMove();
    } else {
      this.cursor?.setDefault();
    }
  }

  // ─── Snapshots ──────────────────────────────────────────

  /**
   * Capture current geometry of shapes for undo.
   */
  _snapshotShapes(shapes) {
    return shapes.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: s.rotation,
      flipH: s.flipH,
      flipV: s.flipV,
      points: s.points ? s.points.map(p => ({ ...p })) : null,
    }));
  }

  /**
   * Restore shapes to a previous snapshot.
   */
  _restoreSnapshots(snapshots) {
    for (const snap of snapshots) {
      const shape = this.doc.getObjectById(snap.id);
      if (!shape) continue;
      shape.x = snap.x;
      shape.y = snap.y;
      shape.width = snap.width;
      shape.height = snap.height;
      shape.rotation = snap.rotation;
      shape.flipH = snap.flipH;
      shape.flipV = snap.flipV;
      if (snap.points) {
        shape.points = snap.points.map(p => ({ ...p }));
      }
    }
  }
}
