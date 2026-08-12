/**
 * Builder PDF rangkuman catatan (pdfkit) — struktur skripsi/laporan resmi.
 *
 * Dipakai oleh:
 *  - /api/notes/[id]/pdf   (unduh langsung, mesin pdfkit Node)
 *  - /api/notes/[id]/pdf/stream (fallback bila Python/reportlab tidak ada)
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
}

/** Bangun buffer PDF rangkuman catatan (pdfkit). */
export async function buildNotePdfBuffer(note: PdfNoteInput): Promise<Buffer> {
  const chapters = (note.chapters ?? []).filter(
    (c) => c && typeof c.title === "string" && typeof c.content === "string"
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
  chapters.forEach((c, i) => {
    doc.addPage();
    // Kop bab
    doc.rect(0, 0, doc.page.width, 34).fill("#4C1D95");
    doc.fillColor("#FFFFFF");
    doc.font("Helvetica-Bold").fontSize(13).text(`BAB ${i + 1}`, 56, 10);
    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(17).fillColor("#292524").text(c.title);
    doc.moveDown(0.4);

    const paragraphs = markdownToParagraphs(c.content);
    if (paragraphs.length === 0) {
      doc.font("Helvetica-Oblique").fontSize(11).text("(Bab ini kosong.)");
      return;
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
  });

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
