"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Flag, Plus, Trophy, Zap } from "lucide-react";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { PENDING_PROMPT_KEY } from "@/lib/assistant/pendingPrompt";
import {
  MISSION_TEMPLATES, addMission, completedMissionSteps, deleteMission, finishMission,
  getMissions, missionProgress, missionXp, toggleMissionCheckpoint, updateMission,
  type Mission, type MissionType,
} from "@/lib/mission-store";
import "./missions.css";

export default function MisiPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<MissionType>("umum");
  const [busy, setBusy] = useState<"plan" | "chat" | null>(null);
  const [status, setStatus] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const pending = useRef(false);
  const refresh = () => setMissions(getMissions());
  useEffect(() => {
    setMissions(getMissions());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const selected = missions.find(m => m.id === selectedId) ?? missions.find(m => m.status === "active") ?? missions[0];
  const template = MISSION_TEMPLATES.find(item => item.type === type)!;
  const completed = selected ? completedMissionSteps(selected) : [];
  const next = selected?.steps?.find(step => !completed.includes(step));
  const xp = missions.reduce((sum, mission) => sum + missionXp(mission), 0);
  const wins = missions.filter(m => m.status === "done").length;

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim() || template.title;
    const target = String(data.get("target") ?? "").trim();
    const mission = addMission({
      type, title, unit: template.unit,
      targetValue: target ? Number(target) : undefined,
      deadline: String(data.get("deadline") || "") || undefined,
      planSource: "starter",
      steps: [
        "Petakan materi dan pilih satu bagian yang paling sulit.",
        "Luangkan 15 menit untuk berlatih. Catat dua kesalahan atau pertanyaan.",
        "Ulangi latihan tanpa melihat catatan dan tulis hasilnya.",
      ],
    });
    setSelectedId(mission.id);
    setCreating(false);
    setStatus("Misi dibuat. Mulai checkpoint pertama atau minta rencana dari Momo.");
    refresh();
  }

  async function plan(mission: Mission, blocker: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy("plan");
    setStatus("");
    try {
      const response = await apiFetch("/api/missions/guide", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mission.type,
          title: mission.title,
          currentValue: mission.currentValue,
          targetValue: mission.targetValue,
          unit: mission.unit,
          deadline: mission.deadline,
          completedSteps: completedMissionSteps(mission),
          blocker,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.source !== "ai" || !Array.isArray(result.steps)) {
        throw new Error("Momo belum bisa menyusun rencana. Checkpoint lama masih bisa dikerjakan.");
      }
      const latest = getMissions().find(item => item.id === mission.id);
      if (!latest || latest.status !== "active") return;
      const kept = completedMissionSteps(latest);
      const remaining = [...new Set<string>(result.steps.filter((step: unknown): step is string => typeof step === "string" && !!step.trim()))].filter(step => !kept.includes(step));
      if (!remaining.length) throw new Error("Momo belum menemukan checkpoint baru. Coba jelaskan kendalamu.");
      updateMission(mission.id, { steps: [...kept, ...remaining], guide: result.guide, planSource: "ai" });
      refresh();
      setStatus("Rencana diperbarui. Checkpoint yang sudah selesai tetap tercatat.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rencana belum bisa dimuat.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  async function practice(mission: Mission, step: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy("chat");
    setStatus("");
    try {
      const response = await apiFetch("/api/assistant/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getUserId() }),
      });
      const data = await response.json();
      if (!response.ok || !data.session?.id) throw new Error();
      sessionStorage.setItem(PENDING_PROMPT_KEY, JSON.stringify({
        prompt: `Dampingi saya mengerjakan misi belajar "${mission.title}". Checkpoint: "${step}". Beri satu aktivitas singkat yang bisa saya kerjakan sekarang, tunggu jawaban saya, lalu beri umpan balik. Jangan langsung memberi solusi.`,
      }));
      router.push(`/chat/${encodeURIComponent(data.session.id)}`);
    } catch {
      setStatus("Chat latihan belum bisa dibuka. Coba lagi.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  return (
    <main className="mission-board">
      <header className="mission-banner">
        <div><span className="mission-eyebrow"><Flag size={15} /> MARKAS BELAJAR</span><h1>Misi Belajar</h1><p>Pilih target, tuntaskan checkpoint, dan naik level.</p></div>
        <button type="button" className="mission-button mission-new" aria-expanded={creating} onClick={() => setCreating(value => !value)}><Plus size={17} /> Misi baru</button>
      </header>
      <div className="mission-stats">
        <div><Zap size={19} /><strong>{xp} XP</strong><span>XP misi di perangkat ini</span></div>
        <div><Flag size={19} /><strong>Level {1 + Math.floor(xp / 100)}</strong><span>{100 - xp % 100} XP ke level berikutnya</span></div>
        <div><Trophy size={19} /><strong>{wins} selesai</strong><span>Dari {missions.length} misi</span></div>
      </div>
      {creating && (
        <form className="mission-panel mission-form" onSubmit={create}>
          <h2>Siapkan misi</h2>
          <div className="mission-fields">
            <label>Jenis misi<select value={type} onChange={event => setType(event.target.value as MissionType)}>{MISSION_TEMPLATES.map(item => <option key={item.type} value={item.type}>{item.title}</option>)}</select></label>
            <label>Nama misi<input name="title" maxLength={120} placeholder={template.title} /></label>
            <label>Target {template.unit} (opsional)<input name="target" type="number" min="0.01" max={type === "ipk" ? 4 : undefined} step="any" placeholder={String(template.defaultTarget)} /></label>
            <label>Tenggat (opsional)<input name="deadline" type="date" /></label>
          </div>
          <button className="mission-button mission-primary" type="submit">Buat misi <ArrowRight size={16} /></button>
        </form>
      )}
      {status && <p className="mission-notice" role="status">{status}</p>}
      {selected ? (
        <div className="mission-layout">
          <aside className="mission-panel mission-list" aria-label="Daftar misi">
            <h2>Koleksi misi</h2>
            {missions.map(mission => <button type="button" key={mission.id} aria-pressed={mission.id === selected.id} onClick={() => { setSelectedId(mission.id); setDeleteId(""); setStatus(""); }}><span>{mission.title}</span><small>{mission.status === "done" ? "Selesai" : `${missionProgress(mission)}%`}</small></button>)}
          </aside>
          <section className="mission-panel mission-track">
            <div className="mission-track-heading">
              <div><span className="mission-eyebrow">{selected.status === "done" ? "MISI SELESAI" : "JALUR MISI"}</span><h2>{selected.title}</h2></div>
              <span className="mission-reward">+{missionXp(selected)} XP</span>
            </div>
            {selected.deadline && <p className="mission-meta">Tenggat {selected.deadline}</p>}
            <div className="mission-progress-label"><span>Progres misi</span><strong>{missionProgress(selected)}%</strong></div>
            <progress aria-label="Progres misi" max={100} value={missionProgress(selected)} />
            <ol className="mission-checkpoints">
              {[...new Set(selected.steps)].map((step, index) => {
                const checked = completed.includes(step);
                return <li key={`${index}-${step}`} data-next={next === step || undefined}>
                  <label><input type="checkbox" checked={checked} disabled={selected.status === "done"} onChange={() => { toggleMissionCheckpoint(selected.id, step); refresh(); }} /><span className="mission-node" aria-hidden="true">{checked ? <Check size={16} /> : index + 1}</span><span className="mission-step-copy">{next === step && <small>CHECKPOINT BERIKUTNYA</small>}{step}</span><small className="mission-step-xp">+10 XP</small></label>
                </li>;
              })}
            </ol>
            {!selected.steps?.length && selected.status === "active" && <p className="mission-meta">Minta Momo menyusun checkpoint pertama untuk misi ini.</p>}
            {selected.status === "active" && <>
              {selected.targetValue != null && <form className="mission-score" key={selected.id} onSubmit={event => {
                event.preventDefault();
                const value = Number(new FormData(event.currentTarget).get("score"));
                updateMission(selected.id, { currentValue: value }); refresh();
              }}><label>Nilai tercatat · target {selected.targetValue} {selected.unit}<input name="score" required type="number" min="0" max={selected.type === "ipk" ? 4 : undefined} step="any" defaultValue={selected.currentValue} /></label><button type="submit" className="mission-button">Simpan nilai</button></form>}
              <button className="mission-button mission-primary" disabled={missionProgress(selected) < 100 || (selected.targetValue != null && (selected.currentValue ?? -1) < selected.targetValue)} onClick={() => {
                if (finishMission(selected.id)) { refresh(); setStatus("Misi selesai! Kamu mendapat bonus 30 XP."); }
              }}><Trophy size={16} /> Selesaikan misi · +30 XP</button>
            </>}
            <div className="mission-manage">{deleteId === selected.id ? <><span>Hapus misi beserta progres dan XP-nya?</span><button type="button" onClick={() => { deleteMission(selected.id); refresh(); setDeleteId(""); }}>Ya, hapus</button><button type="button" onClick={() => setDeleteId("")}>Batal</button></> : <button type="button" onClick={() => setDeleteId(selected.id)}>Hapus misi</button>}</div>
          </section>
          {selected.status === "active" && <aside className="mission-panel mission-coach" aria-label="Mentor Momo">
            <div className="mission-coach-heading"><div><span className="mission-eyebrow">MENTOR BELAJAR</span><h2>Momo</h2></div><MomoCompanion className="mission-momo" mode="deep" thinking={busy !== null} /></div>
            <p>{selected.guide || "Momo bisa mengubah targetmu jadi tugas kecil dan menyesuaikan rencana saat kamu buntu."}</p>
            <form key={selected.id} onSubmit={event => {
              event.preventDefault();
              void plan(selected, String(new FormData(event.currentTarget).get("blocker") ?? ""));
            }}>
              <label>Bagian yang terasa sulit <span>(opsional)</span><textarea name="blocker" maxLength={300} rows={2} placeholder="Misalnya, saya hanya punya 15 menit sehari." /></label>
              <button className="mission-button mission-primary" disabled={busy !== null}>{busy === "plan" ? "Momo menyusun rencana…" : selected.planSource === "ai" ? "Sesuaikan rencana" : "Susun rencana AI"}</button>
            </form>
            {next && <button className="mission-button" disabled={busy !== null} onClick={() => void practice(selected, next)}>{busy === "chat" ? "Membuka chat…" : "Latihan bareng Momo"} <ArrowRight size={16} /></button>}
          </aside>}
        </div>
      ) : !creating && <section className="mission-panel mission-empty"><Flag size={28} /><h2>Belum ada misi</h2><p>Mulai dari satu target belajar. Kamu bisa langsung mengerjakan checkpoint pertamamu.</p><button className="mission-button mission-primary" onClick={() => setCreating(true)}>Buat misi pertama <ArrowRight size={16} /></button></section>}
    </main>
  );
}
