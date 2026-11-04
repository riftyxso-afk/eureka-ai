import { extractTextFromFile, extractYoutubeId, scrapeYoutubeTranscript } from "@/lib/rag/extract";
import { scrapeWebUrl } from "@/lib/firecrawl";

export async function readCourseSources(form: FormData) {
  const links = [...new Set(form.getAll("link").map(value => String(value).trim()))].filter(Boolean);
  const documents = form.getAll("document");
  if (links.length + documents.length > 5) throw new Error("Sumber kursus personal maksimal lima.");
  const urls = links.map(link => {
    const url = URL.parse(link);
    if (!url || !["https:", "http:"].includes(url.protocol) || url.username || url.password ||
        !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname) ||
        !/[a-z]/i.test(url.hostname.split(".").at(-1) ?? "") ||
        /\.(?:localhost|local|internal|test|invalid|lan)$/i.test(url.hostname)) {
      throw new Error("Sumber kursus personal harus berupa tautan web publik.");
    }
    return url;
  });
  const files = documents.map(value => {
    if (typeof value === "string" || !value.size || value.size > 4_000_000 || !/\.(pdf|docx|pptx|txt)$/i.test(value.name)) {
      throw new Error("Dokumen kursus personal harus PDF, DOCX, PPTX, atau TXT dan maksimal 4 MB per file.");
    }
    return value;
  });
  const read = async (label: string, fetchSource: () => Promise<{ title: string; text: string }>) => {
    try {
      const result = await fetchSource();
      if (!result.text.trim()) throw new Error();
      return { title: result.title.slice(0, 160), text: result.text.slice(0, 6500) };
    } catch {
      throw new Error(`Sumber kursus personal belum bisa dibaca: ${label}. Periksa akses atau ganti sumber.`);
    }
  };
  return Promise.all([
    ...urls.map(url => read(url.hostname, () => extractYoutubeId(url.href) && /(^|\.)(youtube\.com|youtu\.be)$/i.test(url.hostname)
      ? scrapeYoutubeTranscript(url.href) : scrapeWebUrl(url.href))),
    ...files.map(file => read(file.name, async () => extractTextFromFile(
      Buffer.from(await file.arrayBuffer()),
      file.name.replace(/[^a-z0-9._-]/gi, "_").slice(-100),
    ))),
  ]);
}
