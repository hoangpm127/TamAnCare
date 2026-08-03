from __future__ import annotations

import argparse
import html
import io
import os
import re
import tempfile
from pathlib import Path

from docx import Document
from docx.document import Document as _Document
from docx.oxml.ns import qn
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


BRAND_RED = colors.HexColor("#A71922")
BRAND_GOLD = colors.HexColor("#B98421")
INK = colors.HexColor("#241F1D")
MUTED = colors.HexColor("#6B625E")
PALE = colors.HexColor("#F7F2ED")
FOOTER_FONT = "Helvetica"


def iter_block_items(parent):
    if isinstance(parent, _Document):
        parent_elm = parent.element.body
    else:
        raise TypeError(f"Unsupported parent: {type(parent)!r}")

    for child in parent_elm.iterchildren():
        if child.tag == qn("w:p"):
            yield DocxParagraph(child, parent)
        elif child.tag == qn("w:tbl"):
            yield DocxTable(child, parent)


def register_fonts():
    candidates = [
        ("ArialQA", r"C:\Windows\Fonts\arial.ttf"),
        ("ArialQA-Bold", r"C:\Windows\Fonts\arialbd.ttf"),
        ("ArialQA-Italic", r"C:\Windows\Fonts\ariali.ttf"),
    ]
    for name, path in candidates:
        if Path(path).exists():
            pdfmetrics.registerFont(TTFont(name, path))
    return (
        "ArialQA" if "ArialQA" in pdfmetrics.getRegisteredFontNames() else "Helvetica",
        "ArialQA-Bold" if "ArialQA-Bold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold",
        "ArialQA-Italic" if "ArialQA-Italic" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Oblique",
    )


def para_text(paragraph: DocxParagraph) -> str:
    return " ".join(paragraph.text.split())


def has_page_break(paragraph: DocxParagraph) -> bool:
    return bool(paragraph._p.xpath(".//w:br[@w:type='page']"))


def paragraph_images(paragraph: DocxParagraph, temp_dir: Path):
    items = []
    for idx, blip in enumerate(paragraph._p.xpath(".//a:blip")):
        rid = blip.get(qn("r:embed"))
        if not rid:
            continue
        part = paragraph.part.related_parts.get(rid)
        if not part:
            continue
        suffix = Path(str(part.partname)).suffix or ".png"
        image_path = temp_dir / f"image-{rid}-{idx}{suffix}"
        image_path.write_bytes(part.blob)
        try:
            with PILImage.open(image_path) as img:
                width_px, height_px = img.size
            max_w = 6.65 * inch
            max_h = 4.2 * inch
            scale = min(max_w / width_px, max_h / height_px, 1.0)
            items.append(Image(str(image_path), width=width_px * scale, height=height_px * scale))
        except Exception:
            continue
    return items


def convert_inline_markup(paragraph: DocxParagraph) -> str:
    fragments = []
    for run in paragraph.runs:
        value = html.escape(run.text or "")
        if not value:
            continue
        value = value.replace("\n", "<br/>")
        if run.bold:
            value = f"<b>{value}</b>"
        if run.italic:
            value = f"<i>{value}</i>"
        fragments.append(value)
    text = "".join(fragments).strip()
    return text or html.escape(para_text(paragraph))


def table_cell_text(cell, style):
    lines = []
    for paragraph in cell.paragraphs:
        text = para_text(paragraph)
        if text:
            lines.append(html.escape(text))
    return Paragraph("<br/>".join(lines) or " ", style)


def build_styles(font, font_bold, font_italic):
    sample = getSampleStyleSheet()
    return {
        "body": ParagraphStyle(
            "QA Body",
            parent=sample["BodyText"],
            fontName=font,
            fontSize=9,
            leading=12.2,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        ),
        "cover_title": ParagraphStyle(
            "QA Cover Title",
            parent=sample["Title"],
            fontName=font_bold,
            fontSize=25,
            leading=30,
            textColor=BRAND_RED,
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        "title": ParagraphStyle(
            "QA Title",
            parent=sample["Title"],
            fontName=font_bold,
            fontSize=18,
            leading=22,
            textColor=BRAND_RED,
            alignment=TA_LEFT,
            spaceBefore=7,
            spaceAfter=9,
        ),
        "h1": ParagraphStyle(
            "QA H1",
            parent=sample["Heading1"],
            fontName=font_bold,
            fontSize=15,
            leading=18,
            textColor=BRAND_RED,
            spaceBefore=10,
            spaceAfter=7,
        ),
        "h2": ParagraphStyle(
            "QA H2",
            parent=sample["Heading2"],
            fontName=font_bold,
            fontSize=12,
            leading=15,
            textColor=INK,
            spaceBefore=8,
            spaceAfter=5,
        ),
        "h3": ParagraphStyle(
            "QA H3",
            parent=sample["Heading3"],
            fontName=font_bold,
            fontSize=10,
            leading=13,
            textColor=BRAND_GOLD,
            spaceBefore=6,
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "QA Subtitle",
            parent=sample["BodyText"],
            fontName=font_italic,
            fontSize=11,
            leading=15,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "list": ParagraphStyle(
            "QA List",
            parent=sample["BodyText"],
            fontName=font,
            fontSize=9,
            leading=12,
            textColor=INK,
            leftIndent=13,
            firstLineIndent=-8,
            spaceAfter=3,
        ),
        "table": ParagraphStyle(
            "QA Table",
            parent=sample["BodyText"],
            fontName=font,
            fontSize=7.7,
            leading=9.4,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "table_header": ParagraphStyle(
            "QA Table Header",
            parent=sample["BodyText"],
            fontName=font_bold,
            fontSize=7.7,
            leading=9.4,
            textColor=colors.white,
            alignment=TA_LEFT,
        ),
    }


def docx_table_to_reportlab(docx_table, styles, available_width):
    rows = []
    col_count = max((len(row.cells) for row in docx_table.rows), default=1)
    for row_idx, row in enumerate(docx_table.rows):
        row_items = []
        for cell in row.cells:
            cell_style = styles["table_header"] if row_idx == 0 else styles["table"]
            row_items.append(table_cell_text(cell, cell_style))
        while len(row_items) < col_count:
            row_items.append(Paragraph(" ", styles["table"]))
        rows.append(row_items)

    if not rows:
        return Spacer(1, 1)

    widths = []
    try:
        first_row = docx_table.rows[0]
        raw_widths = []
        for cell in first_row.cells:
            tcw = cell._tc.tcPr.tcW
            raw_widths.append(float(tcw.w) if tcw is not None and tcw.w else 1.0)
        total = sum(raw_widths)
        widths = [available_width * w / total for w in raw_widths]
    except Exception:
        widths = [available_width / col_count] * col_count

    table = Table(rows, colWidths=widths, repeatRows=1, hAlign="CENTER")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_RED),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D8CBC1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D8CBC1"))
    canvas.setLineWidth(0.4)
    canvas.line(doc.leftMargin, 0.55 * inch, LETTER[0] - doc.rightMargin, 0.55 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont(FOOTER_FONT, 7)
    canvas.drawString(doc.leftMargin, 0.37 * inch, "Tuệ Tâm Care — bản kết xuất QA nội bộ")
    canvas.drawRightString(LETTER[0] - doc.rightMargin, 0.37 * inch, f"Trang {doc.page}")
    canvas.restoreState()


def render(input_path: Path, output_path: Path):
    global FOOTER_FONT
    font, font_bold, font_italic = register_fonts()
    FOOTER_FONT = font
    styles = build_styles(font, font_bold, font_italic)
    docx = Document(input_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    report = SimpleDocTemplate(
        str(output_path),
        pagesize=LETTER,
        leftMargin=0.72 * inch,
        rightMargin=0.72 * inch,
        topMargin=0.68 * inch,
        bottomMargin=0.72 * inch,
        title="Tuệ Tâm Care — QA render",
        author="OpenAI Codex",
    )
    available_width = LETTER[0] - report.leftMargin - report.rightMargin
    story = []
    cover_seen = False

    with tempfile.TemporaryDirectory(prefix="tuetam-docx-qa-") as temp:
        temp_dir = Path(temp)
        for block in iter_block_items(docx):
            if isinstance(block, DocxParagraph):
                if has_page_break(block):
                    story.append(PageBreak())

                images = paragraph_images(block, temp_dir)
                if images:
                    for item in images:
                        item.hAlign = "CENTER"
                        story.extend([Spacer(1, 5), item, Spacer(1, 7)])

                text = para_text(block)
                if not text:
                    continue

                style_name = (block.style.name or "").lower()
                if "title" in style_name and not cover_seen:
                    style = styles["cover_title"]
                    cover_seen = True
                elif "title" in style_name:
                    style = styles["title"]
                elif style_name.startswith("heading 1"):
                    style = styles["h1"]
                elif style_name.startswith("heading 2"):
                    style = styles["h2"]
                elif style_name.startswith("heading 3"):
                    style = styles["h3"]
                elif "subtitle" in style_name:
                    style = styles["subtitle"]
                elif "list" in style_name:
                    style = styles["list"]
                    marker = "• " if "bullet" in style_name else "– "
                    story.append(Paragraph(marker + convert_inline_markup(block), style))
                    continue
                else:
                    style = styles["body"]

                story.append(Paragraph(convert_inline_markup(block), style))
            else:
                story.extend(
                    [
                        Spacer(1, 4),
                        docx_table_to_reportlab(block, styles, available_width),
                        Spacer(1, 7),
                    ]
                )

        report.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    render(args.input.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
