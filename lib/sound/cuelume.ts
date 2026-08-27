/**
 * Eureka Sound Adapter — cuelume wrapper with Web Audio fallback.
 *
 * - Cuelume: 17 curated sounds (ESM-only, SSR-safe, no files). We map Eureka cues to closest cuelume sounds.
 * - Fallback: legacy Web Audio sine tones (preservasi frekuensi Eureka) bila cuelume gagal / diblokir.
 * - Unlock: iOS-friendly via pointerdown/touchend, plus cuelume's lazy AudioContext.
 *
 * Mapping preservasi karakter Eureka (dari lib/notifySound.ts):
 * - completion ding-dong E5(659Hz,0.4s)→A5(880Hz,0.6s) → cuelume "success" (warm three-note confirmation)
 * - celebration C5→E5→G5→C6 (0.22+0.22+0.22+0.55s) → cuelume "sparkle" (quick four-note twinkle)
 * - level-up 392→523→659→783→1046→1318 6-step → cuelume "arrival" (rising harmonic portal)
 */

let cuelumePlay: ((name: string, opts?: { volume?: number }) => void) | null = null;
let cuelumeSetEnabled: ((v: boolean) => void) | null = null;
let cuelumeBind: (() => void) | null = null;
let cuelumeReady = false;
let cuelumeFailed = false;

// Fallback Web Audio (copied from notifySound.ts legacy, preservasi frekuensi)
let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function playToneFallback(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

function shouldPlay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Hormati preferensi user
    const stored = localStorage.getItem("eureka_sound_enabled");
    if (stored === "false") return false;
    // Hormati prefers-reduced-motion sebagai sinyal kurangi audio
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true; // tetap main tapi volume akan dikurangi di caller jika mau
  } catch {
    // abaikan
  }
  return true;
}

async function ensureCuelume(): Promise<boolean> {
  if (cuelumeReady || cuelumeFailed) return cuelumeReady;
  if (typeof window === "undefined") return false;
  try {
    const mod = await import("cuelume");
    cuelumePlay = mod.play as unknown as typeof cuelumePlay;
    cuelumeSetEnabled = mod.setEnabled;
    cuelumeBind = mod.bind;
    // Bind sekali untuk data-cuelume-* (idempotent)
    try {
      cuelumeBind?.();
    } catch {
      // abaikan
    }
    cuelumeReady = true;
    return true;
  } catch {
    cuelumeFailed = true;
    return false;
  }
}

function unlockAudioFallback(): void {
  const ctx = getCtx();
  if (!ctx || unlocked) return;
  if (ctx.state === "suspended") {
    void ctx
      .resume()
      .then(() => {
        unlocked = true;
        try {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        } catch {}
      })
      .catch(() => {});
  } else {
    unlocked = true;
  }
}

// Pasang unlock sekali di gestur pertama
if (typeof window !== "undefined") {
  const onGesture = () => {
    unlockAudioFallback();
    // Cuelume juga lazy, tapi kita coba ensure
    void ensureCuelume();
  };
  window.addEventListener("pointerdown", onGesture, { passive: true });
  window.addEventListener("keydown", onGesture, { passive: true });
  window.addEventListener("touchend", onGesture, { passive: true });
}

function tryCuelumePlay(name: string, volume: number): boolean {
  if (!cuelumePlay || !shouldPlay()) return false;
  try {
    cuelumePlay(name, { volume });
    return true;
  } catch {
    return false;
  }
}

// Public API — preservasi nama Eureka, mapping ke cuelume + fallback

export function playCompletionSound(): void {
  if (!shouldPlay()) return;
  // Coba cuelume dulu (async, tapi play sync bila sudah ready)
  if (cuelumeReady && tryCuelumePlay("success", 0.4)) return;
  void ensureCuelume().then((ok) => {
    if (ok && tryCuelumePlay("success", 0.4)) return;
    // Fallback Web Audio E5→A5
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      playToneFallback(ctx, 659.25, now, 0.4, 0.3);
      playToneFallback(ctx, 880, now + 0.3, 0.6, 0.3);
    } catch {}
  });
  // Jika cuelume belum ready, langsung fallback sync juga agar tidak delay
  if (!cuelumeReady) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      playToneFallback(ctx, 659.25, now, 0.4, 0.3);
      playToneFallback(ctx, 880, now + 0.3, 0.6, 0.3);
    } catch {}
  }
}

export function playCelebrationSound(): void {
  if (!shouldPlay()) return;
  if (cuelumeReady && tryCuelumePlay("sparkle", 0.35)) return;
  void ensureCuelume().then((ok) => {
    if (ok && tryCuelumePlay("sparkle", 0.35)) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      playToneFallback(ctx, 523.25, now, 0.22, 0.28);
      playToneFallback(ctx, 659.25, now + 0.14, 0.22, 0.28);
      playToneFallback(ctx, 783.99, now + 0.28, 0.22, 0.28);
      playToneFallback(ctx, 1046.5, now + 0.42, 0.55, 0.3);
    } catch {}
  });
  if (!cuelumeReady) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      playToneFallback(ctx, 523.25, now, 0.22, 0.28);
      playToneFallback(ctx, 659.25, now + 0.14, 0.22, 0.28);
      playToneFallback(ctx, 783.99, now + 0.28, 0.22, 0.28);
      playToneFallback(ctx, 1046.5, now + 0.42, 0.55, 0.3);
    } catch {}
  }
}

export function playLevelUpSound(): void {
  if (!shouldPlay()) return;
  if (cuelumeReady && tryCuelumePlay("arrival", 0.45)) return;
  void ensureCuelume().then((ok) => {
    if (ok && tryCuelumePlay("arrival", 0.45)) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      playToneFallback(ctx, 392, now, 0.12, 0.26);
      playToneFallback(ctx, 523.25, now + 0.1, 0.12, 0.26);
      playToneFallback(ctx, 659.25, now + 0.2, 0.12, 0.26);
      playToneFallback(ctx, 783.99, now + 0.3, 0.18, 0.28);
      playToneFallback(ctx, 1046.5, now + 0.44, 0.6, 0.32);
      playToneFallback(ctx, 1318.5, now + 0.58, 0.45, 0.2);
    } catch {}
  });
  if (!cuelumeReady) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      playToneFallback(ctx, 392, now, 0.12, 0.26);
      playToneFallback(ctx, 523.25, now + 0.1, 0.12, 0.26);
      playToneFallback(ctx, 659.25, now + 0.2, 0.12, 0.26);
      playToneFallback(ctx, 783.99, now + 0.3, 0.18, 0.28);
      playToneFallback(ctx, 1046.5, now + 0.44, 0.6, 0.32);
      playToneFallback(ctx, 1318.5, now + 0.58, 0.45, 0.2);
    } catch {}
  }
}

// Global click sound untuk menu/apapun — main di setiap klik button/a/menu
let globalClickBound = false;
let lastClickSound = 0;

export function enableGlobalClickSounds(): void {
  if (globalClickBound || typeof window === "undefined") return;
  globalClickBound = true;
  window.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Hanya untuk elemen interaktif — biar tidak bunyi di klik kosong
      const interactive = target.closest(
        'button, a, [role="button"], [data-cuelume-press], [data-cuelume-release], [data-cuelume-toggle], .card-clay, [class*="btn-"]'
      );
      if (!interactive) return;
      const now = Date.now();
      if (now - lastClickSound < 90) return; // throttle 90ms biar swipe menu tidak berisik
      lastClickSound = now;
      if (!shouldPlay()) return;
      // Coba cuelume "press" (dull knock) — paling cocok untuk menu
      if (cuelumeReady && tryCuelumePlay("press", 0.22)) return;
      void ensureCuelume().then((ok) => {
        if (ok && tryCuelumePlay("press", 0.22)) return;
        // Fallback tick kecil
        const ctx = getCtx();
        if (!ctx) return;
        try {
          const t = ctx.currentTime;
          playToneFallback(ctx, 900, t, 0.07, 0.12);
        } catch {}
      });
      if (!cuelumeReady) {
        const ctx = getCtx();
        if (!ctx) return;
        try {
          const t = ctx.currentTime;
          playToneFallback(ctx, 900, t, 0.07, 0.12);
        } catch {}
      }
    },
    { capture: true, passive: true }
  );
}

// Auto-enable global click sound sekali saat module load (client only)
if (typeof window !== "undefined") {
  // Delay sedikit biar tidak bentrok dengan unlock
  setTimeout(() => enableGlobalClickSounds(), 300);
}

// Expose untuk preferensi
export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem("eureka_sound_enabled", String(enabled));
    cuelumeSetEnabled?.(enabled);
  } catch {}
}

export function initCuelume(): void {
  void ensureCuelume();
  enableGlobalClickSounds();
}
