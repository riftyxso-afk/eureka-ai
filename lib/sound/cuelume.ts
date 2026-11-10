import { play, setEnabled, unlock, type PlayOptions, type SoundName } from "cuelume";

const preferenceKey = "eureka_sound_enabled";
const controls = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="switch"]';
let soundEnabled = true;

function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (window.localStorage.getItem(preferenceKey) ?? String(soundEnabled)) !== "false";
  } catch {
    return soundEnabled;
  }
}

function playCue(cue: SoundName, options: PlayOptions): void {
  if (isSoundEnabled()) play(cue, options);
}

export function playCompletionSound(): void {
  playCue("ready", { volume: 0.32, emphasis: "subtle" });
}

export function playCelebrationSound(): void {
  playCue("success", { theme: "bubble", volume: 0.38 });
}

export function playLevelUpSound(): void {
  playCue("success", { theme: "bubble", volume: 0.46, emphasis: "strong" });
}

export function playCallSound(cue: "open" | "close"): void {
  playCue(cue, { theme: "bubble", volume: 0.3, emphasis: "subtle" });
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  setEnabled(enabled);
  try {
    window.localStorage.setItem(preferenceKey, String(enabled));
  } catch {
    // Keep the setting for this tab when storage is unavailable.
  }
}

export function initCuelume(): () => void {
  const listeners = new AbortController();
  const options = { capture: true, passive: true, signal: listeners.signal };
  let unlocked = false;
  let lastClick = -Infinity;

  function unlockOnGesture(event: Event): void {
    if (event.isTrusted && !unlocked && isSoundEnabled()) {
      void unlock().then(ready => { unlocked ||= ready; });
    }
  }

  function onClick(event: MouseEvent): void {
    if (!event.isTrusted || event.button !== 0 || !(event.target instanceof Element)) return;
    const control = event.target.closest(controls);
    if (!control || control.closest(':disabled, [aria-disabled="true"], [data-eureka-sound="off"], dialog.momo-call')) return;

    const now = performance.now();
    if (now - lastClick < 120) return;
    lastClick = now;
    const cue = control.matches('a[href]') ? "navigate" : "tap";
    playCue(cue, {
      theme: "bubble",
      volume: 0.18,
      emphasis: "subtle",
      input: event.detail === 0 ? "keyboard" : undefined,
    });
  }

  window.addEventListener("pointerup", unlockOnGesture, options);
  window.addEventListener("keydown", unlockOnGesture, options);
  window.addEventListener("click", onClick, options);
  return () => listeners.abort();
}
