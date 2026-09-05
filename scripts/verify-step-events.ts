// Verifikasi ProgressTracker mengemisikan field step berurutan (task 1.2).
async function main() {
  const { ProgressTracker, getProgressEvents } = await import("@/lib/progressTracker");
  const sid = "probe-steps-" + Date.now();
  const t = new ProgressTracker(sid);

  // Simulasi pipeline: mulai → sub-kemajuan → selesai, per fase.
  t.advance("extract", 0.2, "Mengambil transkrip video…");
  t.done("extract", "Materi siap");
  t.advance("chapters", 0.1, "Bab 1/4…");
  t.advance("chapters", 0.5, "Bab 2/4…");
  t.done("chapters", "4 bab tersusun");
  t.run("enrichment", "Mencari fakta pendukung…", "Enrichment selesai", async () => null);
  t.done("rag", "Pencarian cerdas siap");
  t.done("study_tools", "Kuis & kartu hafalan dibuat");

  const events = getProgressEvents(sid);
  const stepEvents = events.filter((e) => e.step);
  console.log(`total event: ${events.length}, dengan step: ${stepEvents.length}`);

  const phases: string[] = [];
  for (const e of events) {
    if (e.step) {
      console.log(`  [${e.step.status}] ${e.step.id} "${e.step.label}" icon=${e.step.icon} detail="${e.step.detail}" pct=${e.percent}`);
      if (e.step.status === "active" && phases[phases.length - 1] !== e.step.id) phases.push(e.step.id);
    }
  }
  console.log("urutan fase aktif:", phases.join(" → "));

  const ok =
    stepEvents.length >= 5 &&
    stepEvents.every((e) => e.percent !== undefined && e.message && e.step?.id && e.step?.label && e.step?.icon) &&
    ["extract", "chapters", "enrichment", "rag", "study_tools"].every((p) =>
      events.some((e) => e.step?.id === p)
    ) &&
    events.every((e) => typeof e.phase === "string") &&
    // backward-compatible: semua event tetap punya phase/percent/message
    events.every((e) => "phase" in e && "percent" in e && "message" in e);
  console.log(ok ? "PROBE STEP LOLOS" : "PROBE GAGAL");
}
void main();
