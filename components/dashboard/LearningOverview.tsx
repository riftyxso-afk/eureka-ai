"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FaceSticker, CuriousGlobeSticker } from "stick-it-up";
import { useTheme } from "@/context/ThemeContext";
import { useV2Progress } from "./V2Progress";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { studyDay } from "@/lib/streak";
import LoadingStatus from "@/components/ui/LoadingStatus";
import type { SubjectJourney } from "@/lib/subject-journey";
import type { Contribution } from "@/components/amicro/MonoActivityHeatmap";
import "./learning-overview.css";

const Activity = dynamic(() => import("@/components/amicro/MonoActivityHeatmap").then(module => module.MonoActivityHeatmap));
const Radar = dynamic(() => import("@/components/amicro/MonoRoundedRadarChart").then(module => module.MonoRoundedRadarChart));
type Subject = { id: string; name: string; journey: SubjectJourney };

export default function LearningOverview({ premium }: { premium: boolean }) {
  const { resolved } = useTheme();
  const { stats, loading, error, refresh } = useV2Progress();
  const [checking, setChecking] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectError, setSubjectError] = useState("");
  const [subjectLoading, setSubjectLoading] = useState(premium);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!premium) { setSubjects([]); setSubjectLoading(false); return; }
    const controller = new AbortController();
    setSubjectLoading(true); setSubjectError("");
    void apiFetch("/api/subjects?journey=1", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(async response => { const body = await response.json(); if (!response.ok || !Array.isArray(body.subjects)) throw new Error("Progres pelajaran belum bisa dimuat."); if (!controller.signal.aborted) setSubjects(body.subjects); })
      .catch(cause => { if (!controller.signal.aborted) setSubjectError(cause instanceof Error ? cause.message : "Progres belum tersedia."); })
      .finally(() => { if (!controller.signal.aborted) setSubjectLoading(false); });
    return () => controller.abort();
  }, [premium, revision]);
  const days = useMemo<Contribution[]>(() => {
    const active = new Set(stats?.activeDays ?? []);
    const today = stats?.streakDetails.today ?? studyDay();
    return Array.from({ length: 140 }, (_, index) => {
      const date = new Date(Date.parse(today) - (139 - index) * 86_400_000).toISOString().slice(0, 10);
      return { date, count: active.has(date) ? 1 : 0, level: active.has(date) ? 4 : 0 };
    });
  }, [stats]);
  const data = subjects.filter(subject => subject.journey?.progressAvailable).slice(0, 6).map(subject => ({ subject: subject.name, metric: subject.journey.percent }));
  async function checkIn() {
    if (checking || stats?.streakDetails.activeToday) return;
    setChecking(true); setAttendanceError("");
    try {
      const response = await apiFetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: getUserId(), action: "check_in" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Absen belum tersimpan.");
      await refresh();
    } catch (cause) { setAttendanceError(cause instanceof Error ? cause.message : "Absen belum tersimpan."); }
    finally { setChecking(false); }
  }
  return <section className="learning-overview" aria-label="Ritme belajar">
    <div className="learning-panel">
      <div className="learning-heading"><div><h2>Hadir untuk dirimu</h2><p>Setiap hari belajar berarti. Kalender mengikuti WIB.</p></div><span className="learning-sticker" aria-hidden="true"><FaceSticker size={62} peel /></span></div>
      {loading ? <LoadingStatus stage="synchronizing" compact /> : !stats ? <div role="alert"><p>{error || "Aktivitas belum tersedia."}</p><button onClick={() => void refresh()}>Coba lagi</button></div> : <Activity data={days} theme={resolved} accentColor="purple" compact streak={stats.streak} />}
      {attendanceError && <p className="learning-error" role="alert">{attendanceError}</p>}
      <div className="learning-footer"><button className="learning-action" disabled={loading || !stats || checking || stats.streakDetails.activeToday} onClick={() => void checkIn()}>{checking ? "Menyimpan…" : stats?.streakDetails.activeToday ? "Kehadiran hari ini tercatat" : "Absen hari ini"}</button><Link href="/dashboard-v2/streaks">Lihat aktivitas</Link></div>
    </div>
    <div className="learning-panel">
      <div className="learning-heading"><div><h2>Arah belajarmu</h2><p>Materi, kartu, dan pengulangan per pelajaran.</p></div><span className="learning-sticker" aria-hidden="true"><CuriousGlobeSticker size={58} peel /></span></div>
      {!premium ? <p>Aktifkan Pro untuk meninjau perjalanan tiap pelajaran.</p> : subjectLoading ? <LoadingStatus stage="retrieving" compact /> : subjectError ? <div role="alert"><p>{subjectError}</p><button onClick={() => setRevision(value => value + 1)}>Coba lagi</button></div> : data.length >= 3 ? <Radar theme={resolved} data={data} compact /> : <div className="learning-subject-list">{data.length ? <>{data.map(item => <div key={item.subject}><span>{item.subject}</span><progress max={100} value={item.metric} /><strong>{item.metric}%</strong></div>)}<p>Radar muncul setelah ada minimal tiga pelajaran dengan data aktivitas.</p></> : <p>Tambahkan mata pelajaran dan materi pertamamu untuk mulai melihat progres.</p>}</div>}
      <div className="learning-footer"><small>Progres aktivitas, bukan nilai penguasaan.</small><Link href={premium ? "/dashboard-v2/mata-pelajaran" : "/dashboard-v2/pricing"}>{premium ? "Tinjau pelajaran" : "Lihat Pro"}</Link></div>
    </div>
    <Link className="learning-library-link" href="/dashboard-v2/perpustakaan"><span><strong>Masuk ke perpustakaan</strong><small>Jelajahi buku daring atau buka studio dongeng bergambar.</small></span><span aria-hidden="true">↗</span></Link>
  </section>;
}
