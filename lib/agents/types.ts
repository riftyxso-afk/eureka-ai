/**
 * Tipe Artifact — struktur data lintas backend & frontend (PRD §7.2).
 * Eksplisit, tanpa `any`; dipakai parser streaming, canvas, dan toolbar.
 */

export type ArtifactType = "markdown" | "terminal" | "image";

/** Agent yang menghasilkan artifact (PRD §7.2 — sourceAgent). */
export type ArtifactSourceAgent = "jejak" | "socra" | "palet";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  /** Bertambah satu tiap markdown diedit & disimpan ulang (history). */
  version: number;
  /** ISO timestamp pembuatan. */
  createdAt: string;
  sourceAgent: ArtifactSourceAgent;
}

/** Guard tipe artifact dari input eksternal (query/payload). */
export function isArtifactType(v: string): v is ArtifactType {
  return v === "markdown" || v === "terminal" || v === "image";
}

/** Guard source agent dari input eksternal. */
export function isArtifactSourceAgent(v: string): v is ArtifactSourceAgent {
  return v === "jejak" || v === "socra" || v === "palet";
}
