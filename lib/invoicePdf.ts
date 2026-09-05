/**
 * Builder PDF Invoice pembelian (pdfkit) — rapi untuk cetak/print.
 *
 * Dipakai oleh:
 *  - /api/payments/invoice?orderId=xxx  (unduh langsung)
 *  - Tombol "Cetak Invoice" di Riwayat Pembelian (/pricing)
 */

import PDFDocument from "pdfkit";

export interface InvoicePdfInput {
  orderId: string;
  amount: number;
  tier: string;
  status: string;
  paidAt?: string | null;
  createdAt?: string | null;
  userEmail?: string | null;
  userName?: string | null;
}

function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso ?? "-";
  }
}

function formatTier(tier: string): string {
  const m: Record<string, string> = {
    normal: "Pro Bulanan",
    trial: "Trial 7 Hari",
    promo: "Promo",
  };
  return m[tier] ?? tier;
}

export async function buildInvoicePdfBuffer(input: InvoicePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width;
  const H = doc.page.height;
  const M = 48;

  // --- Header background ---
  doc.rect(0, 0, W, 90).fill("#4C1D95");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text("EUREKA.AI", M, 22);
  doc.font("Helvetica").fontSize(9).fillColor("#E9D5FF").text("AI Tutor Socratic untuk Pelajar Indonesia", M, 44);
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#FFFFFF").text("INVOICE", W - M - 80, 28, { width: 80, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor("#E9D5FF").text(input.orderId, W - M - 180, 42, { width: 180, align: "right" });

  // Reset y
  doc.y = 105;
  doc.fillColor("#292524");

  // Judul
  doc.font("Helvetica-Bold").fontSize(20).text("INVOICE PEMBELIAN", { align: "left" });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9).fillColor("#8A8578").text(`Dicetak: ${formatDate(new Date().toISOString())}`, { align: "left" });
  doc.moveDown(0.8);

  // Dua kolom: Dari & Untuk
  const colW = (W - M * 2 - 24) / 2;
  const y0 = doc.y;
  // Dari
  doc.fillColor("#292524").font("Helvetica-Bold").fontSize(9).text("DARI", M, y0);
  doc.font("Helvetica").fontSize(10).text("Eureka.AI", M, y0 + 14);
  doc.font("Helvetica").fontSize(9).fillColor("#57534E").text("www.eureka-ai.web.id", M, y0 + 28);
  doc.text("support@eureka-ai.web.id", M, y0 + 40);
  // Untuk
  const xRight = M + colW + 24;
  doc.fillColor("#292524").font("Helvetica-Bold").fontSize(9).text("UNTUK", xRight, y0);
  const custName = input.userName || "Pelanggan Eureka.AI";
  const custEmail = input.userEmail || "-";
  doc.font("Helvetica").fontSize(10).text(custName, xRight, y0 + 14);
  doc.font("Helvetica").fontSize(9).fillColor("#57534E").text(custEmail, xRight, y0 + 28);
  doc.moveDown(3.5);

  // Garis pemisah
  doc.moveTo(M, doc.y).lineTo(W - M, doc.y).strokeColor("#E7E5E4").lineWidth(1).stroke();
  doc.moveDown(0.8);

  // Detail invoice — kotak
  const boxY = doc.y;
  const boxH = 92;
  doc.roundedRect(M, boxY, W - M * 2, boxH, 10).fill("#FFF7ED").strokeColor("#FDE68A").lineWidth(1).stroke();
  // Isi kotak
  const pad = 14;
  const innerW = W - M * 2 - pad * 2;
  doc.fillColor("#92400E").font("Helvetica-Bold").fontSize(8).text("DETAIL PEMBAYARAN", M + pad, boxY + 10);
  const leftX = M + pad;
  const rightX = M + pad + innerW / 2 + 10;
  const rowGap = 14;
  let ry = boxY + 24;
  doc.fillColor("#44403C").font("Helvetica").fontSize(8).text("Nomor Invoice", leftX, ry);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#1C1917").text(input.orderId, rightX, ry);
  ry += rowGap;
  doc.font("Helvetica").fontSize(8).fillColor("#44403C").text("Tanggal Bayar", leftX, ry);
  doc.font("Helvetica").fontSize(9).fillColor("#1C1917").text(formatDate(input.paidAt ?? input.createdAt), rightX, ry);
  ry += rowGap;
  doc.font("Helvetica").fontSize(8).fillColor("#44403C").text("Paket", leftX, ry);
  doc.font("Helvetica").fontSize(9).fillColor("#1C1917").text(formatTier(input.tier), rightX, ry);
  ry += rowGap;
  doc.font("Helvetica").fontSize(8).fillColor("#44403C").text("Status", leftX, ry);
  const statusLabel = input.status === "paid" ? "LUNAS" : input.status.toUpperCase();
  const statusColor = input.status === "paid" ? "#16A34A" : "#78716C";
  doc.fillColor(statusColor).font("Helvetica-Bold").fontSize(9).text(statusLabel, rightX, ry);
  doc.y = boxY + boxH + 16;

  // Tabel rincian
  doc.fillColor("#292524").font("Helvetica-Bold").fontSize(10).text("RINCIAN", M, doc.y);
  doc.moveDown(0.4);
  const tableTop = doc.y;
  const col1 = M;
  const col2 = M + 280;
  const col3 = W - M - 100;
  // Header tabel
  doc.rect(M, tableTop, W - M * 2, 22).fill("#4C1D95");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text("Deskripsi", col1 + 8, tableTop + 7);
  doc.text("Jumlah", col3, tableTop + 7, { width: 92, align: "right" });
  // Baris
  const rowY = tableTop + 22;
  doc.rect(M, rowY, W - M * 2, 28).fill("#FFFFFF").strokeColor("#E7E5E4").lineWidth(0.5).stroke();
  doc.fillColor("#1C1917").font("Helvetica").fontSize(9).text(`Langganan ${formatTier(input.tier)} — 1 bulan`, col1 + 8, rowY + 9);
  doc.font("Helvetica-Bold").fontSize(10).text(formatRupiah(input.amount), col3, rowY + 8, { width: 92, align: "right" });
  // Total
  const totalY = rowY + 36;
  doc.rect(M, totalY, W - M * 2, 28).fill("#F5F5F4");
  doc.fillColor("#292524").font("Helvetica-Bold").fontSize(10).text("TOTAL DIBAYAR", col1 + 8, totalY + 9);
  doc.fillColor("#4C1D95").font("Helvetica-Bold").fontSize(11).text(formatRupiah(input.amount), col3, totalY + 8, { width: 92, align: "right" });
  doc.y = totalY + 40;

  // Catatan kaki
  doc.moveDown(0.5);
  doc.fillColor("#78716C").font("Helvetica").fontSize(8).text(
    "Terima kasih telah berlangganan Eureka.AI Pro. Invoice ini sah sebagai bukti pembayaran. Jika ada pertanyaan, hubungi support@eureka-ai.web.id.",
    M,
    doc.y,
    { width: W - M * 2, align: "center" }
  );
  doc.moveDown(0.8);
  doc.fillColor("#A8A29E").font("Helvetica-Oblique").fontSize(7).text(
    `Invoice: ${input.orderId} • Dokumen digital Eureka.AI • ${new Date().getFullYear()}`,
    { align: "center" }
  );

  // Footer kecil
  const footY = H - 30;
  doc.fillColor("#D6D3D1").font("Helvetica").fontSize(7).text("www.eureka-ai.web.id  •  AI Tutor Socratic", M, footY, { width: W - M * 2, align: "center" });

  doc.end();
  return done;
}
