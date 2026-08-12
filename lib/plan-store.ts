/**
 * Store fitur "Rencana Belajar" — rencana mingguan per hari dengan
 * kartu bergaya kertas origami.
 *
 * Disimpan di localStorage per-user (pola sama seperti schedule-store/mission-store).
 */

export type PlanDay =
  | "senin"
  | "selasa"
  | "rabu"
  | "kamis"
  | "jumat"
  | "sabtu"
  | "minggu";

export const PLAN_DAYS: { id: PlanDay; label: string; short: string }[] = [
  { id: "senin", label: "Senin", short: "Sen" },
  { id: "selasa", label: "Selasa", short: "Sel" },
  { id: "rabu", label: "Rabu", short: "Rab" },
  { id: "kamis", label: "Kamis", short: "Kam" },
  { id: "jumat", label: "Jumat", short: "Jum" },
  { id: "sabtu", label: "Sabtu", short: "Sab" },
  { id: "minggu", label: "Minggu", short: "Min" },
];

export interface PlanItem {
  id: string;
  day: PlanDay;
  /** Waktu mulai, format "HH:MM" (opsional). */
  time?: string;
  /** Nama aktivitas belajar, mis. "Review Fisika Bab 3". */
  title: string;
  /** Subjek/warna chip (opsional). */
  subject?: string;
  done: boolean;
  createdAt: number;
}

const KEY = "eureka_plan_items";

export function getPlanItems(): PlanItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PlanItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: PlanItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // abaikan
  }
}

export function addPlanItem(
  input: Omit<PlanItem, "id" | "done" | "createdAt">
): PlanItem {
  const item: PlanItem = {
    ...input,
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    done: false,
    createdAt: Date.now(),
  };
  save([...getPlanItems(), item]);
  return item;
}

export function updatePlanItem(id: string, patch: Partial<Omit<PlanItem, "id">>): void {
  save(getPlanItems().map((it) => (it.id === id ? { ...it, ...patch } : it)));
}

export function deletePlanItem(id: string): void {
  save(getPlanItems().filter((it) => it.id !== id));
}

export function togglePlanItem(id: string): void {
  save(
    getPlanItems().map((it) =>
      it.id === id ? { ...it, done: !it.done } : it
    )
  );
}

export interface PlanStats {
  total: number;
  done: number;
  percent: number;
}

export function getPlanStats(items: PlanItem[]): PlanStats {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/** Urutkan item: hari sesuai urutan minggu, lalu jam. */
export function sortPlanItems(items: PlanItem[]): PlanItem[] {
  const dayOrder = PLAN_DAYS.map((d) => d.id);
  return [...items].sort((a, b) => {
    const da = dayOrder.indexOf(a.day);
    const db = dayOrder.indexOf(b.day);
    if (da !== db) return da - db;
    return (a.time ?? "99").localeCompare(b.time ?? "99");
  });
}

export function planDayLabel(day: PlanDay): string {
  return PLAN_DAYS.find((d) => d.id === day)?.label ?? day;
}
