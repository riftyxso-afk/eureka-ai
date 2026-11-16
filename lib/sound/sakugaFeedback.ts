export type SakugaKind = "button" | "checkbox" | "progress" | "radio" | "rating" | "toast" | "input";
type SakugaEffects = {
  P: Record<string, string | string[]>;
  ticks: (x: number, y: number, options: { n: number; r: number; len: number; dir: number; life: number }) => void;
  kira: (x: number, y: number, options: { r: number; life: number; col: string }) => void;
  puff: (x: number, y: number, options: { n: number; size: number; vy: number; life: number }) => void;
};
const scripts = new Map<SakugaKind, Promise<void>>();
const effects = () => (window as Window & { SakugaFX?: SakugaEffects }).SakugaFX;

export function loadSakuga(kind: SakugaKind): Promise<void> {
  const previous = scripts.get(kind);
  if (previous) return previous;
  const ready = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `/sakuga-vfx/${kind}.js`;
    script.onload = () => {
      if (!customElements.get(`sakuga-${kind}`)) {
        scripts.delete(kind);
        reject(new Error("Sakuga component unavailable"));
        return;
      }
      const fx = effects();
      if (fx) Object.assign(fx.P, { shade: "#d9c9f5", line: "#8b5bc4", accent: "#a77be9" });
      resolve();
    };
    script.onerror = () => { scripts.delete(kind); reject(new Error("Sakuga effects unavailable")); };
    document.head.appendChild(script);
  });
  scripts.set(kind, ready);
  return ready;
}

export function showSakugaFeedback(control: Element, event: MouseEvent | Event, toggle = false): void {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches || control.closest('[data-sakuga-feedback="off"], sakuga-button, sakuga-checkbox, sakuga-radio, sakuga-rating, sakuga-input, sakuga-toast')) return;
  const started = performance.now();
  const rect = control.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const pointer = event instanceof MouseEvent && event.detail > 0;
  const cap = (position: number, max: number) => Math.max(8, Math.min(Math.max(8, max - 8), position));
  const x = cap(pointer ? event.clientX : rect.right - Math.min(12, rect.width / 2), innerWidth);
  const y = cap(pointer ? event.clientY : rect.top + rect.height / 2, innerHeight);
  const paint = () => {
    if (motion.matches || performance.now() - started > 220) return;
    const fx = effects();
    fx?.ticks(x, y - 4, { n: 3, r: 5, len: 8, dir: -Math.PI / 2, life: 0.24 });
    if (toggle) fx?.kira(x + 3, y - 5, { r: 5, life: 0.28, col: "#a77be9" });
  };
  if (effects()) paint();
  else void loadSakuga("button").then(paint).catch(() => {});
}

/** Give the multiline composer the same dust cue as the single-line Sakuga input. */
export function showSakugaTyping(event: Event): void {
  const fx = effects();
  const control = event.target;
  if (!event.isTrusted || !fx || matchMedia("(prefers-reduced-motion: reduce)").matches || !(control instanceof HTMLTextAreaElement)) return;
  const rect = control.getBoundingClientRect();
  fx.puff(rect.right - 16, rect.bottom - 8, { n: 2, size: 4, vy: -22, life: .32 });
}
