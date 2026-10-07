# Macintosh bitmap provenance

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

No glyph was traced, redrawn, thresholded or resampled. Rulers paint each set
bit at an integer logical pixel, including the counterclockwise vertical
orientation. The existing MacScreen integer display scaling and pixelated
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
