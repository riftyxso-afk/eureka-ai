"use client";

/**
 * Model Store — katalog semua model AI (model-store-selector).
 *
 * Setiap model tampil sebagai KARTU: logo brand, nama, badge peringkat
 * kecerdasan (1–5 otak, "sedikit pintar → terpintar"), deskripsi, dan
 * penanda terpilih. Grup per tier (Kilat/Seimbang/Mendalam). Klik kartu →
 * mode manual (terkunci ke model itu); klik lagi → lepas ke mode otomatis.
 * Model tanpa channel Juan ditandai "segera" (tetap bisa dipilih — rantai
 * fallback menanggungnya).
 */
import { Brain, Check, Crown, Gem, Leaf, Lock, Zap } from "lucide-react";

import {
  MODEL_CATALOG,
  type AiSpeedMode,
  type ModelCatalogEntry,
} from "@/lib/modelCatalog";

const TIER_META: Record<
  AiSpeedMode,
  { label: string; icon: typeof Zap; tint: string; chip: string }
> = {
  fast: { label: "Kilat", icon: Zap, tint: "text-amber-600", chip: "bg-amber-500/15 text-amber-600" },
  normal: { label: "Seimbang", icon: Leaf, tint: "text-emerald-600", chip: "bg-emerald-500/15 text-emerald-600" },
  deep: { label: "Mendalam", icon: Gem, tint: "text-clay-primary", chip: "bg-clay-primary/15 text-clay-primary" },
};

/** Badge peringkat kecerdasan: 1–5 otak. */
function SmartnessBadge({ level }: { level: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-px"
      title={`Kecerdasan ${level}/5 — dari sedikit pintar (1) sampai terpintar (5)`}
      aria-label={`Kecerdasan ${level} dari 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Brain
          key={i}
          size={10}
          className={i < level ? "text-clay-primary" : "text-clay-borderLight"}
        />
      ))}
    </span>
  );
}

interface ModelStoreProps {
  /** Model terpilih saat ini (mode manual) — ""/undefined = mode otomatis. */
  selectedModel?: string;
  /** Status premium user — model premiumOnly dikunci bila false. */
  isPremium?: boolean;
  onPick: (id: string) => void;
  /** Klik badge Pro pada model terkunci → buka halaman pricing. */
  onUpgrade?: () => void;
}

export function ModelStore({ selectedModel, isPremium = false, onPick, onUpgrade }: ModelStoreProps) {
  const tiers: AiSpeedMode[] = ["fast", "normal", "deep"];
  return (
    <div className="max-h-[60vh] overflow-y-auto px-1 py-1">
      {tiers.map((tier) => {
        const meta = TIER_META[tier];
        // Urutan tampil: sedikit pintar → terpintar (smartness asc).
        const models = MODEL_CATALOG.filter((m) => m.tier === tier).sort(
          (a, b) => a.smartness - b.smartness
        );
        return (
          <div key={tier} className="mb-2 last:mb-0">
            <div
              className={`sticky top-0 z-10 flex items-center gap-1.5 bg-clay-cream px-2 pb-1 pt-1.5 text-[10px] font-extrabold uppercase tracking-wide ${meta.tint}`}
            >
              <meta.icon size={11} />
              {meta.label}
            </div>
            <div className="grid grid-cols-1 gap-1.5 px-1 sm:grid-cols-2">
              {models.map((m) => (
                <ModelCard
                  key={m.id}
                  model={m}
                  selected={selectedModel === m.id}
                  locked={Boolean(m.premiumOnly) && !isPremium}
                  onPick={onPick}
                  onUpgrade={onUpgrade}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModelCard({
  model,
  selected,
  locked,
  onPick,
  onUpgrade,
}: {
  model: ModelCatalogEntry;
  selected: boolean;
  /** Model premiumOnly & user belum Pro → terkunci. */
  locked: boolean;
  onPick: (id: string) => void;
  onUpgrade?: () => void;
}) {
  const meta = TIER_META[model.tier];
  return (
    <button
      type="button"
      onClick={() => (locked ? onUpgrade?.() : onPick(model.id))}
      aria-pressed={selected}
      aria-disabled={locked}
      title={
        locked
          ? `${model.name} — khusus pengguna Pro. Klik untuk upgrade.`
          : selected
          ? `${model.name} — klik untuk lepas, kembali ke mode otomatis`
          : `${model.brand} · ${model.name}`
      }
      className={`relative flex flex-col gap-1.5 rounded-clay-sm border-2 bg-white/70 p-2.5 text-left transition-all duration-100 ${
        locked
          ? "border-clay-borderLight/60 opacity-70"
          : "hover:-translate-y-0.5"
      } ${
        selected
          ? "border-clay-primary bg-clay-primary/5 shadow-clay-sm"
          : locked
          ? ""
          : "border-clay-borderLight shadow-clay-sm hover:border-clay-primary/40"
      }`}
    >
      {/* Penanda terpilih / Pro terkunci */}
      {selected && !locked && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-clay-primary text-white">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {locked && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-clay-beige text-clay-muted">
          <Lock size={9} />
        </span>
      )}

      {/* Header kartu: logo + nama + brand */}
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-clay-sm bg-clay-beige">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={model.logo}
            alt=""
            className="h-5 w-5 rounded"
            onError={(e) => {
              // Logo hilang → ganti ikon tier, jangan biarkan gambar rusak.
              const el = e.currentTarget;
              el.style.display = "none";
              const box = el.parentElement;
              if (box && !box.querySelector("svg")) {
                box.classList.add(meta.tint);
                box.insertAdjacentHTML(
                  "beforeend",
                  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>`
                );
              }
            }}
          />
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-[12px] font-extrabold leading-tight ${
              selected ? "text-clay-primary" : "text-clay-dark"
            }`}
          >
            {model.name}
          </span>
          <span className="block truncate text-[10px] font-bold text-clay-muted">
            {model.brand}
          </span>
        </span>
      </span>

      {/* Deskripsi */}
      <span className="line-clamp-2 text-[10.5px] font-semibold leading-snug text-clay-muted">
        {model.desc}
      </span>

      {/* Footer kartu: badge tier + segera + peringkat */}
      <span className="mt-auto flex items-center justify-between gap-1">
        <span className="flex items-center gap-1">
          <span className={`rounded-full px-1.5 py-px text-[9px] font-extrabold ${meta.chip}`}>
            {meta.label}
          </span>
          {!model.available && (
            <span className="rounded-full bg-clay-beige px-1.5 py-px text-[9px] font-bold text-clay-muted">
              segera
            </span>
          )}
          {model.premiumOnly && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-extrabold text-amber-600">
              <Crown size={8} /> Pro
            </span>
          )}
        </span>
        <SmartnessBadge level={model.smartness} />
      </span>
    </button>
  );
}
