import { NextRequest, NextResponse } from "next/server";

import { listFriends, ensureUser } from "@/lib/friends-store";
import { getStats } from "@/lib/progress-store";

export const runtime = "nodejs";

interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  level: number;
  avatar: string;
  rank: number;
}

function levelFromXP(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "");
    const name = String(req.nextUrl.searchParams.get("name") ?? "").slice(0, 60);
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    await ensureUser(userId, name);

    const friends = await listFriends(userId);
    const candidates = [
      { id: userId, name: name || "Kamu" },
      ...friends.map((f) => ({ id: f.id, name: f.name })),
    ];

    const withXp: LeaderboardEntry[] = [];
    for (const c of candidates) {
      const stats = await getStats(c.id);
      withXp.push({
        id: c.id,
        name: c.name,
        xp: stats.xp,
        level: levelFromXP(stats.xp),
        avatar: "🧑‍🎓",
        rank: 0,
      });
    }

    withXp.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
    withXp.forEach((entry, i) => {
      entry.rank = i + 1;
    });

    const currentUser = withXp.find((e) => e.id === userId) ?? withXp[0];

    return NextResponse.json({
      entries: withXp,
      currentUser: currentUser ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat leaderboard.";
    console.error("[api/leaderboard] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
