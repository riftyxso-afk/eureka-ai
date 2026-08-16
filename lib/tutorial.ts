/**
 * State tutorial realtime (spotlight) untuk pengguna baru yang belum punya
 * catatan. Tutorial menyorot tombol/menu ASLI di halaman (bukan slide),
 * dan langkahnya tersimpan di localStorage agar berlanjut antar halaman
 * (mis. /home → klik Dashboard → lanjut di /dashboard).
 */

export interface TutorialStep {
  /** id elemen target — elemen diberi atribut data-tutorial-id="..." */
  targetId: string;
  title: string;
  text: string;
}

export interface TutorialState {
  active: boolean;
  step: number;
}

const KEY = "eureka_realtime_tutorial";
const CHANGE_EVENT = "eureka:tutorial-change";

/** Langkah tutorial untuk pengguna tanpa catatan. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    targetId: "dashboard-nav",
    title: "Langkah 1 dari 3",
    text: "Kamu belum punya catatan nih. Yuk mulai dari Dashboard — klik tombol Dashboard di atas.",
  },
  {
    targetId: "create-note-btn",
    title: "Langkah 2 dari 3",
    text: "Klik tombol Buat Catatan Baru di pojok kanan bawah untuk membuat catatan pertamamu.",
  },
  {
    targetId: "source-card-dokumen",
    title: "Langkah 3 dari 3",
    text: "Pilih sumber materimu — misal Dokumen, Soal/Tugas, atau Web. AI akan menyusun catatanmu.",
  },
];

// Snapshot di-cache dengan referensi stabil — WAJIB untuk useSyncExternalStore
// (kalau getSnapshot mengembalikan objek baru tiap kali, React akan loop tak hingga).
let cached: TutorialState = { active: false, step: 0 };
let loaded = false;

function parse(): TutorialState {
  if (typeof window === "undefined") return { active: false, step: 0 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TutorialState>;
      return {
        active: p.active === true,
        step: Math.max(0, Number(p.step) || 0),
      };
    }
  } catch {
    // storage tidak tersedia
  }
  return { active: false, step: 0 };
}

function read(): TutorialState {
  if (!loaded) {
    cached = parse();
    loaded = true;
  }
  return cached;
}

function write(s: TutorialState): TutorialState {
  cached = s;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // abaikan
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return s;
}

export function getTutorialState(): TutorialState {
  return read();
}

/** Mulai tutorial dari langkah 0. */
export function startTutorial(): TutorialState {
  return write({ active: true, step: 0 });
}

/** Maju satu langkah. */
export function nextStep(): TutorialState {
  const c = read();
  return write({ active: c.active, step: c.step + 1 });
}

/** Selesai (atau lewati) tutorial. */
export function completeTutorial(): TutorialState {
  return write({ active: false, step: 0 });
}

export const skipTutorial = completeTutorial;

/** Subscribe perubahan tutorial (storage + event lokal). */
export function subscribeTutorial(cb: () => void): () => void {
  const onStorage = () => {
    cached = parse(); // tab lain mengubah state → segarkan cache + beri tahu React
    cb();
  };
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
