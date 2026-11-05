/**
 * Helpers untuk menghitung progres aktivitas belajar per mata pelajaran.
 * Progress dihitung dari: (1) materi tersedia, (2) kartu sudah disiapkan, (3) semua kartu pernah diulang.
 * Ini bukan skor mastery/penguasaan.
 */

import type { Note } from "@/lib/types";
export interface SubjectJourneyCard {
  note_id: string;
  review_count: number;
  due_date: string;
}

interface NormalizedSubjectName {
  normalized: string;
  original: string;
}

export function normalizeSubjectName(value?: string | null): NormalizedSubjectName {
  const original = value ?? "";
  const normalized = original.normalize("NFKC").trim().toLocaleLowerCase("id");
  return { normalized, original };
}

export interface SubjectJourneyNote {
  id: string;
  title: string;
  createdAt: string;
  cardCount: number;
  reviewedCards: number;
  dueCards: number;
}

export interface SubjectJourney {
  notes: SubjectJourneyNote[];
  completedSteps: number;
  totalSteps: number;
  percent: number;
  reviewedNotes: number;
  totalCards: number;
  dueCards: number;
  nextAction:
    | { type: "review"; noteId: string }
    | { type: "cards"; noteId: string }
    | { type: "prepare_cards"; noteId: string }
    | { type: "create_note" }
    | { type: "revisit"; noteId: string }
    | null;
  nextNoteId: string | null;
  progressAvailable: boolean;
}

function summarizeCards(
  userId: string,
  allCards: readonly SubjectJourneyCard[] | null,
  ownedNoteIds: readonly string[],
  now: Date
): { notes: Record<string, { cardCount: number; reviewedCards: number; dueCards: number }> } {
  const byNote: Record<string, { cardCount: number; reviewedCards: number; dueCards: number }> = {};
  if (!allCards || !ownedNoteIds.length) {
    return { notes: {} };
  }
  const ownedSet = new Set(ownedNoteIds);
  for (const card of allCards) {
    if (!ownedSet.has(card.note_id)) continue;
    const entry = byNote[card.note_id] ??= { cardCount: 0, reviewedCards: 0, dueCards: 0 };
    entry.cardCount += 1;
    if (card.review_count > 0) entry.reviewedCards += 1;
    if (new Date(card.due_date) <= now) entry.dueCards += 1;
  }
  return { notes: byNote };
}

export function buildSubjectJourney(
  user: { id: string },
  subjectName: string,
  notes: readonly Omit<Note, "user_id">[],
  cards: readonly SubjectJourneyCard[] | null,
  now: Date = new Date()
): SubjectJourney {
  const { normalized: subjectNormalized } = normalizeSubjectName(subjectName);
  const notesFiltered = notes.filter((n) => normalizeSubjectName(n.subject).normalized === subjectNormalized);
  const ownedIds = notesFiltered.map((n) => n.id);
  const summary = summarizeCards(user.id, cards, ownedIds, now);
  const noteSummaries = notesFiltered.map((n) => ({
    id: n.id,
    title: n.title,
    createdAt: n.createdAt,
    ...(summary.notes[n.id] ?? { cardCount: 0, reviewedCards: 0, dueCards: 0 }),
  })) as SubjectJourneyNote[];

  const totalSteps = noteSummaries.length * 3; // 3 langkah per materi
  let completedSteps = 0;
  let dueCardsTotal = 0;
  let totalCards = 0;
  let reviewedNotes = 0;
  for (const note of noteSummaries) {
    // material exists → always complete since filtered
    completedSteps += 1;
    if (note.cardCount > 0 && note.reviewedCards === note.cardCount) {
      // cards prepared + all reviewed
      completedSteps += 2;
    } else if (note.cardCount > 0) {
      // cards prepared but not all reviewed
      completedSteps += 1;
    }
    // review progress tracking for UI
    if (note.cardCount > 0 && note.reviewedCards > 0) {
      reviewedNotes += 1;
    }
    totalCards += note.cardCount;
    dueCardsTotal += note.dueCards;
  }
  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  // Recommended next step
  let nextAction: NonNullable<SubjectJourney["nextAction"]> | null = null;
  let nextNoteId: string | null = null;
  if (noteSummaries.length === 0) {
    nextAction = { type: "create_note" };
  } else {
    const sorted = [...noteSummaries].sort((a, b) => {
      // due first
      if (a.dueCards > 0 && b.dueCards === 0) return -1;
      if (a.dueCards === 0 && b.dueCards > 0) return 1;
      // then unreviewed cards
      if (a.cardCount > a.reviewedCards && b.cardCount === b.reviewedCards) return -1;
      if (a.cardCount === a.reviewedCards && b.cardCount > b.reviewedCards) return 1;
      // then no cards
      if (a.cardCount === 0 && b.cardCount > 0) return -1;
      if (a.cardCount > 0 && b.cardCount === 0) return 1;
      // then newest
      if (b.createdAt < a.createdAt) return -1;
      if (b.createdAt > a.createdAt) return 1;
      // tie-break by id
      return a.id.localeCompare(b.id);
    });
    const candidate = sorted[0];
    if (!candidate) {
      // impossible in theory, fallback to revisit latest
      const last = [...noteSummaries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      nextNoteId = last?.id ?? null;
      nextAction = nextNoteId ? { type: "revisit", noteId: nextNoteId } : null;
    } else if (candidate.dueCards > 0) {
      nextNoteId = candidate.id;
      nextAction = { type: "review", noteId: candidate.id };
    } else if (candidate.cardCount > candidate.reviewedCards) {
      nextNoteId = candidate.id;
      nextAction = { type: "cards", noteId: candidate.id };
    } else if (candidate.cardCount > 0) {
      nextNoteId = candidate.id;
      nextAction = { type: "revisit", noteId: candidate.id };
    } else {
      nextNoteId = candidate.id;
      nextAction = { type: "prepare_cards", noteId: candidate.id };
    }
  }
  // progress availability is false only when flashcards table was inaccessible
  const progressAvailable = cards !== null;
  return {
    notes: noteSummaries,
    completedSteps,
    totalSteps,
    percent,
    reviewedNotes,
    totalCards,
    dueCards: dueCardsTotal,
    nextAction,
    nextNoteId,
    progressAvailable,
  };
}
