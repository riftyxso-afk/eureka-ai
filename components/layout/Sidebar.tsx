"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ClipboardCheck,
  Crown,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
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

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

const menuItems: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
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
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const handleLogout = () => {
    if (window.confirm("Yakin ingin keluar dari Eureka.AI?")) {
      showToast("Sampai jumpa lagi! 👋");
    }
  };

  const brand = (
    <Link href="/dashboard" className="block border-b-[3px] border-clay-borderLight pb-4">
      <span className="text-2xl font-extrabold text-clay-primary">
        Eureka<span className="text-clay-dark">.AI</span>
      </span>
    </Link>
  );

  const navBody = (onNavigate?: () => void) => (
    <>
      <nav className="flex flex-1 flex-col gap-1.5">
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

      <div className="mt-3 border-t-2 border-clay-shadow/30 pt-3">
        <SidebarItem
          icon={Crown}
          label="Tingkatkan Pro"
          href="/pricing"
          variant="pro"
          onClick={onNavigate}
        />
      </div>

      <div className="mt-3 flex flex-col gap-1.5 border-t-2 border-clay-shadow/30 pt-3">
        <button
          onClick={() => showToast("Fitur segera hadir! 🚧")}
          className="flex items-center gap-3 rounded-clay-md px-4 py-3 text-left text-[15px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:shadow-[0_4px_0_#D1C4B4]"
        >
          <Pin size={16} />
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
          className="flex items-center gap-3 rounded-clay-md px-4 py-3 text-left text-[15px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:shadow-[0_4px_0_#D1C4B4]"
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          {isDarkMode ? "Mode Terang" : "Mode Gelap"}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-clay-md px-4 py-3 text-left text-[15px] font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige hover:text-red-500 hover:shadow-[0_4px_0_#D1C4B4]"
        >
          <LogOut size={16} />
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

      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col gap-6 rounded-clay bg-white p-4 py-6 shadow-clay-sm lg:flex">
        {brand}
        {navBody()}
      </aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col gap-6 rounded-r-clay bg-white p-4 py-6 shadow-clay-sm lg:hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b-[3px] border-clay-borderLight pb-4">
                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                  <span className="text-2xl font-extrabold text-clay-primary">
                    Eureka<span className="text-clay-dark">.AI</span>
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
