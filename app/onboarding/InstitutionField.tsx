"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type Institution = { id: string; name: string; city: string; type?: string };
type Lookup = { query: string; level: string; items: Institution[]; error?: string };

export default function InstitutionField({ value, level, onChange }: {
  value: string;
  level: string;
  onChange: (value: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [lookup, setLookup] = useState<Lookup>();
  const [attempt, setAttempt] = useState(0);
  const query = value.trim();
  const searching = query.length >= 5 && value !== selected;
  const result = lookup?.query === query && lookup.level === level ? lookup : undefined;
  const campus = level === "mahasiswa";
  const institutionLabel = campus ? "Nama kampus" : level === "lainnya" ? "Nama sekolah atau kampus" : "Nama sekolah";

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, level });
        const response = await fetch(`/api/institutions?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        setLookup({ query, level, items: Array.isArray(data.items) ? data.items : [], error: response.ok ? undefined : data.error });
      } catch {
        if (!controller.signal.aborted) {
          setLookup({ query, level, items: [], error: "Pencarian belum tersedia. Kamu bisa lanjut dengan nama yang sudah diketik." });
        }
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, level, searching, attempt]);

  return <div className="onboarding-institutions">
    <label htmlFor="onboarding-school">{institutionLabel}</label>
    <div className="onboarding-institution-input">
      <Search size={18} aria-hidden="true" />
      <input id="onboarding-school" type="search" autoComplete="off" maxLength={100}
        placeholder={campus ? "Contoh: Universitas Indonesia" : "Contoh: SMP Negeri 1 Denpasar"}
        aria-describedby="onboarding-school-hint" value={value} onChange={event => { setSelected(""); onChange(event.target.value); }} />
    </div>
    {searching && <p className="onboarding-institution-hint" role="status">
      {!result ? "Mencari di direktori pendidikan…" : result.error ||
        (result.items.length ? "Pilih hasil yang sesuai dengan kota atau kodenya." : "Tidak ada hasil. Tambahkan kota atau lanjut dengan nama yang diketik.")}
    </p>}
    {searching && result?.error && <button type="button" className="onboarding-institution-retry" onClick={() => { setLookup(undefined); setAttempt(value => value + 1); }}>Coba cari lagi</button>}
    {searching && !!result?.items.length && <ul className="onboarding-institution-results" aria-label="Hasil pencarian">
      {result.items.map(item => <li key={item.id}>
        <button type="button" onClick={() => { setSelected(item.name); onChange(item.name); }}>
          <strong>{item.name}</strong>
          <small>{[item.type, item.city, item.id].filter(Boolean).join(" · ")}</small>
        </button>
      </li>)}
    </ul>}
    <p className="onboarding-institution-hint" id="onboarding-school-hint">Ketik minimal 5 karakter, misalnya nama dan kota. Kamu juga bisa mengisi nama sendiri.</p>
  </div>;
}
