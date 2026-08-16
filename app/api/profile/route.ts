import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/supabase/admin";
import { buildProfileMarkdown } from "@/lib/profile";
import type { OnboardingAnalysis } from "@/lib/types";

export const runtime = "nodejs";

interface ProfileRow {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  user_number: number | null;
  onboarding_completed: boolean;
  profile_data: Record<string, unknown> | null;
  profile_md: string | null;
}

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "");
}

export function isUsernameValid(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db()
    .from("users")
    .select(
      "id, name, email, username, user_number, onboarding_completed, profile_data, profile_md"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) ?? null;
}

function toPayload(row: ProfileRow) {
  const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email,
    username: row.username ?? "",
    userNumber: row.user_number,
    onboardingCompleted: row.onboarding_completed,
    plan: typeof profileData.plan === "string" ? profileData.plan : "free",
    profileData,
    profileMd: row.profile_md ?? "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "");
    const checkUsername = normalizeUsername(
      String(req.nextUrl.searchParams.get("checkUsername") ?? "")
    );

    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }

    if (checkUsername) {
      if (!isUsernameValid(checkUsername)) {
        return NextResponse.json({
          available: false,
          reason: "Hanya huruf kecil, angka, dan _ (3–20 karakter).",
        });
      }
      const { data } = await db()
        .from("users")
        .select("id")
        .eq("username", checkUsername)
        .neq("id", userId)
        .maybeSingle();
      return NextResponse.json({
        available: !data,
        reason: data ? "Username sudah dipakai pengguna lain." : "",
      });
    }

    const row = await loadProfile(userId);
    if (!row) {
      return NextResponse.json({ error: "Profil tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ user: toPayload(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat profil.";
    console.error("[api/profile] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      userId?: string;
      email?: string;
      name?: string;
      username?: string;
      plan?: string;
      onboardingCompleted?: boolean;
      profileData?: Record<string, unknown>;
    } | null;
    const userId = String(body?.userId ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }

    let row = await loadProfile(userId);
    let isNewRow = false;
    if (!row) {
      // Akun tanpa baris profil (mis. terdaftar sebelum trigger dibuat)
      // → buat barisnya sekarang agar onboarding tetap bisa disimpan.
      const email = String(body?.email ?? "").trim().toLowerCase();
      if (!email.includes("@")) {
        return NextResponse.json(
          { error: "Profil tidak ditemukan." },
          { status: 404 }
        );
      }
      row = {
        id: userId,
        name: "",
        email,
        username: null,
        user_number: null,
        onboarding_completed: false,
        profile_data: null,
        profile_md: null,
      };
      isNewRow = true;
    }

    // id selalu disertakan agar upsert(onConflict: "id") tahu baris targetnya.
    const patch: Record<string, unknown> = { id: userId };
    if (typeof body?.name === "string") {
      const name = body.name.trim().slice(0, 60);
      if (name.length >= 2) patch.name = name;
    }
    if (typeof body?.username === "string") {
      const username = normalizeUsername(body.username);
      if (!isUsernameValid(username)) {
        return NextResponse.json(
          { error: "Username hanya boleh huruf kecil, angka, dan _ (3–20 karakter)." },
          { status: 400 }
        );
      }
      const { data: clash } = await db()
        .from("users")
        .select("id")
        .eq("username", username)
        .neq("id", userId)
        .maybeSingle();
      if (clash) {
        return NextResponse.json(
          { error: "Username sudah dipakai pengguna lain." },
          { status: 409 }
        );
      }
      patch.username = username;
    }
    if (typeof body?.onboardingCompleted === "boolean") {
      patch.onboarding_completed = body.onboardingCompleted;
    }

    let profileData = { ...(row.profile_data ?? {}) } as Record<string, unknown>;
    if (body?.profileData && typeof body.profileData === "object") {
      profileData = { ...profileData, ...body.profileData };
    }
    if (typeof body?.plan === "string") {
      profileData.plan = body.plan === "pro" ? "pro" : "free";
    }
    patch.profile_data = profileData;

    // Selalu segarkan profile.md dari profil terbaru agar AI tahu konteks user.
    const finalName =
      typeof patch.name === "string" ? (patch.name as string) : row.name;
    const finalUsername =
      typeof patch.username === "string" ? (patch.username as string) : row.username;
    patch.profile_md = buildProfileMarkdown({
      name: finalName,
      username: finalUsername,
      userNumber: row.user_number,
      education: typeof profileData.education === "string" ? profileData.education : "",
      grade: typeof profileData.grade === "string" ? profileData.grade : "",
      psyAnswers:
        profileData.psyAnswers && typeof profileData.psyAnswers === "object"
          ? (profileData.psyAnswers as Record<string, string>)
          : null,
      weakTopic: typeof profileData.weakTopic === "string" ? profileData.weakTopic : "",
      learningHabit:
        typeof profileData.learningHabit === "string" ? profileData.learningHabit : "",
      peakHour: typeof profileData.peakHour === "string" ? profileData.peakHour : "",
      plan: typeof profileData.plan === "string" ? profileData.plan : "free",
      analysis:
        profileData.analysis && typeof profileData.analysis === "object"
          ? (profileData.analysis as OnboardingAnalysis)
          : null,
    });

    // Baris baru → INSERT (trigger fill_user_number menetapkan nomor user).
    // Baris lama → UPDATE; hindari upsert karena PostgREST meng-update SEMUA
    // kolom dengan nilai EXCLUDED sehingga kolom NOT NULL (email) jadi null.
    const { data, error } = isNewRow
      ? await db()
          .from("users")
          .insert({ ...patch, id: userId, email: row.email })
          .select(
            "id, name, email, username, user_number, onboarding_completed, profile_data, profile_md"
          )
          .single()
      : await db()
          .from("users")
          .update(patch)
          .eq("id", userId)
          .select(
            "id, name, email, username, user_number, onboarding_completed, profile_data, profile_md"
          )
          .single();

    if (error) {
      // 23505 = unique violation (race condition: username diambil akun lain
      // tepat setelah cek ketersediaan lolos).
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        return NextResponse.json(
          { error: "Username sudah dipakai pengguna lain." },
          { status: 409 }
        );
      }
      throw error;
    }

    // Sinkronkan nama ke metadata Supabase Auth (best-effort) supaya
    // syncAuthSession() di client membaca nama terbaru setelah refresh.
    if (typeof patch.name === "string") {
      try {
        const finalName = patch.name as string;
        const { data: existing } = await db().auth.admin.getUserById(userId);
        const meta = existing?.user?.user_metadata ?? {};
        await db().auth.admin.updateUserById(userId, {
          user_metadata: { ...meta, name: finalName },
        });
      } catch (metaErr) {
        console.warn(
          "[api/profile] sinkron nama ke metadata Supabase gagal (best-effort):",
          metaErr
        );
      }
    }

    return NextResponse.json({ user: toPayload(data as ProfileRow) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan profil.";
    console.error("[api/profile] PUT", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
