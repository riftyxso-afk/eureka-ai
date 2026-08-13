/**
 * Builder PDF rangkuman catatan (pdfkit) — struktur skripsi/laporan resmi.
 *
 * Dipakai oleh:
 *  - /api/notes/[id]/pdf   (unduh langsung, mesin pdfkit Node)
 *  - /api/notes/[id]/pdf/stream (fallback bila Python/reportlab tidak ada)
 *
 * Mendukung gambar opsional (field `images`): setiap gambar diunduh dengan
 * timeout + validasi content-type image/*. Bila gagal, digambar placeholder
 * bergaya — PDF selalu valid, gambar tidak pernah membuat error.
 */
import PDFDocument from "pdfkit";

/** Ubah markdown kasar menjadi paragraf teks yang rapi untuk PDF. */
export function markdownToParagraphs(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer
      .join(" ")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // ![alt](url) → alt
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
      .replace(/[*_~`#]+/g, "") // hapus markdown inline
      .replace(/\s{2,}/g, " ")
      .trim();
    if (text) paragraphs.push(text);
    buffer = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    // Baris tabel "| A | B |" → kalimat deskriptif.
    if (t.startsWith("|") && t.endsWith("|")) {
      const cells = t
        .split("|")
        .map((c) => c.trim().replace(/[*_~`#]+/g, ""))
        .filter(Boolean);
      if (cells.length >= 2 && !cells.every((c) => /^[-:]+$/.test(c))) {
        buffer.push(`${cells[0]}: ${cells.slice(1).join(" — ")}.`);
      }
      continue;
    }
    // Heading "#", "##" dst → paragraf pembuka bab/bagian.
    if (/^#{1,6}\s/.test(t)) {
      flush();
      const title = t.replace(/^#{1,6}\s+/, "").replace(/[*_`~]+/g, "").trim();
      if (title) paragraphs.push(`▲ ${title}`);
      continue;
    }
    // Bullet "- " / "* " / numbered "- 1."
    const bullet = t.match(/^[-*•]\s+(.+)$/) ?? t.match(/^-?\s*\d+\.\s+(.+)$/);
    if (bullet) {
      flush();
      const item = bullet[1].replace(/[*_`~]+/g, "").trim();
      if (item) paragraphs.push(`• ${item}`);
      continue;
    }
    buffer.push(t);
  }
  flush();
  return paragraphs;
}

export function readableDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export interface PdfNoteInput {
  title?: string;
  subject?: string;
  summary?: string;
  createdAt?: string;
  chapters?: { title: string; content: string }[];
  /** Gambar opsional per bab (dipakai fallback stream route). */
  images?: { chapterIndex: number; url: string; alt?: string }[];
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 15000;

/** Unduh gambar → Buffer, validasi content-type image/* & ukuran. */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  // Data URL base64 (hasil generate AI) → dekode langsung, tanpa jaringan.
  if (url.startsWith("data:image/")) {
    try {
      const m = url.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!m) return null;
      const buf = Buffer.from(m[1], "base64");
      if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
      return buf;
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EurekaAI-PDF/1.0)",
        Accept: "image/png,image/jpeg,image/avif,image/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ctype.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

/** Sisipkan gambar ke dokumen pdfkit; placeholder bila gagal. */
async function placeChapterImage(
  doc: InstanceType<typeof PDFDocument>,
  img: { url: string; alt?: string }
): Promise<void> {
  const avail =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const buf = await fetchImageBuffer(img.url);
  const y0 = doc.y;

  if (buf) {
    try {
      const maxW = Math.min(avail, 420);
      const maxH = 260;
      // Hitung proporsi dari PNG/JPEG header sederhana (gambar 1:1 bila tak dikenal).
      let w = maxW;
      let h = maxH;
      const dims = sniffImageSize(buf);
      if (dims) {
        const scale = Math.min(maxW / dims.w, maxH / dims.h, 1);
        w = dims.w * scale;
        h = dims.h * scale;
      }
      doc.image(buf, doc.page.margins.left + (avail - w) / 2, y0, {
        width: w,
        height: h,
      });
      doc.y = y0 + h + 6;
      if (img.alt) {
        doc
          .fillColor("#8A8578")
          .font("Helvetica-Oblique")
          .fontSize(8.5)
          .text(img.alt.slice(0, 120), { align: "center", width: avail });
      }
      doc.moveDown(0.3);
      return;
    } catch {
      // gagal embed → jatuh ke placeholder
    }
  }

  // Placeholder bergaya (selalu tampil, tidak error).
  const phW = Math.min(avail, 300);
  const phH = 58;
  const phX = doc.page.margins.left + (avail - phW) / 2;
  doc.save();
  doc.roundedRect(phX, y0, phW, phH, 8).fill("#F1EAD9");
  doc.fillColor("#8A8578");
  doc.font("Helvetica-Oblique").fontSize(9);
  doc.text(
    `${img.alt || "Ilustrasi"}\n(gambar tidak tersedia)`,
    phX + 10,
    y0 + 20,
    { width: phW - 20, align: "center" }
  );
  doc.restore();
  doc.y = y0 + phH + 8;
  doc.moveDown(0.3);
}

/** Deteksi ukuran PNG/JPEG/GIF dari header (tanpa library ekstra). */
function sniffImageSize(buf: Buffer): { w: number; h: number } | null {
  try {
    if (buf.length < 24) return null;
    // PNG: 8-byte signature + IHDR
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    // JPEG: scan segment SOF0/SOF2 untuk dimensi
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
        }
        const len = buf.readUInt16BE(i + 2);
        i += 2 + len;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Bangun buffer PDF rangkuman catatan (pdfkit). */
export async function buildNotePdfBuffer(note: PdfNoteInput): Promise<Buffer> {
  const chapters = (note.chapters ?? []).filter(
    (c) => c && typeof c.title === "string" && typeof c.content === "string"
  );
  const images = (note.images ?? []).filter(
    (im) =>
      im &&
      typeof im.chapterIndex === "number" &&
      typeof im.url === "string" &&
      /^https?:\/\//i.test(im.url)
  );
  const summary = note.summary?.trim() || "Tidak ada ringkasan.";
  const title = note.title || "Rangkuman Materi";
  const dateStr = readableDate(note.createdAt ?? "");

  const doc = new PDFDocument({ size: "A4", margin: 56, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks)))
  );

  const INDENT = 30;
  const BODY_SIZE = 11;

  // --- Halaman sampul ---
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FFF9EF");
  doc.fillColor("#4C1D95");
  doc.font("Helvetica-Bold").fontSize(15).text("EUREKA.AI", { align: "center" });
  doc.moveDown(0.5);
  doc.fillColor("#292524");
  doc.font("Helvetica-Bold").fontSize(26).text(title, { align: "center", width: doc.page.width - 120 });
  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(13).text("RANGKUMAN MATERI & BAB", { align: "center" });
  doc.moveDown(0.4);
  doc.font("Helvetica-Oblique").fontSize(11).text(
    `Disusun otomatis oleh AI • ${dateStr || "tanpa tanggal"}`,
    { align: "center" }
  );
  if (note.subject) {
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11).text(`Subjek: ${note.subject}`, { align: "center" });
  }
  doc.addPage();

  // --- Kata Pengantar ---
  doc.fillColor("#292524");
  doc.font("Helvetica-Bold").fontSize(16).text("KATA PENGANTAR");
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(BODY_SIZE).text(summary, {
    align: "justify",
    indent: INDENT,
    lineGap: 4,
  });
  doc.moveDown(0.6);
  doc
    .font("Helvetica-Oblique")
    .fontSize(10)
    .text(
      "Dokumen ini merupakan rangkuman otomatis yang dihasilkan Eureka.AI dari materi sumber. Harap tetap memeriksa isi sesuai materi asli."
    );

  // --- Daftar Isi ---
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(16).text("DAFTAR ISI");
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(12).text("Kata Pengantar", { continued: true });
  doc.text("........................................................................ i", { align: "right" });
  chapters.forEach((c, i) => {
    const bab = `BAB ${i + 1}. ${c.title}`;
    doc.font("Helvetica").fontSize(12).text(bab, { continued: true });
    doc.text("........................................................................", { align: "right" });
  });
  doc.moveDown(0.4);
  doc.font("Helvetica-Oblique").fontSize(10).text("Halaman BAB mengikuti daftar di atas.");

  // --- BAB ---
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    doc.addPage();
    // Kop bab
    doc.rect(0, 0, doc.page.width, 34).fill("#4C1D95");
    doc.fillColor("#FFFFFF");
    doc.font("Helvetica-Bold").fontSize(13).text(`BAB ${i + 1}`, 56, 10);
    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(17).fillColor("#292524").text(c.title);
    doc.moveDown(0.4);

    // Gambar bab ini (bila ada)
    const img = images.find((im) => im.chapterIndex === i);
    if (img) {
      await placeChapterImage(doc, img);
      doc.moveDown(0.4);
    }

    const paragraphs = markdownToParagraphs(c.content);
    if (paragraphs.length === 0) {
      doc.font("Helvetica-Oblique").fontSize(11).text("(Bab ini kosong.)");
      continue;
    }
    for (const p of paragraphs) {
      if (p.startsWith("▲ ")) {
        doc.moveDown(0.3);
        doc.fillColor("#4C1D95");
        doc.font("Helvetica-Bold").fontSize(13).text(p.slice(2));
        doc.fillColor("#292524");
        doc.moveDown(0.2);
        continue;
      }
      if (p.startsWith("• ")) {
        const item = p.slice(2);
        // Bullet panjang: gunakan kolom indent biar rapi.
        const available = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        doc.font("Helvetica").fontSize(BODY_SIZE);
        doc.text(item, doc.page.margins.left + 14, doc.y, {
          width: available - 14,
          align: "left",
          lineGap: 3,
        });
        doc.moveDown(0.15);
        continue;
      }
      doc
        .font("Helvetica")
        .fontSize(BODY_SIZE)
        .text(p, {
          align: "justify",
          indent: INDENT,
          lineGap: 4,
        });
      doc.moveDown(0.25);
    }
  }

  // --- Penutup ---
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FFF9EF");
  doc.fillColor("#292524");
  doc.font("Helvetica-Bold").fontSize(18).text("PENUTUP", { align: "center" });
  doc.moveDown(1);
  doc
    .font("Helvetica")
    .fontSize(BODY_SIZE)
    .text(
      `Rangkuman "${title}" telah disajikan dalam ${chapters.length} bab. Gunakan dokumen ini sebagai bahan belajar dan tetap kembalikan ke materi sumber untuk pendalaman.`,
      { align: "justify", indent: INDENT, lineGap: 4 }
    );

  doc.end();
  return done;
}
