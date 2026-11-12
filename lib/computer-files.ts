import { randomUUID } from "node:crypto";
import { runStudyComputerExport } from "./study-browser";
import { saveStudyFile, type StudyFile } from "./study-files";
import { generateImageViaOpenAgentic } from "./image-gen";
import type { StudySource } from "./study-sources-types";

const mimeTypes: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain", md: "text/markdown", png: "image/png", jpg: "image/jpeg", webp: "image/webp",
};

export function requestedComputerFormats(prompt: string) {
  // This only inspects the user's current request, never instructions found on a website.
  if (!/buat|kirim|unduh|download|export|ekspor|simpan|jadikan|create|generate|send|save|format|pdf|docx|xlsx|csv|screenshot|tangkapan layar/i.test(prompt)) return [];
  const formats = [];
  if (/\bpdf\b/i.test(prompt)) formats.push("pdf");
  if (/\b(docx|word|doc)\b/i.test(prompt) || (!/\b(pdf|odt|xlsx|excel|csv)\b/i.test(prompt) && /\b(dokumen|document)\b/i.test(prompt))) formats.push("docx");
  if (/\bodt\b/i.test(prompt)) formats.push("odt");
  if (/\b(xlsx|excel|spreadsheet)\b/i.test(prompt)) formats.push("xlsx");
  if (/\bcsv\b/i.test(prompt)) formats.push("csv");
  if (/\b(txt|teks|text)\b/i.test(prompt) && /\b(file|berkas|format)\b/i.test(prompt)) formats.push("txt");
  if (/\b(markdown|md)\b/i.test(prompt)) formats.push("md");
  if (/screenshot|tangkapan layar/i.test(prompt)) formats.push("screenshot");
  else if (/infografis|diagram|poster|\bpng\b/i.test(prompt)) formats.push("png");
  else if (/\b(gambar|image|ilustrasi|foto|picture)\b/i.test(prompt)) formats.push("image");
  return [...new Set(formats)].slice(0, 3);
}

export async function createComputerFiles(input: {
  userId: string; sessionId: string; prompt: string; title: string; text: string; sources: StudySource[];
  signal: AbortSignal; emit: (label: string) => void;
}): Promise<{ files: StudyFile[]; errors: string[] }> {
  const files: StudyFile[] = [], errors: string[] = [];
  const formats = requestedComputerFormats(input.prompt);
  for (const format of formats) {
    input.signal.throwIfAborted();
    input.emit(format === "image" ? "Menghasilkan gambar…" : "Membuat " + format.toUpperCase() + " di komputer…");
    try {
      let image: { data: string; extension: string } | undefined;
      if (format === "image") {
        const data = await generateImageViaOpenAgentic(input.prompt + "\nKonteks: " + input.title + "\n" + input.text.slice(0, 1200));
        const match = data?.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) throw new Error("Pembuatan gambar belum berhasil. Coba lagi.");
        if (Buffer.byteLength(match[2], "base64") > 8 * 1024 * 1024) throw new Error("Gambar melewati batas 8 MB.");
        image = { extension: match[1] === "jpeg" ? "jpg" : match[1], data: match[2] };
      }
      const outputs = await runStudyComputerExport(input.userId, {
        job: randomUUID(), title: input.title.slice(0, 120), text: input.text.slice(0, 40000), formats: [format],
        sources: input.sources.map(source => ({ title: source.title, url: source.url })),
        imageExtension: image?.extension, imageData: image?.data,
      }, input.signal);
      for (const output of outputs) {
        const extension = output.name.split(".").at(-1)!;
        const mime = mimeTypes[extension];
        if (!mime) throw new Error("Format file belum didukung.");
        const bytes = Buffer.from(output.data, "base64");
        if (bytes.length !== output.size) throw new Error("Transfer file belum lengkap.");
        const name = (input.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 90).trim() || "Hasil Computer Use") + "." + extension;
        input.emit("Mengirim " + name + " ke chat…");
        files.push(await saveStudyFile(input.userId, input.sessionId, name, mime, bytes));
      }
    } catch (cause) {
      if (input.signal.aborted) throw cause;
      errors.push(format.toUpperCase() + " belum berhasil dibuat atau dikirim.");
    }
  }
  return { files, errors };
}
