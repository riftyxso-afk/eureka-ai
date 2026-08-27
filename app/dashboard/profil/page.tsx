"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  BookOpen,
  Brain,
  Camera,
  Copy,
  Flame,
  Gift,
  GraduationCap,
  LogOut,
  Mail,
  PartyPopper,
  School,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import { useOnboarding } from "@/context/OnboardingContext";
import { getUserId, getUserName, setUserName } from "@/lib/identity";
import { logoutUser, updateSessionName } from "@/lib/auth";
import { fileToAvatarDataUrl, getAvatar, setAvatar } from "@/lib/avatar";
import { PlanBadge } from "@/components/PlanBadge";
import { useI18n } from "@/context/LocaleContext";
import {
  EDUCATION_OPTIONS,
  ONBOARDING_STEPS,
  gradeOptionsFor,
} from "@/lib/onboardingContent";
import {
  educationForGrade,
  gradeLabel,
  normalizeGrade,
} from "@/lib/gradeVocab";

const SCHOOL_KEY = "eureka_school";

/** Label tampilan untuk nilai opsi onboarding (weakTopic/habit/peakHour). */
function optionLabel(stepKey: string, value?: string | null): string {
  if (!value) return "—";
  const step = ONBOARDING_STEPS.find((s) => s.key === stepKey);
  return (
    step?.options?.find((o) => o.value === value)?.label ?? value
  );
}

function readSchool(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SCHOOL_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function ProfilPage() {
  const { data, update } = useOnboarding();
  const { dict } = useI18n();
  const l = dict.profile;
  const userId = getUserId();
  const [form, setForm] = useState({
    name: getUserName(),
    email: "",
    username: "",
    school: readSchool(),
    education: "",
    grade: "",
  });
  const [userNumber, setUserNumber] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [avatar, setAvatarState] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState({
    xp: 0,
    level: 1,
    streak: 0,
    rank: null as number | null,
    totalNotes: 0,
  });
  const [refStatus, setRefStatus] = useState<{
    code: string;
    count: number;
    goal: number;
    rewarded: boolean;
    link: string;
  } | null>(null);
  // Ringkasan hasil onboarding + status skip (kartu "Lengkapi Orientasi").
  const [summary, setSummary] = useState<{
    psyLabel: string;
    weakTopic: string;
    learningHabit: string;
    peakHour: string;
    tagline: string;
  } | null>(null);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: getUserName(),
      email: prev.email || "akun-lokal@eureka.local",
      grade: data.grade || prev.grade,
    }));
    // Muat profil asli dari Supabase (email, @username, nomor urut user).
    (async () => {
      try {
        const res = await apiFetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return;
        const payload = await res.json();
        const u = payload?.user;
        if (!u) return;
        // Kosakata grade kanonik: nilai lama bergaya label dinormalisasi
        // agar select tidak kosong dan simpanan tidak merusak data.
        const canonicalGrade =
          normalizeGrade(u.profileData?.grade) ?? normalizeGrade(data.grade);
        const education =
          (typeof u.profileData?.education === "string" &&
            u.profileData.education) ||
          educationForGrade(canonicalGrade) ||
          "";
        setForm((prev) => ({
          ...prev,
          name: u.name || prev.name,
          email: u.email || prev.email,
          username: u.username || prev.username,
          education,
          grade: canonicalGrade || "",
        }));
        if (typeof u.profileData?.onboardingSkipped === "boolean") {
          setOnboardingSkipped(u.profileData.onboardingSkipped);
        }
        const a = u.profileData?.analysis;
        if (a && typeof a === "object") {
          setSummary({
            psyLabel: a.psyLabel ?? "",
            weakTopic: u.profileData?.weakTopic ?? "",
            learningHabit: u.profileData?.learningHabit ?? "",
            peakHour: u.profileData?.peakHour ?? "",
            tagline: a.tagline ?? "",
          });
        }
        if (u.userNumber != null) setUserNumber(Number(u.userNumber));
        // Foto profil: prioritas dari server (profile_data.avatarUrl),
        // fallback ke cache lokal.
        const serverAvatar =
          typeof u.profileData?.avatarUrl === "string" &&
          u.profileData.avatarUrl.startsWith("data:image/")
            ? u.profileData.avatarUrl
            : null;
        setAvatarState(serverAvatar ?? getAvatar());
        if (serverAvatar) setAvatar(serverAvatar);
      } catch {
        // biarkan nilai lokal
      }
    })();
  }, [data.grade, userId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [progressRes, notesRes] = await Promise.all([
        apiFetch(`/api/progress?userId=${encodeURIComponent(userId)}`),
        apiFetch(`/api/notes?userId=${encodeURIComponent(userId)}`),
      ]);
      if (progressRes.ok) {
        const payload = await progressRes.json();
        if (payload.stats) {
          setStats((prev) => ({
            ...prev,
            xp: payload.stats.xp,
            level: payload.stats.level,
            streak: payload.stats.streak,
            rank: payload.stats.rank,
          }));
        }
      }
      if (notesRes.ok) {
        const payload = await notesRes.json();
        setStats((prev) => ({
          ...prev,
          totalNotes: Array.isArray(payload.notes) ? payload.notes.length : 0,
        }));
      }
    } catch {
      // biarkan nilai awal
    }
  }, [userId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Status program referral (link, progres x/5, status reward).
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(
          `/api/referral?userId=${encodeURIComponent(userId)}`
        );
        if (!res.ok) return;
        const payload = await res.json();
        if (payload?.code) setRefStatus(payload);
      } catch {
        // tabel referral belum ada → sembunyikan seksi
      }
    })();
  }, [userId]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast(l.errNameEmpty);
      return;
    }
    const cleanUsername = form.username.trim().toLowerCase().replace(/^@+/, "");
    if (cleanUsername && !/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      showToast(l.errUsername);
      return;
    }
    setUserName(form.name);
    updateSessionName(form.name);
    // Simpan grade dalam kosakata kanonik (enum mesin), bukan label.
    const canonicalGrade = normalizeGrade(form.grade) ?? "";
    const canonicalEducation =
      form.education || educationForGrade(canonicalGrade) || "";
    update({
      name: form.name.trim(),
      education: canonicalEducation,
      grade: canonicalGrade,
    });
    try {
      window.localStorage.setItem(SCHOOL_KEY, form.school.trim());
    } catch {
      // abaikan
    }
    try {
      const res = await apiFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: form.name.trim(),
          username: cleanUsername,
          profileData: {
            school: form.school.trim(),
            education: canonicalEducation,
            grade: canonicalGrade,
            ...(avatar ? { avatarUrl: avatar } : {}),
          },
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        showToast(payload?.error ?? l.errSave);
        return;
      }
      if (payload?.user?.userNumber != null) {
        setUserNumber(Number(payload.user.userNumber));
      }
    } catch {
      showToast(l.errSave);
      return;
    }
    showToast(l.saved);
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast(l.errPhotoSize);
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatar(dataUrl);
      setAvatarState(dataUrl);
      showToast(l.photoChanged);
    } catch (err) {
      showToast(err instanceof Error ? err.message : l.errPhotoLoad);
    }
  };

  const removeAvatar = () => {
    setAvatar(null);
    setAvatarState(null);
    showToast(l.photoRemoved);
  };

  const copyRefLink = async () => {
    if (!refStatus?.link) return;
    try {
      await navigator.clipboard.writeText(refStatus.link);
      showToast(l.refCopied);
    } catch {
      showToast(l.refCopyFailed);
    }
  };

  const shareRefLink = async () => {
    if (!refStatus?.link) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: l.shareTitle,
          text: l.shareText,
          url: refStatus.link,
        });
      } else {
        await copyRefLink();
      }
    } catch {
      // dibatalkan user
    }
  };

  const handleLogout = async () => {
    if (window.confirm(l.confirmLogout)) {
      await logoutUser();
      window.location.href = "/login";
    }
  };

  const statCards = [
    { icon: TrendingUp, label: l.totalXp, value: stats.xp },
    { icon: BookOpen, label: l.totalNotes, value: stats.totalNotes },
    { icon: Flame, label: l.streak, value: stats.streak },
  ];

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{l.title}</h1>
      <p className="mt-2 text-base font-semibold text-clay-muted">
        {l.desc}
      </p>

      {/* Avatar + info ringkas */}
      <div className="card-clay mt-6 flex flex-col items-center py-8 text-center">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-clay-primary/20 text-5xl shadow-clay-sm">
            {avatar ? (
              <img
                src={avatar}
                alt={l.photoAlt}
                className="h-full w-full object-cover"
              />
            ) : (
              <GraduationCap size={44} className="text-clay-primary" />
            )}
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            aria-label={l.changePhoto}
            title={l.changePhoto}
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-clay-primary text-white shadow-clay-btn transition-all duration-75 active:translate-y-0.5"
          >
            <Camera size={15} />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
        </div>
        {avatar && (
          <button
            onClick={removeAvatar}
            className="mt-2 flex items-center gap-1 text-xs font-extrabold text-red-500 underline-offset-2 hover:underline"
          >
            <Trash2 size={12} /> {l.removePhoto}
          </button>
        )}
        <p className="mt-4 flex items-center justify-center gap-2 text-2xl font-extrabold text-clay-dark">
          <span className="truncate">{form.name}</span>
          <PlanBadge size="md" className="shrink-0" />
        </p>
        <p className="text-sm font-bold text-clay-muted">{form.email}</p>
        {form.username && (
          <p className="mt-1 text-sm font-extrabold text-clay-primary">
            @{form.username}
            {userNumber != null && (
              <span className="ml-2 rounded-full bg-clay-primary/10 px-3 py-0.5 text-xs">
                {l.userNumber.replace("{n}", String(userNumber))}
              </span>
            )}
          </p>
        )}
        <span className="mt-3 inline-block rounded-clay-full border-2 border-clay-primary bg-clay-primary/10 px-5 py-1.5 text-sm font-extrabold text-clay-primary">
          Level {stats.level} · {l.levelTitle}
        </span>
      </div>

      {/* Statistik akun */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((s) => (
          <div key={s.label} className="card-clay flex flex-col items-center gap-1 !p-4 text-center sm:!p-5">
            <s.icon size={18} className="text-clay-primary sm:hidden" />
            <s.icon size={20} className="hidden text-clay-primary sm:block" />
            <p className="text-xl font-extrabold sm:text-2xl">
              {s.value.toLocaleString("id-ID")}
            </p>
            <p className="text-xs font-bold text-clay-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Kartu lengkapi orientasi — hanya untuk yang melewati onboarding */}
      {onboardingSkipped && (
        <CardClay className="mt-6 !border-clay-primary/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-clay-dark">
                <Sparkles size={20} className="text-clay-primary" />
                Kenalan lebih dekat yuk!
              </h2>
              <p className="mt-1 text-sm font-semibold text-clay-muted">
                Lengkapi orientasi (±1 menit) supaya Eureka bisa mempersonalisasi
                cara belajarmu.
              </p>
            </div>
            <a
              href="/onboarding?resume=1"
              className="btn-clay-primary shrink-0 !min-h-[44px] !px-5 text-sm"
            >
              {l.completeOnboarding}
            </a>
          </div>
        </CardClay>
      )}

      {/* Ringkasan hasil onboarding */}
      {(summary || form.grade) && (
        <CardClay className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-clay-dark">
            <Brain size={20} className="text-clay-primary" />
            {l.learningProfile}
          </h2>
          {summary ? (
            <>
              {summary.tagline && (
                <p className="mt-3 text-sm font-extrabold text-clay-primary">
                  “{summary.tagline}”
                </p>
              )}
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  [l.summaryPsy, summary.psyLabel],
                  [l.summaryWeak, optionLabel("weakTopic", summary.weakTopic)],
                  [
                    l.summaryHabit,
                    optionLabel("learningHabit", summary.learningHabit),
                  ],
                  [l.summaryPeak, optionLabel("peakHour", summary.peakHour)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-clay-md border-2 border-clay-shadow/40 bg-clay-inputBg px-4 py-3"
                  >
                    <dt className="text-[10px] font-extrabold uppercase tracking-wide text-clay-muted">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-clay-dark">
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="mt-3 text-sm font-semibold text-clay-muted">
              {l.summaryEmpty}
            </p>
          )}
        </CardClay>
      )}

      {/* Program Referral */}
      {refStatus && (
        <CardClay className="mt-6 !border-clay-primary/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-clay-dark">
              <Gift size={20} className="text-clay-primary" />
              {l.referralProgram}
            </h2>
            {refStatus.rewarded ? (
              <span className="flex items-center gap-1.5 rounded-clay-full bg-clay-success/15 px-4 py-1.5 text-xs font-extrabold text-clay-success">
                <PartyPopper size={14} /> {l.rewardClaimed}
              </span>
            ) : (
              <span className="rounded-clay-full bg-clay-primary/10 px-4 py-1.5 text-xs font-extrabold text-clay-primary">
                {l.inviteGoal.replace("{n}", String(refStatus.goal))}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm font-semibold text-clay-muted">
            {l.referralDesc.replace("{n}", String(refStatus.goal))}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded-clay-md border-2 border-clay-shadow/40 bg-clay-inputBg px-4 py-3 text-sm font-bold text-clay-dark">
              <span className="block truncate">{refStatus.link}</span>
            </div>
            <button
              onClick={copyRefLink}
              aria-label={l.copyRefLink}
              title={l.copyRefLink}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-md border-2 border-clay-primary bg-clay-primary text-white transition-all duration-75 active:translate-y-0.5"
            >
              <Copy size={17} />
            </button>
            <button
              onClick={shareRefLink}
              aria-label={l.shareRefLink}
              title={l.shareRefLink}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-md border-2 border-clay-primary bg-clay-primary text-white transition-all duration-75 active:translate-y-0.5"
            >
              <Share2 size={17} />
            </button>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-extrabold text-clay-muted">
              <span>
                {l.validRefs
                  .replace("{count}", String(refStatus.count))
                  .replace("{goal}", String(refStatus.goal))}
              </span>
              <span>
                {refStatus.count >= refStatus.goal
                  ? l.readyCheck
                  : l.needMore.replace(
                      "{n}",
                      String(Math.max(refStatus.goal - refStatus.count, 0))
                    )}
              </span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-clay-full bg-clay-shadow/25">
              <div
                className="h-full rounded-clay-full bg-gradient-to-r from-clay-primary to-clay-secondary transition-all duration-500"
                style={{
                  width: `${Math.min(
                    Math.round((refStatus.count / refStatus.goal) * 100),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        </CardClay>
      )}

      {/* Form edit profil */}
      <CardClay className="mt-6">
        <h2 className="text-lg font-extrabold text-clay-dark">{l.editProfile}</h2>

        <div className="mt-5 space-y-5">
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <User size={15} className="text-clay-primary" />
              {l.fullName}
            </label>
            <InputClay
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={l.namePlaceholder}
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <User size={15} className="text-clay-primary" />
              {l.username}
            </label>
            <InputClay
              value={form.username}
              onChange={(e) =>
                setForm({
                  ...form,
                  username: e.target.value
                    .toLowerCase()
                    .replace(/^@+/, "")
                    .replace(/[^a-z0-9_]/g, ""),
                })
              }
              placeholder={l.usernamePlaceholder}
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <Mail size={15} className="text-clay-primary" />
              {l.email}
            </label>
            <InputClay
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={l.emailPlaceholder}
              disabled
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <School size={15} className="text-clay-primary" />
              {l.school}
            </label>
            <InputClay
              value={form.school}
              onChange={(e) => setForm({ ...form, school: e.target.value })}
              placeholder={l.schoolPlaceholder}
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <GraduationCap size={15} className="text-clay-primary" />
              {l.education}
            </label>
            <div className="relative">
              <select
                value={form.education}
                onChange={(e) =>
                  setForm({ ...form, education: e.target.value, grade: "" })
                }
                className="w-full appearance-none rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-5 py-4 pr-12 text-base font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none"
              >
                <option value="">{l.chooseEducation}</option>
                {EDUCATION_OPTIONS.map((edu) => (
                  <option key={edu.value} value={edu.value}>
                    {edu.label.replace(/^[^\w]+\s*/, "")}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-clay-muted">
                ▾
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <GraduationCap size={15} className="text-clay-primary" />
              {l.grade}
            </label>
            <div className="relative">
              <select
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="w-full appearance-none rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-5 py-4 pr-12 text-base font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none disabled:opacity-60"
                disabled={!form.education}
              >
                <option value="">
                  {form.education ? l.chooseGrade : l.chooseEducation}
                </option>
                {gradeOptionsFor(form.education).map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-clay-muted">
                ▾
              </span>
            </div>
            {/* Kelas tersimpan (mis. dari onboarding) tetap terbaca sebagai label */}
            {!form.education && form.grade && (
              <p className="mt-2 text-xs font-bold text-clay-muted">
                Tersimpan: {gradeLabel(form.grade) || form.grade}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <ButtonClay onClick={handleSave} className="sm:flex-1">
              {l.saveChanges}
            </ButtonClay>
            <ButtonClay
              variant="secondary"
              onClick={handleLogout}
              className="border-red-300 text-red-500 sm:flex-1"
            >
              <LogOut size={18} className="mr-2" />
              {l.logout}
            </ButtonClay>
          </div>
        </div>
      </CardClay>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn">
          {toast}
        </div>
      )}
    </div>
  );
}
