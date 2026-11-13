"use client";

import {TrainingSettings} from "@/components/dashboard/TrainingContribution";
import LearningConsent from "@/components/dashboard/LearningConsent";
import "@/components/dashboard/study-production.css";
import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import StudyArt from "@/components/dashboard/StudyArt";
import Link from "next/link";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import StudyFlowNav from "@/components/dashboard/StudyFlowNav";
import { useTheme } from "@/context/ThemeContext";
import "../study-flows.css";

const sections = [
  { id: "appearance", label: "Tampilan", icon: <StudyArt name="palette" /> },
  { id: "privacy", label: "Data & AI", icon: <StudyArt name="gear" /> },
  { id: "account", label: "Akun", icon: <StudyArt name="profile" /> },
] as const;

const themes = [
  { id: "light", label: "Terang", icon: <StudyArt name="sun" size={24} /> },
  { id: "dark", label: "Gelap", icon: <StudyArt name="moon" size={24} /> },
  { id: "system", label: "Ikuti perangkat", icon: <StudyArt name="system" size={24} /> },
] as const;

export default function SettingsPage() {
  const [section, setSection] = useState<(typeof sections)[number]["id"]>("appearance");
  const { theme, setTheme } = useTheme();
  return (
    <V2FeaturePage title="Pengaturan" art={10} guide="settings">
      <main className="study-flow settings-flow">
        <header className="flow-heading"><h1 className="study-flow-title"><StudyArt name="gear" size={46} /><span>Pengaturan</span><small>Beta</small></h1></header>
        <div className="flow-layout">
          <StudyFlowNav label="Kategori pengaturan" items={sections} current={section} onChange={setSection} />
          <section className="flow-panel" id="flow-panel" aria-labelledby="settings-title">
            {section === "appearance" ? (
              <>
                <h2 id="settings-title">Tema aplikasi</h2>
                <p className="flow-description">Pilih tampilan yang nyaman untukmu. Pilihan langsung tersimpan.</p>
                <div className="settings-themes" role="group" aria-label="Pilih tema">
                  {themes.map(({ id, label, icon }) => (
                    <button type="button" key={id} aria-pressed={theme === id} onClick={() => setTheme(id)}>
                      <span className="theme-preview" data-theme={id} aria-hidden="true">
                        <i /><b><i /><i /></b>
                      </span>
                      <span className="theme-caption">{icon}<span>{label}</span>{theme === id && <Check size={16} aria-hidden="true" />}</span>
                    </button>
                  ))}
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
