"""Build production raster assets from the Sanad Inventory SVG sources.

Strategy:
  - 16/32/48 px: render from favicon.svg (thicker strokes, larger nodes — built for small sizes)
  - 64-1024 px:  render from tile.svg (full app-icon design)
  - apple-touch-icon.png: 180 px alias from tile.svg
  - favicon.ico: multi-resolution (16+32+48), built from the favicon PNGs via Pillow

Run from project root:
    python3 .snapshots/build-icons.py
"""

from pathlib import Path
import struct
import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "public" / "icons"

TILE_SVG = ICONS / "sanad-inventory-tile.svg"
FAVICON_SVG = ICONS / "sanad-inventory-favicon.svg"

FAVICON_SIZES = [16, 32, 48]
TILE_SIZES = [64, 128, 180, 192, 256, 512, 1024]
ICO_SIZES = [16, 24, 32, 48, 64]


def build_multires_ico(svg_path: Path, sizes: list, out_path: Path) -> None:
    """Render the SVG directly at each size and pack into a multi-resolution ICO.
    Each frame is a PNG rendered at its exact target size — no downsampling."""
    blobs = []
    for size in sizes:
        png_bytes = cairosvg.svg2png(
            url=str(svg_path),
            output_width=size,
            output_height=size,
        )
        blobs.append((size, png_bytes))

    with open(out_path, "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, len(blobs)))
        data_offset = 6 + 16 * len(blobs)
        for size, blob in blobs:
            w = size if size < 256 else 0
            f.write(struct.pack(
                "<BBBBHHII",
                w, w, 0, 0, 1, 32, len(blob), data_offset,
            ))
            data_offset += len(blob)
        for _, blob in blobs:
            f.write(blob)


def render(svg_path: Path, size: int, out_path: Path) -> None:
    cairosvg.svg2png(
        url=str(svg_path),
        write_to=str(out_path),
        output_width=size,
        output_height=size,
    )
    print(f"  {out_path.name} ({size}x{size})")


def main() -> None:
    if not TILE_SVG.exists():
        raise SystemExit(f"missing {TILE_SVG}")
    if not FAVICON_SVG.exists():
        raise SystemExit(f"missing {FAVICON_SVG}")

    print(f"writing to {ICONS}")

    print("rendering favicon-variant PNGs (16/32/48):")
    for size in FAVICON_SIZES:
        render(FAVICON_SVG, size, ICONS / f"sanad-inventory-{size}.png")

    print("rendering tile-variant PNGs (64-1024):")
    for size in TILE_SIZES:
        render(TILE_SVG, size, ICONS / f"sanad-inventory-{size}.png")

    apple_touch = ICONS / "apple-touch-icon.png"
    src_180 = ICONS / "sanad-inventory-180.png"
    apple_touch.write_bytes(src_180.read_bytes())
    print(f"copied {src_180.name} -> {apple_touch.name}")

    ico_path = ICONS / "favicon.ico"
    print(f"building {ico_path.name} ({', '.join(f'{s}x{s}' for s in ICO_SIZES)}):")
    build_multires_ico(FAVICON_SVG, ICO_SIZES, ico_path)
    print(f"  {ico_path.name} — each frame rendered directly from favicon SVG")

    print("done.")


if __name__ == "__main__":
    main()
