# Original toolbar font bearings

The reported T misalignment was reproduced on the live `8df7cf7` build.
Its ink started at native column 4 and was centered at 8.5 within a 24-pixel
cell. The original FONT 31755 offset/width table gives glyph 4 a left bearing
of 3. The original palette character origin is column 4, so the T's ink belongs
at column 7, centered at 11.5. The old extractor read this bearing but discarded
it for the tool manifest. The renderer consequently used the character origin
as the ink origin.

The original MacDraw 1.9 FONT SHA-256 is
`eb2fdd00042a4f7d05370080a6da30e67fe89ca2e67b904751928d5544440662`.
See `assets/bitmaps/PROVENANCE.md` for the archive and palette code references.

| Tool | Font bearing | Previous ink left | Correct ink left | Correct center |
| --- | ---: | ---: | ---: | ---: |
| Selection arrow | 4 | 4 | 8 | 11.5 |
| Text T | 3 | 4 | 7 | 11.5 |
| Perpendicular lines | 1 | 4 | 5 | 11.5 |
| Diagonal lines | 2 | 4 | 6 | 11.5 |
| Rectangle, round rectangle, oval, arc, freehand, polygon | 0 | 4 | 4 | 11.5 |

All origins remain integers. The T's seven-column left/eight-column right
margin is the original one-pixel asymmetry for odd ink widths in an even cell.
Moving it by 3.5 pixels to force symmetric margins would lose the native grid.
No such transform was introduced. Its top remains row 2 with the original
baseline; no glyph rows, sizes, advance widths or PNG hashes changed.

Changed files: the tool manifest records bearings, `Toolbar.js` honors them,
and the extraction script preserves them. The existing bitmap test now checks
the proper source origin. `test/toolbar-placement.mjs` also checks the complete
24x16 composited cell, blank margins, ink bounds and shared visual center using
actual toolbar clicks/double clicks and screenshots.

Verification: 360 complete-cell screenshot comparisons passed for all ten tools,
normal/selected/locked states, display scales 1x/2x/3x and effective DPR 1,
1.125, 1.5625 and 2.2. A selection arrow is selected in the locked-state pass;
locking is not applicable to that tool. A 30-case live baseline records the old
placement. All ten PNG hashes remain exact. Chrome 154.0.8037.98.
306 fidelity unit tests and the production build passed. No interaction logic,
CSS scaling or line-ending policy changed for this correction.

Ignored review artifacts are under `output/toolbar-centering`: before/after
results, full-window screenshots and cropped palette screenshots for each
state. `after-normal.png`, `after-selected.png` and `after-locked.png` capture
the correction at effective DPR 1.125 and 2x physical display scaling. These
tests emulate effective DPR combinations; they do not operate Chrome's browser
zoom settings. The screenshots themselves are exact physical-pixel checks.
