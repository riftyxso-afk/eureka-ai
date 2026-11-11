"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, ListChecks } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { profileChecklist, type ChecklistProfile } from "@/lib/profileChecklist";
import "./profile-checklist.css";

export default function ProfileChecklist() {
  const [profile, setProfile] = useState<ChecklistProfile | null>(null);
  const [hidden, setHidden] = useState(false);
  const [storageKey, setStorageKey] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await apiFetch(`/api/profile?userId=${encodeURIComponent(getUserId())}`, { signal });
      const result = await response.json();
      if (response.ok && result.user && !signal?.aborted) setProfile(result.user);
    } catch { /* Do not mark an unavailable profile as incomplete. */ }
  }, []);
  useEffect(() => {
    const key = "eureka:profile-checklist:hidden:" + getUserId();
    setStorageKey(key);
    try { setHidden(localStorage.getItem(key) === "yes"); } catch { /* Current tab still works. */ }
    const controller = new AbortController();
    void refresh(controller.signal);
    const update = () => { void refresh(controller.signal); };
    window.addEventListener("eureka:profile-updated", update);
    return () => { controller.abort(); window.removeEventListener("eureka:profile-updated", update); };
  }, [refresh]);
  if (!profile) return null;
  const items = profileChecklist(profile);
  const count = items.filter(item => item.done).length;
  if (count === items.length) return null;
  const toggle = (next: boolean) => {
    setHidden(next);
    try { localStorage.setItem(storageKey, next ? "yes" : "no"); } catch { /* Optional persistence. */ }
  };
  return <aside className="profile-setup" aria-label="Checklist kelengkapan profil" data-collapsed={hidden}>
    {hidden ? <button className="profile-setup-reopen" type="button" aria-expanded={false} aria-controls="profile-checklist" onClick={() => toggle(false)}><ListChecks size={17} /><span>Lengkapi profil</span><span className="profile-setup-fraction">{count}/{items.length}</span></button>
      : <section id="profile-checklist" className="profile-setup-card">
        <header><span className="profile-setup-symbol"><ListChecks size={19} /></span><div><h2>Buat Eureka lebih personal</h2><p>{count} dari {items.length} langkah selesai</p></div><button type="button" onClick={() => toggle(true)} aria-label="Sembunyikan checklist profil" aria-expanded={true} aria-controls="profile-checklist"><ChevronDown size={18} /></button></header>
        <progress value={count} max={items.length} aria-label="Kelengkapan profil" />
        <ul>{items.map(item => <li key={item.id}>{item.done ? <span className="profile-setup-item is-done"><span className="profile-setup-check"><Check size={12} /></span>{item.label}<span className="sr-only">, selesai</span></span>
          : <Link className="profile-setup-item" href={item.href}><span className="profile-setup-check" aria-hidden="true" /><span>{item.label}</span><ArrowUpRight size={14} aria-hidden="true" /></Link>}</li>)}</ul>
        <p className="profile-setup-footnote">Isi sedikit dulu, lanjutkan kapan saja.</p>
      </section>}
  </aside>;
}
