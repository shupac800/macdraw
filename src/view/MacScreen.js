export const MAC_SCREEN = { width: 512, height: 342 };

// Resolution is expressed in real display pixels, not CSS pixels. Fractional
// Windows display scaling / browser zoom is canceled rather than interpolated.
export function screenGeometry(width, height, dpr = 1, preference = 'auto') {
  const available = Math.min(width * dpr / MAC_SCREEN.width, height * dpr / MAC_SCREEN.height);
  const automatic = Math.max(1, Math.min(3, Math.floor(available + 1e-6)));
  const pixels = ['1','2','3'].includes(String(preference)) ? Number(preference) : automatic;
  const scale = pixels / dpr;
  return {
    pixels, scale,
    left: Math.max(0, Math.floor((width * dpr - 512 * pixels) / 2)) / dpr,
    top: Math.max(0, Math.floor((height * dpr - 342 * pixels) / 2)) / dpr,
  };
}

export class MacScreen {
  constructor(element) {
    this.element = element;
    try { this.preference = localStorage.getItem('macdraw_screen_scale') || 'auto'; } catch { this.preference = 'auto'; }
    this.update();
  }
  setScale(preference) {
    this.preference = preference;
    try { localStorage.setItem('macdraw_screen_scale', preference); } catch { /* Private mode may forbid storage. */ }
    this.update();
  }
  update() {
    const geometry = screenGeometry(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, this.preference);
    Object.assign(this, geometry);
    this.element.style.transform = `translate(${geometry.left}px, ${geometry.top}px) scale(${geometry.scale})`;
    // Layout positions are quantized to 1/64 CSS pixels in Chrome. Keep the
    // centering translation in the transform so fractional DPR does not shift
    // bitmap pixels off the physical display grid.
    this.element.style.left = '0px'; this.element.style.top = '0px';
    this.element.dataset.screenScale = geometry.pixels;
    this.element.setAttribute('aria-label', `Macintosh screen, ${512 * geometry.pixels} by ${342 * geometry.pixels} display pixels`);
  }
}
