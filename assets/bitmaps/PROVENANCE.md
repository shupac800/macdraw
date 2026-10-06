# Macintosh bitmap provenance

The current toolbar and ruler numerals target the user-supplied MacDraw 1.9
archive. The Chicago and Guided Tour research below records the earlier
baseline; Chicago 12 is no longer used for normal ruler numerals.

These assets copy bits from Apple Chicago 12, archived as `Chicago-12.bdf` in
[danfe/fonts](https://github.com/danfe/fonts/blob/1fcfa2e1bcf87b530e66aa8ebedd53e870c816a0/Chicago-12.bdf).
The source identifies Apple as its foundry and says it was created by Fondu
from a Macintosh NFNT/FONT resource. The archive does not identify the exact
System release from which that resource was extracted.

Source revision: `1fcfa2e1bcf87b530e66aa8ebedd53e870c816a0`.
Source SHA-256: `c49c1ee835be49493f78de056ecd63f3ce98afb8f6332b82237329431b028456`.

- `apple-menu.png`: the original menu glyph at Macintosh character 0x14
  (also mapped to U+F8FF in this archive), cropped to its 9 x 11 bounding box.
  The rows are `0600 0C00 0800 7700 FF80 FE00 FE00 FF80 FF80 7F00 3600`.
  Black source bits become opaque black; unset bits become transparent.
- `chicago-12-ruler.json`: numeric glyphs `0123456789.+-eE`, including original
  advance widths, bounding boxes and hexadecimal bitmap rows. Punctuation and
  exponent characters support negative/fractional custom ruler values.

No glyph was traced, redrawn, thresholded or resampled. The earlier ruler
implementation used these Chicago bits and rotated vertical labels. That
assumption is superseded by the MacDraw 1.9 findings below. The existing MacScreen integer display scaling and pixelated
canvas/image rendering enlarge these bits with nearest-neighbor sampling.
The menu bitmap inverts on hover/open to preserve the white-on-black menu state.

These original Apple resource bits are distinct from the bundled Chicago Kare
reproduction and its MIT license; no new license for the historical bits is claimed.


## Text tool icon

`text-tool.png` copies the exact 9 x 11 bitmap of glyph 4 from the original
MacDraw tool font, `FONT` resource 31755 (font family 248, size 11). The resource
was extracted read-only from MacDraw 1.9.5 in the archived German disk
[disk1.img](https://archive.org/download/AppleMacDraw/disk1.img), described by
[Internet Archive](https://archive.org/details/AppleMacDraw). The disk's SHA-1
matches the archive metadata: `5b883383827d2742220b89de083c646c308853d0`.

- Disk SHA-256: `4e170fa25564726a1d9b4c422cb22eaa89278586f9a824aaac57038ecddbb25e`.
- FONT resource SHA-256: `b6dd8d8dd6149093056fc5a180f85ef2ba73cd595771a656d556e5d305df3cba`.
- Bitmap PNG SHA-256: `1f6e4d605a18eb63e168c5dd382bf0b3db04679817b6e36b1c6ee5c446016867`.
- Rows: `FF80 C980 8880 0800 0800 0800 0800 0800 0800 1C00 3E00`.

The serif shape and proportions were checked against the user's MacDraw Guided
Tour 1.0 reference photo (`libfile_cf6fb855db948191bd1403364d0e590e`, SHA-256
`1e0af89800f22280b06ce6de53902273bbc950cd3a029d34bd718e7f1cc44271`). The photo
is enlarged and blurred, so the exact bits come from the application resource,
not thresholding or redrawing the photo. The archive is a later version than
the Guided Tour pictured; the T glyph visually matches that reference.

Each source bit maps to one transparent or opaque black PNG pixel. The image
uses nearest-neighbor display scaling, with exact inversion for selection.
This is original application resource data, not original MacDraw program
source code. No new license for these historical bits is claimed.


## Authoritative MacDraw 1.9 archive

Input: `C:\Users\david\Downloads\macdraw_1_9.zip`.
ZIP SHA-256: `f5e2b00413b9db69f25fc7166b5cf77230c54e8b820558bced2192edb2dc2d67`.
The application resource is from `MacDraw800k.dsk`, an HFS disk image. Its
`MDRW` resource identifies the build as `MacDraw 1.9 5/28/85`. This is compiled
application/resource data, not MacDraw source. That build date does not prove
an independent 1988 release date.

- `FONT` 31755, family 248, size 11, SHA-256:
  `eb2fdd00042a4f7d05370080a6da30e67fe89ca2e67b904751928d5544440662`.
- `FONT` 31881, family 249, size 9, SHA-256:
  `54e9467586f5ca3c72d292b1dcc0cd8ab77f268dc615e9eab1af954558a8059f`.

`tool-*.png` contains the ten cropped toolbar glyphs, with transparent unset
bits and opaque black set bits. `macdraw-1.9-tools.json` records source glyph
numbers 3 through 12, source crop, advance, bitmap rows and PNG SHA-256. Glyph 4
is the serif T. Its PNG hash matches the previous 1.9.5 extraction exactly;
the application does not use an A for this tool. All tools now use original
resource bits instead of SVG approximations.

Static code evidence: `CODE` 2 at resource-relative offsets `0x3ea8` through
`0x3ed8` establishes 24x16 cells with 17-pixel vertical pitch. At `0x3f68`
through `0x3f82` the routine places the glyph four pixels from the cell's left,
sets its baseline three rows above the bottom, and draws tool index plus 3.
The shared character routine at `0x67dc` selects family 248, size 11. These
references describe behavior in our own words; no application code is bundled.

`macdraw-1.9-ruler.json` records original family 249 digits, minus and decimal
point with advance widths and bitmap rows. Numerals have seven bitmap rows
and six-pixel advances. The application selects family 249 at size 9 in
`CODE` 21 at `0x38e` through `0x396`. Its label routine at `0x172` through
`0x196` uses the measured string width plus one pixel before the tick and draws
upright text on both axes. The clone retains its existing 20-pixel ruler strip;
matching every surrounding ruler/window dimension is not established here.

Comparison against `FONT` 393 (Geneva 9) in the System resource fork on this
same disk: digits 0, 1, 2, 4, 5, 6, 7, 8 and 9 match exactly after cropping
blank rows; digit 3 differs. Thus the verified identity is MacDraw's custom
9-point numeral font, with strong Geneva 9 similarity, not Chicago 12. The
custom numeral resource is byte-identical to the earlier 1.9.5 resource. It
contains arrow symbols at character positions normally used for '+' and
other punctuation; those arrow symbols are not treated as arithmetic signs.
The existing Chicago '+', 'e' and 'E' remain explicit fallbacks only for the
clone's modern exponent-format/custom-numbering extension.

Extraction is reproducible using our independently authored
`tools/extract-macdraw-bitmaps.py` with external `FONT-31755.bin` and
`FONT-31881.bin` payloads. The disk images, forks, executable code, manual and
Lisa source stay outside this repository. Only the requested MacDraw bitmap
assets and their metadata are included. No new license for historical Apple
resource bits is claimed.
