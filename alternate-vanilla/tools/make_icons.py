"""Erzeugt die PWA-Icons.dev-only, benötigt Pillow und einmalig Internet.

    python tools/make_icons.py

Schrift: Lexend (SIL OFL 1.1), Quelle: fonts.gstatic.com
"""

from __future__ import annotations

import io
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
FONT_URL = (
    "https://fonts.gstatic.com/s/lexend/v26/"
    "wlptgwvFAVdoq2_F94zlCfv0bz1WC9wR_LA.ttf"  # Lexend 700
)
TEAL = (20, 108, 98, 255)
CREAM = (251, 246, 233, 255)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    with urllib.request.urlopen(FONT_URL, timeout=30) as response:
        data = response.read()
    return ImageFont.truetype(io.BytesIO(data), size)


def make_icon(size: int, *, maskable: bool = False) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = int(size * 0.22)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=TEAL)

    # Bei maskable Icons alles in die sichere Zone (80 %) ziehen.
    scale = 0.82 if maskable else 1.0
    font = load_font(int(size * 0.56 * scale))
    text = "K"
    box = draw.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    draw.text(
        ((size - tw) / 2 - box[0], size * 0.43 - th / 2 - box[1]),
        text,
        font=font,
        fill=CREAM,
    )

    # Drei Schreiblinien als Hinweis auf Rechtschreibung/Handschrift.
    line_w = int(size * 0.34 * scale)
    line_h = max(2, int(size * 0.014))
    y0 = size * 0.72
    gap = size * 0.055
    for i, alpha in enumerate((170, 120, 80)):
        y = y0 + i * gap
        draw.rounded_rectangle(
            ((size - line_w) / 2, y, (size + line_w) / 2, y + line_h),
            radius=line_h // 2,
            fill=(CREAM[0], CREAM[1], CREAM[2], alpha),
        )
    return image


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for name, size, maskable in (
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ):
        make_icon(size, maskable=maskable).save(OUT / name, optimize=True)
        print(f"geschrieben: {OUT / name}")


if __name__ == "__main__":
    main()
