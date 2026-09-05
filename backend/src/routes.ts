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
  const authNotify = await import("@/app/api/auth/notify/route");
  const sessionExchange = await import("@/app/api/auth/session-exchange/route");
  mount(app, "/api/auth/otp", otp);
  mount(app, "/api/auth/verify-captcha", verifyCaptcha);
  mount(app, "/api/auth/notify", authNotify);
  mount(app, "/api/auth/session-exchange", sessionExchange);
  count += 4;

  // ─── Safety (guardrails NVIDIA NIM) ─────────────────────
  const safetyMetrics = await import("@/app/api/safety/metrics/route");
  mount(app, "/api/safety/metrics", safetyMetrics);
  count++;

  // ─── Chat ──────────────────────────────────────────────
  const chat = await import("@/app/api/chat/route");
  mount(app, "/api/chat", chat);
  count++;

  // ─── Exams ─────────────────────────────────────────────
  const exams = await import("@/app/api/exams/route");
  mount(app, "/api/exams", exams);
  count++;

  // ─── Feedback (survey performa Eureka) ─────────────────
  const feedbackNote = await import("@/app/api/feedback/note/route");
  mount(app, "/api/feedback/note", feedbackNote);
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

  // ─── Payments (langganan Pakasir) ───────────────────────
  const paymentsCheckout = await import("@/app/api/payments/checkout/route");
  const paymentsWebhook = await import("@/app/api/payments/webhook/route");
  const paymentsStatus = await import("@/app/api/payments/status/route");
  const paymentsTrial = await import("@/app/api/payments/trial/route");
  const paymentsCancel = await import("@/app/api/payments/cancel/route");
  const paymentsValidateCode = await import(
    "@/app/api/payments/validate-code/route"
  );
  const paymentsHistory = await import("@/app/api/payments/history/route");
  const paymentsInvoice = await import("@/app/api/payments/invoice/route");
  mount(app, "/api/payments/checkout", paymentsCheckout);
  mount(app, "/api/payments/webhook", paymentsWebhook);
  mount(app, "/api/payments/status", paymentsStatus);
  mount(app, "/api/payments/trial", paymentsTrial);
  mount(app, "/api/payments/cancel", paymentsCancel);
  mount(app, "/api/payments/validate-code", paymentsValidateCode);
  mount(app, "/api/payments/history", paymentsHistory);
  mount(app, "/api/payments/invoice", paymentsInvoice);
  count += 8;

  // ─── Profile ───────────────────────────────────────────
  const profile = await import("@/app/api/profile/route");
  mount(app, "/api/profile", profile);
  count++;

  // ─── Beta tester (halaman /join & gating fitur baru) ───
  const betaJoin = await import("@/app/api/beta/join/route");
  const betaStatus = await import("@/app/api/beta/status/route");
  mount(app, "/api/beta/join", betaJoin);
  mount(app, "/api/beta/status", betaStatus);
  count += 2;

  // ─── Audio (transkripsi rekaman suara, beta) ───────────
  const audioTranscribe = await import("@/app/api/audio/transcribe/route");
  mount(app, "/api/audio/transcribe", audioTranscribe);
  count++;

  // ─── Call (percakapan suara AI, beta) ──────────────────
  const call = await import("@/app/api/call/route");
  mount(app, "/api/call", call);
  count++;

  // ─── Referral (program ajak teman) ─────────────────────
  const referral = await import("@/app/api/referral/route");
  const referralApply = await import("@/app/api/referral/apply/route");
  const referralClaim = await import("@/app/api/referral/claim/route");
  mount(app, "/api/referral", referral);
  mount(app, "/api/referral/apply", referralApply);
  mount(app, "/api/referral/claim", referralClaim);
  count += 3;

  // ─── Progress ──────────────────────────────────────────
  const progress = await import("@/app/api/progress/route");
  mount(app, "/api/progress", progress);
  count++;

  // ─── Reviews (ulasan produk → JSON-LD aggregateRating) ──
  const reviews = await import("@/app/api/reviews/route");
  mount(app, "/api/reviews", reviews);
  count++;

  // ─── Study Buddy ───────────────────────────────────────
  const studyBuddyChat = await import("@/app/api/study-buddy/chat/route");
  mount(app, "/api/study-buddy/chat", studyBuddyChat);
  count++;

  // ─── Asisten AI (halaman /home & /chat) ────────────────
  const assistantChat = await import("@/app/api/assistant/chat/route");
  const assistantFlashcards = await import("@/app/api/assistant/flashcards/route");
  const assistantImage = await import("@/app/api/assistant/image/route");
  const assistantQuiz = await import("@/app/api/assistant/quiz/route");
  const assistantSessions = await import("@/app/api/assistant/sessions/route");
  const assistantSessionsId = await import("@/app/api/assistant/sessions/[sessionId]/route");
  const assistantSessionsShare = await import("@/app/api/assistant/sessions/[sessionId]/share/route");
  mount(app, "/api/assistant/chat", assistantChat);
  mount(app, "/api/assistant/flashcards", assistantFlashcards);
  mount(app, "/api/assistant/image", assistantImage);
  mount(app, "/api/assistant/quiz", assistantQuiz);
  mount(app, "/api/assistant/sessions", assistantSessions);
  mount(app, "/api/assistant/sessions/:sessionId", assistantSessionsId);
  mount(app, "/api/assistant/sessions/:sessionId/share", assistantSessionsShare);
  count += 7;

  // ─── Video YouTube (panel View) ──────────────────────────
  const videoPoints = await import("@/app/api/video/points/route");
  const videoTranscript = await import("@/app/api/video/transcript/route");
  mount(app, "/api/video/points", videoPoints);
  mount(app, "/api/video/transcript", videoTranscript);
  count += 2;

  // ─── Share chat publik (view-only) ─────────────────────
  const sharesToken = await import("@/app/api/shares/[token]/route");
  mount(app, "/api/shares/:token", sharesToken);
  count += 1;

  // ─── Quiz Live (share & live room) ─────────────────────
  const quizShares = await import("@/app/api/quiz-shares/route");
  const quizSharesToken = await import("@/app/api/quiz-shares/[token]/route");
  const quizRooms = await import("@/app/api/quiz-rooms/route");
  const quizRoomsToken = await import("@/app/api/quiz-rooms/[token]/route");
  const quizRoomsJoin = await import("@/app/api/quiz-rooms/[token]/join/route");
  const quizRoomsStart = await import("@/app/api/quiz-rooms/[token]/start/route");
  const quizRoomsSubmit = await import("@/app/api/quiz-rooms/[token]/submit/route");
  mount(app, "/api/quiz-shares", quizShares);
  mount(app, "/api/quiz-shares/:token", quizSharesToken);
  mount(app, "/api/quiz-rooms", quizRooms);
  mount(app, "/api/quiz-rooms/:token", quizRoomsToken);
  mount(app, "/api/quiz-rooms/:token/join", quizRoomsJoin);
  mount(app, "/api/quiz-rooms/:token/start", quizRoomsStart);
  mount(app, "/api/quiz-rooms/:token/submit", quizRoomsSubmit);
  count += 7;

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
  const notesComprehension = await import(
    "@/app/api/notes/[id]/comprehension/route"
  );
  const notesComprehensionGrade = await import(
    "@/app/api/notes/[id]/comprehension/grade/route"
  );
  const notesComprehensionUpload = await import(
    "@/app/api/notes/[id]/comprehension/upload/route"
  );
  const notesComprehensionStream = await import(
    "@/app/api/notes/[id]/comprehension/stream/route"
  );
  const notesRegenerate = await import("@/app/api/notes/[id]/regenerate/route");
  const notesVersions = await import("@/app/api/notes/[id]/versions/route");
  const notesShare = await import("@/app/api/notes/[id]/share/route");
  const shareNotePublic = await import("@/app/api/share/note/[token]/route");

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
  mount(app, "/api/notes/:id/comprehension", notesComprehension);
  mount(app, "/api/notes/:id/comprehension/grade", notesComprehensionGrade);
  mount(app, "/api/notes/:id/comprehension/upload", notesComprehensionUpload);
  mount(app, "/api/notes/:id/comprehension/stream", notesComprehensionStream);
  mount(app, "/api/notes/:id/regenerate", notesRegenerate);
  mount(app, "/api/notes/:id/versions", notesVersions);
  mount(app, "/api/notes/:id/share", notesShare);
  mount(app, "/api/share/note/:token", shareNotePublic);
  count += 17;

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
