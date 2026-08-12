#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Eureka.AI — Generator PDF rangkuman catatan (struktur skripsi) memakai reportlab.

Dibaca dari stdin: satu baris JSON dengan struktur:
{
  "title": "...",
  "subject": "...",
  "summary": "...",
  "createdAt": "...",      // ISO date
  "chapters": [ { "title": "...", "content": "..." }, ... ],
  "images": [ { "chapterIndex": 0, "url": "...", "alt": "..." }, ... ]   // opsional
}

Ditulis ke stdout (line-based protocol yang dibaca Node/SSE):
  PROGRESS|<persen>|<pesan>
  DONE|<base64-pdf>
Error → stderr, exit code non-zero.

Gambar: setiap URL diunduh dengan timeout + validasi content-type image/*.
Bila gagal (jaringan/format/terlalu besar), diganti KOTAK PLACEHOLDER berisi
teks alt — PDF tetap valid & gambar "selalu tampil" tanpa error.

Dipakai route /api/notes/:id/pdf/stream (Node spawn python3 script ini).
"""

import base64
import io
import json
import os
import re
import sys
import urllib.request
from datetime import datetime

try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
        Image as RLImage,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )
except ImportError as e:  # pragma: no cover
    sys.stderr.write("ERROR|reportlab tidak terpasang. Jalankan: pip install reportlab\n")
    sys.stderr.write(f"{e}\n")
    sys.exit(3)


def progress(pct: int, msg: str) -> None:
    """Kirim progres ke stdout (dibaca Node untuk SSE)."""
    sys.stdout.write(f"PROGRESS|{int(pct)}|{msg}\n")
    sys.stdout.flush()


# ─── Font Unicode (DejaVu bila ada, fallback Helvetica) ───────────────
_FONT = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
_FONT_ITALIC = "Helvetica-Oblique"
DEJAVU_DIRS = [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/dejavu",
    "C:/Windows/Fonts",
]


def _register_fonts() -> None:
    global _FONT, _FONT_BOLD, _FONT_ITALIC
    for base_dir in DEJAVU_DIRS:
        regular = os.path.join(base_dir, "DejaVuSans.ttf")
        if not os.path.exists(regular):
            continue
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", regular))
            pdfmetrics.registerFont(
                TTFont("DejaVuSans-Bold", os.path.join(base_dir, "DejaVuSans-Bold.ttf"))
            )
            pdfmetrics.registerFont(
                TTFont("DejaVuSans-Oblique", os.path.join(base_dir, "DejaVuSans-Oblique.ttf"))
            )
            _FONT = "DejaVuSans"
            _FONT_BOLD = "DejaVuSans-Bold"
            _FONT_ITALIC = "DejaVuSans-Oblique"
            return
        except Exception:
            continue


_register_fonts()

# ─── Warna (konsisten dgn pdfkit route) ───────────────────────────────
C_PRIMARY = colors.HexColor("#4C1D95")
C_DARK = colors.HexColor("#292524")
C_BG = colors.HexColor("#FFF9EF")
C_PLACEHOLDER_BG = colors.HexColor("#F1EAD9")
C_PLACEHOLDER_BORDER = colors.HexColor("#D8CFBA")
C_PLACEHOLDER_TEXT = colors.HexColor("#8A8578")

# ─── Konversi markdown → paragraf ─────────────────────────────────────
def _clean(text: str) -> str:
    """Hapus marker markdown & emoji yang tidak didukung font, rapikan spasi."""
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)  # ![alt](url) → alt
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)    # [t](url) → t
    text = re.sub(r"[*_~`#]+", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    # Buang emoji & simbol non-latin (font DejaVu tetap tak punya semua)
    text = re.sub(
        r"[\U0001F000-\U0001FAFF\u2600-\u27BF\u2190-\u21FF\u2300-\u23FF]",
        "",
        text,
    )
    return text.strip()


def markdown_to_paragraphs(raw: str):
    lines = raw.splitlines()
    paragraphs: list = []  # (kind, text) kind: "heading" | "bullet" | "body"
    buffer: list = []

    def flush():
        text = _clean(" ".join(buffer))
        if text:
            paragraphs.append(("body", text))
        buffer.clear()

    for line in lines:
        t = line.strip()
        if not t:
            flush()
            continue
        # Tabel "| A | B |" → kalimat deskriptif
        if t.startswith("|") and t.endswith("|"):
            cells = [c.strip() for c in t.split("|")]
            cells = [re.sub(r"[*_~`#]+", "", c) for c in cells]
            cells = [c for c in cells if c]
            if len(cells) >= 2 and not all(re.fullmatch(r"[-:]+", c) for c in cells):
                buffer.append(f"{cells[0]}: {' — '.join(cells[1:])}.")
            continue
        # Heading
        if re.match(r"^#{1,6}\s", t):
            flush()
            title = re.sub(r"^#{1,6}\s+", "", t)
            title = re.sub(r"[*_`~]+", "", title).strip()
            if title:
                paragraphs.append(("heading", _clean(title)))
            continue
        # Bullet "- " / "* " / "- 1."
        m = re.match(r"^[-*•]\s+(.+)$", t) or re.match(r"^-?\s*\d+\.\s+(.+)$", t)
        if m:
            flush()
            item = _clean(m.group(1))
            if item:
                paragraphs.append(("bullet", item))
            continue
        buffer.append(t)
    flush()
    return paragraphs


# ─── Gambar: unduh + embed (dengan placeholder bila gagal) ────────────
MAX_IMAGE_BYTES = 8 * 1024 * 1024
IMAGE_TIMEOUT = 20


def download_image(url: str):
    """Unduh gambar, validasi content-type image/* & ukuran. None bila gagal."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; EurekaAI-PDF/1.0)",
                "Accept": "image/png,image/jpeg,image/avif,image/*;q=0.8",
            },
        )
        with urllib.request.urlopen(req, timeout=IMAGE_TIMEOUT) as resp:
            ctype = (resp.headers.get("Content-Type") or "").lower()
            if not ctype.startswith("image/"):
                return None
            data = resp.read(MAX_IMAGE_BYTES + 1)
            if len(data) > MAX_IMAGE_BYTES:
                return None
            return data if data else None
    except Exception:
        return None


def _placeholder_flowable(alt: str):
    """Kotak placeholder bergaya — dipakai saat gambar tak bisa diunduh."""
    text = Paragraph(
        f"{_clean(alt) or 'Ilustrasi'}"
        f"<br/><font size='8' color='#8A8578'>(gambar tidak tersedia)</font>",
        ParagraphStyle(
            "PhText",
            fontName=_FONT_ITALIC,
            fontSize=10,
            leading=14,
            textColor=C_PLACEHOLDER_TEXT,
            alignment=TA_CENTER,
        ),
    )
    t = Table([[text]], colWidths=[140 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), C_PLACEHOLDER_BG),
                ("BOX", (0, 0), (-1, -1), 0.75, C_PLACEHOLDER_BORDER),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 16),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
            ]
        )
    )
    t.hAlign = "CENTER"
    return t


def make_image_flowable(url: str, alt: str):
    """
    Unduh & bungkus gambar jadi flowable reportlab (proporsi dijaga).
    Gagal → placeholder. Return (flowable, caption_alt_or_None).
    """
    data = download_image(url)
    if not data:
        return _placeholder_flowable(alt), None
    try:
        reader = ImageReader(io.BytesIO(data))
        iw, ih = reader.getSize()
        if not iw or not ih:
            return _placeholder_flowable(alt), None
        # Skala agar muat (lebar ≤ 150mm, tinggi ≤ 95mm), jangan perbesar.
        scale = min((150 * mm) / iw, (95 * mm) / ih, 1.0)
        w, h = iw * scale, ih * scale
        if w < 30 * mm or h < 18 * mm:
            # Terlalu kecil untuk ditampilkan → placeholder.
            return _placeholder_flowable(alt), None
        img = RLImage(io.BytesIO(data), width=w, height=h)
        img.hAlign = "CENTER"
        return img, (alt or "Ilustrasi").strip()[:120] or "Ilustrasi"
    except Exception:
        return _placeholder_flowable(alt), None


# ─── Bangun PDF ───────────────────────────────────────────────────────
def build_pdf(data: dict) -> bytes:
    title = (data.get("title") or "Rangkuman Materi").strip()
    subject = (data.get("subject") or "").strip()
    summary = (data.get("summary") or "Tidak ada ringkasan.").strip()
    chapters = [
        c
        for c in (data.get("chapters") or [])
        if isinstance(c, dict)
        and isinstance(c.get("title"), str)
        and isinstance(c.get("content"), str)
    ]
    # Gambar per bab: {chapterIndex: {"url","alt"}}
    img_by_chapter = {}
    for im in data.get("images") or []:
        if (
            isinstance(im, dict)
            and isinstance(im.get("chapterIndex"), int)
            and isinstance(im.get("url"), str)
            and im["url"].startswith(("http://", "https://"))
        ):
            img_by_chapter.setdefault(
                im["chapterIndex"], {"url": im["url"], "alt": str(im.get("alt") or "Ilustrasi")}
            )

    date_str = ""
    try:
        dt = datetime.fromisoformat(data.get("createdAt", "").replace("Z", "+00:00"))
        date_str = dt.strftime("%d %B %Y")
    except Exception:
        date_str = ""

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=56,
        rightMargin=56,
        topMargin=60,
        bottomMargin=52,
        title=f"{title} — Rangkuman Eureka.AI",
        author="Eureka.AI",
    )

    st_title = ParagraphStyle(
        "Title", fontName=_FONT_BOLD, fontSize=15, leading=19, textColor=C_PRIMARY, alignment=TA_CENTER
    )
    st_main = ParagraphStyle(
        "Main", fontName=_FONT_BOLD, fontSize=26, leading=34, textColor=C_DARK, alignment=TA_CENTER
    )
    st_sub = ParagraphStyle(
        "Sub", fontName=_FONT, fontSize=13, leading=17, textColor=C_DARK, alignment=TA_CENTER
    )
    st_date = ParagraphStyle(
        "Date", fontName=_FONT_ITALIC, fontSize=11, leading=15, textColor=C_DARK, alignment=TA_CENTER
    )
    st_h1 = ParagraphStyle(
        "H1", fontName=_FONT_BOLD, fontSize=16, leading=20, textColor=C_DARK, spaceAfter=10
    )
    st_h2 = ParagraphStyle(
        "H2", fontName=_FONT_BOLD, fontSize=13, leading=17, textColor=C_PRIMARY, spaceBefore=8, spaceAfter=4
    )
    st_body = ParagraphStyle(
        "Body",
        fontName=_FONT,
        fontSize=11,
        leading=15.5,
        textColor=C_DARK,
        alignment=TA_JUSTIFY,
        firstLineIndent=30,
        spaceAfter=6,
    )
    st_bullet = ParagraphStyle(
        "Bullet",
        fontName=_FONT,
        fontSize=11,
        leading=15.5,
        textColor=C_DARK,
        leftIndent=14,
        bulletIndent=0,
        spaceAfter=3,
    )
    st_toc = ParagraphStyle(
        "Toc", fontName=_FONT, fontSize=12, leading=18, textColor=C_DARK
    )
    st_caption = ParagraphStyle(
        "Caption",
        fontName=_FONT_ITALIC,
        fontSize=9,
        leading=12,
        textColor=C_PLACEHOLDER_TEXT,
        alignment=TA_CENTER,
        spaceBefore=4,
        spaceAfter=8,
    )

    story = []

    # ── Sampul ──
    progress(6, "Menyusun halaman sampul...")
    story.append(Spacer(1, 150))
    story.append(Paragraph("EUREKA.AI", st_title))
    story.append(Spacer(1, 14))
    story.append(Paragraph(title, st_main))
    story.append(Spacer(1, 34))
    story.append(Paragraph("RANGKUMAN MATERI &amp; BAB", st_sub))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            f"Disusun otomatis oleh AI • {date_str or 'tanpa tanggal'}",
            st_date,
        )
    )
    if subject:
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Subjek: {subject}", st_date))
    story.append(PageBreak())

    # ── Kata Pengantar ──
    progress(16, "Menulis kata pengantar...")
    story.append(Paragraph("KATA PENGANTAR", st_h1))
    story.append(Paragraph(_clean(summary), st_body))
    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            "Dokumen ini merupakan rangkuman otomatis yang dihasilkan Eureka.AI "
            "dari materi sumber. Harap tetap memeriksa isi sesuai materi asli.",
            ParagraphStyle(
                "Disclaimer",
                fontName=_FONT_ITALIC,
                fontSize=10,
                leading=14,
                textColor=C_DARK,
            ),
        )
    )
    story.append(PageBreak())

    # ── Daftar Isi ──
    progress(24, "Menyusun daftar isi...")
    story.append(Paragraph("DAFTAR ISI", st_h1))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Kata Pengantar", st_toc))
    for i, c in enumerate(chapters):
        story.append(Paragraph(f"BAB {i + 1}. {c['title']}", st_toc))
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "Halaman BAB mengikuti daftar di atas.",
            ParagraphStyle("TocNote", fontName=_FONT_ITALIC, fontSize=10, leading=14, textColor=C_DARK),
        )
    )
    story.append(PageBreak())

    # ── BAB ──
    total = max(1, len(chapters))
    for i, c in enumerate(chapters):
        pct = 30 + int(((i + 1) / total) * 52)
        progress(pct, f"Menulis BAB {i + 1}: {c['title']}")
        story.append(Paragraph(f"BAB {i + 1}", st_title))
        story.append(Spacer(1, 4))
        story.append(Paragraph(c["title"], st_h1))
        story.append(Spacer(1, 8))

        # Gambar untuk bab ini (bila ada) — unduh + embed realtime.
        im = img_by_chapter.get(i)
        if im:
            progress(pct, f"Mengunduh gambar untuk BAB {i + 1}...")
            flow, caption = make_image_flowable(im["url"], im.get("alt", "Ilustrasi"))
            story.append(Spacer(1, 4))
            story.append(flow)
            if caption:
                story.append(Paragraph(caption, st_caption))
            else:
                story.append(Spacer(1, 6))
            progress(pct, f"Gambar BAB {i + 1} disisipkan.")

        paragraphs = markdown_to_paragraphs(c.get("content") or "")
        if not paragraphs:
            story.append(Paragraph("(Bab ini kosong.)", st_body))
            continue
        for kind, text in paragraphs:
            if kind == "heading":
                story.append(Paragraph(text, st_h2))
            elif kind == "bullet":
                story.append(Paragraph(f"• {text}", st_bullet))
            else:
                story.append(Paragraph(text, st_body))
        story.append(PageBreak())

    # ── Penutup ──
    progress(88, "Menulis halaman penutup...")
    story.append(Paragraph("PENUTUP", st_main))
    story.append(Spacer(1, 20))
    story.append(
        Paragraph(
            f'Rangkuman "{title}" telah disajikan dalam {len(chapters)} bab. '
            "Gunakan dokumen ini sebagai bahan belajar dan tetap kembalikan ke "
            "materi sumber untuk pendalaman.",
            st_body,
        )
    )

    progress(94, "Merender PDF...")
    doc.build(story)
    progress(99, "Memfinalisasi dokumen...")
    return buf.getvalue()


def main() -> int:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
    except Exception as e:
        sys.stderr.write(f"ERROR|Gagal membaca input JSON: {e}\n")
        return 1

    try:
        pdf = build_pdf(data)
    except Exception as e:
        sys.stderr.write(f"ERROR|Gagal membuat PDF: {e}\n")
        return 2

    encoded = base64.b64encode(pdf).decode("ascii")
    sys.stdout.write(f"DONE|{encoded}\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
