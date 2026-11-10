"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { prepareInstalledAccount } from "@/lib/installedAccount";
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
  const [accountReady, setAccountReady] = useState(false);
  async function prepare(copy = false) {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    try {
      const result = await prepareInstalledAccount(copy);
      setAccountReady(true);
      if (copy && result.ticket) {
        const url = new URL("/id/auth/import", window.location.origin);
        url.hash = new URLSearchParams({ account: result.ticket }).toString();
        await navigator.clipboard.writeText(url.toString());
        setMessage("Tautan disalin. Di Eureka dari layar utama, pilih Impor akun lalu tempel tautan ini. Jangan bagikan tautan ke orang lain.");
      } else {
        setMessage("Akun siap dibawa selama 10 menit. Sekarang tambahkan Eureka ke layar utama, lalu buka ikonnya.");
      }
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Akun belum bisa disiapkan.");
      return false;
    } finally { setBusy(false); }
  }
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
    if (!accountReady && !await prepare()) return;
    setBusy(true);
    try { await prompt.prompt(); const result = await prompt.userChoice; setPrompt(null); if (result.outcome === "accepted") close(); else setMessage("Kamu bisa mencoba lagi lewat menu browser."); }
    catch { setMessage("Gunakan langkah manual di atas untuk menambah Eureka."); setPrompt(null); }
    finally { setBusy(false); }
  }
  async function advance() {
    if (step < 2) {
      if (!accountReady && !await prepare()) return;
      setStep(step + 1);
    } else if (platform === "android" && prompt) await install();
    else close();
  }
  const slides = platform === "ios" ? [
    ["Siapkan akun di Safari", "Ketuk Siapkan akun sebelum menambahkan Eureka. Gunakan alamat Eureka yang sedang kamu buka.", "Safari"],
    ["Buka menu Bagikan", "Ketuk tombol Bagikan di toolbar Safari. Gulir menu jika pilihannya belum terlihat.", "Bagikan ↑"],
    ["Tambahkan ke Layar Utama", "Pilih Tambah ke Layar Utama, lalu ketuk Tambah. Buka Eureka lewat ikon Momo di layar HP.", "+ Tambah ke Layar Utama"],
  ] : [
    ["Bawa akunmu ke Eureka", "Siapkan akun terlebih dahulu, lalu pasang Eureka dari Chrome di HP Android.", "Chrome"],
    ["Pilih instal aplikasi", "Ketuk menu ⋮ di Chrome, lalu pilih Instal aplikasi atau Tambahkan ke layar utama.", "⋮  Menu browser"],
    ["Eureka siap di layar utama", "Konfirmasikan Instal atau Tambah. Ikon Momo akan muncul di layar utama atau daftar aplikasi HP.", "+ Tambahkan Eureka"],
  ];
  if (!available) return null;
  return <>
    <button className="eureka-install-trigger" type="button" onClick={() => { setStep(0); setMessage(""); dialog.current?.showModal(); }} aria-haspopup="dialog">Tambah ke layar utama</button>
    <dialog className="eureka-install-dialog" ref={dialog} aria-labelledby="install-title" onCancel={event => { event.preventDefault(); close(); }}>
      <button type="button" className="install-close" aria-label="Tutup panduan" onClick={close}>×</button>
      <div className="install-platforms" aria-label="Pilih perangkat">{(["ios", "android"] as const).map(value => <button type="button" key={value} aria-pressed={platform === value} onClick={() => { setPlatform(value); setStep(0); }}>{value === "ios" ? "iPhone / iPad" : "Android"}</button>)}</div>
      {platform === "ios" && <figure className="install-video">
        <video controls playsInline preload="none" aria-label="Video cara menambahkan Eureka ke layar utama iPhone">
          <source src="/tutorials/add-to-home-ios.mp4" type="video/mp4" />
          Browser ini belum mendukung video.
        </video>
        <figcaption>Ikuti langkah di video setelah menyiapkan akun.</figcaption>
      </figure>}
      <div className="install-preview" aria-hidden="true"><Image src="/icons/momo-192.png" width={80} height={80} alt="" /><strong>Eureka</strong><span key={`${platform}-${step}`} className="install-preview-hint">{slides[step][2]}</span></div>
      <div className="install-slide" key={`${platform}-${step}`} aria-live="polite" onTouchStart={event => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={event => { if (touchStart.current === null) return; const delta = event.changedTouches[0].clientX - touchStart.current; touchStart.current = null; if (Math.abs(delta) > 50) setStep(current => Math.max(0, Math.min(2, current + (delta < 0 ? 1 : -1)))); }}><small>LANGKAH {step + 1} DARI 3</small><h2 id="install-title">{slides[step][0]}</h2><p>{slides[step][1]}</p></div>
      <div className="install-dots" aria-label="Langkah panduan">{slides.map((_, i) => <button key={i} type="button" aria-label={`Langkah ${i + 1}`} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)} />)}</div>
      <div className="install-account-actions">
        <button type="button" disabled={busy} onClick={() => void prepare()}>{busy ? "Menyiapkan…" : accountReady ? "Siapkan ulang akun" : "Siapkan akun untuk aplikasi"}</button>
        <button type="button" disabled={busy} onClick={() => void prepare(true)}>Salin tautan impor</button>
        <p>Akun dan semua datanya tetap sama. Jika ikon sudah terpasang dan belum masuk, gunakan tautan impor di halaman masuk aplikasi.</p>
      </div>
      <div className="install-actions"><button type="button" onClick={() => step ? setStep(step - 1) : close()}>{step ? "Kembali" : "Nanti saja"}</button><button type="button" onClick={() => void advance()} disabled={busy}>{busy ? "Menyiapkan…" : step < 2 ? "Lanjut →" : platform === "android" && prompt ? "Instal Eureka" : "Mengerti"}</button></div>
      {message && <p role="status" className="install-status">{message}</p>}
    </dialog>
  </>;
}
