# MacDraw interaction fidelity investigation

## Target and isolated branch

The current target is original MacDraw 1.9 from the user's
`C:\Users\david\Downloads\macdraw_1_9.zip`, supplemented by Apple's 1984
MacDraw manual. The supplied binary identifies itself as `MacDraw 1.9 5/28/85`.
The user's 1988-era target describes the intended experience; the supplied
archive alone does not establish a separate 1988 build or a 1.9.5 application.
The earlier Guided Tour image says 1.0 GT, and is a supporting visual reference.
LisaDraw source is comparative evidence, not proof that the products behaved
identically. Where the MacDraw manual differs, this branch uses MacDraw rules.

Work is isolated in `fidelity/lisadraw-interactions` at
`C:\Users\david\Documents\Codex\2026-10-06\task-4\macdraw-fidelity`.
Baseline commit `f7a8bcf` preserves every tracked and nonignored untracked edit
from the already-deployed original checkout. The original checkout was not
reset, stashed, switched or edited. Its path/hash manifest remains outside
this repository in `task-4/baseline-manifest.json`. The clone's origin is a
local path to the original checkout; nothing has been pushed or deployed.

## Evidence and original file map

Read-only Lisa tree: `C:\Users\david\Downloads\Lisa_Source`.
The actual LisaDraw application is `APPS/APLD`, not the reusable `UDRAW`
toolkit. `BUILD-MAKE-ALISADRAW` establishes its assembly inputs.

| Lisa application file | Functions and local line references | What it establishes |
| --- | --- | --- |
| `APLD-SEL.TEXT.unix.txt` | `GetSelRect` 392; `PtNearRect` 466; `PtNearGrp` 770; `PtNearObj` 783; `PtOnObjKnob` 823 | Shape-sensitive hits, recursive group hits, text boundary hits and handle tests |
| `APLD-CTR.TEXT.unix.txt` | `EditCtrl` 653 | Shift routes to selection; ordinary handle/object hits route to resize/move |
| `APLD-TR1.TEXT.unix.txt` | `GetTSel` 8; `DrawTSel` 59; `CnstrRect` 177; `StrTSel` 324; `MoveSelCmd` 665; `GetSel` 871; `MakeSelCmd` 901/1024 | Outline tracking, anchored signed resize, half-grid text movement, page limits, full containment and Shift toggling |
| `APLD-TRK.TEXT.unix.txt` | `StartTrk` 122; `ReDrwSel` 147 | Native deadzone and tracking feedback |
| `APLD-CM1.TEXT.unix.txt` | `GroupCmd` 92; `UnGroupCmd` 192; `LineUpCmd` 271 | Lisa's locked exclusions, highest-selected stacking placement and boundary alignment |
| `APLD-CMD.TEXT.unix.txt` | `TxtToTop` 183; `GroupLoc` 258 | Separate text stacking and group bookkeeping |
| `APLD-DA1.TEXT.unix.txt` | `AlignObj` 294; `ScaleObj` 579/text 736; `GetBBox` 765; `GetObjKnobs` 1023 | Recursive alignment, text location versus font size, bounds, zero text/two line/eight graphic knobs |
| `APLD-UOP.TEXT.unix.txt` | `UngpInPl` 575; `PtOnObj` 988; `PtOnSelKnob` 1018 | Ungroup in place, retained selection and per-root handles |
| `APLD-HDR.TEXT.unix.txt` | knob constants near 172 | Lisa's 6x4 handle geometry and 3x2 deadzone |

The included Apple Academic License Agreement was inspected. No Lisa source,
translated source, or Lisa assets were added to the repo.
All JavaScript here is independently authored from functional findings.

The MacDraw ZIP contains `checksum.md5`, `GuidedTour128.dsk`,
`GuidedTourPlus.dsk`, `MacDraw400k.dsk`, `MacDraw800k.dsk`, and `Package.pdf`.
The first three disk formats are MFS; the 800K disk is HFS. The HFS application
is type APPL/creator MDRW with a zero-length data fork and a 100352-byte
resource fork. Its CODE resources contain compiled 68000 code. No MacDraw
source modules were found. Resource parsing and static disassembly were used;
no original executable or emulator was run or installed.

Only the requested toolbar/numeral bitmap data from the user-supplied MacDraw
archive is in the repo. Detailed hashes, glyph mapping and static code offsets
are in `assets/bitmaps/PROVENANCE.md`. The T glyph is exact and matches the
previous 1.9.5 T. Rulers use custom family 249 at size 9, whose seven-row digits
mostly match Geneva 9; they are not Chicago 12. Vertical labels are upright.

Apple's scanned manual was obtained from
[MacDraw manual, 1984](https://vintageapple.org/macbooks/pdf/MacDraw_1984.pdf).
SHA-256: `8224207e1ea7290cdcee0de88ad23b0e49e51b6d5c216c5623c9135b0cb94153`.
References below use printed page numbers; PDF physical pages are one higher.
Manual pages were rendered and read visually. The manual is supporting primary
MacDraw documentation, not proof that every point-release runtime is identical.

## Behavior matrix

| Area | Evidence | Initial clone gap / final behavior | Verification and limits |
| --- | --- | --- | --- |
| Hit testing | MacDraw p32; Lisa SEL `PtNearObj`/`PtNearGrp` | Topmost shape wins; clear interiors pass through; a group's empty space is not treated as filled geometry. Rounded corners now use the painted curved boundary rather than square corners. | Unit tests for clear interiors, rounded corners, groups and text; smooth freehand selection still approximates sampled polylines. |
| Multiple selection and marquee | MacDraw pp32-33; Lisa TR1 `MakeSelCmd` | Shift at down selects/toggles rather than moving an object. Full root-group containment required. Short click toggles, Shift marquee toggles enclosed units, cancel restores previous selection. | Unit and real pointer tests. MacDraw manual establishes Shift-click; Shift-marquee toggle is supported specifically by Lisa evidence. |
| Frames and handles | MacDraw pp35,75-76,97; Lisa DA1 `GetObjKnobs` | Each independently selected root has its own handles; a group has one set; a line has endpoint handles. Resize affects that root while other selections remain selected. Recent padded, native five-pixel text handles remain crisp. | Unit resize/line tests; six-zoom real-canvas handle checks. Lisa uses no text knobs and 6x4 graphic knobs; MacDraw paragraph text is resizable. Exact point-release caption handle behavior needs runtime comparison. |
| Drag feedback | MacDraw p36 | Original objects and their handles stay visible while a moving boundary frame tracks above all fills. Option/Alt switches to shape outlines. Inversion keeps feedback visible over both black and white. | Browser cancellation/atomic movement and Canvas inversion checks; screenshot QA. Browser rendering uses difference compositing rather than original QuickDraw XOR machinery. |
| Drag constraints and snapping | MacDraw pp36,77-78,94,98; Lisa TR1 | Shift pressed after down constrains to 0/45/90 degree directions. Jitter creates no edit. A real drag snaps off-grid boundaries; standalone text uses half-grid spacing. Whole movable selection clamps to the page and locked roots cannot split. | Grid, reduced zoom, diagonal, locked-group and page-limit tests. Two-pixel square deadzone is a Macintosh adaptation; exact original MacDraw timing/threshold is unverified. |
| Group and stacking | MacDraw pp39,75,96-97; Lisa CM1 | Group preserves child paint order, brings the group to front, includes and unlocks locked objects. Copy/duplicate retain foreground labels. Forward/backward arrange moves root units without interleaving children. | Order, lock, nested-group, foreground-pixel and undo tests. Lisa instead excludes locked roots and inserts at the highest selected location; that rule is intentionally not used for the MacDraw target. |
| Ungroup | MacDraw pp39,97; Lisa UOP | Children/subgroups retain relative stack order and stay selected. One wrapper is removed while real nested subgroups survive. | Unit and pixel tests. Earlier deployed tests expected selection to clear; they now explicitly clear selection before testing an independent box/text drag. Baseline remains recoverable. |
| Alignment and centering | MacDraw pp76,99; Lisa CM1 `LineUpCmd` | Align root boundaries against the union of selected bounds. Groups translate rigidly. Locked objects can provide a reference but cannot move. Text justification is preserved. | Group-offset and locked-reference tests. Lisa's standalone text-justification behavior is deliberately not carried into MacDraw boundary alignment. |
| Align to Grid | MacDraw p98 | Rectangle/oval boundaries can resize to the grid; grouped/freehand roots move by their top-left; polygon/line vertices snap individually; text uses half-grid spacing. Custom ruler origin is respected. | Rectangle-boundary and rigid-group tests. Exact caption baseline midpoint rules remain a runtime comparison item. |
| Resize and undo/cancel | MacDraw p35; Lisa TR1 `CnstrRect`/`StrTSel` | Opposite corner stays anchored; signed crossing mirrors points and records box/text flip state. Line endpoint crossing preserves its opposite endpoint. No-op resize/rotation adds no undo. Escape/tool cancellation restores snapshots; mouse-up uses the final pointer position. | All four proportional corners, mirroring, bounds, no-op and cancellation tests. Arbitrarily rotated nonuniform resizing still approximates shape scale; original arc/polygon reshape handles remain outside this patch. |
| Text transitions | MacDraw pp75,97-98 | Typing over a selection starts paragraph text with its width. Text tool edits standalone untransformed text; grouping/rotation/flipping requires restoration before editing. Locked text content can change while geometry/style stay fixed. Draft cancellation preserves identity/content; existing new/edit/undo paths retained. | Real paragraph/new text and cancel tests; lock and guard unit tests; JSON/SVG/pixel regressions. Modern Ctrl+Enter maps completion; Return/Enter remains multiline. Original caption jagged bounds and mixed character selection remain simplified. |
| Zoom centering and defaults | MacDraw pp77,92-94 | Fresh documents have alignment grid on and rulers hidden. Normal Size centers selection (or document when empty); other zoom changes center a selection when possible. Existing saved explicit settings stay intact. | Default unit test and real viewport centering test. Clone retains zoom beyond original normal size as a modern extension. |
| Toolbar and rulers | MacDraw FONT/CODE resources; manual pp10,16,77 | All ten tools now use exact native resource bitmaps in source-sized cells. T is verified. Ruler family 249/9 uses upright right-aligned bitmap numerals. Major labels survive minor-tick sampling at reduced zoom. | Resource hash verification, pixel/canvas tests and 240 screenshot comparisons across four DPRs, three display scales and normal/selected states. Surrounding ruler strip/window metrics are retained where not verified. |

## Changed implementation map

- `src/controller/tools/SelectTool.js`: selection state machine, root handle hits,
  line endpoints, constraints, live snapshots, snapping, bounds and cancellation.
- `src/controller/EditorActions.js`: complete group roots, child paint order,
  stacking units, group/ungroup rules, rigid group alignment and grid alignment.
- `src/model/Document.js`, `src/model/Shape.js`: original new-document defaults,
  full-root marquee bounds and curved rounded-rectangle hits.
- `src/view/Renderer.js`, `src/view/SelectionOverlay.js`: original-object
  rendering, inverted moving frames/outlines and per-root native handles.
- `src/controller/InputHandler.js`: stationary edge autoscroll and final pointer
  coordinates; `KeyboardShortcuts.js`: paragraph creation over a selection.
- `src/controller/tools/TextTool.js`: original edit eligibility and locked text
  content editing; `ResizeGroupCommand.js`: mirror state in undo/redo.
- `src/app.js`: selection/document centering on Normal Size and selected zoom.
- `src/ui/Toolbar.js`, `css/styles.css`: original tool bitmap data and cell
  geometry; `src/util/bitmapText.js`, `src/view/RulerRenderer.js`: custom MacDraw
  numeral font, upright placement and independent major tick sampling.
- `tools/extract-macdraw-bitmaps.py`: independently authored, hash-checked bitmap
  extraction from external FONT payloads; no application code is included.

## Verification

Use `npm test` and `npm run build`. Browser suites require a Vite origin and an
installed Playwright/Chrome runtime. In this environment set TEMP/TMP to this
checkout's ignored `tmp` directory and PLAYWRIGHT_MODULE to the installed
module URI, then run `node test/browser-interactions.mjs` and
`node test/bitmap-toolbar.mjs`. The defaults use `http://127.0.0.1:5174`.
The source fixture is seeded through the model; gestures use actual pointer and
keyboard events through the app. This is not an emulator comparison.

Final verification: 301 unit tests passed in 13 files; production build passed;
72 real-canvas pixel checks passed; all browser pointer/keyboard scenarios
passed without uncaught errors; 240 actual-toolbar screenshot comparisons
passed. Chrome version: 154.0.8037.98. Original-checkout hash comparison found
zero mismatches across all 16 preserved baseline files. `git diff --check` passed.

Current results and screenshots are in ignored `output/interaction-qa` and
`output/bitmap-qa`. Automated checks include the inherited pattern, text,
selection, font and serialization regressions. Visual QA checks crisp native
pixels, T and all tools, upright labels, unobscured foreground text, selection
handles and moving frames. Final counts and original-checkout integrity are
reported with the local fidelity commit.

## Remaining distinctions

This is a tested interaction reconstruction, not a claim of identical LisaDraw
and MacDraw products or complete runtime equivalence. Original event timing,
blink cadence, Shift-marquee behavior in MacDraw 1.9, caption-specific handles,
exact text baseline snapping, smoothed curve hits, arc/polygon reshape feedback
and surrounding window/ruler dimensions need further original-runtime evidence.
The modern file format, accessible HTML text editor, keyboard tool shortcuts
when nothing is selected, multi-step undo, browser scrolling and extra zoom
levels remain independent clone features. No emulator was installed or original
executable run; no deployment, remote push or publication was performed.
