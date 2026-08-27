/**
 * Ekstraksi teks dari berbagai sumber materi.
 * - YouTube: scraping subtitle via youtube-transcript
 * - Dokumen: officeparser (pdf, docx, pptx, xlsx, odt, md, html, csv, ...) + txt manual
 * - Audio/Video: transkripsi Whisper via API OpenAI-compatible (butuh API key)
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

import { getAiApiConfig, isOpenAICompatible } from "@/lib/ai";

export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchYoutubeTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.title === "string" ? data.title : null;
  } catch {
    return null;
  }
}

/** Download audio YouTube sebagai Buffer untuk Whisper fallback (pakai @distube/ytdl-core, fallback ke ytdl-core). */
async function downloadYoutubeAudio(videoId: string): Promise<Buffer> {
  let ytdl: any;
  try {
    ytdl = (await import("@distube/ytdl-core")).default;
  } catch {
    ytdl = (await import("ytdl-core")).default;
  }
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  if (!ytdl.validateURL(url)) throw new Error("Link YouTube tidak valid untuk download audio.");
  const info = await ytdl.getInfo(videoId);
  const format = ytdl.chooseFormat(info.formats, { filter: "audioonly", quality: "highestaudio" });
  if (!format) throw new Error("Tidak ada format audio untuk video ini.");
  const stream = ytdl.downloadFromInfo(info, { filter: "audioonly", quality: "highestaudio" });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Download audio timeout (30s)")), 30000);
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      clearTimeout(timeout);
      resolve();
    });
    stream.on("error", (e: Error) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
  return Buffer.concat(chunks);
}

export interface TranscriptSegment {
  text: string;
  offsetMs: number;
  /** Durasi segmen dalam ms (dari library youtube-transcript; 0 bila tidak tersedia). */
  durationMs?: number;
}

export interface ExtractedContent {
  text: string;
  title: string;
  sourceUrl?: string;
  segments?: TranscriptSegment[];
}

/**
 * Marker suara/efek dari subtitle otomatis YouTube (mis. [Musik], [Applause],
 * [Tepuk tangan], [Penonton tertawa]) — tidak berguna untuk materi belajar.
 */
const YT_SOUND_CUE_RE =
  /[\[\(【〔][^\]\)】〕]*(?:musik|music|applause|tepuk tangan|bertepuk|tertawa|laugh|laughter|cheer|penonton|suara|noise|jingle|bel)[^\]\)】〕]*[\]\)】〕]/gi;

/** Buang marker suara lalu rapikan spasi ganda. */
function cleanTranscriptText(raw: string): string {
  return raw.replace(YT_SOUND_CUE_RE, " ").replace(/\s+/g, " ").trim();
}

export async function scrapeYoutubeTranscript(url: string): Promise<ExtractedContent> {
  const videoId = extractYoutubeId(url);
  if (!videoId) throw new Error("Link YouTube tidak valid. Contoh: https://youtu.be/XXXX");

  const { YoutubeTranscript } = await import("youtube-transcript");

  let transcript: Awaited<ReturnType<typeof YoutubeTranscript.fetchTranscript>> | null = null;
  let lastErr: unknown = null;
  // Coba beberapa bahasa — di HP kadang muncul auto-caption "id" tapi di scraper butuh fallback "en"/default
  const langs: (string | undefined)[] = ["id", "en", "en-US", undefined];
  for (const lang of langs) {
    try {
      transcript = lang
        ? await YoutubeTranscript.fetchTranscript(videoId, { lang })
        : await YoutubeTranscript.fetchTranscript(videoId);
      if (transcript && transcript.length > 0) break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!transcript || transcript.length === 0) {
    // Fallback: tidak ada subtitle → coba transkripsi audio via Whisper (download audio YouTube)
    if (isOpenAICompatible()) {
      try {
        console.info(`[extract] No transcript for ${videoId}, fallback to Whisper audio...`);
        const audioBuffer = await downloadYoutubeAudio(videoId);
        // Batasi 25MB (limit Whisper)
        if (audioBuffer.length > 25 * 1024 * 1024) {
          throw new Error("Audio video terlalu besar untuk ditranskripsi (>25MB). Coba video lebih pendek.");
        }
        const transcribed = await transcribeAudioVideo(audioBuffer, `${videoId}.mp3`);
        const title = (await fetchYoutubeTitle(videoId)) ?? `Video YouTube (${videoId})`;
        return { text: transcribed.text, title, sourceUrl: `https://www.youtube.com/watch?v=${videoId}` };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[extract] Whisper fallback gagal untuk ${videoId}:`, msg);
        // Jatuh ke error asli di bawah
      }
    }
    throw new Error(
      "Video ini tidak memiliki subtitle yang bisa diambil. Coba video lain, atau pakai sumber Dokumen/Web. Di HP kadang auto-caption muncul tapi di PC/scraper tidak terbaca — itu normal untuk Shorts/video tanpa CC manual."
    );
  }

  const cleaned = transcript
    .map((t) => ({
      text: cleanTranscriptText(t.text),
      offsetMs: t.offset ?? 0,
      durationMs: t.duration ?? 0,
    }))
    .filter((s) => s.text.length > 0);

  const text = cleaned.map((s) => s.text).join(" ").trim();
  if (!text) throw new Error("Subtitle video kosong — tidak ada teks untuk diproses.");

  const title = (await fetchYoutubeTitle(videoId)) ?? `Video YouTube (${videoId})`;

  return { text, title, sourceUrl: `https://www.youtube.com/watch?v=${videoId}`, segments: cleaned };
}

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<ExtractedContent> {
  const title = filename.replace(/\.[^.]+$/, "");

  // Plain text: baca langsung tanpa library
  if (/\.txt$/i.test(filename)) {
    const text = buffer.toString("utf-8").trim();
    if (!text) throw new Error("File teks kosong.");
    return { text, title };
  }

  const { OfficeParser } = await import("officeparser");
  const tmpPath = path.join(os.tmpdir(), `eureka-${randomUUID()}-${filename}`);
  await fs.writeFile(tmpPath, buffer);

  try {
    const result = await OfficeParser.parseOffice(tmpPath);
    const text =
      (typeof result?.toText === "function" ? result.toText() : String(result ?? ""))
        .trim();
    if (!text) {
      throw new Error(
        "Tidak ada teks yang bisa diekstrak dari dokumen ini. Format file mungkin tidak didukung."
      );
    }
    return { text, title };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

export async function transcribeAudioVideo(
  buffer: Buffer,
  filename: string
): Promise<ExtractedContent> {
  if (!isOpenAICompatible()) {
    throw new Error(
      "Transkripsi audio/video butuh API key AI di .env.local (mis. OPENAGENTIC_API_KEY untuk OpenAgentic). Isi key-nya, atau gunakan Dokumen/YouTube dulu."
    );
  }

  const cfg = getAiApiConfig();
  if (!cfg) {
    throw new Error("Tidak ada konfigurasi AI untuk transkripsi.");
  }

  const { OpenAI, toFile } = await import("openai");
  const client = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });

  const file = await toFile(buffer, filename);
  const res = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "text",
  });

  const text = res.trim();
  if (!text) throw new Error("Transkripsi audio kosong.");

  return { text, title: filename.replace(/\.[^.]+$/, "") };
}
