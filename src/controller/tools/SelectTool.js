import { getBounds, getMultiBounds, hitTest } from '../../model/Shape.js';
import { getHandleAtPoint, normalizeRect, rotatePoint } from '../../util/geometry.js';
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
      if (Math.abs(point.x - rotX) < 8 && Math.abs(point.y - rotY) < 8) {
        this._dragging = true;
        this._mode = 'rotate';
        this._startBounds = { ...unifiedBounds };
        this._startSnapshots = this._snapshotShapes(selectedShapes);
        this.cursor?.setRotate();
        return;
      }

      const handle = getHandleAtPoint(point, unifiedBounds, HANDLE_SIZE);
      if (handle) {
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
      if (modifiers.shiftKey) {
        this.selection.toggle(clickedShape.id);
      } else if (!this.selection.has(clickedShape.id)) {
        this.selection.select(clickedShape.id);
      }

      // If shape is in a group, select all group members
      if (clickedShape.groupId && !modifiers.shiftKey) {
        const members = this.doc.getGroupMembers(clickedShape.groupId);
        this.selection.selectMultiple(members.map(m => m.id));
      }

      this._dragging = true;
      this._mode = 'move';
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
        this._handleMove(point.x - this._lastPoint.x, point.y - this._lastPoint.y);
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
        if (Math.abs(totalDx) > 0.5 || Math.abs(totalDy) > 0.5) {
          this._undoLiveMove(totalDx, totalDy);
          const cmd = new MoveCommand(this.doc, this.selection.ids, totalDx, totalDy);
          this.commandStack.execute(cmd);
        }
        break;

      case 'resize':
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
      if (shape.points && shape.points.length > 0 && oldGroup.width !== 0 && oldGroup.height !== 0) {
        shape.points = shape.points.map(p => ({
          x: newGroup.x + ((p.x - oldGroup.x) / oldGroup.width) * newGroup.width,
          y: newGroup.y + ((p.y - oldGroup.y) / oldGroup.height) * newGroup.height,
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
      const handle = getHandleAtPoint(point, unifiedBounds, HANDLE_SIZE);
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
