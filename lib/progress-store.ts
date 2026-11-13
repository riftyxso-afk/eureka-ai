/**
 * Store Progres Belajar (XP, Level, Streak, Kartu Hafalan) — Supabase.
 * Tabel: progress, activity_log, flashcards
 */
import { db } from "./supabase/admin";
import { listFriends } from "./friends-store";
import { studyDay, summarizeStreak, type StreakSummary } from "./streak";

export const LEVEL_TITLE = "PELAJAR KONSISTEN";

/**
 * XP yang dibutuhkan per level (kumulatif):
 * Level 1: 0–100, Level 2: 100–300, Level 3: 300–600, dst.
 * Setiap level butuh 100 XP lebih banyak dari level sebelumnya.
 */
export function xpRequiredForLevel(level: number): number {
  return 100 * Math.max(1, level);
}

export function xpThresholdForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpRequiredForLevel(l);
  return total;
}

export function levelInfoForXp(xp: number): {
  level: number;
  xpInLevel: number;
  xpToNext: number;
} {
  let level = 1;
  while (xp >= xpThresholdForLevel(level + 1)) level++;
  return {
    level,
    xpInLevel: xp - xpThresholdForLevel(level),
    xpToNext: xpRequiredForLevel(level),
  };
}

export interface ProgressCard {
  id: string;
  noteId: string;
  front: string;
  back: string;
  dueDate: string;
  reviewCount: number;
}

export interface ActivityEntry {
  date: string;
  xp: number;
  label: string;
}

export interface UserProgress {
  xp: number;
  activeDays: string[];
  cards: ProgressCard[];
  activityLog: ActivityEntry[];
}

export interface ProgressStats {
  activeDays: string[];
  xp: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  levelTitle: string;
  streak: number;
  longestStreak: number;
  streakDetails: StreakSummary;
  totalDays: number;
  dueCards: number;
  nextDueNoteId?: string;
  rank: number | null;
  recentActivity: ActivityEntry[];
}

/** Attendance never changes XP; compare-and-swap protects concurrent activity writes. */
export async function checkInToday(userId: string): Promise<void> {
  const client = db();
  const today = studyDay();
  const { error: insertError } = await client.from("progress").upsert(
    { user_id: userId, active_days: [today] }, { onConflict: "user_id", ignoreDuplicates: true },
  );
  if (insertError) throw insertError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await client.from("progress").select("active_days").eq("user_id", userId).single();
    if (error) throw error;
    const days: string[] = data.active_days ?? [];
    if (days.includes(today)) return;
    if (days.some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day))) throw new Error("Invalid attendance history");
    const result = await client.from("progress").update({ active_days: [...days, today].sort(), updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("active_days", `{${days.join(",")}}`).select("user_id");
    if (result.error) throw result.error;
    if (result.data?.length) return;
  }
  throw new Error("Attendance changed concurrently; retry");
}

async function loadUserProgress(userId: string): Promise<UserProgress> {
  const client = db();
  const [{ data: row, error }, { data: cards }, { data: log }] = await Promise.all([
    client.from("progress").select("xp, active_days").eq("user_id", userId).maybeSingle(),
    client.from("flashcards").select("id, note_id, front, back, due_date, review_count").eq("user_id", userId),
    client.from("activity_log").select("xp, label, created_at").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(50),
  ]);
  if (error) throw error;

  return {
    xp: row?.xp ?? 0,
    activeDays: row?.active_days ?? [],
    cards: (cards ?? []).map((c) => ({
      id: c.id,
      noteId: c.note_id,
      front: c.front,
      back: c.back,
      dueDate: c.due_date,
      reviewCount: c.review_count,
    })),
    activityLog: (log ?? []).map((e) => ({
      date: e.created_at,
      xp: e.xp,
      label: e.label ?? "Aktivitas belajar",
    })),
  };
}

/** Catat aktivitas hari ini (untuk streak) dan tambah XP bila > 0. */
export async function recordActivity(
  userId: string,
  xpGain: number,
  label?: string
): Promise<{ progress: UserProgress; levelUp: boolean }> {
  const client = db();

  const { data: row } = await client
    .from("progress")
    .select("xp, active_days")
    .eq("user_id", userId)
    .maybeSingle();

  const prevXp = row?.xp ?? 0;
  const prevDays = row?.active_days ?? [];
  const key = studyDay();
  const nextDays = prevDays.includes(key)
    ? prevDays
    : [...prevDays, key].sort();

  const nextXp = prevXp + Math.max(0, xpGain);
  await client.from("progress").upsert({
    user_id: userId,
    xp: nextXp,
    active_days: nextDays,
  });

  if (xpGain > 0) {
    await client.from("activity_log").insert({
      user_id: userId,
      xp: xpGain,
      label: (label ?? "Aktivitas belajar").slice(0, 80),
    });
  }

  return {
    progress: await loadUserProgress(userId),
    levelUp: xpGain > 0 && levelInfoForXp(nextXp).level > levelInfoForXp(prevXp).level,
  };
}

/** Simpan kartu hafalan baru; jatuh tempo besok (jadwal SRS 24 jam). */
export async function addCards(
  userId: string,
  noteId: string,
  cards: { front: string; back: string }[]
): Promise<UserProgress> {
  const client = db();
  const dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  if (cards.length > 0) {
    await client.from("flashcards").insert(
      cards.map((c) => ({
        user_id: userId,
        note_id: noteId,
        front: c.front,
        back: c.back,
        due_date: dueDate,
      }))
    );
  }

  return loadUserProgress(userId);
}

/** Tandai semua kartu dari satu catatan sebagai direview; jadwal berikutnya +24 jam. */
export async function reviewAllCards(
  userId: string,
  noteId: string
): Promise<number> {
  const client = db();
  const { data } = await client
    .from("flashcards")
    .select("id")
    .eq("user_id", userId)
    .eq("note_id", noteId);

  if (!data || data.length === 0) return 0;

  const nextDue = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  // Increment review_count per kartu (Supabase JS tidak mendukung increment
  // ekspresi, jadi ambil lalu update satu per satu — jumlah kartu kecil).
  const { data: cards } = await client
    .from("flashcards")
    .select("id, review_count")
    .eq("user_id", userId)
    .eq("note_id", noteId);

  if (cards) {
    for (const c of cards) {
      await client
        .from("flashcards")
        .update({ review_count: c.review_count + 1, due_date: nextDue })
        .eq("id", c.id);
    }
  }

  return data.length;
}

/**
 * Statistik progres: XP, level, streak, kartu jatuh tempo, dan peringkat
 * di antara diri sendiri + teman (berdasarkan XP).
 */
export async function getStats(userId: string): Promise<ProgressStats> {
  const client = db();
  const p = await loadUserProgress(userId);
  const now = Date.now();
  const dueCards = p.cards.filter((card) => Date.parse(card.dueDate) <= now);
  const nextDueCard = dueCards.reduce<ProgressCard | undefined>((oldest, card) => {
    return !oldest || Date.parse(card.dueDate) < Date.parse(oldest.dueDate) ? card : oldest;
  }, undefined);

  let rank: number | null = null;
  if (p.xp > 0) {
    let friendIds: string[] = [];
    try {
      friendIds = (await listFriends(userId)).map((f) => f.id);
    } catch {
      friendIds = [];
    }
    const { data: rows } = await client
      .from("progress")
      .select("user_id, xp")
      .in("user_id", [userId, ...friendIds]);

    const scores = rows?.length
      ? rows.map((r) => ({ id: r.user_id, xp: r.xp ?? 0 }))
      : [];
    if (!rows?.some((r) => r.user_id === userId)) {
      scores.push({ id: userId, xp: p.xp });
    }
    scores.sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id));
    rank = scores.findIndex((s) => s.id === userId) + 1;
    if (rank === 0) rank = null;
  }

  const info = levelInfoForXp(p.xp);
  const streakDetails = summarizeStreak(p.activeDays, now);
  return {
    activeDays: p.activeDays,
    xp: p.xp,
    level: info.level,
    xpInLevel: info.xpInLevel,
    xpToNext: info.xpToNext,
    levelTitle: LEVEL_TITLE,
    streak: streakDetails.current,
    longestStreak: streakDetails.longest,
    streakDetails,
    totalDays: streakDetails.totalDays,
    dueCards: dueCards.length,
    nextDueNoteId: nextDueCard?.noteId,
    rank,
    recentActivity: p.activityLog,
  };
}
