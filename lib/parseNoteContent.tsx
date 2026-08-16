/**
 * Mengubah teks mentah menjadi array konten terstruktur.
 * Mendeteksi: heading (#, ##, ###), bullet (•, -, *, 1.), tabel (|), quote (>),
 * LaTeX math ($...$, $$...$$), sisanya paragraf. Toleran terhadap teks subtitle polos.
 */
import { Fragment } from "react";
import katex from "katex";

export interface TableContent {
  headers: string[];
  rows: string[][];
}

export interface ImageContent {
  url: string;
  alt: string;
}

export type ParsedContent =
  | { type: "heading1"; content: string }
  | { type: "heading2"; content: string }
  | { type: "heading3"; content: string }
  | { type: "heading4"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "bullet"; content: string }
  | { type: "quote"; content: string }
  | { type: "code"; content: { language: string; code: string } }
  | { type: "image"; content: ImageContent }
  | { type: "table"; content: TableContent }
  | { type: "mindmap"; content: string };

const TABLE_SEPARATOR = /^[\s|:\-]+$/;
const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

/**
 * Bersihkan markdown artifacts yang tidak diinginkan dari output AI.
 * Baris di dalam code fence (```lang … ```) TIDAK disentuh agar kode utuh.
 */
function cleanupMarkdown(text: string): string {
  const rawLines = text.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      out.push(rawLine);
      continue;
    }
    if (inFence) {
      // Kode di dalam fence dibiarkan mentah — jangan ubah apa pun.
      out.push(rawLine);
      continue;
    }
    let line = rawLine;
    // Hapus baris yang hanya berisi tanda * atau **
    if (/^\s*\*+\s*$/.test(line)) line = "";
    // Hapus bold dari single character atau formula symbols
    line = line
      .replace(/\*\*([a-zA-Z])\*\*/g, "$1") // **c** -> c
      .replace(/\*\*([=²³⁰¹⁴⁵⁶⁷⁸⁹]+)\*\*/g, "$1") // **²** -> ²
      .trimEnd();
    out.push(line);
  }
  const joined = out.join("\n").replace(/\n{3,}/g, "\n\n");
  return joined.trim();
}

export function parseNoteContent(rawText: string): ParsedContent[] {
  // Cleanup dulu sebelum parsing
  const cleanText = cleanupMarkdown(rawText);
  const lines = cleanText.split("\n");
  const result: ParsedContent[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#### ")) {
      result.push({ type: "heading4", content: line.replace(/^####\s+/, "") });
      continue;
    }
    if (line.startsWith("### ")) {
      result.push({ type: "heading3", content: line.replace(/^###\s+/, "") });
      continue;
    }
    if (line.startsWith("## ")) {
      result.push({ type: "heading2", content: line.replace(/^##\s+/, "") });
      continue;
    }
    if (line.startsWith("# ")) {
      result.push({ type: "heading1", content: line.replace(/^#\s+/, "") });
      continue;
    }

    const imageMatch = line.match(IMAGE_LINE_RE);
    if (imageMatch) {
      result.push({
        type: "image",
        content: { url: imageMatch[2], alt: imageMatch[1].trim() },
      });
      continue;
    }

    // Deteksi code block mindmap (```mermaid atau ```mindmap)
    if (line.startsWith("```mermaid") || line.startsWith("```mindmap")) {
      const mindmapLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith("```")) {
        mindmapLines.push(lines[j]);
        j++;
      }
      i = j; // Skip closing ```
      
      const mindmapContent = mindmapLines.join("\n").trim();
      if (mindmapContent) {
        result.push({ type: "mindmap", content: mindmapContent });
        continue;
      }
    }

    // Code fence generik ```lang … ``` (selain mermaid/mindmap di atas)
    if (line.startsWith("```") && !line.startsWith("```mermaid") && !line.startsWith("```mindmap")) {
      const lang = line.slice(3).trim().split(/\s+/)[0] ?? "";
      const codeLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith("```")) {
        codeLines.push(lines[j]);
        j++;
      }
      i = j; // Lewati baris penutup ```
      if (codeLines.length > 0) {
        result.push({
          type: "code",
          content: {
            language: lang,
            code: codeLines.join("\n").replace(/\n+$/, ""),
          },
        });
      }
      continue;
    }

    if (/^[•\-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      result.push({ type: "bullet", content: line.replace(/^[•\-*\d.)]+\s+/, "") });
      continue;
    }

    if (line.includes("|") && line.split("|").filter(Boolean).length >= 2) {
      const tableLines: string[] = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].includes("|")) {
        tableLines.push(lines[j].trim());
        j++;
      }
      i = j - 1;

      const headers = tableLines[0]
        .split("|")
        .map((h) => h.trim())
        .filter(Boolean);
      const body = tableLines
        .slice(1)
        .filter((r) => !TABLE_SEPARATOR.test(r));
      const rows = body.map((row) =>
        row
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
      );

      if (headers.length > 0) {
        result.push({ type: "table", content: { headers, rows } });
        continue;
      }
    }

    if (line.startsWith(">") || line.startsWith('"')) {
      result.push({ type: "quote", content: line.replace(/^[>"]\s*/, "") });
      continue;
    }

    result.push({ type: "paragraph", content: line });
  }

  return result;
}

/** Render teks inline: **teks** → <mark> highlight, *teks* → <em>. */
export function renderInlineText(
  text: string,
  highlights: { text: string; color: string }[] = []
) {
  const segments =
    highlights.length > 0
      ? splitHighlightMatches(text, highlights)
      : [{ text, color: undefined as string | undefined }];
  return segments.map((seg, i) => {
    if (seg.color) {
      return (
        <span key={i} className={`hl-${seg.color}`}>
          {seg.text}
        </span>
      );
    }
    return <Fragment key={i}>{renderMarkup(seg.text)}</Fragment>;
  });
}

function renderMarkup(text: string) {
  // Pisahkan LaTeX math ($...$) dan block math ($$...$$) dulu
  const parts = text.split(
    /(\$\$[^$]+\$\$|\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*|\^\[\d+\])/g
  );
  return parts.map((part, i) => {
    // Block math: $$...$$
    if (/^\$\$[^$]+\$\$$/.test(part)) {
      const math = part.slice(2, -2);
      try {
        const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
        return (
          <span
            key={i}
            className="block my-4 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return <span key={i} className="text-red-600">{part}</span>;
      }
    }
    // Inline math: $...$
    if (/^\$[^$]+\$$/.test(part)) {
      const math = part.slice(1, -1);
      try {
        const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
        return (
          <span
            key={i}
            className="inline-block mx-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return <span key={i} className="text-red-600">{part}</span>;
      }
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/.test(part)) {
      return (
        <em key={i} className="font-semibold text-clay-dark">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (/^\^\[\d+\]$/.test(part)) {
      return (
        <sup
          key={i}
          className="ml-0.5 text-[10px] font-extrabold leading-none text-clay-primary"
        >
          {part.slice(1, -1)}
        </sup>
      );
    }
    return part;
  });
}

/**
 * Pecah teks menjadi segmen; bagian yang cocok dengan highlight tersimpan
 * ditandai warna (paling panjang dicocokkan lebih dulu, case-insensitive).
 */
export function splitHighlightMatches(
  text: string,
  highlights: { text: string; color: string }[]
): { text: string; color?: string }[] {
  const sorted = [...highlights]
    .map((h) => ({ ...h, needle: h.text.trim() }))
    .filter((h) => h.needle.length > 0)
    .sort((a, b) => b.needle.length - a.needle.length);

  let rest = text;
  const segments: { text: string; color?: string }[] = [];

  for (const h of sorted) {
    const lowerRest = rest.toLowerCase();
    const lowerNeedle = h.needle.toLowerCase();
    const matchIdx = lowerRest.indexOf(lowerNeedle);
    if (matchIdx < 0) continue;
    if (matchIdx > 0) {
      segments.push({ text: rest.slice(0, matchIdx) });
    }
    segments.push({
      text: rest.slice(matchIdx, matchIdx + h.needle.length),
      color: h.color,
    });
    rest = rest.slice(matchIdx + h.needle.length);
  }

  if (rest.length > 0) segments.push({ text: rest });
  return segments.length > 0 ? segments : [{ text }];
}
