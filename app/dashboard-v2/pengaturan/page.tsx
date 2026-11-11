"use client";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import Link from "next/link";
export default function SettingsPage() {
  return <V2FeaturePage title="Pengaturan" art={10} guide="settings"><main className="account-profile-editor" style={{maxWidth:720,margin:"24px auto",padding:24}}><h1>Pengaturan</h1><section style={{paddingBlock:24}}><h2>Tampilan</h2><p>Pilih tema yang nyaman untuk belajar.</p><ThemeSwitch /></section><section style={{paddingBlock:24}}><h2>Akun dan teman</h2><p><Link href="/dashboard-v2/profil">Lengkapi profil</Link></p><p><Link href="/dashboard-v2/teman">Kelola teman belajar</Link></p></section></main></V2FeaturePage>;
}
