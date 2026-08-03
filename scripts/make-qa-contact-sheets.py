from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pages", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--per-sheet", type=int, default=5)
    args = parser.parse_args()

    paths = sorted(args.pages.glob("page-*.jpg"))
    args.output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()
    thumb_w = 520
    gap = 18
    label_h = 26

    for sheet_no, start in enumerate(range(0, len(paths), args.per_sheet), 1):
        chunk = paths[start : start + args.per_sheet]
        thumbs = []
        for path in chunk:
            with Image.open(path) as src:
                ratio = thumb_w / src.width
                thumb = src.convert("RGB").resize((thumb_w, int(src.height * ratio)))
            thumbs.append((path.name, thumb))

        height = gap + sum(label_h + image.height + gap for _, image in thumbs)
        sheet = Image.new("RGB", (thumb_w + gap * 2, height), "#D8D0CA")
        draw = ImageDraw.Draw(sheet)
        y = gap
        for name, thumb in thumbs:
            draw.text((gap, y + 4), name, fill="#241F1D", font=font)
            y += label_h
            sheet.paste(thumb, (gap, y))
            y += thumb.height + gap
        sheet.save(args.output / f"contact-{sheet_no:02d}.jpg", quality=88)


if __name__ == "__main__":
    main()
