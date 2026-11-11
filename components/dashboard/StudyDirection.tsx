"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CuriousGlobeSticker } from "stick-it-up";
import { useTheme } from "@/context/ThemeContext";
import { apiFetch } from "@/lib/apiClient";
import LoadingStatus from "@/components/ui/LoadingStatus";
import type { SubjectJourney } from "@/lib/subject-journey";
import "./learning-overview.css";

const Radar = dynamic(() => import("@/components/amicro/MonoRoundedRadarChart")
  .then(module => module.MonoRoundedRadarChart));

type Subject = { id: string; name: string; journey: SubjectJourney };

export default function StudyDirection() {
  const { resolved } = useTheme();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    async function load() {
      try {
        const response = await apiFetch("/api/subjects?journey=1", {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.subjects)) {
          throw new Error("Progres pelajaran belum bisa dimuat.");
        }
        if (!controller.signal.aborted) setSubjects(body.subjects);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Progres belum tersedia.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [revision]);

  const radarData = subjects.filter(subject => subject.journey?.progressAvailable)
    .slice(0, 6)
    .map(subject => ({ subject: subject.name, metric: subject.journey.percent }));

  return <main className="study-direction-page">
    <header className="learning-heading study-direction-header">
      <div>
        <h1>Arah belajar</h1>
        <p>Lihat progres dari materi, flashcard, dan pengulangan untuk setiap mata pelajaran.</p>
      </div>
      <span className="learning-sticker" aria-hidden="true"><CuriousGlobeSticker size={66} peel /></span>
    </header>
    {loading ? <div className="learning-panel"><LoadingStatus stage="retrieving" detail="Memuat progres pelajaran" compact /></div>
      : error ? <div className="learning-panel" role="alert">
        <p>{error}</p>
        <button className="learning-action" onClick={() => setRevision(value => value + 1)}>Coba lagi</button>
      </div> : <div className="study-direction-grid">
        <section className="learning-panel" aria-labelledby="study-radar-title">
          <div className="learning-heading"><h2 id="study-radar-title">Radar pelajaran</h2></div>
          {radarData.length >= 3
            ? <Radar theme={resolved} data={radarData} compact />
            : <p className="learning-muted">Radar muncul setelah ada tiga pelajaran dengan data aktivitas.</p>}
        </section>
        <section className="learning-panel" aria-labelledby="study-subjects-title">
          <div className="learning-heading"><h2 id="study-subjects-title">Progres per pelajaran</h2></div>
          {subjects.length ? <ul className="learning-subject-list">{subjects.map(({ id, name, journey }) => <li key={id}>
            <span>{name}</span>
            {journey?.progressAvailable ? <>
              <progress aria-label={`Progres ${name}`} max={100} value={journey.percent} />
              <strong>{journey.percent}%</strong>
            </> : <small>Data belum tersedia</small>}
          </li>)}</ul> : <p className="learning-muted">Tambahkan mata pelajaran dan materi untuk mulai melihat progres.</p>}
          <div className="learning-footer"><Link href="/dashboard-v2/mata-pelajaran">Buka Mata Pelajaran</Link></div>
        </section>
      </div>}
  </main>;
}
