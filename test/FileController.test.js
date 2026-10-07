import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileController } from '../src/controller/FileController.js';
import { Document } from '../src/model/Document.js';
import { createShape } from '../src/model/Shape.js';
import { saveToJSON } from '../src/util/serialize.js';

let app, files;
beforeEach(() => {
  vi.stubGlobal('localStorage', { setItem: vi.fn() });
  app = { doc: new Document({ snapToGrid: false, showRulers: true }), finishText: vi.fn(), updateStatus: vi.fn(), loadDocument: vi.fn(doc => { app.doc = doc; }), dialog: { show: vi.fn(), alert: vi.fn() } };
  files = new FileController(app); vi.stubGlobal('window', {});
});
afterEach(() => vi.unstubAllGlobals());

describe('Windows editable-file workflow', () => {
  it('writes a complete editable snapshot and retains the handle for Save', async () => {
    const writable = { write: vi.fn(), close: vi.fn() }, handle = { name: 'Drawing.macdraw', createWritable: vi.fn(async () => writable) };
    window.showSaveFilePicker = vi.fn(async () => handle);
    app.doc.addObject(createShape('rect', { width: 80, height: 50 })); expect(files.dirty).toBe(true);
    expect(await files.save()).toBe(true); expect(JSON.parse(writable.write.mock.calls[0][0]).objects).toHaveLength(1);
    expect(writable.close).toHaveBeenCalled(); expect(files.dirty).toBe(false); expect(app.doc.name).toBe('Drawing');
    app.doc.objects[0].x = 10; await files.save(); expect(window.showSaveFilePicker).toHaveBeenCalledTimes(1); expect(handle.createWritable).toHaveBeenCalledTimes(2);
  });
  it('canceling Save As preserves the current drawing and its dirty state', async () => {
    app.doc.addObject(createShape('rect')); const snapshot = saveToJSON(app.doc);
    window.showSaveFilePicker = vi.fn(async () => { throw new DOMException('Canceled', 'AbortError'); });
    expect(await files.save(true)).toBe(false); expect(saveToJSON(app.doc)).toBe(snapshot); expect(files.dirty).toBe(true); expect(app.dialog.alert).not.toHaveBeenCalled();
  });
  it('failed writes do not rename a drawing or mark it saved', async () => {
    app.doc.addObject(createShape('rect'));
    window.showSaveFilePicker = vi.fn(async () => ({ name: 'Wrong.macdraw', createWritable: async () => { throw new Error('disk full'); } }));
    expect(await files.save()).toBe(false); expect(app.doc.name).toBe('Untitled'); expect(files.dirty).toBe(true); expect(app.dialog.alert).toHaveBeenCalled();
  });
  it('opens editable JSON with a retained handle and a clean baseline', async () => {
    const doc = new Document({ snapToGrid: false, showRulers: true }); doc.addObject(createShape('text', { text: 'Chicago', width: 100, height: 16 }));
    const handle = { name: 'Test.macdraw' }, file = { name: handle.name, size: 2000, text: async () => saveToJSON(doc) };
    await files.openFile(file, handle); expect(app.doc.name).toBe('Test'); expect(app.doc.objects[0].text).toBe('Chicago'); expect(files.handle).toBe(handle); expect(files.dirty).toBe(false);
  });
  it('rejects malformed input before changing the document', async () => {
    const snapshot = saveToJSON(app.doc);
    await expect(files.openFile({ name: 'bad.macdraw', size: 30, text: async () => '{"objects":[]}' })).rejects.toThrow();
    expect(saveToJSON(app.doc)).toBe(snapshot); expect(app.loadDocument).not.toHaveBeenCalled();
  });
  it('Cancel in Save Changes leaves the document intact', async () => {
    app.doc.addObject(createShape('rect')); app.dialog.show.mockResolvedValue(null);
    await files.newDocument(); expect(app.doc.objects).toHaveLength(1); expect(app.loadDocument).not.toHaveBeenCalled();
  });
  it('does not close a drawing when its requested save is canceled', async () => {
    app.doc.addObject(createShape('rect')); app.dialog.show.mockResolvedValue({ action: 'save' });
    window.showSaveFilePicker = vi.fn(async () => { throw new DOMException('Canceled', 'AbortError'); });
    expect(await files.canReplace()).toBe(false); expect(app.doc.objects).toHaveLength(1);
  });
});
