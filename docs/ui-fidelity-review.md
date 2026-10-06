# MacDraw rendered UI corrections

These changes follow the deployment of `c9c49b2`. They remain on
`fidelity/lisadraw-interactions` for review; this follow-up has not been deployed.

## Glyph rendering

The live Chrome tab reported effective DPR 1.125; the local tab reported 1.25.
The previous tests covered 1, 1.25, 1.5 and 2, and omitted locked tools. An
expanded test reproduced 12 incorrect source pixels in the selection arrow at
DPR 2.2, display scale 3, even without selection. The original PNG source was
correct; the rendered image was not. The old locked-tool dotted outline also
crossed the glyph, as seen in the live screenshot.

`src/ui/Toolbar.js` now paints a complete native 24x16 cell from the same
archived FONT bits onto one canvas. Selection reverses those cell pixels.
No image filter, hover outline or locked-tool outline covers the glyph.
Locking still keeps the tool selected after drawing; repeated click/double-click
switches retain that behavior. No glyph assets or native cell dimensions changed.

990 actual screenshot comparisons passed: ten glyphs, three display scales,
normal/selected/locked states, and effective DPR 0.9, 1, 1.1, 1.125, 1.25,
1.375, 1.5, 1.5625, 1.875, 2 and 2.2. These effective DPRs include common
Windows/browser-zoom combinations (for example 125% Windows scaling with 90%,
110%, 125% and 150% browser zoom gives 1.125, 1.375, 1.5625 and 1.875).
The automated contexts emulate effective DPR rather than operating Chrome's
browser-settings zoom control. The current real Chrome tabs were also inspected.
The source of the earlier DPR 2.2 pixel differences was isolated to the image
presentation path; no claim is made about Chrome's internal compositor algorithm.

## Drawing-window space and controls

The original manual's printed pages 10 and 16 show a thin window edge and
patterned Macintosh desktop outside a document window. Page 10 describes a
working size box. The clone's seven-pixel margin and two-pixel shadow around a
non-resizable window provided no working desktop/window operation.

The margin, outer desktop pattern, shadow, default help/status strip, invented
tool instruction and decorative size box are removed. The thin document edge
is retained. The line/pattern preview is at the palette bottom, beside the
horizontal scrollbar as in the manual. It still opens Fill. The titlebar button
now fits the drawing; Layout retains Normal Size, Reduce, Enlarge and Fit.
The optional Show Size measurement strip remains available when requested.

With rulers visible, actual measured canvas dimensions changed from 434x232
to 448x266 native pixels: 14 more columns and 34 more rows. This is a purposeful
browser adaptation, not a claim that the original lacked patterned desktop space.

## Editing and highlighting text

Committed text passed through the one-bit drawing canvas; editable text was
painted directly by the browser textarea at display resolution. That mismatch
made highlighted or edited text appear smooth.

The textarea now supplies keyboard input, native text-selection semantics and
accessibility while its glyphs, selection background and caret are transparent.
Spellcheck decorations are disabled. `TextTool.js` maintains an unsaved draft
and selection offsets; `Renderer.js` draws the draft through the same shape
renderer and monochrome framebuffer as committed text. Selection inverts
integer framebuffer rectangles and the caret is one native pixel wide.
`src/util/text.js` maps pointer positions and selection ranges through the same
wrapping, font measurements and alignment used for drawing text.

Draft state is excluded from saved documents and removed on completion/cancel.
Typing, pointer character selection, keyboard selection, commit, undo, blur/tool
transitions and Escape remain covered. Normal and highlighted glyph screenshots
match their canvas pixels at DPR 1, 1.125, 1.25, 1.5 and 2.2 and drawing zoom
0.5, 1 and 2. Wrapped/right-aligned paragraphs with blank lines, underline and
shadow are also checked in composited screenshots.

## Text-tool handles: retained behavior and evidence limit

The original MacDraw manual's printed page 35 specifically instructs users to
position the selection pointer on a handle to resize an object. Page 75 describes
moving/resizing a selected paragraph as an object separately from selecting and
editing its characters with the Text tool. These are MacDraw references, not
LisaDraw or clone behavior.

The pointer remains required for object-handle dragging; Text mode continues
to select/edit characters. The manual does not establish automatic conversion
to the selection pointer while hovering a handle in Text mode. That exact
runtime detail remains unverified, so no new automatic handle action was added.
Pointer-mode handle hover and existing resize/undo behavior are regression-tested.

## Verification and review artifacts

- 306 unit tests in 14 files passed.
- 72 existing Canvas pixel checks and the existing real-pointer interaction suite passed.
- 990 glyph screenshot comparisons passed (900 expanded sweep plus 90 at DPR 1.5625).
- 25 UI/text scenarios passed, including actual repeated toolbar clicks, text
  screenshot comparisons, three viewport sizes and retained Fill controls.
- Chrome 154.0.8037.98; no uncaught page errors in the browser suites.
- Production build and whitespace checks passed.

Ignored screenshots/results are in `output/ui-correction`, `output/bitmap-qa`
and `output/interaction-qa`. Useful review images are
`highlighted-text-DPR-1.125.png`, `highlighted-paragraph-DPR-1.125.png`,
`reclaimed-window-DPR-1.125.png` and `output/bitmap-qa/toolbar-and-rulers.png`.
Run `test/browser-ui-fidelity.mjs`, `test/bitmap-toolbar.mjs` and
`test/browser-interactions.mjs` against this checkout's Vite origin with the
existing PLAYWRIGHT_MODULE/MACDRAW_TEST_ORIGIN environment settings.

The separately supplied `.gitattributes` policy (`*.sh text eol=lf`) is preserved
with this scoped change. No deployment script or shared line-ending tooling was
edited. Any later Unix deployment-script run must first pass the shared
`C:\Users\david\bin\check-shell-lf.py` preflight.
