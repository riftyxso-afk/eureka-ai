/**
 * Store fitur "Misi" — target belajar dengan bimbingan AI.
 *
 * Contoh misi:
 *  - Mahasiswa: kejar IPK dari 2.0 ke 3.5
 *  - Siswa SMA: kejar lulus SNBP / SNBT (seleksi masuk PTN)
 *
 * Disimpan di localStorage per-user (pola sama seperti schedule-store).
 */

export type MissionType = "ipk" | "snbp" | "snbt" | "umum";

export interface Mission {
  id: string;
  type: MissionType;
  title: string;
  /** Nilai/posisi sekarang (IPK 0-4, skor, dsb). */
  currentValue?: number;
  /** Nilai target (mis. IPK 3.5, skor SNBT 600+). */
  targetValue?: number;
  /** Satuan nilai untuk ditampilkan (mis. "IPK", "skor", "nilai"). */
  unit?: string;
  deadline?: string; // ISO date
  status: "active" | "done";
  /** Ringkasan singkat dari AI guide. */
  guide?: string;
  /** Langkah-langkah bimbingan dari AI. */
  steps?: string[];
  createdAt: number;
}

export const MISSION_TEMPLATES: {
  type: MissionType;
  icon: string;
  title: string;
  desc: string;
  unit: string;
  defaultTarget: number;
  forLabel: string;
}[] = [
  {
    type: "ipk",
    icon: "🎓",
    title: "Kejar IPK",
    desc: "Mahasiswa mengejar IPK dari 2 ke 4 — AI menyusun strategi belajar per semester.",
    unit: "IPK",
    defaultTarget: 3.5,
    forLabel: "Mahasiswa",
  },
  {
    type: "snbp",
    icon: "🏛️",
    title: "Lulus SNBP",
    desc: "Siswa SMA kelas 12 mengejar lolos SNBP (seleksi prestasi) — AI membimbing portofolio & nilai rapor.",
    unit: "nilai rapor",
    defaultTarget: 90,
    forLabel: "SMA Kelas 12",
  },
  {
    type: "snbt",
    icon: "✍️",
    title: "Lulus SNBT",
    desc: "Siswa SMA kelas 12 mengejar lolos SNBT (tes tertulis) — AI menyusun rencana belajar UTBK.",
    unit: "skor",
    defaultTarget: 600,
    forLabel: "SMA Kelas 12",
  },
  {
    type: "umum",
    icon: "🎯",
    title: "Target Pribadi",
    desc: "Misi belajar apa pun — dari naik kelas sampai menaklukkan ujian sertifikasi.",
    unit: "nilai",
    defaultTarget: 80,
    forLabel: "Semua",
  },
];

const KEY = "eureka_missions";

export function getMissions(): Mission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Mission[]) : [];
  } catch {
    return [];
  }
}

function save(missions: Mission[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(missions));
  } catch {
    // abaikan
  }
}

export function addMission(
  input: Omit<Mission, "id" | "status" | "createdAt">
): Mission {
  const mission: Mission = {
    ...input,
    id: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "active",
    createdAt: Date.now(),
  };
  save([mission, ...getMissions()]);
  return mission;
}

export function updateMission(
  id: string,
  patch: Partial<Omit<Mission, "id">>
): void {
  save(getMissions().map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

export function deleteMission(id: string): void {
  save(getMissions().filter((m) => m.id !== id));
}

/** Kira-kira progress misi (0-100) dari nilai sekarang vs target. */
export function missionProgress(m: Mission): number {
  if (m.currentValue == null || m.targetValue == null) return 0;
  if (m.targetValue <= 0) return 0;
  const ratio = m.currentValue / m.targetValue;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/** Nama friendly per tipe misi. */
export function missionTypeLabel(type: MissionType): string {
  switch (type) {
    case "ipk":
      return "Kejar IPK";
    case "snbp":
      return "Lolos SNBP";
    case "snbt":
      return "Lolos SNBT";
    default:
      return "Target Pribadi";
  }
}
