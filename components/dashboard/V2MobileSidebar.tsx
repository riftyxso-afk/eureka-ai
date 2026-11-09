"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import type { AssistantChatSession } from "@/lib/assistant/types";

const BASE = "/dashboard-v2";
const navigation = [
  { label: "Beranda", href: BASE, image: 0 },
  { label: "Koleksi catatan", href: BASE + "#dv2-notes-title", image: 1 },
  { label: "Tanya Momo", href: BASE + "/tanya-momo", image: 6 },
  { label: "Mata Pelajaran", href: BASE + "/mata-pelajaran", image: 2 },
  { label: "Misi", href: BASE + "/misi", image: 3 },
  { label: "Jadwal", href: BASE + "/jadwal", image: 8 },
  { label: "Kursus", href: BASE + "/kursus", image: 4 },
];

export function V2MenuArt({ index }: { index: number }) {
  return <span className="v2-menu-art" aria-hidden="true" style={{
    backgroundPosition: `${index % 3 * 50}% ${Math.floor(index / 3) * 50}%`,
  }} />;
}

export default function V2MobileSidebar({ sections = [], sessions }: {
  sections?: readonly { id: string; label: string; active: boolean; select: () => void }[];
  sessions?: readonly AssistantChatSession[];
}) {
  const id = useId();
  const pathname = usePathname().replace(/^\/(id|en)(?=\/)/, "");
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filter = (label: string) => label.toLowerCase().includes(query.trim().toLowerCase());
  const links = navigation.filter(item => filter(item.label));
  const tabs = sections.filter(item => filter(item.label));
  const history = sessions?.filter(session => filter(session.title || "Percakapan baru"));
  const showNewChat = sessions !== undefined && filter("Chat baru");

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 700px)");
    const handleResize = () => { if (!mobile.matches) dialog.current?.close(); };
    mobile.addEventListener("change", handleResize);
    return () => mobile.removeEventListener("change", handleResize);
  }, []);

  function show() {
    dialog.current?.showModal();
    setOpen(true);
  }
  function close() {
    dialog.current?.close();
  }
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) close();
  }

  return <div className="v2-mobile-navigation">
    <button type="button" className="v2-mobile-menu-toggle" aria-label="Buka sidebar"
      aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={show}><Menu size={21} /></button>
    <dialog ref={dialog} id={id} className="v2-mobile-drawer" aria-labelledby={id + "-title"}
      onClose={() => { setOpen(false); setQuery(""); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const { right } = event.currentTarget.getBoundingClientRect();
        if (event.clientX >= right) close();
      }}>
      <header className="v2-drawer-heading">
        <strong id={id + "-title"}>eureka!</strong>
        <button type="button" aria-label="Tutup sidebar" onClick={close} autoFocus><X size={20} /></button>
      </header>
      <div className="v2-drawer-cover">
        <Image src="/onboarding/eureka-welcome.png" alt="" fill sizes="300px" />
        <span>Ruang belajarmu</span>
      </div>
      <label className="v2-drawer-search"><Search size={17} aria-hidden="true" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari menu atau chat" aria-label="Cari menu atau chat" />
      </label>
      <nav aria-label="Navigasi mobile Eureka">
        {links.length > 0 && <><p className="v2-drawer-label">RUANG BELAJAR</p>
          {links.map(item => {
            const active = item.href === BASE
              ? pathname === BASE
              : !item.href.includes("#") && (pathname === item.href || pathname.startsWith(item.href + "/"));
            return <Link key={item.href} href={item.href} onClick={follow} aria-current={active ? "page" : undefined}>
              <V2MenuArt index={item.image} />{item.label}
            </Link>;
          })}
        </>}
        {tabs.length > 0 && <><p className="v2-drawer-label">DALAM CATATAN INI</p>
          <div className="v2-drawer-branch">{tabs.map(item => <button type="button" key={item.id} aria-pressed={item.active} onClick={() => { close(); item.select(); }}>{item.label}</button>)}</div>
        </>}
        {(showNewChat || !!history?.length) && <><p className="v2-drawer-label">PERCAKAPAN</p>
          {showNewChat && <Link href={BASE + "/tanya-momo"} onClick={follow}>+ Chat baru</Link>}
          <div className="v2-drawer-branch">{history?.map(session => {
            const href = BASE + "/tanya-momo/" + encodeURIComponent(session.id);
            return <Link key={session.id} href={href} onClick={follow} aria-current={pathname === href ? "page" : undefined}>{session.title || "Percakapan baru"}</Link>;
          })}</div>
        </>}
        {!links.length && !tabs.length && !history?.length && !showNewChat && query.trim() && <p className="v2-drawer-label" role="status">Tidak ada hasil.</p>}
      </nav>
    </dialog>
  </div>;
}
