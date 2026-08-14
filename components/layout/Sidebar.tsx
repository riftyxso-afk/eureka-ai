"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Crown,
  Flag,
  Flame,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Origami,
  Pin,
  Settings,
  Sun,
  Trophy,
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

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

const menuItems: MenuItem[] = [
  { id: "home", label: "Home", icon: Home, href: "/home" },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "jadwal", label: "Jadwal", icon: CalendarDays, href: "/dashboard/jadwal" },
  { id: "rencana", label: "Rencana", icon: Origami, href: "/dashboard/rencana" },
  { id: "misi", label: "Misi", icon: Flag, href: "/dashboard/misi" },
  { id: "ujian", label: "Ujian", icon: ClipboardCheck, href: "/dashboard/ujian" },
  {
    id: "mata-pelajaran",
    label: "Mata Pelajaran",
    icon: BookOpen,
    href: "/dashboard/mata-pelajaran",
  },
  { id: "streaks", label: "Streaks", icon: Flame, href: "/dashboard/streaks" },
  {
    id: "leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    href: "/dashboard/leaderboard",
  },
  { id: "teman", label: "Teman", icon: Users, href: "/dashboard/teman" },
  { id: "profil", label: "Profil", icon: User, href: "/dashboard/profil" },
  { id: "pengaturan", label: "Pengaturan", icon: Settings, href: "/dashboard/pengaturan" },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { isPremium } = usePremium();
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatar, setAvatarState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("eureka_avatar");
    } catch {
      return null;
    }
  });

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

  const brand = (      <Link href="/dashboard" className="block border-b-[3px] border-clay-borderLight pb-4">
        <span className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Logo Eureka.AI"
            className="h-9 w-9 object-contain"
          />
          <span className="text-2xl font-extrabold text-clay-primary">
            Eureka<span className="text-clay-dark">.AI</span>
          </span>
        </span>
      </Link>
  );

  const navBody = (onNavigate?: () => void) => (
    <>
      <div className="mb-1 flex items-center gap-2 rounded-clay-md bg-clay-beige/70 px-3 py-2 shadow-clay-inset">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-clay-primary/20 text-sm shadow-clay-sm">
          {avatar ? (
            <img src={avatar} alt="Foto profil" className="h-full w-full object-cover" />
          ) : (
            <span>{getUserName().charAt(0).toUpperCase()}</span>
          )}
        </span>
        <Link
          href="/dashboard/profil"
          className="min-w-0 flex-1 truncate text-xs font-extrabold text-clay-dark hover:text-clay-primary"
          onClick={onNavigate}
        >
          {getUserName().split(" ")[0]}
        </Link>
      </div>

      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={pathname === item.href}
            onClick={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-1 border-t-2 border-clay-shadow/30 pt-1">
        <SidebarItem
          icon={Crown}
          label={isPremium ? "Pro Aktif ✓" : "Tingkatkan Pro"}
          href="/pricing"
          variant="pro"
          onClick={onNavigate}
        />
      </div>

      <div className="mt-1 flex flex-col gap-1 border-t-2 border-clay-shadow/30 pt-1">
        <button
          onClick={() => showToast("Fitur segera hadir! 🚧")}
          className="flex items-center gap-3 rounded-clay-md px-4 py-1.5 text-left text-[14px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:shadow-[0_4px_0_#D1C4B4]"
        >
          <Pin size={15} />
          Sematkan
        </button>
        <button
          onClick={() => {
            setIsDarkMode((d) => !d);
            showToast(
              isDarkMode
                ? "Mode terang diaktifkan ☀️"
                : "Mode gelap diaktifkan 🌙"
            );
          }}
          className="flex items-center gap-3 rounded-clay-md px-4 py-1.5 text-left text-[14px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:shadow-[0_4px_0_#D1C4B4]"
        >
          {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          {isDarkMode ? "Mode Terang" : "Mode Gelap"}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-clay-md px-4 py-1.5 text-left text-[14px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:text-red-500 hover:shadow-[0_4px_0_#D1C4B4]"
        >
          <LogOut size={15} />
          Keluar
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-clay-sm transition-all duration-75 active:translate-y-1 lg:hidden"
        aria-label="Buka menu"
      >
        <Menu size={22} />
      </button>

      <div className="sticky top-0 hidden h-screen w-[220px] shrink-0 items-center lg:flex">
        <aside className="flex max-h-full w-full -translate-y-10 flex-col gap-2 overflow-y-auto rounded-clay bg-white p-3 shadow-clay-sm">
          {brand}
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
              className="fixed left-0 top-0 z-50 flex h-dvh w-[30%] min-w-[200px] max-w-[85vw] flex-col gap-2 overflow-y-auto overscroll-contain rounded-r-clay-md bg-white p-3 shadow-clay-lg lg:hidden before:absolute before:inset-0 before:pointer-events-none before:rounded-r-clay-md before:bg-gradient-to-b before:from-clay-primary/5 before:to-transparent"
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
    </>
  );
};
