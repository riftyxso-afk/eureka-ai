"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowRight, CircleHelp, Film, Play, X } from "lucide-react";
import { getUserId } from "@/lib/identity";
import { guideForPath, PAGE_GUIDES, type PageGuide, type PageGuideId } from "@/lib/pageGuides";
import "./page-tutorial.css";

// Also remember within this tab when private browsing blocks persistent storage.
const dismissed = new Set<string>();
const SEEN_PREFIX = "eureka:page-guide:v1:";
const subscribeToMount = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function PageTutorial({ guideId, ready = true }: { guideId?: PageGuideId; ready?: boolean }) {
  const pathname = usePathname();
  const id = guideId ?? guideForPath(pathname);
  if (!id || !ready) return null;
  return <Tutorial key={id} id={id} guide={PAGE_GUIDES[id]} />;
}

function Tutorial({ id, guide }: { id: PageGuideId; guide: PageGuide }) {
  const mounted = useSyncExternalStore(subscribeToMount, clientSnapshot, serverSnapshot);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const storageKey = useRef("");
  const focusAfterClose = useRef(false);

  useEffect(() => {
    const key = `${SEEN_PREFIX}${getUserId()}:${id}`;
    storageKey.current = key;
    let seen = dismissed.has(key);
    try { seen ||= localStorage.getItem(key) === "seen"; } catch { /* In-memory fallback remains available. */ }
    if (seen) return;
    // Avoid covering another dialog or interrupting someone already typing.
    const timer = window.setInterval(() => {
      if (document.hidden || document.querySelector("dialog[open], [role='dialog'][aria-modal='true']")) return;
      if (document.activeElement?.matches("input, textarea, [contenteditable='true']")) return;
      window.clearInterval(timer);
      setOpen(true);
    }, 700);
    return () => window.clearInterval(timer);
  }, [id]);

  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    node.showModal();
    return () => {
      node.querySelector("video")?.pause();
      if (node.open) node.close();
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [open, mounted]);

  function dismiss(focusTarget = false) {
    const key = storageKey.current;
    dismissed.add(key);
    try { localStorage.setItem(key, "seen"); } catch { /* Tutorial dismissal should still work without storage. */ }
    focusAfterClose.current = focusTarget;
    dialog.current?.close();
    setOpen(false);
  }

  function afterClose() {
    if (!focusAfterClose.current) return;
    focusAfterClose.current = false;
    requestAnimationFrame(() => {
      const target = (guide.target ? document.querySelector<HTMLElement>(guide.target) : null)
        ?? document.querySelector<HTMLElement>("main h1, .sr-main h1, h1");
      if (!target) return;
      if (!target.matches("button, a, input, textarea, select, [contenteditable='true'], [tabindex]")) target.tabIndex = -1;
      target.scrollIntoView({ block: "center", behavior: "instant" });
      target.focus({ preventScroll: true });
    });
  }

  return <>
    <button type="button" className="page-guide-launcher" aria-label={`Panduan ${guide.label}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <CircleHelp size={17} aria-hidden="true" /><span>Panduan</span>
    </button>
    {mounted && createPortal(<dialog ref={dialog} className="page-guide-dialog" aria-labelledby={`page-guide-title-${id}`} aria-describedby={`page-guide-description-${id}`}
      onCancel={event => { event.preventDefault(); dismiss(); }} onClose={afterClose}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex='0']")].filter(element => element.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss(); } }}>
      <div className="page-guide-card">
        <button type="button" className="page-guide-close" aria-label="Tutup panduan" autoFocus onClick={() => dismiss()}><X size={20} aria-hidden="true" /></button>
        <div className="page-guide-media">
          {guide.recording ? <video controls playsInline preload="none" poster={guide.recording.poster} aria-label={`Video panduan ${guide.label}`} src={guide.recording.src} /> : <div className="page-guide-placeholder" role="img" aria-label={`Placeholder rekaman layar untuk ${guide.label}`}>
            <div className="page-guide-window-bar" aria-hidden="true"><i /><i /><i /><span>eureka! / {guide.label}</span></div>
            <div className="page-guide-placeholder-body"><span className="page-guide-play" aria-hidden="true"><Play size={26} fill="currentColor" /></span><strong>Kenali {guide.label.replace(" · Beta", "").toLowerCase()}</strong><span>Rekaman layar akan hadir di sini</span><small><Film size={13} aria-hidden="true" /> Video tutorial segera tersedia</small></div>
          </div>}
        </div>
        <div className="page-guide-copy">
          <p className="page-guide-eyebrow">PANDUAN {guide.label.toUpperCase()}</p>
          <h2 id={`page-guide-title-${id}`}>{guide.title}</h2>
          <p id={`page-guide-description-${id}`} className="page-guide-description">{guide.description}</p>
          <ol className="page-guide-steps">{guide.steps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span>{step}</li>)}</ol>
          <div className="page-guide-actions"><button type="button" className="page-guide-primary" onClick={() => dismiss(true)}>{guide.action}<ArrowRight size={18} aria-hidden="true" /></button><button type="button" className="page-guide-later" onClick={() => dismiss()}>Nanti saja</button></div>
          <p className="page-guide-footnote">Buka ulang kapan saja lewat tombol Panduan.</p>
        </div>
      </div>
    </dialog>, document.body)}
  </>;
}
