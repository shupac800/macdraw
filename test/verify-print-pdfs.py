"""Verify browser-print.mjs output with pypdf, Pillow and Poppler's pdftoppm.

Run from any directory: python test/verify-print-pdfs.py
Uses the existing bundled runtime; no changes to MacDraw's npm dependencies.
"""
import json
from pathlib import Path
import subprocess
import sys

from PIL import Image
from pypdf import PdfReader

output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'output' / 'print-qa'
results = []
for name, width, height in [('letter', 612, 792), ('a4', 595, 842), ('legal', 612, 1008)]:
    pdf = output / f'{name}-after-scroll.pdf'
    reader = PdfReader(pdf)
    assert len(reader.pages) == 1, f'{name}: extra or missing print page'
    actual = tuple(float(v) for v in reader.pages[0].mediabox[2:])
    assert all(abs(a - b) < 1 for a, b in zip(actual, (width, height))), f'{name}: wrong paper size {actual}'
    prefix = output / f'{name}-after-scroll-rendered'
    subprocess.run(['pdftoppm', '-png', '-r', '96', '-singlefile', str(pdf), str(prefix)], check=True)
    with Image.open(prefix.with_suffix('.png')) as rendered:
        image = rendered.convert('RGB')
        w, h = image.size
        # The scene's closest ink starts 16 pixels from each edge. Scrollbar
        # tracks, thumbs or corners would dirty these otherwise blank borders.
        for band in [(0, 0, w, 12), (0, h - 12, w, h), (0, 0, 12, h), (w - 12, 0, w, h)]:
            assert all(low >= 250 for low, _ in image.crop(band).getextrema()), f'{name}: unexpected edge ink/scrollbar'
        # Full-page print must retain all four corner markers and the box drawn
        # with pointer input after scrolling, at their original page positions.
        points = [(x, y) for x in [22, width - 22] for y in [22, height - 22]] + [(250, 530)]
        for x, y in points:
            px, py = round(x * 96 / 72), round(y * 96 / 72)
            assert all(high < 20 for _, high in image.crop((px - 1, py - 1, px + 2, py + 2)).getextrema()), f'{name}: missing/clipped ink at {x},{y}'
        assert any(low < 100 for low, _ in image.crop((64, 64, 400, 110)).getextrema()), f'{name}: missing label'
    results.append({'paper': name, 'pages': 1, 'size_points': actual, 'blank_edges': True, 'all_markers_and_scrolled_box': True})
output.joinpath('pdf-results.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
print('PASS: 3 rendered PDFs, one page each, correct paper size, blank borders without scrollbars/corners, all page markers and scrolled drawing intact.')
