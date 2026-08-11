/**
 * Store MVP untuk Progres Belajar (XP, Level, Streak, Kartu Hafalan).
 * Persistensi file JSON lokal: data/progress.json
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { listFriends } from "./friends-store";

const DATA_DIR = path.join(process.cwd(), "data");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

export const XP_TO_NEXT_LEVEL = 100;
export const LEVEL_TITLE = "PELAJAR KONSISTEN";

export interface ProgressCard {
  id: string;
  noteId: string;
  front: string;
  back: string;
  dueDate: string;
  reviewCount: number;
}

export interface UserProgress {
  xp: number;
  activeDays: string[];
  cards: ProgressCard[];
}

export interface ProgressStats {
  xp: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  levelTitle: string;
  streak: number;
  longestStreak: number;
  totalDays: number;
  dueCards: number;
  rank: number | null;
}

interface ProgressStore {
  users: Record<string, UserProgress>;
}

let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readStore(): Promise<ProgressStore> {
  try {
    const raw = await fs.readFile(PROGRESS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ProgressStore>;
    return { users: {}, ...parsed };
  } catch {
    return { users: {} };
  }
}

async function writeStore(store: ProgressStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function emptyProgress(): UserProgress {
  return { xp: 0, activeDays: [], cards: [] };
}

function todayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Catat aktivitas hari ini (untuk streak) dan tambah XP bila > 0. */
export function recordActivity(
  userId: string,
  xpGain: number
): Promise<UserProgress> {
  return withLock(async () => {
    const store = await readStore();
    const p = store.users[userId] ?? emptyProgress();
    if (xpGain > 0) p.xp += xpGain;
    const key = todayKey();
    if (!p.activeDays.includes(key)) {
      p.activeDays.push(key);
      p.activeDays.sort();
    }
    store.users[userId] = p;
    await writeStore(store);
    return p;
  });
}

/** Simpan kartu hafalan baru; jatuh tempo besok (jadwal SRS 24 jam). */
export function addCards(
  userId: string,
  noteId: string,
  cards: { front: string; back: string }[]
): Promise<UserProgress> {
  return withLock(async () => {
    const store = await readStore();
    const p = store.users[userId] ?? emptyProgress();
    const dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    for (const c of cards) {
      p.cards.push({
        id: randomUUID(),
        noteId,
        front: c.front,
        back: c.back,
        dueDate,
        reviewCount: 0,
      });
    }
    store.users[userId] = p;
    await writeStore(store);
    return p;
  });
}

/** Tandai semua kartu dari satu catatan sebagai direview; jadwal berikutnya +24 jam. */
export function reviewAllCards(
  userId: string,
  noteId: string
): Promise<number> {
  return withLock(async () => {
    const store = await readStore();
    const p = store.users[userId];
    if (!p) return 0;
    let reviewed = 0;
    const nextDue = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    p.cards = p.cards.map((c) => {
      if (c.noteId !== noteId) return c;
      reviewed++;
      return { ...c, reviewCount: c.reviewCount + 1, dueDate: nextDue };
    });
    store.users[userId] = p;
    await writeStore(store);
    return reviewed;
  });
}

function calcStreak(activeDays: string[]): number {
  const set = new Set(activeDays);
  const d = new Date();
  if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(todayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcLongestStreak(activeDays: string[]): number {
  const days = [...activeDays].sort();
  if (days.length === 0) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (Date.parse(days[i]) - Date.parse(days[i - 1])) / 86400000;
    if (diff === 1) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  return Math.max(longest, run);
}

/**
 * Statistik progres: XP, level, streak, kartu jatuh tempo, dan peringkat
 * di antara diri sendiri + teman (berdasarkan XP).
 */
export async function getStats(userId: string): Promise<ProgressStats> {
  const store = await readStore();
  const p = store.users[userId] ?? emptyProgress();
  const now = Date.now();
  const dueCards = p.cards.filter((c) => new Date(c.dueDate).getTime() <= now)
    .length;

  let rank: number | null = null;
  if (p.xp > 0) {
    let friendIds: string[] = [];
    try {
      friendIds = (await listFriends(userId)).map((f) => f.id);
    } catch {
      friendIds = [];
    }
    const scores = [userId, ...friendIds].map((id) => ({
      id,
      xp: store.users[id]?.xp ?? 0,
    }));
    scores.sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id));
    rank = scores.findIndex((s) => s.id === userId) + 1;
  }

  return {
    xp: p.xp,
    level: Math.floor(p.xp / XP_TO_NEXT_LEVEL) + 1,
    xpInLevel: p.xp % XP_TO_NEXT_LEVEL,
    xpToNext: XP_TO_NEXT_LEVEL,
    levelTitle: LEVEL_TITLE,
    streak: calcStreak(p.activeDays),
    longestStreak: calcLongestStreak(p.activeDays),
    totalDays: p.activeDays.length,
    dueCards,
    rank,
  };
}
