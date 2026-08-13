/**
 * Route Registry — organized mounting of all API routes.
 *
 * Each group imports Next.js handlers from app/api and mounts them
 * via the honoAdapter. The business logic in lib/ is framework-agnostic,
 * so handlers can later be converted to native Hono without touching lib/.
 */
import type { Hono } from "hono";
import { mountNextRoutes } from "./utils/honoAdapter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = Record<string, any>;

function mount(app: Hono, path: string, mod: AnyModule | Promise<AnyModule>) {
  if (mod instanceof Promise) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mod.then((m) => mountNextRoutes(app as any, path, m));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mountNextRoutes(app as any, path, mod);
  }
}

/**
 * Mount all API routes to the Hono app.
 * Routes are organized by feature domain.
 */
export async function mountAllRoutes(app: Hono): Promise<number> {
  let count = 0;

  // ─── Auth ──────────────────────────────────────────────
  const otp = await import("@/app/api/auth/otp/route");
  const verifyCaptcha = await import("@/app/api/auth/verify-captcha/route");
  mount(app, "/api/auth/otp", otp);
  mount(app, "/api/auth/verify-captcha", verifyCaptcha);
  count += 2;

  // ─── Chat ──────────────────────────────────────────────
  const chat = await import("@/app/api/chat/route");
  mount(app, "/api/chat", chat);
  count++;

  // ─── Exams ─────────────────────────────────────────────
  const exams = await import("@/app/api/exams/route");
  mount(app, "/api/exams", exams);
  count++;

  // ─── Friends ───────────────────────────────────────────
  const friends = await import("@/app/api/friends/route");
  const friendsRequests = await import("@/app/api/friends/requests/route");
  const friendsId = await import("@/app/api/friends/[friendId]/route");
  mount(app, "/api/friends", friends);
  mount(app, "/api/friends/requests", friendsRequests);
  mount(app, "/api/friends/:friendId", friendsId);
  count += 3;

  // ─── Leaderboard ───────────────────────────────────────
  const leaderboard = await import("@/app/api/leaderboard/route");
  mount(app, "/api/leaderboard", leaderboard);
  count++;

  // ─── Missions (bimbingan AI) ───────────────────────────
  const missionsGuide = await import("@/app/api/missions/guide/route");
  mount(app, "/api/missions/guide", missionsGuide);
  count++;

  // ─── Notifications ─────────────────────────────────────
  const notifications = await import("@/app/api/notifications/route");
  const notificationsPushSubscribe = await import("@/app/api/notifications/push-subscribe/route");
  mount(app, "/api/notifications", notifications);
  mount(app, "/api/notifications/push-subscribe", notificationsPushSubscribe);
  count += 2;

  // ─── Onboarding ────────────────────────────────────────
  const onboardingAnalyze = await import("@/app/api/onboarding/analyze/route");
  mount(app, "/api/onboarding/analyze", onboardingAnalyze);
  count++;

  // ─── Profile ───────────────────────────────────────────
  const profile = await import("@/app/api/profile/route");
  mount(app, "/api/profile", profile);
  count++;

  // ─── Progress ──────────────────────────────────────────
  const progress = await import("@/app/api/progress/route");
  mount(app, "/api/progress", progress);
  count++;

  // ─── Study Buddy ───────────────────────────────────────
  const studyBuddyChat = await import("@/app/api/study-buddy/chat/route");
  mount(app, "/api/study-buddy/chat", studyBuddyChat);
  count++;

  // ─── Asisten AI (halaman /home & /chat) ────────────────
  const assistantChat = await import("@/app/api/assistant/chat/route");
  const assistantSessions = await import("@/app/api/assistant/sessions/route");
  const assistantSessionsId = await import("@/app/api/assistant/sessions/[sessionId]/route");
  mount(app, "/api/assistant/chat", assistantChat);
  mount(app, "/api/assistant/sessions", assistantSessions);
  mount(app, "/api/assistant/sessions/:sessionId", assistantSessionsId);
  count += 3;

  // ─── Subjects ──────────────────────────────────────────
  const subjects = await import("@/app/api/subjects/route");
  const subjectsId = await import("@/app/api/subjects/[id]/route");
  mount(app, "/api/subjects", subjects);
  mount(app, "/api/subjects/:id", subjectsId);
  count += 2;

  // ─── Notes (CRUD) ──────────────────────────────────────
  const notes = await import("@/app/api/notes/route");
  const notesId = await import("@/app/api/notes/[id]/route");
  mount(app, "/api/notes", notes);
  mount(app, "/api/notes/:id", notesId);
  count += 2;

  // ─── Notes (Background Jobs) ───────────────────────────
  const notesJobsId = await import("@/app/api/notes/jobs/[jobId]/route");
  const notesProcess = await import("@/app/api/notes/process/route");
  const notesProcessProgress = await import("@/app/api/notes/process-progress/[sessionId]/route");
  const notesQuery = await import("@/app/api/notes/query/route");
  mount(app, "/api/notes/jobs/:jobId", notesJobsId);
  mount(app, "/api/notes/process", notesProcess);
  mount(app, "/api/notes/process-progress/:sessionId", notesProcessProgress);
  mount(app, "/api/notes/query", notesQuery);
  count += 4;

  // ─── Notes (Per-note sub-routes) ───────────────────────
  const notesPdf = await import("@/app/api/notes/[id]/pdf/route");
  const notesPdfStream = await import("@/app/api/notes/[id]/pdf/stream/route");
  const notesAsk = await import("@/app/api/notes/[id]/ask/route");
  const notesBoard = await import("@/app/api/notes/[id]/board/route");
  const notesChat = await import("@/app/api/notes/[id]/chat/route");
  const notesCollab = await import("@/app/api/notes/[id]/collab/route");
  const notesFlashcards = await import("@/app/api/notes/[id]/flashcards/route");
  const notesHighlights = await import("@/app/api/notes/[id]/highlights/route");
  const notesHighlightsGenerate = await import("@/app/api/notes/[id]/highlights/generate/route");
  const notesImages = await import("@/app/api/notes/[id]/images/route");
  const notesPresence = await import("@/app/api/notes/[id]/presence/route");
  const notesQuiz = await import("@/app/api/notes/[id]/quiz/route");
  const notesRegenerate = await import("@/app/api/notes/[id]/regenerate/route");
  const notesVersions = await import("@/app/api/notes/[id]/versions/route");

  mount(app, "/api/notes/:id/pdf", notesPdf);
  mount(app, "/api/notes/:id/pdf/stream", notesPdfStream);
  mount(app, "/api/notes/:id/ask", notesAsk);
  mount(app, "/api/notes/:id/board", notesBoard);
  mount(app, "/api/notes/:id/chat", notesChat);
  mount(app, "/api/notes/:id/collab", notesCollab);
  mount(app, "/api/notes/:id/flashcards", notesFlashcards);
  mount(app, "/api/notes/:id/highlights", notesHighlights);
  mount(app, "/api/notes/:id/highlights/generate", notesHighlightsGenerate);
  mount(app, "/api/notes/:id/images", notesImages);
  mount(app, "/api/notes/:id/presence", notesPresence);
  mount(app, "/api/notes/:id/quiz", notesQuiz);
  mount(app, "/api/notes/:id/regenerate", notesRegenerate);
  mount(app, "/api/notes/:id/versions", notesVersions);
  count += 13;

  // ─── Notes (Chapter sub-routes) ────────────────────────
  const notesBab = await import("@/app/api/notes/[id]/bab/[chapterId]/route");
  const notesBabAsk = await import("@/app/api/notes/[id]/bab/[chapterId]/ask/route");
  const notesBabRegenerate = await import("@/app/api/notes/[id]/bab/[chapterId]/regenerate/route");

  mount(app, "/api/notes/:id/bab/:chapterId", notesBab);
  mount(app, "/api/notes/:id/bab/:chapterId/ask", notesBabAsk);
  mount(app, "/api/notes/:id/bab/:chapterId/regenerate", notesBabRegenerate);
  count += 3;

  return count;
}
