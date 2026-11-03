"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlarmClock,
  BookOpen,
  CalendarDays,
  Crown,
  Flag,
  Flame,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
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
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setIsOpen(false);
  }, [pathname]);

  // Kunci scroll body saat drawer mobile terbuka (anti geser-geser).
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("scroll-lock");
      return () => document.body.classList.remove("scroll-lock");
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
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

  const navBody = (onNavigate?: () => void, mobile = false) => {
    const compact = collapsed && !mobile;
    return (
      <>
        <nav className="eureka-sidebar-nav" aria-label="Navigasi utama">
          {["dashboard", "catatan", "mata-pelajaran", "leaderboard", "misi", "jadwal", "profil"].map((id) => {
            const item = menuItems.find((entry) => entry.id === id)!;
            return <SidebarItem key={item.id} icon={item.icon} art={item.id} label={item.label} href={item.href} active={activeMenuId(pathname) === item.id} onClick={onNavigate} collapsed={compact} />;
          })}
          <button type="button" className={`eureka-sidebar-item eureka-sidebar-more ${compact ? "is-collapsed" : ""}`} aria-expanded={showMore} aria-label={compact ? "Lainnya" : undefined} title={compact ? "Lainnya" : undefined} onClick={() => setShowMore((value) => !value)}>
            <SidebarIcon name="more" />{!compact && <span>Lainnya</span>}
          </button>
        </nav>
        {showMore && <div className="eureka-sidebar-extra">
          {menuItems.filter((item) => !["dashboard", "catatan", "mata-pelajaran", "leaderboard", "misi", "jadwal", "profil"].includes(item.id)).map((item) => (
            <SidebarItem key={item.id} icon={item.icon} label={item.label} href={item.href} active={activeMenuId(pathname) === item.id} onClick={onNavigate} collapsed={compact} />
          ))}
        <div className="eureka-sidebar-actions">
          <SidebarItem icon={Crown} label={isPremium ? "Top Up Pro" : "Tingkatkan Pro"} href="/pricing" variant="pro" onClick={onNavigate} collapsed={compact} />
          <button type="button" onClick={() => setReferralOpen(true)} title={compact ? "Bagikan link referral" : undefined} aria-label={compact ? "Bagikan link referral" : undefined} className={`eureka-sidebar-item ${compact ? "is-collapsed" : ""}`}>
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
      <button
        onClick={() => setIsOpen(true)}
        className="eureka-sidebar-menu-toggle fixed left-4 top-4 z-40 lg:hidden"
        aria-label="Buka menu"
      >
        <Menu size={22} />
      </button>

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
          {navBody()}
        </aside>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px] lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{
                type: "tween",
                duration: 0.3,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="eureka-sidebar eureka-sidebar-mobile fixed left-0 top-0 z-50 lg:hidden"
            >
              <div className="eureka-sidebar-mobile-header">
                <Link href="/dashboard" onClick={() => setIsOpen(false)} className="eureka-sidebar-brand">eureka!</Link>
                <button type="button" onClick={() => setIsOpen(false)} className="eureka-sidebar-close" aria-label="Tutup menu"><X size={20} /></button>
              </div>
              {navBody(() => setIsOpen(false), true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup referral: progres + link + klaim premium */}
      <ReferralPopup
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
      />
    </>
  );
};
