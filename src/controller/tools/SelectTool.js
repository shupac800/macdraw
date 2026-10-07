import { getVisualBounds as getBounds, getMultiBounds } from '../../model/Shape.js';
import { getHandleAtPoint, getSelectionHandleBounds, normalizeRect, rotatePoint } from '../../util/geometry.js';
import { HANDLE_SIZE, ROTATION_HANDLE_DISTANCE, TOOLS } from '../../util/constants.js';
import { MoveCommand } from '../../commands/MoveCommand.js';
import { ResizeGroupCommand } from '../../commands/ResizeGroupCommand.js';
import { TransformCommand } from '../../commands/TransformCommand.js';

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

  deactivate() {
    if (this._dragging && this._startSnapshots) this._restoreSnapshots(this._startSnapshots);
    this._dragging = false;
    this._mode = null;
    if (this.overlay) this.overlay.marquee = null;
  }

  onMouseDown(point, modifiers) {
    this._startPoint = { ...point };
    this._lastPoint = { ...point };

    // Check handles on unified selection bounds (skip when shift is held)
    if (!this.selection.isEmpty && !modifiers.shiftKey) {
      const selectedShapes = this.selection.getSelectedObjects(this.doc);
      const unifiedBounds = selectedShapes.length === 1
        ? getBounds(selectedShapes[0])
        : getMultiBounds(selectedShapes);

      // Check rotation handle
      const rotX = unifiedBounds.x + unifiedBounds.width / 2;
      const rotY = unifiedBounds.y - ROTATION_HANDLE_DISTANCE;
      if (this.overlay?.showRotationHandle !== false && Math.abs(point.x - rotX) < 8 && Math.abs(point.y - rotY) < 8) {
        this._dragging = true;
        this._mode = 'rotate';
        this._startBounds = { ...unifiedBounds };
        this._startSnapshots = this._snapshotShapes(selectedShapes);
        this.cursor?.setRotate();
        return;
      }

      const zoom = this.manager?.zoom || 1;
      const handleBounds = getSelectionHandleBounds(unifiedBounds, zoom, selectedShapes.length === 1 && selectedShapes[0].type === 'text');
      const handle = getHandleAtPoint(point, handleBounds, Math.max(HANDLE_SIZE, 7) / zoom);
      if (handle && selectedShapes.every(s => !s.locked)) {
        this._dragging = true;
        this._mode = 'resize';
        this._handle = handle;
        this._startBounds = { ...unifiedBounds };
        this._startSnapshots = this._snapshotShapes(selectedShapes);
        this.cursor?.setForHandle(handle);
        return;
      }
    }

    // Check if clicking on a shape
    const clickedShape = this.doc.getObjectAtPoint(point);

    if (clickedShape) {
      const members = clickedShape.groupId ? this.doc.getGroupMembers(clickedShape.groupId) : [clickedShape];
      if (modifiers.shiftKey) {
        const remove = members.every(m => this.selection.has(m.id));
        members.forEach(m => remove ? this.selection.deselect(m.id) : this.selection.add(m.id));
      } else if (!this.selection.has(clickedShape.id)) {
        this.selection.selectMultiple(members.map(m => m.id));
      }

      // Expand a partial group selection without throwing away other selected
      // objects. A click on any selected member must drag the entire selection.
      if (clickedShape.groupId && !modifiers.shiftKey) {
        for (const member of members) {
          if (!this.selection.has(member.id)) this.selection.add(member.id);
        }
      }

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

    switch (this._mode) {
      case 'move':
        this._restoreSnapshots(this._startSnapshots);
        let dx = point.x - this._startPoint.x, dy = point.y - this._startPoint.y;
        if (modifiers?.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        if (this.doc.snapToGrid) {
          const b = getMultiBounds(this._startSnapshots);
          dx = Math.round((b.x + dx) / this.doc.gridSize) * this.doc.gridSize - b.x;
          dy = Math.round((b.y + dy) / this.doc.gridSize) * this.doc.gridSize - b.y;
        }
        this._moveDelta = { x: dx, y: dy };
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

  onMouseUp(point, modifiers) {
    if (!this._dragging) return;

    const totalDx = point.x - this._startPoint.x;
    const totalDy = point.y - this._startPoint.y;

    switch (this._mode) {
      case 'move':
        this.onMouseMove(point, modifiers);
        if (Math.abs(this._moveDelta.x) > 0.5 || Math.abs(this._moveDelta.y) > 0.5) {
          this._restoreSnapshots(this._startSnapshots);
          const cmd = new MoveCommand(this.doc, this.selection.ids.filter(id => !this.doc.getObjectById(id)?.locked), this._moveDelta.x, this._moveDelta.y);
          this.commandStack.execute(cmd);
        }
        break;

      case 'resize':
        this._handleResize(point, modifiers);
        if (this._startSnapshots) {
          // Capture current state as the "new" state
          const selectedShapes = this.selection.getSelectedObjects(this.doc);
          const newSnapshots = this._snapshotShapes(selectedShapes);
          // Revert to start state
          this._restoreSnapshots(this._startSnapshots);
          // Execute command that goes from start → new
          const cmd = new ResizeGroupCommand(this.doc, this._startSnapshots, newSnapshots);
          this.commandStack.execute(cmd);
        }
        break;

      case 'marquee':
        this._finishMarquee(point, modifiers);
        break;

      case 'rotate':
        if (this._startSnapshots) {
          const selectedShapes = this.selection.getSelectedObjects(this.doc);
          const newSnapshots = this._snapshotShapes(selectedShapes);
          this._restoreSnapshots(this._startSnapshots);
          const cmd = new ResizeGroupCommand(this.doc, this._startSnapshots, newSnapshots);
          cmd.label = 'Rotate';
          this.commandStack.execute(cmd);
        }
        break;
    }

    this._dragging = false;
    this._mode = null;
    this._handle = null;
    this._startBounds = null;
    this._startSnapshots = null;
    this._startRotation = undefined;
    if (this.overlay) this.overlay.marquee = null;
    this.cursor?.setDefault();
    this.doc._notify('change');
  }

  onDoubleClick(point, modifiers) {
    const shape = this.doc.getObjectAtPoint(point);
    if (shape?.type === 'text') {
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
      if (!shape || shape.locked) continue;

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
    const sb = this._startBounds;
    let { x, y, width, height } = sb;

    const dx = point.x - this._startPoint.x;
    const dy = point.y - this._startPoint.y;

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

    // Constrain to proportional if shift held
    if (modifiers.shiftKey && ['se', 'nw', 'ne', 'sw'].includes(this._handle)) {
      const aspect = sb.width / sb.height;
      if (Math.abs(width) / aspect < Math.abs(height)) {
        height = Math.sign(height) * Math.abs(width) / aspect;
      } else {
        width = Math.sign(width) * Math.abs(height) * aspect;
      }
    }

    const newBounds = { x, y, width, height };
    const normalized = normalizeRect(x, y, width, height);
    Object.assign(newBounds, normalized);

    // Restore from snapshots and proportionally map every shape
    this._restoreSnapshots(this._startSnapshots);
    this._mapAllShapes(sb, newBounds);
    this.doc._notify('resize');
  }

  /**
   * Proportionally map all selected shapes from oldGroup bounds to newGroup bounds.
   */
  _mapAllShapes(oldGroup, newGroup) {
    for (const id of this.selection.ids) {
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
      }

      shape.x = nx;
      shape.y = ny;
      shape.width = nw;
      shape.height = nh;
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

    if (rect.width < 2 && rect.height < 2) return;

    const hits = this.doc.objects.filter(obj => {
      const b = getBounds(obj);
      return (
        b.x >= rect.x &&
        b.y >= rect.y &&
        b.x + b.width <= rect.x + rect.width &&
        b.y + b.height <= rect.y + rect.height
      );
    });

    const groupIds = new Set(hits.map(h => h.groupId).filter(Boolean));
    for (const gid of groupIds) for (const member of this.doc.getGroupMembers(gid)) if (!hits.includes(member)) hits.push(member);
    if (modifiers.shiftKey) {
      for (const obj of hits) {
        this.selection.add(obj.id);
      }
    } else {
      this.selection.selectMultiple(hits.map(h => h.id));
    }
  }

  // ─── Cursor ─────────────────────────────────────────────

  _updateHoverCursor(point) {
    if (!this.selection.isEmpty) {
      // Check handles on the unified selection bounds
      const selectedShapes = this.selection.getSelectedObjects(this.doc);
      const unifiedBounds = selectedShapes.length === 1
        ? getBounds(selectedShapes[0])
        : getMultiBounds(selectedShapes);
      const zoom = this.manager?.zoom || 1;
      const handleBounds = getSelectionHandleBounds(unifiedBounds, zoom, selectedShapes.length === 1 && selectedShapes[0].type === 'text');
      const handle = selectedShapes.every(s => !s.locked) && getHandleAtPoint(point, handleBounds, Math.max(HANDLE_SIZE, 7) / zoom);
      if (handle) {
        this.cursor?.setForHandle(handle);
        return;
      }
    }

    const hit = this.doc.getObjectAtPoint(point);
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
      if (snap.points) {
        shape.points = snap.points.map(p => ({ ...p }));
      }
    }
  }
}
