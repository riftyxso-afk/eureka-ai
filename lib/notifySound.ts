/**
 * Bunyi lonceng saat catatan selesai dirangkum di latar belakang.
 * Disintesis via Web Audio API (tidak butuh file aset) — nada "ding-dong"
 * yang lembut. Gagal diabaikan (suara murni opsional).
 */

let audioCtx: AudioContext | null = null;

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
