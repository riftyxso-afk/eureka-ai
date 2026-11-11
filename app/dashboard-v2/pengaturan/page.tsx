"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Monitor, Moon, Palette, Settings, Sun, UserRound, Users } from "lucide-react";
import Link from "next/link";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import StudyFlowNav from "@/components/dashboard/StudyFlowNav";
import { useTheme } from "@/context/ThemeContext";
import "../study-flows.css";

const sections = [
  { id: "appearance", label: "Tampilan", icon: <Palette size={18} /> },
  { id: "account", label: "Akun", icon: <UserRound size={18} /> },
] as const;

const themes = [
  { id: "light", label: "Terang", icon: <Sun size={17} /> },
  { id: "dark", label: "Gelap", icon: <Moon size={17} /> },
  { id: "system", label: "Ikuti perangkat", icon: <Monitor size={17} /> },
] as const;

export default function SettingsPage() {
  const [section, setSection] = useState<(typeof sections)[number]["id"]>("appearance");
  const { theme, setTheme } = useTheme();
  return (
    <V2FeaturePage title="Pengaturan" art={10} guide="settings">
      <main className="study-flow settings-flow">
        <header className="flow-heading"><h1><Settings size={28} aria-hidden="true" /> Pengaturan</h1></header>
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
            ) : (
              <>
                <h2 id="settings-title">Akun</h2>
                <div className="settings-links">
                  <Link href="/dashboard-v2/profil">
                    <UserRound size={20} aria-hidden="true" /><span><strong>Profil saya</strong><small>Nama, sekolah, dan informasi belajar</small></span><ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                  <Link href="/dashboard-v2/teman">
                    <Users size={20} aria-hidden="true" /><span><strong>Teman belajar</strong><small>Kelola teman dan bagikan materi</small></span><ArrowUpRight size={16} aria-hidden="true" />
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
