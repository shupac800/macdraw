import { Document } from '../model/Document.js';
import { renderShape } from '../model/Shape.js';
import { saveToJSON, loadFromJSON, loadFromSVG, saveToSVGWithPatterns, saveToLocalStorage } from '../util/serialize.js';
import { PatternRegistry, monochromePixels } from '../util/patterns.js';
import chicagoLicense from '../../assets/fonts/LICENSE-Chicago-Kare.txt?raw';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export class FileController {
  constructor(app, recovered = false) { this.app = app; this.handle = null; this.savedDocument = null; this.savedBaseline = recovered ? null : saveToJSON(app.doc); }
  get dirty() { return saveToJSON(this.app.doc) !== this.savedBaseline; }
  get basename() { return (this.app.doc.name || 'Untitled').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_'); }
  async canReplace() {
    this.app.finishText();
    if (!this.dirty) return true;
    const result = await this.app.dialog.show({ title: 'Save Changes?', message: `Save changes to “${this.app.doc.name}” before closing?`, buttons: [{ label: 'Don’t Save', value: 'discard' }, { label: 'Cancel', value: null }, { label: 'Save', value: 'save', default: true }] });
    return result?.action === 'discard' || (result?.action === 'save' && await this.save());
  }
  async newDocument() {
    if (!await this.canReplace()) return;
    this.app.loadDocument(new Document()); this.handle = null; this.savedDocument = null; this.savedBaseline = saveToJSON(this.app.doc); saveToLocalStorage(this.app.doc); this.app.updateStatus();
  }
  async open() {
    if (!await this.canReplace()) return;
    try {
      let file, handle = null;
      if (window.showOpenFilePicker) {
        [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'MacDraw drawing or SVG', accept: { 'application/json': ['.macdraw', '.json'], 'image/svg+xml': ['.svg'] } }] });
        file = await handle.getFile();
      } else file = await this._chooseFile();
      if (file) await this.openFile(file, handle);
    } catch (error) { if (error.name !== 'AbortError') await this.app.dialog.alert('Couldn’t Open Drawing', error.message); }
  }
  async openFile(file, handle = null) {
    if (file.size > 10000000) throw new Error('This drawing is too large. The maximum file size is 10 MB.');
    const contents = await file.text(), isSVG = /\.svg$/i.test(file.name) || contents.trimStart().startsWith('<');
    const doc = isSVG ? loadFromSVG(contents) : loadFromJSON(contents);
    doc.name = file.name.replace(/\.(macdraw|json|svg)$/i, '');
    this.app.loadDocument(doc); this.handle = isSVG ? null : handle; this.savedBaseline = saveToJSON(this.app.doc); this.savedDocument = this.savedBaseline;
    saveToLocalStorage(this.app.doc); this.app.updateStatus();
  }
  _chooseFile() {
    return new Promise(resolve => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.macdraw,.json,.svg';
      input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
      input.addEventListener('cancel', () => { resolve(null); input.remove(); });
      input.hidden = true; document.body.append(input); input.click();
    });
  }
  async save(saveAs = false) {
    this.app.finishText();
    if (!window.showSaveFilePicker) return this.download();
    try {
      const handle = !saveAs && this.handle ? this.handle : await window.showSaveFilePicker({ suggestedName: `${this.basename}.macdraw`, types: [{ description: 'Editable MacDraw drawing', accept: { 'application/json': ['.macdraw'] } }] });
      const name = handle.name.replace(/\.(macdraw|json)$/i, '');
      const snapshot = saveToJSON({ toJSON: () => ({ ...this.app.doc.toJSON(), name }) }), writable = await handle.createWritable();
      await writable.write(snapshot); await writable.close();
      this.app.doc.name = name;
      this.handle = handle; this.savedBaseline = this.savedDocument = snapshot; saveToLocalStorage(this.app.doc); this.app.updateStatus(); return true;
    } catch (error) { if (error.name !== 'AbortError') await this.app.dialog.alert('Couldn’t Save Drawing', error.message); return false; }
  }
  async download() {
    this.app.finishText();
    const result = await this.app.dialog.show({ title: 'Save Drawing', fields: [{ name: 'name', label: 'Save drawing as', value: this.basename }] });
    if (!result) return false;
    this.app.doc.name = result.name.replace(/\.macdraw$/i, '').trim() || 'Untitled';
    const snapshot = saveToJSON(this.app.doc); downloadBlob(new Blob([snapshot], { type: 'application/json' }), `${this.basename}.macdraw`);
    this.handle = null; this.savedBaseline = this.savedDocument = snapshot; saveToLocalStorage(this.app.doc); this.app.updateStatus(); return true;
  }
  async revert() {
    if (!this.savedDocument) return;
    const result = await this.app.dialog.show({ title: 'Revert Drawing?', message: 'Return to the last saved version of this drawing? Changes since then will be discarded.' });
    if (result) { this.app.loadDocument(loadFromJSON(this.savedDocument)); this.savedBaseline = saveToJSON(this.app.doc); saveToLocalStorage(this.app.doc); this.app.updateStatus(); }
  }
  async exportSVG() {
    this.app.finishText(); await document.fonts.ready;
    let svg = saveToSVGWithPatterns(this.app.doc, this.app.patternRegistry);
    const response = await fetch(new URL('../../assets/fonts/ChicagoKare-Regular.woff2', import.meta.url));
    if (!response.ok) throw new Error('The bundled Chicago font could not be loaded.');
    const buffer = new Uint8Array(await response.arrayBuffer()); let binary = ''; for (const byte of buffer) binary += String.fromCharCode(byte);
    const fontStyle = `<style>@font-face { font-family: Chicago; src: url(data:font/woff2;base64,${btoa(binary)}) format('woff2'); size-adjust: 133.333333%; }</style>`;
    const notice = chicagoLicense.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    svg = svg.replace(/(<svg\b[^>]*>)/, `$1${fontStyle}<metadata id="chicago-font-license">${notice}</metadata>`);
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${this.basename}.svg`);
  }
  async exportPNG() {
    this.app.finishText(); await document.fonts.ready;
    const { pageWidth, pageHeight, objects } = this.app.doc;
    const width = Math.ceil(pageWidth), height = Math.ceil(pageHeight);
    if (width * height > 16000000) throw new Error('This drawing is too large for PNG export. Export SVG, or use a smaller drawing.');
    const scale = width * height * 4 <= 16000000 ? 2 : 1;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }), patterns = new PatternRegistry(); patterns.init(ctx);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); objects.forEach(s => renderShape(ctx, s, patterns));
    ctx.putImageData(monochromePixels(ctx.getImageData(0, 0, width, height)), 0, 0);
    const output = document.createElement('canvas'); output.width = width * scale; output.height = height * scale;
    const outputCtx = output.getContext('2d'); outputCtx.imageSmoothingEnabled = false; outputCtx.drawImage(canvas, 0, 0, output.width, output.height);
    const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The PNG could not be created.'); downloadBlob(blob, `${this.basename}.png`);
  }
  async print() {
    this.app.finishText(); await document.fonts.ready;
    let holder = document.getElementById('print-drawing'); if (!holder) { holder = document.createElement('div'); holder.id = 'print-drawing'; holder.style.display = 'none'; document.body.append(holder); }
    const svg = saveToSVGWithPatterns(this.app.doc, this.app.patternRegistry);
    // Generated SVG consists only of this app's shape primitives.
    holder.replaceChildren(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement);
    holder.firstChild.style.width = `${this.app.doc.pageWidth / 72}in`; holder.firstChild.style.height = `${this.app.doc.pageHeight / 72}in`;
    window.print(); holder.replaceChildren();
  }
}
