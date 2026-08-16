"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Copy,
  Loader2,
  RefreshCw,
  Rocket,
  Trophy,
  Users,
} from "lucide-react";

import QuizTake from "@/components/quiz/QuizTake";
import {
  getQuizRoom,
  getQuizShare,
  joinQuizRoom,
  loadAnswers,
  loadParticipantKey,
  loadRoomName,
  QuizClientError,
  saveAnswers,
  saveParticipantKey,
  saveRoomName,
  startQuizRoom,
  submitQuizRoom,
  type QuizQuestion,
  type RoomInfo,
} from "@/lib/quizLiveClient";

type Phase =
  | "loading"
  | "error"
  | "share"
  | "join"
  | "lobby"
  | "play"
  | "leaderboard";

const ANSWERS_STORAGE = (token: string) => `eureka_quiz_answers_${token}`;

export default function QuizPage() {
  const params = useParams<{ token: string }>();
  const token = String(params.token ?? "").trim();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Share view
  const [shareTitle, setShareTitle] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [shareAnswers, setShareAnswers] = useState<Record<string, number>>({});
  const [shareSubmitted, setShareSubmitted] = useState(false);

  // Room view
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myName, setMyName] = useState("");
  const [myIsHost, setMyIsHost] = useState(false);
  const [mySubmitted, setMySubmitted] = useState(false);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [roomAnswers, setRoomAnswers] = useState<Record<string, number>>({});
  const [linkCopied, setLinkCopied] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const isShare = token.startsWith("s_");
  const isRoom = token.startsWith("r_");

  const notify = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      notify("Gagal menyalin link.");
    }
  };

  /** Refetch room; sinkronkan fase dengan status terbaru. */
  const refreshRoom = async () => {
    if (!isRoom) return;
    try {
      const r = await getQuizRoom(token);
      setRoom(r);
      const self = r.participants.find((p) => p.name === myName);
      if (self?.submittedAt) {
        setMySubmitted(true);
        setMyScore(self.score);
        setPhase("leaderboard");
      } else if (r.status === "live" && phase === "lobby") {
        setPhase("play");
      } else if (r.status === "ended") {
        setPhase("leaderboard");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat ruang.");
      setPhase("error");
    }
  };

  // Muat awal: share atau room.
  useEffect(() => {
    if (!token) return;

    if (isShare) {
      (async () => {
        try {
          const share = await getQuizShare(token);
          setShareTitle(share.title);
          setQuestions(share.questions);
          setPhase("share");
        } catch (e) {
          setError(
            e instanceof QuizClientError ? e.message : "Kuis tidak ditemukan."
          );
          setPhase("error");
        }
      })();
      return;
    }

    if (isRoom) {
      (async () => {
        try {
          const r = await getQuizRoom(token);
          const savedName = loadRoomName(token);
          if (!savedName || !loadParticipantKey(token)) {
            setRoom(r);
            setPhase("join");
            return;
          }
          setMyName(savedName);
          const self = r.participants.find((p) => p.name === savedName);
          setMyIsHost(Boolean(self?.isHost));
          if (self?.submittedAt) {
            setMySubmitted(true);
            setMyScore(self.score);
            setPhase("leaderboard");
          } else {
            setRoomAnswers(loadAnswers(token));
            setPhase(r.status === "live" ? "play" : "lobby");
          }
          setRoom(r);
        } catch (e) {
          setError(
            e instanceof QuizClientError ? e.message : "Ruang tidak ditemukan."
          );
          setPhase("error");
        }
      })();
    } else {
      setError("Link tidak valid.");
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Live: poll room berkala. (Realtime postgres_changes butuh policy SELECT
  // publik pada quiz_room_participants yang sengaja dihapus di patch 017 —
  // polling lewat route service-role lebih aman & tetap mengikuti leaderboard.)
  const roomId = room?.id ?? "";
  useEffect(() => {
    if (!roomId || phase === "join" || phase === "loading" || phase === "error") {
      return;
    }
    setRealtimeConnected(true);
    const timer = setInterval(() => {
      void refreshRoom();
    }, 5000);
    return () => {
      clearInterval(timer);
      setRealtimeConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, phase]);

  // Simpan jawaban room otomatis (restore saat buka ulang).
  useEffect(() => {
    if (isRoom && token) {
      saveAnswers(token, roomAnswers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomAnswers]);

  const doJoin = async () => {
    const name = joinName.trim();
    if (!name) {
      notify("Masukkan nama dulu ya!");
      return;
    }
    setJoining(true);
    try {
      const joined = await joinQuizRoom({ token, name });
      saveParticipantKey(token, joined.participantKey);
      saveRoomName(token, name);
      setMyName(name);
      setMyIsHost(joined.isHost);
      const r = await getQuizRoom(token);
      setRoom(r);
      setPhase("lobby");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal bergabung.");
    } finally {
      setJoining(false);
    }
  };

  const doStart = async () => {
    setStarting(true);
    try {
      await startQuizRoom({
        token,
        hostKey: loadParticipantKey(token) || "",
      });
      await refreshRoom();
      setPhase("play");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal memulai ruang.");
    } finally {
      setStarting(false);
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await submitQuizRoom({
        token,
        participantKey: loadParticipantKey(token) || "",
        answers: roomAnswers,
      });
      setMyScore(res.score);
      setMySubmitted(true);
      try {
        sessionStorage.removeItem(ANSWERS_STORAGE(token));
      } catch {
        // abaikan
      }
      setPhase("leaderboard");
      notify(`Skormu: ${res.score}/${res.total}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal mengirim jawaban.");
    } finally {
      setSubmitting(false);
    }
  };

  const leaderboard = room
    ? [...room.participants]
        .filter((p) => p.submittedAt)
        .sort(
          (a, b) =>
            (b.score ?? -1) - (a.score ?? -1) ||
            new Date(a.submittedAt ?? 0).getTime() -
              new Date(b.submittedAt ?? 0).getTime()
        )
    : [];

  if (phase === "loading") {
    return (
      <Shell toast={toast}>
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3">
          <Loader2 size={22} className="animate-spin text-clay-primary" />
          <p className="text-sm font-bold text-clay-muted">Memuat kuis...</p>
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell toast={toast}>
        <div className="rounded-clay-md border-2 border-dashed border-clay-shadow/40 p-6 text-center">
          <p className="text-sm font-bold text-clay-dark">{error}</p>
        </div>
      </Shell>
    );
  }

  if (phase === "share" && questions) {
    return (
      <Shell toast={toast}>
        <header className="mb-5">
          <h1 className="truncate text-base font-extrabold text-clay-dark sm:text-lg">
            {shareTitle || "Kuis"}
          </h1>
          <p className="text-[11px] font-bold text-clay-muted">
            Kuis dibagikan dari Eureka.AI
          </p>
        </header>
        <QuizTake
          questions={questions}
          answers={shareAnswers}
          submitted={shareSubmitted}
          busy={false}
          notify={notify}
          onAnswer={(qid, oi) =>
            setShareAnswers((prev) => ({ ...prev, [qid]: oi }))
          }
          onSubmit={() => setShareSubmitted(true)}
        />
        {shareSubmitted && (
          <button
            onClick={() => {
              setShareSubmitted(false);
              setShareAnswers({});
            }}
            className="btn-clay-ghost mt-4 w-full !min-h-[44px] text-sm"
          >
            <RefreshCw size={14} className="mr-2" />
            Ulangi Kuis
          </button>
        )}
      </Shell>
    );
  }

  if (phase === "join") {
    return (
      <Shell toast={toast}>
        <header className="mb-5">
          <h1 className="text-base font-extrabold text-clay-dark sm:text-lg">
            Ruang Kuis Langsung
          </h1>
          <p className="text-[11px] font-bold text-clay-muted">
            Jawab bersama teman & lihat papan skor realtime
          </p>
        </header>
        <div className="rounded-clay-md border-2 border-clay-shadow/40 bg-white/60 p-4 sm:p-5">
          <label className="mb-1 block text-xs font-bold text-clay-muted">
            Nama kamu
          </label>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="mis. Budi"
            maxLength={40}
            className="w-full rounded-xl border-2 border-clay-shadow/40 bg-white px-3 py-2.5 text-sm font-semibold text-clay-dark outline-none focus:border-clay-primary min-h-[46px]"
          />
          <button
            onClick={doJoin}
            disabled={joining}
            className="btn-clay-primary mt-3 w-full !min-h-[46px] disabled:opacity-60"
          >
            {joining ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Bergabung...
              </>
            ) : (
              "Masuk Ruang"
            )}
          </button>
        </div>
      </Shell>
    );
  }

  if (room && (phase === "lobby" || phase === "play" || phase === "leaderboard")) {
    return (
      <Shell toast={toast}>
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-clay-dark sm:text-lg">
              Ruang Kuis Langsung
            </h1>
            <p className="text-[11px] font-bold text-clay-muted">
              {room.status === "lobby" && "Belum dimulai — tunggu host"}
              {room.status === "live" && "Sedang berlangsung"}
              {room.status === "ended" && "Ruang selesai"}
              {" · "}
              {realtimeConnected ? "live" : "memuat..."}
            </p>
          </div>
          <button
            onClick={copyLink}
            className="btn-clay-ghost !min-h-[44px] !px-3 text-xs"
          >
            <Copy size={13} className="mr-1.5" />
            {linkCopied ? "Tersalin!" : "Salin Link"}
          </button>
        </header>

        {phase === "lobby" && (
          <div className="space-y-4">
            <div className="rounded-clay-md border-2 border-clay-shadow/40 bg-white/60 p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <Users size={15} className="text-clay-primary" />
                <span className="text-xs font-extrabold text-clay-dark">
                  Partisipan ({room.participants.length})
                </span>
              </div>
              <ul className="space-y-1.5">
                {room.participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-clay-beige px-3 py-2 text-xs font-bold text-clay-dark"
                  >
                    <span className="truncate">
                      {p.name}
                      {p.name === myName && (
                        <span className="ml-1 text-clay-primary">(kamu)</span>
                      )}
                    </span>
                    {p.isHost && (
                      <span className="rounded-full bg-clay-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-clay-primary">
                        HOST
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {myIsHost ? (
              <button
                onClick={doStart}
                disabled={starting}
                className="btn-clay-primary w-full !min-h-[46px] disabled:opacity-60"
              >
                {starting ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Memulai...
                  </>
                ) : (
                  <>
                    <Rocket size={16} className="mr-2" /> Mulai Kuis
                  </>
                )}
              </button>
            ) : (
              <p className="rounded-clay-md bg-clay-beige p-3 text-center text-xs font-bold text-clay-muted">
                Menunggu host memulai kuis...
              </p>
            )}
          </div>
        )}

        {phase === "play" && (
          <QuizTake
            questions={room.questions}
            answers={roomAnswers}
            submitted={false}
            busy={submitting}
            notify={notify}
            onAnswer={(qid, oi) =>
              setRoomAnswers((prev) => ({ ...prev, [qid]: oi }))
            }
            onSubmit={doSubmit}
          />
        )}

        {phase === "leaderboard" && (
          <div className="space-y-4">
            {mySubmitted && (
              <div className="rounded-clay-md border-2 border-clay-primary/30 bg-clay-primary/10 p-4 text-center">
                <p className="text-xs font-bold text-clay-muted">Skor kamu</p>
                <p className="text-2xl font-extrabold text-clay-dark">
                  {myScore ?? 0}
                  <span className="text-sm text-clay-muted">
                    /{room.questions.length}
                  </span>
                </p>
              </div>
            )}

            {/* Podium Juara 1-2-3 */}
            {leaderboard.length > 0 && (
              <div className="relative flex flex-col items-center gap-4">
                {/* Nomor 1 - tengah, paling tinggi */}
                <div className="relative w-full max-w-xs">
                  <div className="relative flex flex-col items-center">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white text-[10px] font-extrabold">
                      1
                    </div>
                    <div className="relative flex h-36 w-28 flex-col items-center rounded-t-2xl bg-gradient-to-b from-amber-400/30 to-amber-300/50 p-3 shadow-lg">
                      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.png" alt="" className="h-10 w-10 object-contain" />
                      </div>
                      <div className="mt-2 text-center">
                        <p className="truncate text-xs font-extrabold text-clay-dark">
                          {leaderboard[0].name}
                        </p>
                        <p className="text-[11px] font-bold text-amber-600">
                          {leaderboard[0].score ?? 0} pts
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nomor 2 & 3 - kiri kanan sejajar, lebih rendah */}
                {leaderboard.length >= 2 && (
                  <div className="flex w-full max-w-md justify-between gap-2 -mt-8">
                    {/* Juara 2 - kiri */}
                    <div className="flex-1 flex flex-col items-center">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-white text-[9px] font-extrabold">
                        2
                      </div>
                      <div className="relative flex h-28 w-24 flex-col items-center rounded-t-2xl bg-gradient-to-b from-slate-300/30 to-slate-200/50 p-2 shadow">
                        <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
                        </div>
                        <div className="mt-1.5 text-center">
                          <p className="truncate text-[11px] font-extrabold text-clay-dark">
                            {leaderboard[1].name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-600">
                            {leaderboard[1].score ?? 0} pts
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Juara 3 - kanan */}
                    {leaderboard.length >= 3 && (
                      <div className="flex-1 flex flex-col items-center">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-600/80 text-white text-[9px] font-extrabold">
                          3
                        </div>
                        <div className="relative flex h-24 w-20 flex-col items-center rounded-t-2xl bg-gradient-to-b from-amber-700/20 to-amber-600/40 p-2 shadow">
                          <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/80 shadow">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
                          </div>
                          <div className="mt-1 text-center">
                            <p className="truncate text-[11px] font-extrabold text-clay-dark">
                              {leaderboard[2].name}
                            </p>
                            <p className="text-[10px] font-bold text-amber-700">
                              {leaderboard[2].score ?? 0} pts
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Daftar lengkap (scroll) */}
            <div className="rounded-clay-md border-2 border-clay-shadow/40 bg-white/60 p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <Trophy size={15} className="text-amber-500" />
                <span className="text-xs font-extrabold text-clay-dark">
                  Papan Skor Lengkap
                </span>
              </div>
              <ol className="space-y-1.5 max-h-64 overflow-y-auto">
                {leaderboard.length === 0 && (
                  <li className="py-3 text-center text-xs font-bold text-clay-muted">
                    Belum ada yang mengumpulkan.
                  </li>
                )}
                {leaderboard.map((p, i) => (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold ${
                      p.name === myName
                        ? "border-2 border-clay-primary bg-clay-primary/10 text-clay-dark"
                        : "bg-clay-beige text-clay-dark"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {i < 3 ? (
                        <span className="w-5 text-center">
                          {i === 0 && "����"}
                          {i === 1 && "����"}
                          {i === 2 && "����"}
                        </span>
                      ) : (
                        <span className="w-4 text-clay-muted">#{i + 1}</span>
                      )}
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="text-clay-primary">
                      {p.score ?? 0} pts
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            {room.status === "live" && (
              <p className="text-center text-[11px] font-bold text-clay-muted">
                Papan skor diperbarui otomatis — menunggu teman lain.
              </p>
            )}
          </div>
        )}
      </Shell>
    );
  }

  return null;
}

/** Kerangka halaman publik kuis — mobile-first, safe-area, toast. */
function Shell({
  children,
  toast,
}: {
  children: React.ReactNode;
  toast: string;
}) {
  return (
    <div className="min-h-dvh bg-clay-beige">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:py-10">
        {children}
      </div>
      {toast && (
        <div
          aria-live="polite"
          className="fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
        >
          <p className="max-w-full rounded-full bg-clay-dark px-4 py-2.5 text-center text-xs font-bold text-white shadow-lg">
            {toast}
          </p>
        </div>
      )}
    </div>
  );
}