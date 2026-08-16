"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Medal, Trophy, Users } from "lucide-react";
import { getUserId, getUserName } from "@/lib/identity";
import { apiFetch } from "@/lib/apiClient";

interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  level: number;
  avatar: string;
  rank: number;
}

const TOP3_STYLE = [
  { card: "bg-yellow-100 border-3 border-yellow-400", icon: <Crown size={20} className="text-yellow-500" /> },
  { card: "bg-gray-100 border-3 border-gray-400", icon: <Medal size={20} className="text-gray-500" /> },
  { card: "bg-orange-100 border-3 border-orange-400", icon: <Medal size={20} className="text-orange-500" /> },
];

function formatXP(xp: number): string {
  return xp.toLocaleString("id-ID");
}

type ViewMode = "all" | "friends";

export default function LeaderboardPage() {
  const [view, setView] = useState<ViewMode>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUser, setCurrentUser] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const userId = getUserId();
      const userName = getUserName();
      const res = await apiFetch(
        `/api/leaderboard?userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(userName)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.entries)) setEntries(data.entries);
      if (data.currentUser) setCurrentUser(data.currentUser);
    } catch {
      // biarkan
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const displayEntries = [...entries].sort((a, b) => b.xp - a.xp);
  const showTop3 = view === "all";

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Trophy size={24} className="text-clay-primary sm:hidden" />
          <Trophy size={28} className="hidden text-clay-primary sm:block" />
          <h1 className="text-2xl font-extrabold sm:text-3xl">Leaderboard</h1>
        </div>
        <div className="flex gap-2">
          {(
            [
              { key: "all" as ViewMode, label: "Semua" },
              { key: "friends" as ViewMode, label: "Teman" },
            ]
          ).map((mode) => (
            <button
              key={mode.key}
              onClick={() => setView(mode.key)}
              className={`btn-clay-ghost !min-h-[44px] flex-1 !px-4 text-sm sm:flex-initial sm:!min-h-[40px] ${
                view === mode.key
                  ? "!border-clay-primary !bg-clay-primary !text-white !shadow-clay-sm"
                  : ""
              }`}
            >
              {mode.key === "friends" && <Users size={14} className="mr-1.5 inline" />}
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-base font-semibold text-clay-muted">
        Peringkatmu di antara teman-teman belajar (XP nyata)
      </p>

      {/* Peringkat user saat ini */}
      {currentUser && (
        <div className="mt-6 rounded-clay border-3 border-clay-primary bg-clay-primary/5 p-5 shadow-clay">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-lg font-extrabold text-clay-primary shadow-clay-inset">
                {currentUser.avatar || currentUser.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-clay-dark">
                  {currentUser.name}
                  <span className="ml-2 text-sm font-extrabold text-clay-muted">
                    (Kamu)
                  </span>
                </p>
                <p className="text-sm font-bold text-clay-muted">
                  Level {currentUser.level} · {formatXP(currentUser.xp)} XP
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-clay-full bg-clay-primary px-4 py-2 text-lg font-extrabold text-white shadow-clay-btn">
              #{currentUser.rank}
            </span>
          </div>
        </div>
      )}

      {/* Daftar */}
      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-6 text-center text-sm font-semibold text-clay-muted">
            Memuat leaderboard...
          </p>
        ) : displayEntries.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-6 text-center text-sm font-semibold text-clay-muted">
            Belum ada teman di leaderboard. Tambahkan teman di tab Teman!
          </p>
        ) : (
          displayEntries.map((entry) => {
            const isTop3 = showTop3 && entry.rank <= 3;
            const isMe = currentUser?.id === entry.id;
            return (
              <div
                key={entry.id}
                className={`card-clay flex items-center justify-between gap-4 !p-4 !shadow-clay-sm transition-all duration-75 ${
                  isTop3
                    ? TOP3_STYLE[entry.rank - 1].card
                    : "hover:-translate-y-0.5 hover:shadow-[0_8px_0_#D1C4B4]"
                } ${isMe ? "!border-clay-primary ring-2 ring-clay-primary/30" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex w-8 shrink-0 items-center justify-center text-lg font-extrabold text-clay-dark">
                    {entry.rank}
                  </span>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-beige text-base font-extrabold text-clay-primary shadow-clay-inset">
                    {entry.avatar || entry.name.charAt(0).toUpperCase()}
                  </span>
                  <p className="truncate text-base font-bold text-clay-dark">
                    {entry.name}
                    {isMe && (
                      <span className="ml-2 text-xs font-extrabold text-clay-primary">
                        (Kamu)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                  {isTop3 && TOP3_STYLE[entry.rank - 1].icon}
                  <span className="text-xs font-extrabold text-clay-muted sm:text-sm">
                    Level {entry.level}
                  </span>
                  <span className="text-sm font-extrabold text-clay-primary sm:text-base">
                    {formatXP(entry.xp)} XP
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
