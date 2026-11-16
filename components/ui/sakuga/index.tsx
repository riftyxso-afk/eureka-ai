"use client";
import { useEffect, useRef, useState, type ReactNode, type DetailedHTMLProps, type HTMLAttributes, type Ref } from "react";
import "./sakuga.css";
import { loadSakuga, type SakugaKind } from "@/lib/sound/sakugaFeedback";

type CheckboxElement = HTMLElement & { checked: boolean };
type ProgressElement = HTMLElement & { set: (value: number, instant?: boolean) => void };
export type SakugaButtonElement = HTMLElement & { done: (hold?: number) => void };
export type SakugaToastElement = HTMLElement & { show: (message: string) => void; hide: () => void };
type ValueElement<T> = HTMLElement & { value: T };
type Control<T extends HTMLElement> = DetailedHTMLProps<HTMLAttributes<T>, T>;
declare module "react" {
  // React's JSX registry is augmented through its existing namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "sakuga-button": Control<SakugaButtonElement> & { variant?: string; disabled?: boolean; type?: string };
      "sakuga-checkbox": Control<CheckboxElement> & { name?: string; disabled?: boolean; "data-checked"?: boolean };
      "sakuga-progress": DetailedHTMLProps<HTMLAttributes<ProgressElement>, ProgressElement> & { label?: string; "done-label"?: string };
      "sakuga-radio": Control<ValueElement<string>> & { label?: string; name?: string; value?: string };
      "sakuga-rating": Control<ValueElement<number>> & { label?: string; name?: string; disabled?: boolean };
      "sakuga-input": Control<ValueElement<string>> & { label?: string; name?: string; type?: string; placeholder?: string };
      "sakuga-toast": Control<SakugaToastElement> & { duration?: string };
    }
  }
}

export function useSakuga(kind: SakugaKind) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void loadSakuga(kind).then(() => { if (active) setReady(true); }).catch(() => {});
    return () => { active = false; };
  }, [kind]);
  return ready;
}

export function SakugaButton({ children, onClick, disabled = false, variant = "secondary", type = "button", className = "", buttonRef, fallbackHref }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "secondary"; type?: "button" | "submit";
  className?: string; buttonRef?: Ref<SakugaButtonElement>; fallbackHref?: string;
}) {
  const ready = useSakuga("button");
  const style = `eureka-sakuga sakuga-action ${className}`;
  if (!ready) return fallbackHref
    ? <a className={`${style} sakuga-fallback`} data-variant={variant} href={fallbackHref}>{children}</a>
    : <button type={type} className={`${style} sakuga-fallback`} data-variant={variant} disabled={disabled} onClick={onClick}>{children}</button>;
  return <>
    {type === "submit" && <button type="submit" hidden disabled={disabled} tabIndex={-1} />}
    <sakuga-button ref={buttonRef} className={style} data-variant={variant} variant={variant === "secondary" ? variant : undefined}
      type={type} disabled={disabled} onClick={() => { if (!disabled) onClick?.(); }}>{children}</sakuga-button>
  </>;
}

export async function confirmSakugaButton(button: SakugaButtonElement | null) {
  if (!button) return;
  button.done();
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

export function SakugaCheckbox({ children, checked, onChange, name, disabled = false }: { children: ReactNode; checked: boolean; onChange: (value: boolean) => void; name?: string; disabled?: boolean }) {
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
  if (!ready) return <label className="sakuga-fallback-check"><input type="checkbox" name={name} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />{children}</label>;
  return <sakuga-checkbox ref={ref} className="eureka-sakuga" name={name} disabled={disabled} data-checked={checked}>{children}</sakuga-checkbox>;
}

export function SakugaProgress({ value, label, onDone }: { value: number; label: string; onDone?: () => void }) {
  const ready = useSakuga("progress");
  const ref = useRef<ProgressElement | null>(null);
  const announced = useRef(false);
  useEffect(() => {
    const el = ref.current;
    const done = () => { if (!announced.current) { announced.current = true; onDone?.(); } };
    el?.addEventListener("sakuga:done", done);
    if (el) el.set(Math.max(0, Math.min(1, value / 100)), matchMedia("(prefers-reduced-motion: reduce)").matches);
    else if (value >= 100) done();
    return () => el?.removeEventListener("sakuga:done", done);
  }, [ready, value, onDone]);
  if (!ready) return <progress aria-label={label} max={100} value={value} />;
  return <sakuga-progress ref={ref} label={label} done-label="Selesai" className="eureka-sakuga eureka-sakuga-progress" />;
}

function useValue<T extends string | number>(kind: "radio" | "rating" | "input", value: T, onChange: (value: T) => void) {
  const ready = useSakuga(kind);
  const ref = useRef<ValueElement<T>>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.value !== value) el.value = value;
    const event = kind === "input" ? "input" : "change";
    const change = () => onChange(el.value);
    el.addEventListener(event, change);
    return () => el.removeEventListener(event, change);
  }, [ready, kind, value, onChange]);
  return { ready, ref };
}

export function SakugaRadio({ label, name, options, value, onChange }: {
  label: string; name?: string; options: readonly { id: string; label: string }[]; value: string; onChange: (value: string) => void;
}) {
  const { ready, ref } = useValue("radio", value, onChange);
  useEffect(() => {
    ref.current?.shadowRoot?.querySelectorAll("input").forEach(input => {
      const option = options.find(item => item.id === input.value);
      if (option) input.setAttribute("aria-label", option.label);
    });
  }, [options, ready, ref]);
  const choices = options.map(option => <option key={option.id} value={option.id}>{option.label}</option>);
  if (!ready) return <select aria-label={label} name={name} value={value} onChange={event => onChange(event.target.value)}>{choices}</select>;
  return <sakuga-radio key={options.map(option => `${option.id}:${option.label}`).join("|")} ref={ref} className="eureka-sakuga" label={label} name={name} value={value}>{choices}</sakuga-radio>;
}

export function SakugaRating({ label, name, value, onChange, disabled }: { label: string; name?: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const { ready, ref } = useValue("rating", value, onChange);
  if (!ready) return <div className="sakuga-rating-fallback" role="group" aria-label={label}>{[1, 2, 3, 4, 5].map(score => <button type="button" key={score}
    aria-label={`${score} dari 5`} aria-pressed={value === score} disabled={disabled} onClick={() => onChange(value === score ? 0 : score)}>{score <= value ? "★" : "☆"}</button>)}
    {name && value > 0 && <input type="hidden" name={name} value={value} disabled={disabled} />}
  </div>;
  return <sakuga-rating ref={ref} className="eureka-sakuga" label={label} name={name} disabled={disabled} />;
}

export function SakugaInput({ label, name, placeholder, value, onChange }: { label: string; name?: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  const { ready, ref } = useValue("input", value, onChange);
  if (!ready) return <input type="search" name={name} aria-label={label} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} />;
  return <sakuga-input className="eureka-sakuga sakuga-search" ref={ref} type="search" label={label} name={name} placeholder={placeholder} />;
}
