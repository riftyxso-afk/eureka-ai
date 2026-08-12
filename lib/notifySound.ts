/**
 * Bunyi lonceng saat catatan selesai dirangkum di latar belakang.
 * Disintesis via Web Audio API (tidak butuh file aset) — nada "ding-dong"
 * yang lembut. Gagal diabaikan (suara murni opsional).
 *
 * Catatan iOS Safari & Android: AudioContext hanya bisa aktif setelah gestur
 * pengguna pertama (tap). Karena itu audio "dibuka kunci" pada gestur pertama
 * (pointerdown/keydown/touchend) — supaya suara tetap berbunyi walau dipicu
 * dari job latar belakang (bukan dari tap langsung).
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Buka kunci audio — WAJIB dipanggil dari dalam gestur pengguna (iOS/Android). */
function unlockAudio(): void {
  const ctx = getCtx();
  if (!ctx || unlocked) return;
  if (ctx.state === "suspended") {
    void ctx
      .resume()
      .then(() => {
        unlocked = true;
        // Mainkan buffer senyap agar iOS benar-benar mengizinkan audio
        // berikutnya diputar tanpa gestur.
        try {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        } catch {
          // abaikan — unlock tetap tercatat
        }
      })
      .catch(() => {
        // gagal — coba lagi pada gestur berikutnya
      });
  } else {
    unlocked = true;
  }
}

// Pasang sekali: gestur pertama pengguna membuka kunci audio di semua browser.
if (typeof window !== "undefined") {
  const onGesture = () => unlockAudio();
  window.addEventListener("pointerdown", onGesture, { passive: true });
  window.addEventListener("keydown", onGesture, { passive: true });
  window.addEventListener("touchend", onGesture, { passive: true });
}

function playTone(
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

/** Bunyi lonceng "ding-dong" (E5 → A5) — panggil saat notifikasi muncul. */
export function playCompletionSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playTone(ctx, 659.25, now, 0.4, 0.3); // E5 "ding"
    playTone(ctx, 880, now + 0.3, 0.6, 0.3); // A5 "dong"
  } catch {
    // abaikan — suara opsional
  }
}

/** Fanfare perayaan singkat (C-E-G-C) — panggil saat onboarding selesai. */
export function playCelebrationSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playTone(ctx, 523.25, now, 0.22, 0.28); // C5
    playTone(ctx, 659.25, now + 0.14, 0.22, 0.28); // E5
    playTone(ctx, 783.99, now + 0.28, 0.22, 0.28); // G5
    playTone(ctx, 1046.5, now + 0.42, 0.55, 0.3); // C6 (nada akhir lebih panjang)
  } catch {
    // abaikan — suara opsional
  }
}

/** Nada naik level yang energik — panggil saat target XP level tercapai. */
export function playLevelUpSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playTone(ctx, 392, now, 0.12, 0.26);
    playTone(ctx, 523.25, now + 0.1, 0.12, 0.26);
    playTone(ctx, 659.25, now + 0.2, 0.12, 0.26);
    playTone(ctx, 783.99, now + 0.3, 0.18, 0.28);
    playTone(ctx, 1046.5, now + 0.44, 0.6, 0.32);
    playTone(ctx, 1318.5, now + 0.58, 0.45, 0.2);
  } catch {
    // abaikan — suara opsional
  }
}
