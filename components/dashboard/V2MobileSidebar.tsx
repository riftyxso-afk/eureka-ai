"use client";


import Image from "next/image";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Menu from "kubai-icons-react/icons/menu";
import Search from "kubai-icons-react/icons/search";
import X from "kubai-icons-react/icons/circle-x";
import type { AssistantChatSession } from "@/lib/assistant/types";
import BookOpen from "kubai-icons-react/icons/book-open";
import NotebookPen from "kubai-icons-react/icons/notebook-pen";
import Network from "kubai-icons-react/icons/network";
import ListChecks from "kubai-icons-react/icons/list-checks";
import Layers from "kubai-icons-react/icons/layers";
import FolderOpen from "kubai-icons-react/icons/folder-open";
import MessageCircle from "kubai-icons-react/icons/message-circle";
import Headphones from "kubai-icons-react/icons/headphones";
import StickyNote from "kubai-icons-react/icons/sticky-note";
import GraduationCap from "kubai-icons-react/icons/graduation-cap";
import CalendarDays from "kubai-icons-react/icons/calendar-days";
import Trophy from "kubai-icons-react/icons/trophy";
import Grid from "kubai-icons-react/icons/grid";
import Flame from "kubai-icons-react/icons/flame";
import Crown from "kubai-icons-react/icons/crown";
import User from "kubai-icons-react/icons/user";
import { usePremium } from "@/lib/usePremium";

const BASE = "/dashboard-v2";
const navigation = [
  { group: "Utama", label: "Beranda", href: BASE, icon: Grid, color: "#e9b13b" },
  { group: "Utama", label: "Koleksi catatan", href: BASE + "#dv2-notes-title", icon: NotebookPen, premium: true },
  { group: "Utama", label: "Tanya Momo", href: BASE + "/tanya-momo", icon: MessageCircle, color: "#f18d5c", premium: true },
  { group: "Belajar", label: "Mata Pelajaran", href: BASE + "/mata-pelajaran", icon: BookOpen, premium: true },
  { group: "Belajar", label: "Perpustakaan", href: BASE + "/perpustakaan", icon: BookOpen, color: "#e9b13b", premium: true },
  { group: "Belajar", label: "Kursus", href: BASE + "/kursus", icon: GraduationCap, premium: true },
  { group: "Belajar", label: "Jadwal", href: BASE + "/jadwal", icon: CalendarDays, color: "#e9b13b", premium: true },
  { group: "Belajar", label: "Misi", href: BASE + "/misi", icon: Trophy, premium: true },
  { group: "Progres", label: "Aktivitas", href: BASE + "/aktivitas", icon: ListChecks },
  { group: "Progres", label: "Arah Belajar", href: BASE + "/arah-belajar", icon: Network, premium: true },
  { group: "Akun", label: "Profil", href: BASE + "/profil", icon: User },
  { group: "Akun", label: "Paket Pro", href: BASE + "/pricing", icon: Crown },
];
const navigationGroups = ["Utama", "Belajar", "Progres", "Akun"];

export function V2MenuArt({ index }: { index: number }) {
  const Icon = [BookOpen, NotebookPen, Network, ListChecks, Layers, FolderOpen, MessageCircle, Headphones, StickyNote, Flame, User, Crown][index] ?? BookOpen;
  return <span className="v2-menu-art" aria-hidden="true"><Icon size="100%" trigger="parent" color={index === 0 || index === 8 ? "#e9b13b" : index === 6 ? "#f18d5c" : "#8253d4"} /></span>;
}

export default function V2MobileSidebar({ sections = [], sessions, desktop = false }: {
  desktop?: boolean;
  sections?: readonly { id: string; label: string; active: boolean; select: () => void }[];
  sessions?: readonly AssistantChatSession[];
}) {
  const id = useId();
  const { isPremium, loading: planLoading } = usePremium();
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
    if (desktop) return;
    const mobile = window.matchMedia("(max-width: 700px)");
    const handleResize = () => { if (!mobile.matches) dialog.current?.close(); };
    mobile.addEventListener("change", handleResize);
    return () => mobile.removeEventListener("change", handleResize);
  }, [desktop]);

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

  return <div className={`v2-mobile-navigation${desktop ? " is-desktop-enabled" : ""}`}>
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
        <div className="v2-drawer-brand"><strong id={id + "-title"}><Image src="/icons/momo-192.png" alt="" width={32} height={32} className="eureka-brand-mark" />eureka!</strong><span>Ruang belajarmu</span></div>
        <button type="button" aria-label="Tutup sidebar" onClick={close} autoFocus><X size={20} /></button>
      </header>
      <label className="v2-drawer-search"><Search size={17} aria-hidden="true" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={sessions ? "Cari menu atau percakapan…" : "Cari menu…"} aria-label="Cari menu atau chat" />
      </label>
      <nav aria-label="Navigasi Eureka">
        {tabs.length > 0 && <><p className="v2-drawer-label">DALAM CATATAN INI</p>
          <div className="v2-drawer-branch">{tabs.map(item => <button type="button" key={item.id} aria-pressed={item.active} onClick={() => { close(); item.select(); }}>{item.label}</button>)}</div>
        </>}

        {navigationGroups.map(label => ({ label, items: links.filter(item => item.group === label) })).map(group => group.items.length > 0 &&
          <section className="v2-drawer-group" key={group.label} aria-label={group.label}>
            <p className="v2-drawer-label">{group.label}</p>
            {group.items.map(item => {
              const locked = item.premium && !planLoading && !isPremium;
              const Icon = item.icon;
              const active = item.href === BASE ? pathname === BASE
                : !item.href.includes("#") && (pathname === item.href || pathname.startsWith(item.href + "/"));
              return <Link key={item.href} href={item.href} onClick={follow} aria-current={active ? "page" : undefined}>
                <span className="v2-menu-art" aria-hidden="true"><Icon size="100%" trigger="parent" color={item.color ?? "#8253d4"} /></span><span>{item.label}</span>
                {locked && <span className="v2-drawer-pro">Pro</span>}
                {active && <span className="v2-drawer-active-dot" aria-hidden="true" />}
              </Link>;
            })}
          </section>
        )}
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
