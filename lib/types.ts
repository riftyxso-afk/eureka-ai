export type Role = "user" | "assistant" | "system";

export interface ToolCall {
  name: string;
  status: "called" | "completed";
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
}

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  onboardingCompleted: boolean;
}

export interface OnboardingData {
  name: string;
  grade: string;
  weakTopic: string;
  learningHabit: string;
  peakHour: string;
}

export interface Session {
  id: string;
  topic: string;
  date: string;
  status: "Selesai" | "Belum Selesai";
  difficulty: string;
}

export type NoteSubject = "Dokumen" | "YouTube" | "Audio" | "Video" | "Web";

/** Sumber web yang dipakai untuk validasi/enrichment sebuah bab. */
export interface SearchSource {
  url: string;
  title: string;
  snippet: string;
}

export interface NoteChapter {
  id: number;
  title: string;
  content: string;
  timestamp?: string;
  /** Langkah-langkah proses di bab ini (dirender sebagai diagram alur). */
  flow?: string[];
  /** Sumber web yang digunakan untuk validasi/enrichment bab ini. */
  sources?: SearchSource[];
}

export interface Note {
  id: string;
  title: string;
  subject: NoteSubject | string;
  sourceUrl?: string;
  chunkCount?: number;
  createdAt: string;
  chapters?: NoteChapter[];
  summary?: string;
  keyPoints?: string[];
  /** Kumpulan sumber web untuk bagian "Sumber & Referensi". */
  references?: SearchSource[];
}
