"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Flag,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import {
  MISSION_TEMPLATES,
  addMission,
  deleteMission,
  getMissions,
  missionProgress,
  missionTypeLabel,
  updateMission,
  type Mission,
  type MissionType,
} from "@/lib/mission-store";

export default function MisiPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingGuide, setLoadingGuide] = useState<string | null>(null);

  // Form misi baru
  const [template, setTemplate] = useState<MissionType>("ipk");
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [deadline, setDeadline] = useState("");

  const reload = () => setMissions(getMissions());
  useEffect(() => {
    reload();
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const tpl = MISSION_TEMPLATES.find((t) => t.type === template)!;

  const createMission = () => {
    const cur = Number(currentValue.replace(",", "."));
    const tgt = Number(targetValue.replace(",", "."));
    if (!Number.isFinite(tgt) || tgt <= 0) {
      notify("Isi nilai target dengan benar ⚠️");
      return;
    }
    const mission = addMission({
      type: template,
      title: tpl.title,
      currentValue: Number.isFinite(cur) ? cur : undefined,
      targetValue: tgt,
      unit: tpl.unit,
      deadline: deadline || undefined,
    });
    setShowNew(false);
    setCurrentValue("");
    setTargetValue("");
    setDeadline("");
    reload();
    notify("Misi dibuat! 🎯");
    void requestGuide(mission.id);
  };

  const requestGuide = async (id: string) => {
    const m = getMissions().find((x) => x.id === id);
    if (!m) return;
    setLoadingGuide(id);
    try {
      const res = await apiFetch("/api/missions/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: m.type,
          title: m.title,
          currentValue: m.currentValue,
          targetValue: m.targetValue,
          unit: m.unit,
          deadline: m.deadline,
          education: m.type === "ipk" ? "Mahasiswa" : m.type === "snbp" || m.type === "snbt" ? "SMA Kelas 12" : "",
          userId: getUserId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal");
      updateMission(id, { guide: data.guide, steps: data.steps });
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "AI sibuk — coba lagi nanti");
    } finally {
      setLoadingGuide(null);
    }
  };

  const completeMission = (id: string) => {
    updateMission(id, { status: "done" });
    reload();
    notify("Misi selesai — hebat! 🎉");
  };

  const active = missions.filter((m) => m.status === "active");
  const done = missions.filter((m) => m.status === "done");

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Misi Belajar</h1>
      <p className="mt-2 text-base font-semibold text-clay-muted">
        Tetapkan target besar — AI membimbingmu langkah demi langkah
      </p>

      <div className="mt-5 flex justify-end">
        <ButtonClay
          onClick={() => setShowNew((v) => !v)}
          className="min-h-[44px] px-4 py-2 text-sm"
        >
          <Plus size={16} className="mr-2" />
          Misi Baru
        </ButtonClay>
      </div>

      {showNew && (
        <CardClay className="mt-4 !p-4 sm:!p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MISSION_TEMPLATES.map((t) => {
              const activeTpl = template === t.type;
              return (
                <button
                  key={t.type}
                  onClick={() => setTemplate(t.type)}
                  className={`rounded-clay-md border-3 p-3 text-left transition-all duration-75 min-h-[72px] ${
                    activeTpl
                      ? "border-clay-primary bg-clay-primary/5 shadow-clay-sm"
                      : "border-clay-shadow/40 bg-white hover:-translate-y-0.5"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-sm font-extrabold text-clay-dark">
                      {t.title}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-clay-muted">
                    {t.desc}
                  </span>
                  <span className="mt-1.5 inline-block rounded-clay-full bg-clay-beige px-2 py-0.5 text-[10px] font-extrabold text-clay-muted">
                    {t.forLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                NILAI SEKARANG ({tpl.unit})
              </label>
              <InputClay
                placeholder={tpl.type === "ipk" ? "2.0" : "500"}
                inputMode="decimal"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                TARGET ({tpl.unit})
              </label>
              <InputClay
                placeholder={String(tpl.defaultTarget)}
                inputMode="decimal"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                TENGGAT (opsional)
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <ButtonClay
              variant="secondary"
              onClick={() => setShowNew(false)}
              className="flex-1"
            >
              Batal
            </ButtonClay>
            <ButtonClay onClick={createMission} className="flex-1">
              <Target size={16} className="mr-2" />
              Buat Misi
            </ButtonClay>
          </div>
        </CardClay>
      )}

      {active.length === 0 && done.length === 0 && !showNew && (
        <div className="card-clay mt-4 flex flex-col items-center py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
            <Flag size={30} className="text-clay-muted" />
          </div>
          <h3 className="mt-4 text-lg font-extrabold">Belum ada misi</h3>
          <p className="mt-1.5 max-w-sm text-sm font-semibold text-clay-muted">
            Contoh: mahasiswa kejar IPK dari 2 ke 3.5, atau siswa SMA kelas 12
            mengejar lulus SNBP/SNBT.
          </p>
          <ButtonClay
            onClick={() => setShowNew(true)}
            className="mt-5 min-h-[44px] px-5 py-2 text-sm"
          >
            <Target size={16} className="mr-2" /> Buat Misi Pertama
          </ButtonClay>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {active.map((m) => {
          const progress = missionProgress(m);
          return (
            <CardClay key={m.id} className="!p-4 sm:!p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-primary/10 text-lg">
                    {MISSION_TEMPLATES.find((t) => t.type === m.type)?.icon ?? "🎯"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-clay-dark">
                      {missionTypeLabel(m.type)}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-clay-muted">
                      {m.currentValue != null ? `${m.currentValue} → ` : ""}
                      Target {m.targetValue} {m.unit}
                      {m.deadline ? (
                        <>
                          {" "}
                          ·{" "}
                          {new Date(`${m.deadline}T00:00:00`).toLocaleDateString(
                            "id-ID",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </>
                      ) : (
                        ""
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-clay-primary">
                    {progress}%
                  </span>
                  <button
                    onClick={() => {
                      deleteMission(m.id);
                      reload();
                      notify("Misi dihapus");
                    }}
                    aria-label="Hapus misi"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-red-100 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-clay-inputBg shadow-clay-inset">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-clay-primary to-clay-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progress)}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 20 }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void requestGuide(m.id)}
                  disabled={loadingGuide === m.id}
                  className="btn-clay-ghost !min-h-[40px] !px-3 text-xs"
                >
                  {loadingGuide === m.id ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <Sparkles size={14} className="mr-1 text-clay-primary" />
                  )}
                  <span className="font-extrabold">
                    {loadingGuide === m.id
                      ? "AI menyusun... "
                      : m.guide
                        ? "Bimbingan AI (perbarui)"
                        : "Minta Bimbingan AI"}
                  </span>
                </button>
                <button
                  onClick={() => completeMission(m.id)}
                  className="btn-clay-primary !min-h-[40px] !px-3 text-xs"
                >
                  <CheckCircle2 size={14} className="mr-1" />
                  <span className="font-extrabold">Tandai Selesai</span>
                </button>
              </div>

              {m.guide && (
                <div className="mt-4 rounded-clay-md border-2 border-clay-shadow/30 bg-clay-beige/60 p-4">
                  <p className="text-sm font-semibold leading-relaxed text-clay-dark">
                    {m.guide}
                  </p>
                  {m.steps && m.steps.length > 0 && (
                    <ol className="mt-3 space-y-2">
                      {m.steps.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm font-semibold text-clay-dark"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-clay-primary text-[10px] font-extrabold text-white">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{s}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </CardClay>
          );
        })}
      </div>

      {done.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-extrabold sm:text-xl">Misi Selesai 🏆</h2>
          <div className="mt-3 space-y-2">
            {done.map((m) => (
              <div
                key={m.id}
                className="card-clay flex items-center gap-3 !p-4 opacity-70"
              >
                <span className="text-xl">
                  {MISSION_TEMPLATES.find((t) => t.type === m.type)?.icon ?? "🏆"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-clay-dark">
                    {missionTypeLabel(m.type)}
                  </p>
                  <p className="text-xs font-bold text-clay-muted">
                    Target {m.targetValue} {m.unit} — selesai 🎉
                  </p>
                </div>
                <button
                  onClick={() => {
                    deleteMission(m.id);
                    reload();
                  }}
                  aria-label="Hapus misi"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-clay-muted hover:bg-red-100 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn">
          {toast}
        </div>
      )}
    </div>
  );
}
