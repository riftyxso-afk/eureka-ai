"use client";
import { useEffect, useRef, useState, type ReactNode, type DetailedHTMLProps, type HTMLAttributes } from "react";
import "./sakuga.css";

type CheckboxElement = HTMLElement & { checked: boolean };
type ProgressElement = HTMLElement & { set: (value: number) => void };
declare module "react" {
  // React's JSX registry is augmented through its existing namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "sakuga-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { variant?: string; disabled?: boolean };
      "sakuga-checkbox": DetailedHTMLProps<HTMLAttributes<CheckboxElement>, CheckboxElement> & { disabled?: boolean; "data-checked"?: boolean };
      "sakuga-progress": DetailedHTMLProps<HTMLAttributes<ProgressElement>, ProgressElement> & { label?: string; "done-label"?: string };
    }
  }
}

type Kind = "button" | "checkbox" | "progress";
const scripts = new Map<Kind, Promise<void>>();
function useSakuga(kind: Kind) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    if (!scripts.has(kind)) {
      scripts.set(kind, new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `/sakuga-vfx/${kind}.js`;
        script.onload = () => customElements.whenDefined(`sakuga-${kind}`).then(() => {
          const fx = (window as Window & { SakugaFX?: { P: Record<string, string | string[]> } }).SakugaFX;
          if (fx) Object.assign(fx.P, { shade: "#d9c9f5", line: "#8b5bc4", accent: "#a77be9" });
          resolve();
        });
        script.onerror = () => { scripts.delete(kind); reject(new Error("VFX unavailable")); };
        document.head.appendChild(script);
      }));
    }
    scripts.get(kind)?.then(() => { if (active) setReady(true); }).catch(() => {});
    return () => { active = false; };
  }, [kind]);
  return ready;
}

export function SakugaButton({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  const ready = useSakuga("button");
  if (!ready) return <button type="button" className="sakuga-fallback" disabled={disabled} onClick={onClick}>{children}</button>;
  return <sakuga-button className="eureka-sakuga" variant="secondary" disabled={disabled} onClick={() => { if (!disabled) onClick(); }}>{children}</sakuga-button>;
}

export function SakugaCheckbox({ children, checked, onChange, disabled = false }: { children: ReactNode; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const ready = useSakuga("checkbox");
  const ref = useRef<CheckboxElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.checked = checked;
    // Slotted Markdown is not consistently included in the shadow input's name.
    element.shadowRoot?.querySelector("input")?.setAttribute("aria-label", element.textContent?.trim() || "Langkah belajar");
    const change = () => onChange(element.checked);
    element.addEventListener("change", change);
    return () => element.removeEventListener("change", change);
  }, [ready, checked, onChange, children]);
  if (!ready) return <label className="sakuga-fallback-check"><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />{children}</label>;
  return <sakuga-checkbox ref={ref} className="eureka-sakuga" disabled={disabled} data-checked={checked}>{children}</sakuga-checkbox>;
}

export function SakugaProgress({ value, label }: { value: number; label: string }) {
  const ready = useSakuga("progress");
  const ref = useRef<ProgressElement | null>(null);
  useEffect(() => { ref.current?.set(Math.max(0, Math.min(1, value / 100))); }, [ready, value]);
  if (!ready) return <progress aria-label={label} max={100} value={value} />;
  return <sakuga-progress ref={ref} label={label} done-label="Selesai" className="eureka-sakuga eureka-sakuga-progress" />;
}
