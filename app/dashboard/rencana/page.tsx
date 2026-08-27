"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, Origami, Plus, Sparkles, Trash2, X } from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import {
  PLAN_DAYS,
  addPlanItem,
  deletePlanItem,
  getPlanItems,
  getPlanStats,
  planDayLabel,
  sortPlanItems,
  togglePlanItem,
  type PlanDay,
  type PlanItem,
} from "@/lib/plan-store";

/**
 * Kertas origami: kartu bergaya kertas lipat — sudut terlipat (clip-path),
 * garis lipatan, tekstur halus, dan bayangan tipis.
 */
function OrigamiPaper({
  children,
  className = "",
  rotate = 0,
}: {
  children: React.ReactNode;
  className?: string;
  rotate?: number;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-clay-md ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {/* Tekstur kertas */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,251,235,0.9), rgba(254,243,199,0.75) 45%, rgba(253,230,138,0.5))",
        }}
      />
      {/* Garis lipatan diagonal */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "repeating-linear-gradient(115deg, transparent 0 22px, rgba(180,140,60,0.08) 22px 23px, transparent 23px 46px, rgba(180,140,60,0.05) 46px 47px)",
        }}
      />
      {/* Lipatan sudut kiri atas */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-10 w-10"
        style={{
          background:
            "linear-gradient(225deg, rgba(255,255,255,0.9), rgba(253,230,138,0.35))",
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
          boxShadow: "inset -1px -1px 2px rgba(180,140,60,0.25)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Warna subjek (chip kecil) — palet hangat ala kertas. */
const SUBJECT_COLORS = [
  "bg-amber-200 text-amber-900",
  "bg-rose-200 text-rose-900",
  "bg-sky-200 text-sky-900",
  "bg-emerald-200 text-emerald-900",
  "bg-violet-200 text-violet-900",
  "bg-orange-200 text-orange-900",
];

function subjectColor(subject: string): string {
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}

function formatTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${Number(h)}.${m ?? "00"}`;
}

export default function RencanaPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Form item baru
  const [day, setDay] = useState<PlanDay>("senin");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");

  const reload = () => setItems(getPlanItems());
  useEffect(() => {
    reload();
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const stats = useMemo(() => getPlanStats(items), [items]);
  const sorted = useMemo(() => sortPlanItems(items), [items]);

  const createItem = () => {
    const clean = title.trim();
    if (clean.length < 3) {
      notify("Isi nama aktivitas belajar dulu");
      return;
    }
    addPlanItem({
      day,
      time: time || undefined,
      title: clean,
      subject: subject.trim() || undefined,
    });
    setShowNew(false);
    setTitle("");
    setTime("");
    setSubject("");
    reload();
    notify("Ditambahkan ke rencana!");
  };

  const todayIndex = new Date().getDay(); // 0=Min .. 6=Sab → geser ke Senin
  const today = PLAN_DAYS[(todayIndex + 6) % 7].id;

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <OrigamiPaper rotate={-3} className="h-14 w-14 !rounded-clay-lg">
          <span className="flex h-14 w-14 items-center justify-center text-amber-700">
            <Origami size={26} />
          </span>
        </OrigamiPaper>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Rencana Belajar</h1>
          <p className="mt-1 text-sm font-semibold text-clay-muted sm:text-base">
            Lipat rencanamu jadi nyata — satu kertas per hari
          </p>
        </div>
      </div>

      {/* Kartu progres — origami besar */}
      <OrigamiPaper className="mt-6 !rounded-clay-lg">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-clay-md bg-amber-500/15 text-amber-700">
                <Sparkles size={20} />
              </span>
              <div>
                <p className="text-base font-extrabold text-amber-950">
                  Minggu ini
                </p>
                <p className="text-xs font-bold text-amber-800/70">
                  {stats.done} dari {stats.total} aktivitas selesai
                </p>
              </div>
            </div>
            <span className="text-2xl font-extrabold text-amber-700">
              {stats.percent}%
            </span>
          </div>
          <div className="mt-4 h-3.5 w-full overflow-hidden rounded-clay-full bg-amber-900/10 shadow-clay-inset">
            <motion.div
              className="h-full rounded-clay-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400"
              initial={{ width: 0 }}
              animate={{ width: `${stats.percent}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 20 }}
            />
          </div>
        </div>
      </OrigamiPaper>

      {/* Tombol tambah */}
      <div className="mt-5 flex justify-end">
        <ButtonClay
          onClick={() => setShowNew((v) => !v)}
          className="min-h-[44px] px-4 py-2 text-sm"
        >
          <Plus size={16} className="mr-2" />
          Tambah Aktivitas
        </ButtonClay>
      </div>

      {/* Form tambah */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardClay className="mt-4 !p-4 sm:!p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                    HARI
                  </label>
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value as PlanDay)}
                    className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]"
                  >
                    {PLAN_DAYS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                    JAM (OPSIONAL)
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                    AKTIVITAS
                  </label>
                  <InputClay
                    placeholder="Mis. Review Fisika Bab 3"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                    SUBJEK (OPSIONAL)
                  </label>
                  <InputClay
                    placeholder="Mis. Matematika"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
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
                <ButtonClay onClick={createItem} className="flex-1">
                  <Plus size={16} className="mr-2" />
                  Simpan ke Rencana
                </ButtonClay>
              </div>
            </CardClay>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid 7 hari — kartu origami */}
      {sorted.length === 0 && !showNew ? (
        <div className="card-clay mt-4 flex flex-col items-center py-14 text-center">
          <OrigamiPaper rotate={4} className="h-16 w-16 !rounded-clay-lg">
            <span className="flex h-16 w-16 items-center justify-center text-amber-700">
              <Origami size={30} />
            </span>
          </OrigamiPaper>
          <h3 className="mt-4 text-lg font-extrabold">Rencanamu masih kosong</h3>
          <p className="mt-1.5 max-w-sm text-sm font-semibold text-clay-muted">
            Tambahkan aktivitas belajar per hari — AI bantu wujudkan targetmu
            satu lipatan demi lipatan.
          </p>
          <ButtonClay
            onClick={() => setShowNew(true)}
            className="mt-5 min-h-[44px] px-5 py-2 text-sm"
          >
            <Plus size={16} className="mr-2" /> Buat Rencana Pertama
          </ButtonClay>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {PLAN_DAYS.map((d, di) => {
            const dayItems = sorted.filter((i) => i.day === d.id);
            const dayStats = getPlanStats(dayItems);
            const isToday = d.id === today;
            return (
              <OrigamiPaper
                key={d.id}
                rotate={di % 2 === 0 ? -1 : 1}
                className={`min-h-[180px] ${isToday ? "ring-2 ring-amber-400" : ""}`}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
                      {d.short}
                    </p>
                    {isToday && (
                      <span className="rounded-clay-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-800">
                        Hari ini
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-amber-900/10">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${dayStats.percent}%` }}
                    />
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {dayItems.length === 0 ? (
                      <p className="py-3 text-center text-[10px] font-bold text-amber-800/40">
                        —
                      </p>
                    ) : (
                      dayItems.map((item) => (
                        <div
                          key={item.id}
                          className={`group flex items-start gap-1.5 rounded-clay-md border border-amber-900/10 bg-clay-cream/60 px-2 py-1.5 transition-all duration-75 ${
                            item.done ? "opacity-55" : ""
                          }`}
                        >
                          <button
                            onClick={() => {
                              togglePlanItem(item.id);
                              reload();
                            }}
                            aria-label={item.done ? "Tandai belum selesai" : "Tandai selesai"}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              item.done
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-amber-900/30 bg-clay-cream hover:border-amber-500"
                            }`}
                          >
                            {item.done && <Check size={10} strokeWidth={4} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-[11px] font-extrabold leading-tight text-amber-950 ${
                                item.done ? "line-through" : ""
                              }`}
                            >
                              {item.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              {item.time && (
                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-800/60">
                                  <Clock size={8} />
                                  {formatTime(item.time)}
                                </span>
                              )}
                              {item.subject && (
                                <span
                                  className={`rounded-clay-full px-1.5 py-px text-[8px] font-extrabold ${subjectColor(
                                    item.subject
                                  )}`}
                                >
                                  {item.subject}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              deletePlanItem(item.id);
                              reload();
                            }}
                            aria-label="Hapus"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-amber-800/0 transition-colors hover:bg-red-100 hover:text-red-500 group-hover:text-amber-800/50"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </OrigamiPaper>
            );
          })}
        </div>
      )}

      {/* Ringkasan hari */}
      {sorted.length > 0 && (
        <div className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
            <Origami size={18} className="text-amber-600" />
            Rincian Mingguan
          </h2>
          <div className="mt-3 space-y-2">
            {PLAN_DAYS.map((d) => {
              const dayItems = sorted.filter((i) => i.day === d.id);
              if (dayItems.length === 0) return null;
              return (
                <div key={d.id} className="card-clay flex items-center gap-3 !p-3.5">
                  <span className="w-16 shrink-0 text-sm font-extrabold text-amber-800">
                    {d.label}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {dayItems.map((item) => (
                      <span
                        key={item.id}
                        className={`rounded-clay-full border border-amber-900/10 px-2.5 py-1 text-[11px] font-extrabold ${
                          item.done
                            ? "bg-emerald-100 text-emerald-800 line-through"
                            : "bg-clay-cream/70 text-amber-950"
                        }`}
                      >
                        {item.time ? `${formatTime(item.time)} · ` : ""}
                        {item.title}
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 text-xs font-extrabold text-clay-muted">
                    {getPlanStats(dayItems).done}/{dayItems.length}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-right text-xs font-semibold text-clay-muted">
            Disimpan otomatis di perangkatmu ·{" "}
            {planDayLabel(today)} adalah hari ini
          </p>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.button
            key="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={() => setToast(null)}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn"
          >
            {toast}
            <X size={14} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
