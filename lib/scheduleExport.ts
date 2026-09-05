/**
 * Builder PDF Jadwal Belajar aesthetic (pdfkit) — hasil ekspor dari halaman
 * Jadwal (fitur schedule-export). Potret A4, tema clay Eureka:
 * header ungu, grid mingguan dengan blok kelas berwarna per mapel,
 * dan daftar tugas + tenggat di bawahnya.
 *
 * Dipakai oleh: /api/schedule/export (POST — data jadwal dari klien karena
 * jadwal mingguan tersimpan di localStorage user).
 */

import PDFDocument from "pdfkit";

import { SUBJECT_ACCENTS, accentIndexFor } from "./palette";

export interface ScheduleExportEntry {
  day: string; // "Senin"…
  start: string; // "07:30"
  end: string; // "09:00"
  subject: string;
  room?: string;
  color?: string;
}

export interface ScheduleExportTask {
  title: string;
  subject?: string;
  dueDate?: string; // YYYY-MM-DD
  done?: boolean;
}

export interface ScheduleExportInput {
  userName?: string;
  entries: ScheduleExportEntry[];
  tasks: ScheduleExportTask[];
}

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;
const DAY_ABBR: Record<string, string> = {
  Senin: "Sen", Selasa: "Sel", Rabu: "Rab", Kamis: "Kam",
  Jumat: "Jum", Sabtu: "Sab", Minggu: "Min",
};

const C = {
  bg: "#FAF6EF",
  card: "#FFFDF8",
  primary: "#8B5CF6",
  primaryDark: "#6D4FD6",
  amber: "#F59E0B",
  success: "#10B981",
  dark: "#2D2A24",
  muted: "#8A7F70",
  border: "#EADFCB",
  cream: "#F3EBDD",
};

function colorForEntry(e: ScheduleExportEntry): string {
  if (e.color && /^#[0-9a-fA-F]{6}$/.test(e.color)) return e.color;
  return SUBJECT_ACCENTS[accentIndexFor(e.subject)].light;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function fmtDateLong(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export async function buildSchedulePdfBuffer(input: ScheduleExportInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks)))
  );

  const W = doc.page.width;
  const H = doc.page.height;
  const M = 40; // margin sisi

  // ── Latar belakang kertas ────────────────────────────────────────────
  doc.rect(0, 0, W, H).fill(C.bg);

  // ── Header card ──────────────────────────────────────────────────────
  const headerY = 36;
  doc.save();
  doc.roundedRect(M, headerY, W - 2 * M, 92, 18).fill(C.primary);
  // aksen gelombang sederhana di kanan
  doc.roundedRect(M, headerY + 6, W - 2 * M, 80, 16).fill(C.primaryDark).opacity(0.25);
  doc.opacity(1);
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#FFFFFF");
  doc.text("Jadwal Belajarku", M + 24, headerY + 22, { width: W - 2 * M - 48 });
  doc.font("Helvetica").fontSize(11).fillColor("#EDE4FF");
  const nama = (input.userName || "Pelajar Eureka").slice(0, 40);
  const dibuat = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
  doc.text(`${nama} · dibuat ${dibuat}`, M + 24, headerY + 58, { width: W - 2 * M - 48 });
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").opacity(0.85);
  doc.text("Eureka.AI", W - M - 24, headerY + 22, { width: 120, align: "right" });
  doc.restore();

  let y = headerY + 112;

  // ── Grid mingguan ────────────────────────────────────────────────────
  const entries = input.entries.filter((e) => DAYS.includes(e.day as any));
  doc.font("Helvetica-Bold").fontSize(13).fillColor(C.dark);
  doc.text("Jadwal Mingguan", M, y);
  y += 20;

  const gap = 6;
  const gridW = W - 2 * M;
  const colW = (gridW - gap * 6) / 7;
  const colTop = y;

  for (let i = 0; i < 7; i++) {
    const x = M + i * (colW + gap);
    const dayName = DAYS[i];

    // Header kolom
    doc.roundedRect(x, colTop, colW, 20, 6).fill(C.cream);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.dark);
    doc.text(DAY_ABBR[dayName], x, colTop + 6, { width: colW, align: "center" });

    // Isi kolom
    const colBottom = colTop + 300;
    doc.roundedRect(x, colTop + 24, colW, colBottom - colTop - 24, 8).fill(C.card);
    doc.save();
    doc.roundedRect(x, colTop + 24, colW, colBottom - colTop - 24, 8).stroke(C.border);
    doc.restore();

    const dayEntries = entries
      .filter((e) => e.day === dayName)
      .sort((a, b) => a.start.localeCompare(b.start));

    let by = colTop + 30;
    const blockH = 36;
    const maxBlocks = Math.floor((colBottom - by - 18) / (blockH + 4));
    const shown = dayEntries.slice(0, maxBlocks);
    for (const e of shown) {
      const col = colorForEntry(e);
      const [r, g, b] = hexToRgb(col);
      doc.roundedRect(x + 3, by, colW - 6, blockH, 5).fill(col);
      // teks blok: jam, mapel, ruang — putih agar kontras di atas warna blok
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#FFFFFF").opacity(0.92);
      doc.text(`${e.start}–${e.end}`, x + 6, by + 4, { width: colW - 12 });
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF").opacity(1);
      doc.text(e.subject.slice(0, 22), x + 6, by + 13, { width: colW - 12, ellipsis: true });
      if (e.room) {
        doc.font("Helvetica").fontSize(6).fillColor("#FFFFFF").opacity(0.85);
        doc.text(e.room.slice(0, 18), x + 6, by + 26, { width: colW - 12 });
      }
      void r; void g; void b;
      by += blockH + 4;
    }
    if (dayEntries.length > shown.length) {
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(C.muted);
      doc.text(`+${dayEntries.length - shown.length} lagi`, x + 6, by, { width: colW - 12 });
    }
    if (dayEntries.length === 0) {
      doc.font("Helvetica").fontSize(6.5).fillColor(C.border);
      doc.text("libur", x, colTop + 36, { width: colW, align: "center" });
    }
  }
  y = colTop + 300 + 24;

  // ── Daftar tugas & tenggat ───────────────────────────────────────────
  const tasks = input.tasks ?? [];
  if (tasks.length > 0) {
    y += 8;
    doc.font("Helvetica-Bold").fontSize(13).fillColor(C.dark);
    doc.text("Tugas & Tenggat", M, y);
    y += 20;

    const maxRows = Math.min(tasks.length, 9);
    const rowH = 26;
    const boxH = maxRows * rowH + 16;
    const boxBottomLimit = H - 70;
    const boxHClamped = Math.min(boxH, boxBottomLimit - y);
    doc.roundedRect(M, y, gridW, boxHClamped, 10).fill(C.card);
    doc.roundedRect(M, y, gridW, boxHClamped, 10).stroke(C.border);

    let ry = y + 8;
    for (let i = 0; i < maxRows && ry + rowH < y + boxHClamped - 4; i++) {
      const t = tasks[i];
      const dotCol = t.done ? C.success : C.amber;
      doc.circle(M + 18, ry + rowH / 2, 3.5).fill(dotCol);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.dark);
      doc.text(
        t.title.slice(0, 70),
        M + 30,
        ry + 4,
        { width: gridW - 190, ellipsis: true, lineBreak: false }
      );
      if (t.subject) {
        doc.font("Helvetica").fontSize(7.5).fillColor(C.muted);
        doc.text(t.subject.slice(0, 24), M + 30, ry + 14, { width: 150, lineBreak: false });
      }
      // tanggal tenggat rata kanan
      if (t.dueDate) {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.primaryDark);
        doc.text(fmtDateLong(t.dueDate), M + gridW - 150, ry + 8, {
          width: 130, align: "right", lineBreak: false,
        });
      }
      ry += rowH;
    }
    if (tasks.length > maxRows) {
      doc.font("Helvetica").fontSize(8).fillColor(C.muted);
      doc.text(`…dan ${tasks.length - maxRows} tugas lainnya`, M + 18, ry + 6, { width: gridW - 36 });
    }
    y = Math.min(y + boxHClamped, boxBottomLimit) + 20;
  }

  // ── Footer ───────────────────────────────────────────────────────────
  doc.font("Helvetica").fontSize(8).fillColor(C.muted);
  doc.text(
    "Dibuat dengan Eureka.AI — AI Tutor Socratic untuk pelajar Indonesia · eureka-ai.web.id",
    M,
    H - 34,
    { width: gridW, align: "center" }
  );

  doc.end();
  return done;
}
