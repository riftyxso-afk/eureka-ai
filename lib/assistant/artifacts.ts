import { ArtifactStreamParser } from "../agents/artifactParser";
import type { Artifact } from "../agents/types";
import type { AssistantChatMessage } from "./types";

export function parseArtifactMessage(content: string, streaming = false): { chat: string; artifacts: Artifact[] } {
  const parser = new ArtifactStreamParser();
  const events = parser.push(content);
  if (!streaming) events.push(...parser.flush());
  const artifacts: Artifact[] = [];
  let chat = "";
  for (const event of events) {
    if (event.kind === "chat") chat += event.text;
    if (event.kind === "artifact-open") artifacts.push({ ...event.artifact });
    if (event.kind === "artifact-chunk") {
      const item = artifacts.find((artifact) => artifact.id === event.id);
      if (item) item.content += event.text;
    }
  }
  return { chat, artifacts };
}

export function messageArtifacts(message: AssistantChatMessage): Artifact[] {
  if (message.role !== "assistant") return [];
  const parser = new ArtifactStreamParser();
  const artifacts: Artifact[] = [];
  for (const event of [...parser.push(message.content), ...parser.flush()]) {
    if (event.kind === "artifact-open") artifacts.push({ ...event.artifact });
    if (event.kind === "artifact-chunk") {
      const artifact = artifacts.find((item) => item.id === event.id);
      if (artifact) artifact.content += event.text;
    }
  }
  return artifacts.map((artifact, index) => ({
    ...artifact,
    id: `${message.id}:artifact:${index}`,
    createdAt: message.createdAt,
    version: artifactVersion(message.content, index),
  }));
}

/** Replace only the selected, complete markdown artifact; preserve surrounding chat. */
export function editMessageArtifact(raw: string, index: number, content: string): string {
  if (content.includes("</artifact>")) throw new Error("Isi tidak boleh memuat tag penutup artifact.");
  let ordinal = -1;
  let found = false;
  const next = raw.replace(/<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/g, (whole, attributes: string) => {
    const parsed = new ArtifactStreamParser();
    const open = parsed.push(whole).find((event) => event.kind === "artifact-open");
    if (!open || open.kind !== "artifact-open") return whole;
    ordinal += 1;
    if (ordinal !== index) return whole;
    if (open.artifact.type !== "markdown") throw new Error("Hanya artifact markdown yang dapat diedit.");
    found = true;
    const version = /\bversion="(\d+)"/.exec(attributes);
    const nextVersion = Number(version?.[1] ?? 1) + 1;
    const updated = attributes.replace(/\s+version="\d+"/g, "");
    return `<artifact${updated} version="${nextVersion}">${content}</artifact>`;
  });
  if (!found) throw new Error("Artifact tidak ditemukan atau belum selesai.");
  return next;
}

export function artifactVersion(raw: string, index: number): number {
  const tags = [...raw.matchAll(/<artifact\b([^>]*)>/g)].filter((match) => /\btype="(?:markdown|terminal|image)"/.test(match[1]));
  return Number(/\bversion="(\d+)"/.exec(tags[index]?.[1] ?? "")?.[1] ?? 1);
}

/** A request can commit only while both its session and generation remain current. */
export class ChatRequestScope {
  private generation = 0;
  sessionId: string | null = null;
  enter(sessionId: string | null): number {
    this.sessionId = sessionId;
    return ++this.generation;
  }
  current(sessionId: string | null, generation: number): boolean {
    return this.sessionId === sessionId && this.generation === generation;
  }
  get token(): number { return this.generation; }
}
