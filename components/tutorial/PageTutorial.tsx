"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { getUserId } from "@/lib/identity";
import { guideForPath, PAGE_GUIDES, type PageGuideId } from "@/lib/pageGuides";
import { PAGE_TOURS, type GuideStep } from "@/lib/pageGuideTours";
import "./page-tutorial.css";

const seenInTab = new Set<string>();
const PREFIX = "eureka:page-guide:v2:";
export const OPEN_GUIDE_EVENT = "eureka:open-guide";
function visibleTarget(selector: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(node => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).opacity !== "0";
  }) ?? null;
}

export default function PageTutorial({ guideId, ready = true }: { guideId?: PageGuideId; ready?: boolean }) {
  const pathname = usePathname();
  const id = guideId ?? guideForPath(pathname);
  return id && ready ? <PageTour key={id + pathname} id={id} /> : null;
}

// Each real workflow state gets its own short guide, including generated results.
function PageTour({ id }: { id: PageGuideId }) {
  const [phase, setPhase] = useState("page");
  useEffect(() => {
    const inspect = () => {
      const states: Partial<Record<PageGuideId, [string, string][]>> = {
        "room-quiz": [["results", ".sp-results"], ["practice", ".sp-practice"], ["setup", ".sp-setup"]],
        "room-cards": [["results", ".sp-results"], ["practice", ".rf-practice"], ["setup", ".sp-setup"]],
        books: [["story", ".story-studio"], ["catalog", ".library-search"]],
        schedule: [["form", ".quest-form"], ["calendar", ".quest-calendar-panel"], ["tasks", ".quest-task-list"], ["week", ".quest-week-list"], ["map", ".quest-map"]],
      };
      const next = states[id]?.find(([, selector]) => visibleTarget(selector));
      if (next) setPhase(next[0]); // Keep the previous state during network loading.
    };
    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);
  return <Tour key={id + phase} id={id} phase={phase} />;
}

function Tour({ id, phase }: { id: PageGuideId; phase: string }) {
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<{left:number;top:number;width:number;height:number} | null>(null);
  const [viewport, setViewport] = useState({ width: 390, height: 844 });
  const [cardHeight, setCardHeight] = useState(210);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const openedDrawer = useRef<HTMLDialogElement | null>(null);
  const key = useRef("");
  const active = steps.length > 0;
  const current = steps[index];
  const dismiss = useCallback(() => {
    if (key.current) {
      seenInTab.add(key.current);
      try { localStorage.setItem(key.current, "seen"); } catch { /* Tab memory still works. */ }
    }
    openedDrawer.current?.close(); openedDrawer.current = null;
    setSteps([]); setRect(null);
    requestAnimationFrame(() => launcher.current?.focus({ preventScroll: true }));
  }, []);
  const start = useCallback(() => {
    if (document.querySelector("[data-eureka-tour], dialog[open], [aria-modal=true]")) return;
    const available = PAGE_TOURS[id].filter(step => visibleTarget(step.target) || (step.sidebar && visibleTarget(".v2-mobile-menu-toggle")));
    if (!available.length) return false;
    key.current = PREFIX + getUserId() + ":" + id + ":" + phase;
    setIndex(0); setRect(null); setSteps(available);
    return true;
  }, [id, phase]);
  useEffect(() => {
    const storageKey = PREFIX + getUserId() + ":" + id + ":" + phase;
    key.current = storageKey;
    let seen = seenInTab.has(storageKey);
    try {
      seen ||= localStorage.getItem(storageKey) === "seen";
      // Workflow guides are new; prior menu-only tours do not suppress them.
    } catch { /* Storage is optional. */ }
    const onRequest = (event: Event) => { if ((event as CustomEvent).detail === id) start(); };
    window.addEventListener(OPEN_GUIDE_EVENT, onRequest);
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!seen) timer = setInterval(() => {
      if (seenInTab.has(storageKey)) { clearInterval(timer); return; }
      if (document.hidden || visibleTarget(".momo-splash") || document.querySelector("[data-eureka-tour], dialog[open], [aria-modal=true]") || document.activeElement?.matches("input,textarea,[contenteditable=true]")) return;
      if (document.querySelector("[aria-busy=true]")) return;
      if (start()) clearInterval(timer);
    }, 900);
    return () => { clearInterval(timer); window.removeEventListener(OPEN_GUIDE_EVENT, onRequest); };
  }, [id, phase, start]);

  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); dismiss(); } };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => card.current?.focus({ preventScroll: true }));
    return () => { document.removeEventListener("keydown", onKey); openedDrawer.current?.close(); openedDrawer.current = null; previous?.focus({ preventScroll: true }); };
  }, [active, dismiss]);

  useLayoutEffect(() => {
    if (!active || !current) return;
    let raf = 0, scrolled = false;
    if (current.sidebar) {
      const drawer = document.querySelector<HTMLDialogElement>(".v2-mobile-drawer");
      const button = document.querySelector<HTMLElement>(".v2-mobile-menu-toggle");
      if (drawer && button && visibleTarget(".v2-mobile-menu-toggle") && !drawer.open) {
        button.click(); openedDrawer.current = drawer;
      }
      // The native modal makes siblings inert. Keep guide controls in its DOM.
      setPortalHost(drawer?.open ? drawer : null);
    } else if (openedDrawer.current?.open) {
      openedDrawer.current.close(); openedDrawer.current = null;
      setPortalHost(null);
    } else {
      setPortalHost(null);
    }
    const measure = () => {
      // Include newly opened forms and generated controls without restarting the tour.
      setSteps(previous => {
        const known = new Set(previous.map(item => item.target));
        const added = PAGE_TOURS[id].filter(item => !known.has(item.target) && visibleTarget(item.target));
        return added.length ? [...previous, ...added] : previous;
      });
      const target = visibleTarget(current.target);
      if (target && !scrolled) {
        scrolled = true;
        target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      }
      const box = target?.getBoundingClientRect();
      setRect(box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null);
      setViewport({ width: innerWidth, height: window.visualViewport?.height ?? innerHeight });
      if (card.current) setCardHeight(card.current.offsetHeight);
    };
    const update = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(update); observer.observe(document.documentElement);
    if (card.current) observer.observe(card.current);
    const mutation = new MutationObserver(update); mutation.observe(document.body, { childList: true, subtree: true });
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || card.current?.contains(event.target)) return;
      const target = visibleTarget(current.target);
      if (target && target.contains(event.target) && event.target.closest("a,button")) {
        requestAnimationFrame(() => { if (index === steps.length - 1) dismiss(); else setIndex(i => i + 1); });
      }
    };
    document.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    document.addEventListener("animationend", update, true); document.addEventListener("transitionend", update, true);
    window.visualViewport?.addEventListener("resize", update); document.addEventListener("click", onClick, true);
    return () => { observer.disconnect(); mutation.disconnect(); cancelAnimationFrame(raf); document.removeEventListener("scroll", update, true); document.removeEventListener("animationend", update, true); document.removeEventListener("transitionend", update, true); window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); document.removeEventListener("click", onClick, true); };
  }, [active, current, index, steps.length, dismiss, portalHost, id]);

  // A manual popover stays above native sidebars without making page controls inert.
  useLayoutEffect(() => {
    if (!active || !layer.current) return;
    const node = layer.current;
    if (typeof node.showPopover === "function") {
      if (node.matches(":popover-open")) node.hidePopover();
      node.showPopover();
    }
  }, [active, index, portalHost]);

  const width = Math.min(330, viewport.width - 32);
  const x = Math.max(16, Math.min((rect ? rect.left + rect.width / 2 : viewport.width / 2) - width / 2, viewport.width - width - 16));
  const below = rect ? rect.top + rect.height + cardHeight + 60 < viewport.height : true;
  const y = Math.max(16, Math.min(rect ? below ? rect.top + rect.height + 48 : rect.top - cardHeight - 48 : 90, viewport.height - cardHeight - 16));
  const endX = rect ? Math.max(10, Math.min(rect.left + rect.width / 2, viewport.width - 10)) : 0;
  const endY = rect ? Math.max(8, Math.min(below ? rect.top + rect.height + 7 : rect.top - 7, viewport.height - 8)) : 0;
  const startX = x + Math.min(44, width / 2), startY = below ? y - 4 : y + cardHeight + 4;
  const bend = below ? -24 : 24;

  return <>
    <button ref={launcher} type="button" className="page-guide-launcher" aria-label={"Panduan " + PAGE_GUIDES[id].label} aria-haspopup="dialog" onClick={start}>
      <CircleHelp size={17} aria-hidden="true" /><span>Panduan</span>
    </button>
    {active && createPortal(<div ref={layer} popover="manual" className="eureka-tour" data-eureka-tour={id}>
      {rect && <><div className="eureka-tour-target" style={{ left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 }} />
        <svg className="eureka-tour-arrow" width={viewport.width} height={viewport.height} aria-hidden="true"><defs><marker id={"guide-arrow-" + id} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M1 1 Q5 5 1 9 M1 1 L8 5 L1 9" /></marker></defs><path key={index} d={"M " + startX + " " + startY + " C " + (startX - 35) + " " + (startY + bend) + ", " + (endX - 35) + " " + (endY - bend) + ", " + endX + " " + endY} markerEnd={"url(#guide-arrow-" + id + ")"} /></svg></>}
      <div ref={card} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby={"guide-title-" + id} aria-describedby={"guide-text-" + id} className="eureka-tour-card" style={{ left: x, top: y, width }}>
        <button type="button" className="eureka-tour-close" aria-label="Tutup panduan" onClick={dismiss}><X size={17} /></button>
        <span className="eureka-tour-number">{String(index + 1).padStart(2, "0")} / {steps.length} · {PAGE_GUIDES[id].label}</span>
        <div key={index} className="eureka-tour-copy" aria-live="polite"><h2 id={"guide-title-" + id}>{current.title}</h2><p id={"guide-text-" + id}>{current.text}</p></div>
        {!rect && <p className="eureka-tour-unavailable">Bagian ini belum tampil. Kamu bisa melanjutkan ke langkah berikutnya.</p>}
        <div className="eureka-tour-actions"><button type="button" aria-label="Langkah sebelumnya" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ArrowLeft size={16} /></button><button type="button" className="eureka-tour-skip" onClick={dismiss}>Nanti saja</button><button type="button" className="eureka-tour-next" onClick={() => index === steps.length - 1 ? dismiss() : setIndex(i => i + 1)}>{index === steps.length - 1 ? "Selesai" : "Lanjut"}<ArrowRight size={16} /></button></div>
      </div>
    </div>, portalHost ?? document.body)}
  </>;
}
