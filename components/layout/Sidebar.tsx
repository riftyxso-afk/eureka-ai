"use client";

import { toast } from "@yusufceng1z/ding-react";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlarmClock,
  BookOpen,
  CalendarDays,
  Crown,
  Flag,
  Flame,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Music,
  Trophy,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Share2,
  Sun,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import SidebarIcon from "./SidebarIcon";
import { logoutUser } from "@/lib/auth";
import { usePremium } from "@/lib/usePremium";
import { ReferralPopup } from "@/components/ReferralPopup";
import { useTheme } from "@/context/ThemeContext";
import "./sidebar.css";

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

const menuItems: MenuItem[] = [
  // Menu dipangkas agar ringkas — halaman yang dihapus dari daftar tetap
  // dapat diakses lewat URL/link internal (Home, Rencana, Ujian, Leaderboard).
  { id: "dashboard", label: "Belajar", icon: LayoutDashboard, href: "/dashboard" },
  { id: "catatan", label: "Catatan", icon: FileText, href: "/dashboard/catatan" },
  { id: "kursus", label: "Kursus", icon: GraduationCap, href: "/dashboard/kursus" },
  { id: "leaderboard", label: "Papan skor", icon: Trophy, href: "/dashboard/leaderboard" },
  { id: "jadwal", label: "Jadwal", icon: CalendarDays, href: "/dashboard/jadwal" },
  { id: "tugas", label: "Tugas & Ujian", icon: AlarmClock, href: "/dashboard/tugas" },
  { id: "musik", label: "Musik", icon: Music, href: "/dashboard/musik" },
  { id: "misi", label: "Misi", icon: Flag, href: "/dashboard/misi" },
  {
    id: "mata-pelajaran",
    label: "Mata Pelajaran",
    icon: BookOpen,
    href: "/dashboard/mata-pelajaran",
  },
  { id: "streaks", label: "Streaks", icon: Flame, href: "/dashboard/streaks" },
  { id: "teman", label: "Teman", icon: Users, href: "/dashboard/teman" },
  { id: "profil", label: "Profil", icon: User, href: "/dashboard/profil" },
  { id: "pengaturan", label: "Pengaturan", icon: Settings, href: "/dashboard/pengaturan" },
  { id: "panduan", label: "Panduan", icon: HelpCircle, href: "/dashboard/panduan" },
];

/**
 * Item menu aktif untuk path saat ini: cocok persis ATAU seluruh
 * sub-halaman di bawahnya (prefix), dengan aturan match terpanjang
 * menang sehingga tepat satu item aktif. Sub-halaman yang tidak punya
 * menu sendiri (mis. /dashboard/note/<id>) menyorot menu induknya.
 */
export function activeMenuId(pathname: string): string | null {
  pathname = pathname.replace(/^\/(id|en)(?=\/|$)/, "") || "/";
  // Pemetaan halaman tanpa menu sendiri → menu induk yang relevan.
  // DICEK DULU sebelum prefix-match /dashboard agar tidak tertangkap
  // menu "Dashboard" (prefix /dashboard lebih pendek tapi match duluan
  // pada best-length loop — keduanya prefix, jadi urutan penting).
  const PARENT: [string, string][] = [
    ["/dashboard/note", "catatan"],
    ["/dashboard/keamanan", "pengaturan"],
    ["/dashboard/ujian", "dashboard"],
    ["/dashboard/leaderboard", "leaderboard"],
    ["/dashboard/rencana", "jadwal"],
  ];
  for (const [prefix, id] of PARENT) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return id;
  }

  let best: { id: string; len: number } | null = null;
  for (const item of menuItems) {
    const hit =
      pathname === item.href || pathname.startsWith(item.href + "/");
    if (!hit) continue;
    if (!best || item.href.length > best.len) {
      best = { id: item.id, len: item.href.length };
    }
  }
  return best?.id ?? null;
}

export const Sidebar = () => {
  const pathname = usePathname();
  const { isPremium } = usePremium();
  const { resolved: themeResolved, toggle: toggleTheme } = useTheme();
  const mobileMenu = useRef<HTMLDialogElement>(null);
  const [referralOpen, setReferralOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  // Sidebar desktop: mode collapse/expand tersimpan per perangkat (localStorage).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("eureka_sidebar_collapsed") === "1");
    } catch {
      // localStorage tidak tersedia — default terbuka.
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("eureka_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // abaikan
      }
      return next;
    });
  };

  useEffect(() => {
    mobileMenu.current?.close();
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) mobileMenu.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const showToast = (msg: string) => {
    toast.info(msg);
  };

  const handleLogout = async () => {
    if (!window.confirm("Yakin ingin keluar dari Eureka.AI?")) return;
    try {
      await logoutUser();
    } catch {
      // tetap lanjut ke /login; cache sesi sudah dibersihkan di logoutUser
    }
    // Navigasi penuh agar semua state klien (sesi cache, React) bersih total.
    window.location.href = "/login";
  };

  const brand = (
    <Link href="/dashboard" className="eureka-sidebar-brand" aria-label="Eureka, dashboard" title={collapsed ? "Eureka" : undefined}>
      {collapsed ? "e!" : "eureka!"}
    </Link>
  );

  const navBody = (mobile = false) => {
    const compact = collapsed && !mobile;
    return (
      <>
        <nav className="eureka-sidebar-nav" aria-label="Navigasi utama">
          {["dashboard", "catatan", "kursus", "mata-pelajaran", "leaderboard", "misi", "jadwal", "profil"].map((id) => {
            const item = menuItems.find((entry) => entry.id === id)!;
            return <SidebarItem key={item.id} icon={item.icon} art={item.id} label={item.label} href={item.href} active={activeMenuId(pathname) === item.id} collapsed={compact} />;
          })}
          <button type="button" className={`eureka-sidebar-item eureka-sidebar-more ${compact ? "is-collapsed" : ""}`} aria-expanded={showMore} aria-label={compact ? "Lainnya" : undefined} title={compact ? "Lainnya" : undefined} onClick={() => setShowMore((value) => !value)}>
            <SidebarIcon name="more" />{!compact && <span>Lainnya</span>}
          </button>
        </nav>
        {showMore && <div className="eureka-sidebar-extra">
          {menuItems.filter((item) => !["dashboard", "catatan", "kursus", "mata-pelajaran", "leaderboard", "misi", "jadwal", "profil"].includes(item.id)).map((item) => (
            <SidebarItem key={item.id} icon={item.icon} label={item.label} href={item.href} active={activeMenuId(pathname) === item.id} collapsed={compact} />
          ))}
        <div className="eureka-sidebar-actions">
          <SidebarItem icon={Crown} label={isPremium ? "Top Up Pro" : "Tingkatkan Pro"} href="/pricing" variant="pro" collapsed={compact} />
          <button type="button" onClick={() => { if (mobile) mobileMenu.current?.close(); setReferralOpen(true); }} title={compact ? "Bagikan link referral" : undefined} aria-label={compact ? "Bagikan link referral" : undefined} className={`eureka-sidebar-item ${compact ? "is-collapsed" : ""}`}>
            <Share2 size={19} aria-hidden="true" />{!compact && <span>Bagikan referral</span>}
          </button>
          <button type="button" onClick={() => { toggleTheme(); showToast(themeResolved === "dark" ? "Mode terang diaktifkan" : "Mode gelap diaktifkan"); }} title={compact ? (themeResolved === "dark" ? "Mode terang" : "Mode gelap") : undefined} aria-label={compact ? (themeResolved === "dark" ? "Mode terang" : "Mode gelap") : undefined} className={`eureka-sidebar-item ${compact ? "is-collapsed" : ""}`}>
            {themeResolved === "dark" ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}{!compact && <span>{themeResolved === "dark" ? "Mode terang" : "Mode gelap"}</span>}
          </button>
          <button type="button" onClick={handleLogout} title={compact ? "Keluar" : undefined} aria-label={compact ? "Keluar" : undefined} className={`eureka-sidebar-item is-danger ${compact ? "is-collapsed" : ""}`}><LogOut size={19} aria-hidden="true" />{!compact && <span>Keluar</span>}</button>
        </div>
        </div>}
      </>
    );
  };

  return (
    <>
      <header className="eureka-mobile-bar">
        <button type="button" className="eureka-mobile-menu" onClick={() => mobileMenu.current?.showModal()} aria-label="Buka menu" aria-haspopup="dialog">
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link href="/dashboard" className="eureka-mobile-brand" aria-label="Eureka, dashboard">eureka!</Link>
        <nav aria-label="Akses cepat" className="eureka-mobile-shortcuts">
          <Link href="/dashboard/catatan" aria-current={activeMenuId(pathname) === "catatan" ? "true" : undefined}>
            <FileText size={18} aria-hidden="true" /><span>Catatan</span>
          </Link>
          <Link href="/dashboard-v2"><span>V2</span></Link>
          <Link href="/chat"><MessageCircle size={18} aria-hidden="true" /><span>Chat</span></Link>
        </nav>
      </header>

      <div
        className={`eureka-sidebar-container sticky top-0 hidden h-screen shrink-0 items-center transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[76px]" : "w-[232px]"
        }`}
      >
        <aside
          className={`eureka-sidebar ${collapsed ? "is-compact" : ""}`}
        >
          <div className="relative">
            {brand}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              className="eureka-sidebar-collapse"
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          </div>
          <Link href="/dashboard-v2" className="eureka-sidebar-v2" title="Coba Dashboard V2">{collapsed ? "V2" : "Coba Dashboard V2 →"}</Link>
          {navBody()}
        </aside>
      </div>

      <dialog
        ref={mobileMenu}
        className="eureka-sidebar eureka-sidebar-mobile"
        aria-label="Menu Eureka"
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) {
            event.currentTarget.close();
            return;
          }
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right) mobileMenu.current?.close();
        }}
      >
        <div className="eureka-sidebar-mobile-header">
          <Link href="/dashboard" className="eureka-sidebar-brand">eureka!</Link>
          <button type="button" onClick={() => mobileMenu.current?.close()} className="eureka-sidebar-close" aria-label="Tutup menu"><X size={20} /></button>
        </div>
        {navBody(true)}
      </dialog>



      {/* Popup referral: progres + link + klaim premium */}
      <ReferralPopup
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
      />
    </>
  );
};
