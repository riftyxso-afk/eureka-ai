"use client";

import { useEffect, useState } from "react";
import { Crown, Medal, Trophy, Users } from "lucide-react";
import { getUserId, getUserName } from "@/lib/identity";

interface LeaderboardEntry {
  id: number;
  name: string;
  xp: number;
  level: number;
  avatar: string;
  rank: number;
}

const mockLeaderboard: LeaderboardEntry[] = [
  { id: 1, name: "Andi Pratama", xp: 12500, level: 15, avatar: "👨‍🎓", rank: 1 },
  { id: 2, name: "Budi Santoso", xp: 10800, level: 13, avatar: "👨‍🎓", rank: 2 },
  { id: 3, name: "Citra Dewi", xp: 9500, level: 12, avatar: "👩‍🎓", rank: 3 },
  { id: 4, name: "Doni Saputra", xp: 8200, level: 10, avatar: "👨‍🎓", rank: 4 },
  { id: 5, name: "Eka Fitriani", xp: 7800, level: 9, avatar: "👩‍🎓", rank: 5 },
  { id: 6, name: "Fajar Nugroho", xp: 7200, level: 8, avatar: "👨‍🎓", rank: 6 },
  { id: 7, name: "Gita Rahayu", xp: 6800, level: 8, avatar: "👩‍🎓", rank: 7 },
  { id: 8, name: "Hadi Wijaya", xp: 6500, level: 7, avatar: "👨‍🎓", rank: 8 },
  { id: 9, name: "Indah Permata", xp: 6200, level: 7, avatar: "👩‍🎓", rank: 9 },
  { id: 10, name: "Joko Susilo", xp: 5800, level: 6, avatar: "👨‍🎓", rank: 10 },
];

const currentUser = {
  id: "me",
  name: getUserName(),
  xp: 4200,
  level: 5,
  avatar: "🧑‍🎓",
};

const TOP3_STYLE = [
  { card: "bg-yellow-100 border-3 border-yellow-400", icon: <Crown size={20} className="text-yellow-500" /> },
  { card: "bg-gray-100 border-3 border-gray-400", icon: <Medal size={20} className="text-gray-500" /> },
  { card: "bg-orange-100 border-3 border-orange-400", icon: <Medal size={20} className="text-orange-500" /> },
];

function formatXP(xp: number): string {
  return xp.toLocaleString("id-ID");
}

/** XP deterministik dari nama (untuk mode "Teman" tanpa server XP). */
function xpFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return 2000 + (Math.abs(h) % 10500);
}

function levelFromXP(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 200)));
}

type ViewMode = "all" | "friends";

export default function LeaderboardPage() {
  const [view, setView] = useState<ViewMode>("all");
  const [friendNames, setFriendNames] = useState<string[]>([]);

  useEffect(() => {
    const userId = getUserId();
    const userName = getUserName();
    fetch(`/api/friends?userId=${userId}&name=${encodeURIComponent(userName)}`)
      .then((r) => r.json())
      .then((data) => {
        setFriendNames(
          (data.users ?? [])
            .filter((u: { relation: string }) => u.relation === "friend")
            .map((u: { name: string }) => u.name)
        );
      })
      .catch(() => {});
  }, []);

  const friendEntries: LeaderboardEntry[] = [
    ...friendNames.map((name, i) => {
      const xp = xpFromName(name);
      return {
        id: 100 + i,
        name,
        xp,
        level: levelFromXP(xp),
        avatar: "🧑‍🎓",
        rank: 0,
      };
    }),
    { id: 0, name: currentUser.name, xp: currentUser.xp, level: currentUser.level, avatar: currentUser.avatar, rank: 0 },
  ];

  // Peringkat teman + user terhadap daftar global (mock + user)
  const allScored = [...mockLeaderboard, currentUser];
  friendEntries.forEach((fe) => {
    const globalRank =
      allScored.filter((g) => g.xp > fe.xp || (g.xp === fe.xp && g.name === fe.name)).length + 1;
    fe.rank = globalRank;
  });

  const displayEntries =
    view === "all" ? mockLeaderboard : friendEntries.sort((a, b) => b.xp - a.xp);

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
        {view === "all"
          ? "Lihat posisimu di antara teman-teman belajar"
          : "Peringkat teman dan dirimu (lokal)"}
      </p>

      {/* Peringkat user saat ini */}
      <div className="mt-6 rounded-clay border-3 border-clay-primary bg-clay-primary/5 p-5 shadow-clay">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-clay-inset">
              {currentUser.avatar}
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
            #
            {allScored.filter((g) => g.xp > currentUser.xp).length + 1}
          </span>
        </div>
      </div>

      {/* Daftar */}
      <div className="mt-6 flex flex-col gap-3">
        {displayEntries.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-6 text-center text-sm font-semibold text-clay-muted">
            Belum ada teman di leaderboard. Tambahkan teman di tab Teman! 👋
          </p>
        )}
        {displayEntries.map((entry) => {
          const isTop3 = showTop3 && entry.rank <= 3;
          const isMe = entry.name === currentUser.name;
          return (
            <div
              key={`${entry.id}-${entry.name}`}
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
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-beige text-xl shadow-clay-inset">
                  {entry.avatar}
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
        })}
      </div>
    </div>
  );
}
