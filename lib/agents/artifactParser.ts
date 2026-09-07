/**
 * Streaming parser tag `<artifact>` — memisahkan output non-percakapan dari
 * teks chat, token-by-token (PRD §7.3).
 *
 * Kontrak:
 * - Feed teks mentah dari stream (bisa pecahan token apa pun) via push();
 *   hasil berupa potongan teks chat dan/atau event artifact.
 * - Tag BELUM LENGKAP di-buffer — tidak pernah bocor sebagian ke bubble
 *   maupun canvas.
 * - Tag tidak pernah tertutup sampai stream selesai → flush(): isi buffer
 *   dilepas sebagai teks biasa (toleran) + peringatan dicatat.
 *
 * Grammar:
 *   <artifact type="markdown|terminal|image" title="...">BODY</artifact>
 */

import {
  isArtifactSourceAgent,
  isArtifactType,
  type Artifact,
  type ArtifactSourceAgent,
  type ArtifactType,
} from "./types";

type ParserState = "idle" | "in_tag_open" | "in_artifact";

/** Event hasil parsing. */
export type ArtifactParserEvent =
  | { kind: "chat"; text: string }
  | { kind: "artifact-open"; artifact: Artifact }
  | { kind: "artifact-chunk"; id: string; text: string }
  | { kind: "artifact-close"; id: string };

const TAG_OPEN = '<artifact';
const TAG_CLOSE = '</artifact>';

/** Urutan atribut bebas; type wajib, title & agent opsional. */
function parseOpenTag(tag: string): {
  type: ArtifactType;
  title: string;
  agent: ArtifactSourceAgent;
} | null {
  // tag contoh: ` type="markdown" title="Catatan Bab 1" agent="jejak"`.
  const attrRe = /(type|title|agent)\s*=\s*"([^"]*)"/g;
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(tag)) !== null) {
    attrs[m[1]] = m[2];
  }
  const type = attrs.type ?? "";
  if (!isArtifactType(type)) return null; // tanpa type valid → bukan artifact
  return {
    type,
    title: attrs.title?.trim() || "Artifact",
    agent: attrs.agent && isArtifactSourceAgent(attrs.agent) ? attrs.agent : "socra",
  };
}

export class ArtifactStreamParser {
  private state: ParserState = "idle";
  private buffer = "";
  private current: Artifact | null = null;
  private counter = 0;

  /** Feed pecahan stream; return event yang pasti (aman untuk UI). */
  push(chunk: string): ArtifactParserEvent[] {
    this.buffer += chunk;
    return this.drain(false);
  }

  /**
   * Akhiri stream: tag menggantung dilepas sebagai teks biasa (toleran,
   * PRD §7.3) — dengan peringatan agar terpantau.
   */
  flush(): ArtifactParserEvent[] {
    const events = this.drain(true);
    if (this.buffer) {
      console.warn(
        "[artifactParser] stream berakhir dengan tag menggantung — di-flush sebagai teks biasa."
      );
      events.push({ kind: "chat", text: this.buffer });
      this.buffer = "";
    }
    if (this.current) {
      console.warn(
        "[artifactParser] artifact tidak ditutup saat stream selesai — ditutup otomatis."
      );
      const id = this.current.id;
      this.current = null;
      this.state = "idle";
      events.push({ kind: "artifact-close", id });
    }
    return events;
  }

  /** Proses buffer sebanyak mungkin. */
  private drain(final: boolean): ArtifactParserEvent[] {
    const events: ArtifactParserEvent[] = [];

    while (true) {
      if (this.state === "idle") {
        const idx = this.buffer.indexOf(TAG_OPEN);
        if (idx === -1) {
          // Belum ada tag pembuka. Tahan ekor yang mungkin adalah awal tag.
          const safe = final
            ? this.buffer
            : this.withholdPossibleTagPrefix(this.buffer, TAG_OPEN);
          if (safe) {
            events.push({ kind: "chat", text: safe });
            this.buffer = this.buffer.slice(safe.length);
          }
          break;
        }
        if (idx > 0) {
          events.push({ kind: "chat", text: this.buffer.slice(0, idx) });
          this.buffer = this.buffer.slice(idx);
        }
        // Buffer diawali '<artifact' — cek apakah tag pembuka sudah utuh.
        const gt = this.buffer.indexOf(">");
        if (gt === -1) {
          if (final) {
            // Tag tidak lengkap hingga akhir → biarkan flush() melepasnya.
            break;
          }
          break; // tunggu token berikutnya
        }
        const tagBody = this.buffer.slice(TAG_OPEN.length, gt);
        const parsed = parseOpenTag(tagBody);
        if (!parsed) {
          // Mirip tag artifact tapi type tidak valid → perlakukan sebagai
          // teks biasa (jangan pernah memakan konten user secara diam-diam).
          const consumed = this.buffer.slice(0, gt + 1);
          events.push({ kind: "chat", text: consumed });
          this.buffer = this.buffer.slice(consumed.length);
          continue;
        }
        this.counter += 1;
        this.current = {
          id: `artifact-${Date.now().toString(36)}-${this.counter}`,
          type: parsed.type,
          title: parsed.title,
          content: "",
          version: 1,
          createdAt: new Date().toISOString(),
          sourceAgent: parsed.agent,
        };
        events.push({ kind: "artifact-open", artifact: { ...this.current } });
        this.buffer = this.buffer.slice(gt + 1);
        this.state = "in_artifact";
        continue;
      }

      if (this.state === "in_artifact") {
        const closeIdx = this.buffer.indexOf(TAG_CLOSE);
        if (closeIdx === -1) {
          // Tahan ekor yang mungkin bagian dari `</artifact>`.
          const safe = final
            ? this.buffer
            : this.withholdPossibleTagPrefix(this.buffer, TAG_CLOSE);
          if (safe && this.current) {
            this.current.content += safe;
            events.push({ kind: "artifact-chunk", id: this.current.id, text: safe });
            this.buffer = this.buffer.slice(safe.length);
          }
          break;
        }
        const body = this.buffer.slice(0, closeIdx);
        if (body && this.current) {
          this.current.content += body;
          events.push({ kind: "artifact-chunk", id: this.current.id, text: body });
        }
        const id = this.current?.id ?? "";
        this.buffer = this.buffer.slice(closeIdx + TAG_CLOSE.length);
        this.current = null;
        this.state = "idle";
        events.push({ kind: "artifact-close", id });
        continue;
      }

      break;
    }

    return events;
  }

  /**
   * Lepas bagian akhir string yang MUNGKIN adalah prefix needle
   * (mis. `</artif`) — dikembalikan pada token berikutnya.
   * Overlap max = needle.length - 1.
   */
  private withholdPossibleTagPrefix(text: string, needle: string): string {
    const maxKeep = needle.length - 1;
    const start = Math.max(0, text.length - maxKeep);
    for (let i = start; i < text.length; i++) {
      const slice = text.slice(i);
      if (needle.startsWith(slice)) {
        return text.slice(0, i);
      }
    }
    return text;
  }
}
