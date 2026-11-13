import { createStudyPdf } from "./study-pdf";
import { createStudyDocx } from "./study-docx";
import { saveStudyFile, type StudyFile } from "./study-files";
import type { StudySource } from "./study-sources-types";

export async function createStudyDocuments(input: {
  userId: string; sessionId: string; prompt: string; title: string; text: string;
  sources: StudySource[]; signal: AbortSignal; emit: (label: string) => void;
}): Promise<{ files: StudyFile[]; errors: string[] }> {
  const formats = /\b(docx|word)\b/i.test(input.prompt) ? /\bpdf\b/i.test(input.prompt) ? ["pdf", "docx"] : ["docx"] : ["pdf"];
  const files: StudyFile[] = [], errors: string[] = [];
  for (const format of formats) {
    input.signal.throwIfAborted();
    input.emit(`Menata halaman ${format.toUpperCase()}…`);
    try {
      const bytes = format === "pdf" ? await createStudyPdf(input.title, input.text, input.sources) : Buffer.from(createStudyDocx(input.title, input.text, input.sources));
      input.signal.throwIfAborted();
      const name = (input.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 90).trim() || "Dokumen Eureka") + "." + format;
      input.emit(`Mengirim ${format.toUpperCase()} ke percakapan…`);
      files.push(await saveStudyFile(input.userId, input.sessionId, name, format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes));
    } catch (error) {
      if (input.signal.aborted) throw error;
      errors.push(`${format.toUpperCase()} belum berhasil dibuat atau disimpan. Isi dokumen tetap tersedia di chat; coba minta ekspor ulang.`);
    }
  }
  return { files, errors };
}
