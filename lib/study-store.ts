/**
 * Store kuis & flashcards per catatan — Supabase.
 * Tabel: study_content (satu baris per catatan, konten JSONB)
 */
import { db } from "./supabase/admin";

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Flashcard {
  id: number;
  front: string;
  back: string;
}

async function getRow(noteId: string): Promise<{
  quizzes: QuizQuestion[];
  flashcards: Flashcard[];
}> {
  const client = db();
  const { data } = await client
    .from("study_content")
    .select("quizzes, flashcards")
    .eq("note_id", noteId)
    .maybeSingle();

  return {
    quizzes: Array.isArray(data?.quizzes) ? data!.quizzes : [],
    flashcards: Array.isArray(data?.flashcards) ? data!.flashcards : [],
  };
}

export async function getSavedQuiz(noteId: string): Promise<QuizQuestion[]> {
  return (await getRow(noteId)).quizzes;
}

export async function saveQuiz(noteId: string, questions: QuizQuestion[]) {
  const client = db();
  const row = await getRow(noteId);
  await client.from("study_content").upsert({
    note_id: noteId,
    quizzes: questions,
    flashcards: row.flashcards,
  });
}

export async function getSavedFlashcards(noteId: string): Promise<Flashcard[]> {
  return (await getRow(noteId)).flashcards;
}

export async function saveFlashcards(noteId: string, cards: Flashcard[]) {
  const client = db();
  const row = await getRow(noteId);
  await client.from("study_content").upsert({
    note_id: noteId,
    quizzes: row.quizzes,
    flashcards: cards,
  });
}
