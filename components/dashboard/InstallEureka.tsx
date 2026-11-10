"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import "./install-eureka.css";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const SEEN = "eureka:install-guide:v1";

export default function InstallEureka() {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android">("android");
  const [available, setAvailable] = useState(false);
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)");
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const mobile = ios || /Android/.test(navigator.userAgent);
    setPlatform(ios ? "ios" : "android");
    const installed = () => { setAvailable(false); dialog.current?.close(); setPrompt(null); };
    const update = () => { const active = standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone); setAvailable(mobile && !active); if (active) installed(); };
    update();
    const before = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", installed);
    standalone.addEventListener("change", update);
    return () => { window.removeEventListener("beforeinstallprompt", before); window.removeEventListener("appinstalled", installed); standalone.removeEventListener("change", update); };
  }, []);
  useEffect(() => {
    if (!available) return;
    let seen = true;
    try { seen = !!localStorage.getItem(SEEN); } catch { /* Manual trigger remains available. */ }
    if (seen) return;
    // Wait until another tutorial has closed before offering installation.
    const timer = window.setInterval(() => {
      if (document.querySelector("dialog[open]")) return;
      dialog.current?.showModal();
      window.clearInterval(timer);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [available]);
  function close() { dialog.current?.close(); try { localStorage.setItem(SEEN, "seen"); } catch {} }
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try { await prompt.prompt(); const result = await prompt.userChoice; setPrompt(null); if (result.outcome === "accepted") close(); else setMessage("Kamu bisa mencoba lagi lewat menu browser."); }
    catch { setMessage("Gunakan langkah manual di atas untuk menambah Eureka."); setPrompt(null); }
    finally { setBusy(false); }
  }
  const slides = platform === "ios" ? [
    ["Buka Eureka di Safari", "Gunakan Safari di iPhone atau iPad, lalu buka www.eureka-ai.web.id.", "Safari"],
    ["Buka menu Bagikan", "Ketuk tombol Bagikan di toolbar Safari. Gulir menu jika pilihannya belum terlihat.", "Bagikan ↑"],
    ["Tambahkan ke Layar Utama", "Pilih Tambah ke Layar Utama, lalu ketuk Tambah. Buka Eureka lewat ikon Momo di layar HP.", "+ Tambah ke Layar Utama"],
  ] : [
    ["Buka Eureka di Chrome", "Buka www.eureka-ai.web.id menggunakan Chrome di HP Android.", "Chrome"],
    ["Pilih instal aplikasi", "Ketuk menu ⋮ di Chrome, lalu pilih Instal aplikasi atau Tambahkan ke layar utama.", "⋮  Menu browser"],
    ["Eureka siap di layar utama", "Konfirmasikan Instal atau Tambah. Ikon Momo akan muncul di layar utama atau daftar aplikasi HP.", "+ Tambahkan Eureka"],
  ];
  if (!available) return null;
  return <>
    <button className="eureka-install-trigger" type="button" onClick={() => { setStep(0); setMessage(""); dialog.current?.showModal(); }} aria-haspopup="dialog">Tambah ke layar utama</button>
    <dialog className="eureka-install-dialog" ref={dialog} aria-labelledby="install-title" onCancel={event => { event.preventDefault(); close(); }}>
      <button type="button" className="install-close" aria-label="Tutup panduan" onClick={close}>×</button>
      <div className="install-platforms" aria-label="Pilih perangkat">{(["ios", "android"] as const).map(value => <button type="button" key={value} aria-pressed={platform === value} onClick={() => { setPlatform(value); setStep(0); }}>{value === "ios" ? "iPhone / iPad" : "Android"}</button>)}</div>
      <div className="install-preview" aria-hidden="true"><Image src="/icons/momo-192.png" width={80} height={80} alt="" /><strong>Eureka</strong><span key={`${platform}-${step}`} className="install-preview-hint">{slides[step][2]}</span></div>
      <div className="install-slide" key={`${platform}-${step}`} aria-live="polite" onTouchStart={event => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={event => { if (touchStart.current === null) return; const delta = event.changedTouches[0].clientX - touchStart.current; touchStart.current = null; if (Math.abs(delta) > 50) setStep(current => Math.max(0, Math.min(2, current + (delta < 0 ? 1 : -1)))); }}><small>LANGKAH {step + 1} DARI 3</small><h2 id="install-title">{slides[step][0]}</h2><p>{slides[step][1]}</p></div>
      <div className="install-dots" aria-label="Langkah panduan">{slides.map((_, i) => <button key={i} type="button" aria-label={`Langkah ${i + 1}`} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)} />)}</div>
      <div className="install-actions"><button type="button" onClick={() => step ? setStep(step - 1) : close()}>{step ? "Kembali" : "Nanti saja"}</button><button type="button" onClick={() => step < 2 ? setStep(step + 1) : platform === "android" && prompt ? void install() : close()} disabled={busy}>{busy ? "Membuka…" : step < 2 ? "Lanjut →" : platform === "android" && prompt ? "Instal Eureka" : "Mengerti"}</button></div>
      {message && <p role="status" className="install-status">{message}</p>}
    </dialog>
  </>;
}
