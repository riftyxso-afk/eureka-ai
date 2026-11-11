"use client";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import Link from "next/link";
import "../misi/mission-learning.css";
export default function SettingsPage() {return <V2FeaturePage title="Pengaturan" art={10} guide="settings"><main className="eureka-settings"><header><h1>Ruangmu, caramu.</h1><p>Atur kenyamanan belajar dan kelola akunmu.</p></header><section className="settings-section"><h2>Tampilan</h2><div className="settings-row"><div><h3>Tema aplikasi</h3><p>Pilih tampilan terang atau gelap.</p></div><ThemeSwitch/></div></section><section className="settings-section"><h2>Akun & koneksi</h2><Link className="settings-row" href="/dashboard-v2/profil"><div><h3>Profil saya</h3><p>Nama, sekolah, dan informasi belajarmu.</p></div><span>›</span></Link><Link className="settings-row" href="/dashboard-v2/teman"><div><h3>Teman belajar</h3><p>Kelola teman dan bagikan materi.</p></div><span>›</span></Link></section></main></V2FeaturePage>}
