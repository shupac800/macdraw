"""Extract only the requested UI bitmap data from externally supplied FONT payloads.

Usage: python tools/extract-macdraw-bitmaps.py EXTERNAL_RESOURCE_DIRECTORY
Requires Pillow. Input resource files are not bundled with the repository.
"""
import hashlib
import json
import struct
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "bitmaps"
EXPECTED = {31755: "eb2fdd00042a4f7d05370080a6da30e67fe89ca2e67b904751928d5544440662",
            31881: "54e9467586f5ca3c72d292b1dcc0cd8ab77f268dc615e9eab1af954558a8059f"}

def read_font(directory, resource_id):
    data = (directory / f"FONT-{resource_id}.bin").read_bytes()
    assert hashlib.sha256(data).hexdigest() == EXPECTED[resource_id], "Unexpected FONT version"
    header = struct.unpack_from(">13h", data)
    first, last, height, row_bytes = header[1], header[2], header[7], header[12] * 2
    locations = struct.unpack_from(f">{last-first+3}H", data, 26 + height * row_bytes)
    widths = 16 + header[8] * 2
    def glyph(code):
        index = code - first
        left, right = locations[index:index+2]
        offset, advance = data[widths + index*2:widths + index*2 + 2]
        assert advance != 255
        image = Image.new("RGBA", (right-left, height))
        for y in range(height):
            for x in range(right-left):
                bit = left + x
                if data[26 + y*row_bytes + bit//8] & (128 >> (bit%8)):
                    image.putpixel((x,y),(0,0,0,255))
        return image, advance, offset + header[4]
    return glyph

def extract(directory):
    tool_font = read_font(directory,31755)
    manifest = {}
    for code, name in enumerate(["select","text","perpendicular","line","rect","roundRect","oval","arc","freehand","polygon"],3):
        image, advance, bearing = tool_font(code)
        crop = image.getbbox()
        image = image.crop(crop)
        target = OUT / f"tool-{name}.png"
        image.save(target)
        rows = ["".join("1" if image.getpixel((x,y))[3] else "0" for x in range(image.width)) for y in range(image.height)]
        manifest[name] = dict(rows=rows,glyph=code,width=image.width,height=image.height,advance=advance,bearing=bearing,sourceCrop=list(crop),sha256=hashlib.sha256(target.read_bytes()).hexdigest())
    (OUT / "macdraw-1.9-tools.json").write_text(json.dumps(manifest,indent=2)+"\n")
    numeral_font = read_font(directory,31881)
    numbers = {}
    for char in "0123456789-.":
        image, advance, offset = numeral_font(ord(char))
        crop = image.getbbox()
        width = crop[2]-crop[0]
        bits = ((width+3)//4)*4
        rows = []
        for y in range(image.height):
            value = sum(1 << (bits-1-x) for x in range(width) if image.getpixel((crop[0]+x,y))[3])
            rows.append(f"{value:0{bits//4}x}")
        numbers[char] = dict(advance=advance,x=offset+crop[0],y=0,width=width,height=image.height,rows=rows)
    # Existing modern custom numbering can produce exponent notation. These
    # three fallback glyphs are explicitly not original MacDraw numeral bits.
    fallback = json.loads((OUT / "chicago-12-ruler.json").read_text())
    for char in "+eE": numbers[char] = fallback[char]
    (OUT / "macdraw-1.9-ruler.json").write_text(json.dumps(numbers,indent=2)+"\n")

if __name__ == "__main__":
    extract(Path(sys.argv[1]))

