/**
 * Loop "Eureka Multi Agent" — orkestrasi turn per turn.
 *
 * Arsitektur: server STATELESS per request. Setiap turn chat dengan toggle
 * ON membaca state dari loopStore (Supabase), menjalankan fase yang wajib,
 * lalu menyimpan fase berikutnya. Tidak ada loop tak berujung di memori
 * server — siswa menjawab → request berikutnya melanjutkan siklus.
 *
 * Siklus (PRD §5.2):
 *   act (Socra ajukan pertanyaan) → [siswa jawab] →
 *   reflect (Lensa nilai) → decide (Kompas) → act ... sampai exit.
 *
 * Isolasi kegagalan: gagal Lensa → skor netral (lensaAssess sudah fallback);
 * gagal Socra → error dilempar ke route → fallback pesan Kompas di UI.
 */
import {
  lensaAssess,
  type LensaVerdict,
} from "./index";
import {
  type AgentLoopSession,
  type LoopDecision,
  completeIteration,
  getOpenIteration,
  loopGoalMastery,
  startIteration,
  updateLoopSession,
} from "./loopStore";
import type { AgentModelContext } from "./callAgentModel";

/** Deteksi exit signal manual (PRD §5.3): "udah paham", "skip", dst. */
export function detectManualExit(message: string): boolean {
  const t = message.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return false;
  const patterns = [
    /\budah paham\b/,
    /\bsudah paham\b/,
    /\budah ngerti\b/,
    /\bsudah ngerti\b/,
    /\bpaham\b/,
    /\bskip\b/,
    /\bberhenti\b/,
    /\bstop\b/,
    /\bganti topik\b/,
    /\bcukup\b/,
  ];
  return patterns.some((p) => p.test(t));
}

/** Keputusan Kompas — aturan deterministik + config, bukan tebakan model. */
export function decideNext(
  session: AgentLoopSession,
  verdict: LensaVerdict,
  newMastery: number
): LoopDecision {
  // Exit manual selalu menang.
  if (session.status === "user_stopped" || session.status === "manual_exit") {
    return session.status === "user_stopped" ? "user_stopped" : "manual_exit";
  }
  // Goal: verdict benar + mastery di atas ambang → selesai dengan sukses.
  if (verdict.verdict === "benar" && newMastery >= loopGoalMastery()) {
    return "goal_reached";
  }
  // Batas iterasi.
  if (session.iteration + 1 >= session.maxIterations) {
    return "max_iterations";
  }
  return "continue_loop";
}

export interface ReflectDecideResult {
  verdict: LensaVerdict;
  newMastery: number;
  decision: LoopDecision;
  /** Sesi setelah update (status/fase/iterasi terbaru). */
  session: AgentLoopSession;
}

/**
 * Fase REFLECT + DECIDE — dipanggil saat siswa mengirim jawaban di tengah
 * loop aktif. Menilai jawaban, update mastery, catat iterasi, dan memutuskan
 * langkah berikutnya. Return keputusan agar route tahu harus melanjutkan
 * Socra atau menutup loop.
 */
export async function reflectAndDecide(input: {
  session: AgentLoopSession;
  studentAnswer: string;
  tutorQuestion: string;
  ctx?: AgentModelContext;
}): Promise<ReflectDecideResult> {
  const { session } = input;

  // Exit manual mendeteksi langsung dari pesan — tanpa memanggil Lensa.
  if (detectManualExit(input.studentAnswer)) {
    const iteration = await getOpenIteration(session.id);
    if (iteration) {
      await completeIteration(iteration.id, {
        answer: input.studentAnswer,
        decision: "manual_exit",
      });
    }
    const updated =
      (await updateLoopSession(session.id, {
        status: "manual_exit",
        phase: "selesai",
      })) ?? session;
    return {
      verdict: {
        score: 0,
        verdict: "sebagian",
        masteryDelta: 0,
        feedback: "Siswa memilih berhenti.",
        misconception: null,
      },
      newMastery: session.mastery,
      decision: "manual_exit",
      session: updated,
    };
  }

  // REFLECT — Lensa menilai jawaban (fallback netral internal bila gagal).
  const verdict = await lensaAssess(
    {
      topic: session.topic,
      tutorQuestion: input.tutorQuestion,
      studentAnswer: input.studentAnswer,
      previousMastery: session.mastery,
    },
    input.ctx
  );
  const newMastery = Math.min(
    100,
    Math.max(0, session.mastery + verdict.masteryDelta)
  );

  // DECIDE — Kompas memutuskan dari skor + config.
  const decision = decideNext(session, verdict, newMastery);

  // Catat iterasi lengkap.
  const iteration = await getOpenIteration(session.id);
  if (iteration) {
    await completeIteration(iteration.id, {
      answer: input.studentAnswer,
      score: verdict.score,
      verdict: verdict.verdict,
      masteryAfter: newMastery,
      decision,
    });
  }

  // Update sesi: iterasi bertambah, status sesuai keputusan.
  const finished = decision !== "continue_loop";
  const statusMap: Record<Exclude<LoopDecision, "continue_loop">, AgentLoopSession["status"]> = {
    goal_reached: "goal_reached",
    max_iterations: "max_iterations",
    user_stopped: "user_stopped",
    manual_exit: "manual_exit",
  };
  const updated =
    (await updateLoopSession(session.id, {
      mastery: newMastery,
      iteration: session.iteration + 1,
      phase: finished ? "selesai" : "act",
      status: finished ? statusMap[decision] : "active",
    })) ?? session;

  return { verdict, newMastery, decision, session: updated };
}

/**
 * Fase ACT — daftarkan iterasi baru sebelum Socra mengajukan pertanyaan
 * (pertanyaan diisi setelah streaming selesai via updateIterationQuestion).
 */
export async function beginActPhase(input: {
  session: AgentLoopSession;
  question: string;
}): Promise<string> {
  return startIteration({
    sessionId: input.session.id,
    iteration: input.session.iteration + 1,
    goal: input.session.goal,
    question: input.question,
  });
}

export { loopGoalMastery };
