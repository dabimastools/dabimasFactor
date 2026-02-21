from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def _read_non_empty_lines(path: Path) -> list[str]:
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    return [line for line in lines if line]


def _text_height(font: ImageFont.FreeTypeFont) -> int:
    bbox = font.getbbox("Ag")
    return bbox[3] - bbox[1]


def _wrap_line(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    if not text:
        return [""]
    if draw.textlength(text, font=font) <= max_width:
        return [text]

    wrapped: list[str] = []
    current = ""
    for ch in text:
        candidate = current + ch
        if not current or draw.textlength(candidate, font=font) <= max_width:
            current = candidate
            continue
        wrapped.append(current)
        current = ch
    if current:
        wrapped.append(current)
    return wrapped


def build_image(
    text_lines: list[str],
    output_path: Path,
    font_path: Path,
    title: str,
    width: int,
    padding: int,
    title_size: int,
    body_size: int,
    line_spacing: int,
) -> None:
    title_font = ImageFont.truetype(str(font_path), title_size)
    body_font = ImageFont.truetype(str(font_path), body_size)

    dummy_draw = ImageDraw.Draw(Image.new("RGB", (1, 1), "white"))
    content_width = width - padding * 2

    wrapped_title: list[str] = []
    for line in title.splitlines():
        wrapped_title.extend(_wrap_line(dummy_draw, line.strip(), title_font, content_width))

    wrapped_body: list[str] = []
    for line in text_lines:
        wrapped_body.extend(_wrap_line(dummy_draw, line, body_font, content_width))

    title_height = _text_height(title_font)
    body_height = _text_height(body_font)
    title_block_height = len(wrapped_title) * title_height + max(0, len(wrapped_title) - 1) * line_spacing
    body_block_height = len(wrapped_body) * body_height + max(0, len(wrapped_body) - 1) * line_spacing

    accent_height = 14
    section_gap = 28
    height = padding + accent_height + section_gap + title_block_height + section_gap + body_block_height + padding

    image = Image.new("RGB", (width, height), "#FFFFFF")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, accent_height), fill="#2B6CB0")

    y = padding + accent_height
    for line in wrapped_title:
        draw.text((padding, y), line, fill="#111111", font=title_font)
        y += title_height + line_spacing

    y += section_gap - line_spacing
    for line in wrapped_body:
        draw.text((padding, y), line, fill="#1F2937", font=body_font)
        y += body_height + line_spacing

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG", optimize=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render a UTF-8 text file into a PNG image.")
    parser.add_argument("--input", default="latest_stallions.txt", help="Input text file path")
    parser.add_argument("--output", default="latest_stallions.png", help="Output PNG file path")
    parser.add_argument("--font-path", default="fonts/NotoSansJP-Regular.otf", help="Font file path (OTF/TTF)")
    parser.add_argument("--title", default="ダビふぁく 追加データ", help="Image title")
    parser.add_argument("--width", type=int, default=1200, help="Image width in pixels")
    parser.add_argument("--padding", type=int, default=56, help="Horizontal/vertical padding in pixels")
    parser.add_argument("--title-size", type=int, default=54, help="Title font size in px")
    parser.add_argument("--body-size", type=int, default=40, help="Body font size in px")
    parser.add_argument("--line-spacing", type=int, default=14, help="Line spacing in px")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    font_path = Path(args.font_path)

    if not input_path.exists():
        raise FileNotFoundError(f"Input text file not found: {input_path}")
    if not font_path.exists():
        raise FileNotFoundError(f"Font file not found: {font_path}")

    lines = _read_non_empty_lines(input_path)
    if not lines:
        raise ValueError(f"Input text has no non-empty lines: {input_path}")

    build_image(
        text_lines=lines,
        output_path=output_path,
        font_path=font_path,
        title=args.title,
        width=args.width,
        padding=args.padding,
        title_size=args.title_size,
        body_size=args.body_size,
        line_spacing=args.line_spacing,
    )
    print(f"Saved: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
