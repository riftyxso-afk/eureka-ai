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
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Music,
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
import { logoutUser } from "@/lib/auth";
import { getAvatar } from "@/lib/avatar";
import { getUserName } from "@/lib/identity";
import { usePremium } from "@/lib/usePremium";
import { PlanBadge } from "@/components/PlanBadge";
import { ReferralPopup } from "@/components/ReferralPopup";
import { useTheme } from "@/context/ThemeContext";

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

const menuItems: MenuItem[] = [
  // Menu dipangkas agar ringkas — halaman yang dihapus dari daftar tetap
  // dapat diakses lewat URL/link internal (Home, Rencana, Ujian, Leaderboard).
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
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
  // Pemetaan halaman tanpa menu sendiri → menu induk yang relevan.
  // DICEK DULU sebelum prefix-match /dashboard agar tidak tertangkap
  // menu "Dashboard" (prefix /dashboard lebih pendek tapi match duluan
  // pada best-length loop — keduanya prefix, jadi urutan penting).
  const PARENT: [string, string][] = [
    ["/dashboard/note", "dashboard"],
    ["/dashboard/keamanan", "pengaturan"],
    ["/dashboard/ujian", "dashboard"],
    ["/dashboard/leaderboard", "dashboard"],
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
  const [avatar, setAvatarState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("eureka_avatar");
    } catch {
      return null;
    }
  });

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

  // Segarkan foto profil setelah kembali dari halaman profil (storage event).
  useEffect(() => {
    const sync = () => setAvatarState(getAvatar());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

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
    <Link
      href="/dashboard"
      title={collapsed ? "Eureka.AI" : undefined}
      className="block border-b-[3px] border-clay-borderLight pb-4"
    >
      <span className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
        <img
          src="/logo.png"
          alt="Logo Eureka.AI"
          className="h-9 w-9 object-contain"
        />
        {!collapsed && (
          <span className="text-2xl font-extrabold text-clay-primary">
            Eureka<span className="text-clay-dark">.AI</span>
          </span>
        )}
      </span>
    </Link>
  );

  const navBody = (onNavigate?: () => void) => (
    <>
      <div
        className={`mb-1 flex items-center rounded-clay-md bg-clay-beige/70 py-2 shadow-clay-inset ${
          collapsed ? "justify-center px-1" : "gap-2 px-3"
        }`}
      >
        <Link
          href="/dashboard/profil"
          title={collapsed ? getUserName() : undefined}
          className="flex items-center"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-clay-primary/20 text-sm shadow-clay-sm">
            {avatar ? (
              <img src={avatar} alt="Foto profil" className="h-full w-full object-cover" />
            ) : (
              <span>{getUserName().charAt(0).toUpperCase()}</span>
            )}
          </span>
        </Link>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <Link
              href="/dashboard/profil"
              className="block truncate text-xs font-extrabold text-clay-dark hover:text-clay-primary"
              onClick={onNavigate}
            >
              {getUserName().split(" ")[0]}
            </Link>
            <PlanBadge size="sm" className="mt-1" />
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={activeMenuId(pathname) === item.id}
            onClick={onNavigate}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="mt-1 border-t-2 border-clay-shadow/30 pt-1">
        <SidebarItem
          icon={Crown}
          label={isPremium ? "Top Up Pro" : "Tingkatkan Pro"}
          href="/pricing"
          variant="pro"
          onClick={onNavigate}
          collapsed={collapsed}
        />
      </div>

      <div className="mt-1 flex flex-col gap-1 border-t-2 border-clay-shadow/30 pt-1">
        <button
          onClick={() => setReferralOpen(true)}
          title={collapsed ? "Bagikan Link (Referral)" : undefined}
          className={`flex items-center rounded-clay-md py-1.5 text-left text-[14px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:text-clay-primary hover:shadow-[0_4px_0_rgb(var(--clay-shadow))] ${
            collapsed ? "justify-center px-1" : "gap-3 px-4"
          }`}
        >
          <Share2 size={15} />
          {!collapsed && "Bagikan Link (Referral)"}
        </button>
      </div>

      <div className="mt-1 flex flex-col gap-1 border-t-2 border-clay-shadow/30 pt-1">
        <button
          onClick={() => {
            toggleTheme();
            showToast(
              themeResolved === "dark"
                ? "Mode terang diaktifkan"
                : "Mode gelap diaktifkan"
            );
          }}
          className={`flex items-center rounded-clay-md py-1.5 text-left text-[14px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:shadow-[0_4px_0_rgb(var(--clay-shadow))] ${
            collapsed ? "justify-center px-1" : "gap-3 px-4"
          }`}
        >
          {themeResolved === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          {!collapsed && (themeResolved === "dark" ? "Mode Terang" : "Mode Gelap")}
        </button>
        <button
          onClick={handleLogout}
          className={`flex items-center rounded-clay-md py-1.5 text-left text-[14px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:text-red-500 hover:shadow-[0_4px_0_rgb(var(--clay-shadow))] ${
            collapsed ? "justify-center px-1" : "gap-3 px-4"
          }`}
        >
          <LogOut size={15} />
          {!collapsed && "Keluar"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-clay-cream shadow-clay-sm transition-all duration-75 active:translate-y-1 lg:hidden"
        aria-label="Buka menu"
      >
        <Menu size={22} />
      </button>

      <div
        className={`sticky top-0 hidden h-screen shrink-0 items-center transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[76px]" : "w-[220px]"
        }`}
      >
        <aside
          className={`flex max-h-full w-full -translate-y-10 flex-col gap-2 overflow-y-auto rounded-clay bg-clay-cream shadow-clay-sm ${
            collapsed ? "p-2" : "p-3"
          }`}
        >
          <div className="relative">
            {brand}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              className="absolute -right-1.5 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset transition-colors hover:bg-clay-primary hover:text-white"
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
              className="fixed left-0 top-0 z-50 flex h-dvh w-[30%] min-w-[200px] max-w-[85vw] flex-col gap-2 overflow-y-auto overscroll-contain rounded-r-clay-md bg-clay-cream p-3 shadow-clay-lg lg:hidden before:absolute before:inset-0 before:pointer-events-none before:rounded-r-clay-md before:bg-gradient-to-b before:from-clay-primary/5 before:to-transparent"
            >
              <div className="flex items-center justify-between gap-2 border-b-[3px] border-clay-borderLight pb-2">
                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                  <span className="flex items-center gap-2">
                    <img
                      src="/logo.png"
                      alt="Logo Eureka.AI"
                      className="h-8 w-8 object-contain"
                    />
                    <span className="text-2xl font-extrabold text-clay-primary">
                      Eureka<span className="text-clay-dark">.AI</span>
                    </span>
                  </span>
                </Link>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset"
                  aria-label="Tutup menu"
                >
                  <X size={18} />
                </button>
              </div>
              {navBody(() => setIsOpen(false))}
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
