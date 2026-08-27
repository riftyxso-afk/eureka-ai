/**
 * Facade backward-compatible — delegasi ke cuelume adapter.
 * Semua pemanggilan existing `import { playCompletionSound } from "@/lib/notifySound"`
 * tetap jalan, tapi engine di baliknya sekarang cuelume + fallback Web Audio.
 */
export {
  playCompletionSound,
  playCelebrationSound,
  playLevelUpSound,
  setSoundEnabled,
  initCuelume,
} from "./sound/cuelume";
