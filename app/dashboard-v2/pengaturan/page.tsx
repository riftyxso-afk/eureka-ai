"use client";

import {TrainingSettings} from "@/components/dashboard/TrainingContribution";
import LearningConsent from "@/components/dashboard/LearningConsent";
import "@/components/dashboard/study-production.css";
import { useEffect, useState } from "react";
import { Plug, ArrowUpRight } from "lucide-react";
import StudyArt from "@/components/dashboard/StudyArt";
import Link from "next/link";
import { useRouter } from "next/navigation";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import StudyFlowNav from "@/components/dashboard/StudyFlowNav";
import { useTheme } from "@/context/ThemeContext";
import { SakugaRadio } from "@/components/ui/sakuga";
import { apiFetch } from "@/lib/apiClient";
import { FLAGSHIP_PROMPT_COST, FLAGSHIP_STARTING_CREDITS } from "@/lib/assistant/dahonoModels";
import "../study-flows.css";

const sections = [
  { id: "appearance", label: "Tampilan", icon: <StudyArt name="palette" /> },
  { id: "connectors", label: "Konektor", icon: <Plug size={22} /> },
  { id: "privacy", label: "Data & AI", icon: <StudyArt name="gear" /> },
  { id: "account", label: "Akun", icon: <StudyArt name="profile" /> },
] as const;

const themes = [
  { id: "light", label: "Terang" },
  { id: "dark", label: "Gelap" },
  { id: "system", label: "Ikuti perangkat" },
] as const;

function FlagshipCreditPill() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let request: AbortController | undefined;
    const refresh = async () => {
      if (request) return;
      const controller = new AbortController();
      request = controller;
      try {
        const response = await apiFetch("/api/assistant/models", { signal: controller.signal });
        const value = response.ok ? (await response.json()).dahono?.credits : null;
        if (!controller.signal.aborted && Number.isFinite(value)) setCredits(value);
      } catch {
        // Keep the last known balance through temporary outages.
      } finally {
        request = undefined;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      request?.abort();
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const tone = credits === null ? "unknown" : credits < FLAGSHIP_PROMPT_COST ? "empty"
    : credits < FLAGSHIP_PROMPT_COST * 3 ? "low" : "healthy";
  const label = credits !== null ? `${credits} / ${FLAGSHIP_STARTING_CREDITS} kredit Flagship`
    : loading ? "Memuat kredit Flagship…" : "Kredit Flagship belum tersedia";
  return <span className="flagship-credit" data-balance={tone} aria-live="polite"
    title={`${FLAGSHIP_PROMPT_COST} kredit per prompt Flagship`}>{label}</span>;
}

export default function SettingsPage() {
  const router = useRouter();
  const [section, setSection] = useState<(typeof sections)[number]["id"]>("appearance");
  const { theme, setTheme } = useTheme();
  return (
    <V2FeaturePage title="Pengaturan" art={10} guide="settings">
      <main className="study-flow settings-flow">
        <header className="flow-heading settings-heading">
          <h1 className="study-flow-title"><StudyArt name="gear" size={46} /><span>Pengaturan</span><small>Beta</small></h1>
          <div className="flex flex-wrap items-center gap-3"><Link href="/dashboard-v2/pengaturan/konektor" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 px-4 text-sm font-bold text-violet-700 dark:border-violet-800 dark:text-violet-200"><Plug size={17} />Konektor</Link><FlagshipCreditPill /></div>
        </header>
        <div className="flow-layout">
          <StudyFlowNav label="Kategori pengaturan" items={sections} current={section} onChange={id => {
            if (id === "connectors") router.push("/dashboard-v2/pengaturan/konektor");
            else setSection(id);
          }} />
          <section className="flow-panel" id="flow-panel" aria-labelledby="settings-title">
            {section === "appearance" ? (
              <>
                <h2 id="settings-title">Tema aplikasi</h2>
                <p className="flow-description">Pilih tampilan yang nyaman untukmu. Pilihan langsung tersimpan.</p>
                <div className="sakuga-radio-row settings-theme-options">
                  <SakugaRadio label="Tema aplikasi" name="theme" value={theme} options={themes} onChange={value => {
                    const choice = themes.find(item => item.id === value);
                    if (choice) setTheme(choice.id);
                  }} />
                </div>
              </>
            ) : section === "privacy" ? (<><h2 id="settings-title">Data & AI</h2><TrainingSettings/><details className="settings-personalization"><summary>Personalisasi akun (terpisah dari fine-tuning)</summary><LearningConsent/></details></>) : (
              <>
                <h2 id="settings-title">Akun</h2>
                <div className="settings-links">
                  <Link href="/dashboard-v2/profil">
                    <StudyArt name="profile" /><span><strong>Profil saya</strong><small>Nama, sekolah, dan informasi belajar</small></span><ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                  <Link href="/dashboard-v2/teman">
                    <StudyArt name="friends" /><span><strong>Teman belajar</strong><small>Kelola teman dan bagikan materi</small></span><ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </V2FeaturePage>
  );
}
