/**
 * Store fitur "Jadwal" — jadwal mata pelajaran + daftar tugas.
 *
 * Disimpan per-user di localStorage agar tidak butuh migrasi database.
 * Pola sama seperti buddyStorage: baca/tulis JSON yang toleran error.
 */

export type ScheduleDay =
  | "Senin"
  | "Selasa"
  | "Rabu"
  | "Kamis"
  | "Jumat"
  | "Sabtu"
  | "Minggu";

export const SCHEDULE_DAYS: ScheduleDay[] = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

export interface ScheduleEntry {
  id: string;
  day: ScheduleDay;
  start: string; // "07:30"
  end: string; // "09:00"
  subject: string;
  room?: string;
  color: string;
}

export interface TaskItem {
  id: string;
  title: string;
  subject?: string;
  dueDate?: string; // ISO date "2026-08-20"
  done: boolean;
  createdAt: number;
}

const KEY = "eureka_schedule";

/**
 * Palet warna kegiatan jadwal — diambil dari palet aksen mata pelajaran
 * resmi (lib/palette.ts, tier terang) agar satu sistem warna untuk
 * sampul catatan, badge, dan jadwal. Warna solid dekoratif: teks pada
 * blok dipilih otomatis via luminance (lihat readableTextColor).
 */
import { SUBJECT_ACCENTS } from "@/lib/palette";

export const SCHEDULE_COLORS: string[] = SUBJECT_ACCENTS.map((a) => a.light);

interface ScheduleStorage {
  entries: ScheduleEntry[];
  tasks: TaskItem[];
}

function empty(): ScheduleStorage {
  return { entries: [], tasks: [] };
}

export function getSchedule(): ScheduleStorage {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<ScheduleStorage>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    return empty();
  }
}

function save(storage: ScheduleStorage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(storage));
  } catch {
    // abaikan (quota penuh, dll)
  }
}

export function addScheduleEntry(
  input: Omit<ScheduleEntry, "id" | "color"> & { color?: string }
): ScheduleEntry {
  const storage = getSchedule();
  const { color: chosenColor, ...rest } = input;
  const entry: ScheduleEntry = {
    ...rest,
    id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    // Warna pilihan pengguna; tanpa pilihan → giliran palet agar
    // kegiatan tetap saling terbedakan.
    color:
      chosenColor ?? SCHEDULE_COLORS[storage.entries.length % SCHEDULE_COLORS.length],
  };
  storage.entries = [...storage.entries, entry];
  save(storage);
  return entry;
}

export function updateScheduleEntry(
  id: string,
  patch: Partial<Omit<ScheduleEntry, "id">>
): void {
  const storage = getSchedule();
  storage.entries = storage.entries.map((e) =>
    e.id === id ? { ...e, ...patch } : e
  );
  save(storage);
}

export function deleteScheduleEntry(id: string): void {
  const storage = getSchedule();
  storage.entries = storage.entries.filter((e) => e.id !== id);
  save(storage);
}

export function addTask(input: Omit<TaskItem, "id" | "done" | "createdAt">): TaskItem {
  const storage = getSchedule();
  const task: TaskItem = {
    ...input,
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    done: false,
    createdAt: Date.now(),
  };
  storage.tasks = [task, ...storage.tasks];
  save(storage);
  return task;
}

export function toggleTask(id: string): void {
  const storage = getSchedule();
  storage.tasks = storage.tasks.map((t) =>
    t.id === id ? { ...t, done: !t.done } : t
  );
  save(storage);
}

export function deleteTask(id: string): void {
  const storage = getSchedule();
  storage.tasks = storage.tasks.filter((t) => t.id !== id);
  save(storage);
}

/** Urutkan tugas: belum selesai dulu, lalu berdasarkan tenggat terdekat. */
export function sortedTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt - a.createdAt;
  });
}

/** Jumlah tugas yang belum selesai (untuk badge sidebar). */
export function pendingTaskCount(): number {
  return getSchedule().tasks.filter((t) => !t.done).length;
}
