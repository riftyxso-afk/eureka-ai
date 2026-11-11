"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getClientLocale } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { recordCallTurns } from "./recordCallTurns";
import { readCallReply } from "@/lib/audio/callReply";
import { runLalaWorkspace, type LalaWorkspaceLink } from "./lalaWorkspace";

type Phase = "idle" | "permission" | "connecting" | "listening" | "thinking" | "searching" | "working" | "speaking";
export type CallProvider = "momo" | "lala";
type Turn = { role: "user" | "assistant"; content: string };
type CallTurn = { question: string; answer: string };
type Playback = { controller: AbortController; sources: Set<AudioBufferSourceNode>; spoken?: string };
type Session = {
  controller: AbortController;
  context: AudioContext;
  stream?: MediaStream;
  socket?: WebSocket;
  capture?: AudioWorkletNode;
  micSource?: MediaStreamAudioSourceNode;
  recorder?: ReturnType<typeof recordCallTurns>;
  transcription?: AbortController;
  endMicStream?: () => void;
  sendText?: (text: string) => void;
  sendVideoFrame?: (data: string) => void;
  mic?: AnalyserNode;
  speaker: AnalyserNode;
  playback?: Playback;
  history: Turn[];
  muted: boolean;
  speaking: boolean;
  ending?: boolean;
  echoUntil: number;
  freshSpeech: boolean;
  timers: Set<number>;
};

type LiveMessage = {
  setupComplete?: object;
  toolCall?: { functionCalls?: { id?: string; name?: string; args?: Record<string, unknown> }[] };
  toolCallCancellation?: { ids?: string[] };
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string; finished?: boolean };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
  };
};

const CONNECT_TIMEOUT = 9_000;
const SESSION_TIMEOUT = 12 * 60_000;
const SPEAKER_RATE = 24_000;

function errorName(cause: unknown) {
  return cause && typeof cause === "object" && "name" in cause ? cause.name : undefined;
}

async function microphonePermission(): Promise<PermissionState | undefined> {
  try {
    return (await navigator.permissions?.query({ name: "microphone" as PermissionName }))?.state;
  } catch {
    // Some mobile browsers don't expose microphone permission via this API.
    return undefined;
  }
}

async function openCallMicrophone(signal: AbortSignal) {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (cause) {
    const name = errorName(cause);
    const granted = name === "NotAllowedError" && await microphonePermission() === "granted";
    if (!granted && name !== "OverconstrainedError" && name !== "NotReadableError" && name !== "AbortError") throw cause;
    signal.throwIfAborted();
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

async function microphoneError(cause: unknown) {
  switch (errorName(cause)) {
    case "NotAllowedError":
    case "SecurityError": {
      const permission = await microphonePermission();
      if (permission === "granted") return "Izin mikrofon sudah aktif, tetapi perangkat belum bisa membukanya. Tutup aplikasi lain yang memakai mikrofon, lalu coba lagi.";
      if (permission === "denied") return "Akses mikrofon diblokir. Aktifkan izin mikrofon untuk Eureka di pengaturan browser, lalu coba lagi.";
      return "Browser belum bisa membuka mikrofon. Periksa akses mikrofon untuk Eureka dan untuk browser di pengaturan HP.";
    }
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Mikrofon tidak terdeteksi. Periksa sambungan headset atau mikrofon, lalu coba lagi.";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "Mikrofon belum bisa dibuka. Tutup aplikasi lain yang memakai mikrofon, lalu coba lagi.";
    default:
      return "Mikrofon belum bisa dimulai. Ketuk mikrofon untuk mencoba lagi.";
  }
}

function spokenWords(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function wantsToEndCall(text: string) {
  const command = spokenWords(text)
    .replace(/^(?:hei |hey )?(?:momo|lala) /, "")
    .replace(/ (?:momo|lala)$/, "")
    .replace(/^(?:sudah|udah|ya sudah|oke|ok|baik) /, "")
    .replace(/^tolong /, "");
  return /^(?:(?:tutup|akhiri|hentikan|putuskan)(?: (?:saja|aja))?(?: (?:panggilan|telepon)(?: ini)?)?|(?:end|hang up)(?: the call)?)(?: (?:saja|aja|ya|sekarang|please))?$/.test(command);
}

function correctionReply(question: string) {
  const words = spokenWords(question);
  if (/^(?:(?:eh|oh|maaf|bentar|sebentar|tunggu) )?(?:(?:aku|saya) )?(?:salaha?(?: ngomong)?|keliru|maksudku|maksud saya)$/.test(words)) {
    return "Oh, maksudmu apa tadi?";
  }
  if (/^(?:oh |wait |sorry )?(?:i meant|i said it wrong|that was wrong)$/.test(words)) {
    return "Oh, what did you mean?";
  }
}

function hasVoice(bytes: Uint8Array) {
  const pcm = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let energy = 0;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const sample = pcm.getInt16(i, true) / 32768;
    energy += sample * sample;
  }
  return energy > bytes.length / 2 * 0.025 ** 2;
}

function micBlocked(session: Session) {
  return session.ending || session.muted || session.speaking || performance.now() < session.echoUntil;
}

function stopPlayback(session: Session) {
  const playback = session.playback;
  session.playback = undefined;
  if (session.speaking) session.echoUntil = performance.now() + 180;
  session.speaking = false;
  if (!playback) return;
  playback.controller.abort();
  for (const source of playback.sources) {
    source.stop();
    source.disconnect();
  }
  playback.sources.clear();
}

function dispose(session: Session) {
  session.controller.abort();
  session.timers.forEach(timer => window.clearTimeout(timer));
  stopPlayback(session);
  session.recorder?.stop();
  session.transcription?.abort();
  disconnectRealtime(session);
  session.stream?.getTracks().forEach(track => track.stop());
  void session.context.close().catch(() => {});
}

function disconnectRealtime(session: Session) {
  if (session.capture) {
    session.capture.port.onmessage = null;
    session.capture.port.close();
    session.micSource?.disconnect(session.capture);
    session.capture.disconnect();
    session.capture = undefined;
  }
  if (session.socket) {
    session.socket.onmessage = session.socket.onerror = session.socket.onclose = null;
    session.socket.close();
    session.socket = undefined;
  }
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

async function playPcm(response: Response, session: Session, playback: Playback, onPlaying: () => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Audio Momo tidak tersedia.");

  let nextTime = 0;
  let pending = new Uint8Array(0);
  let last: AudioBufferSourceNode | undefined;
  const schedule = (bytes: Uint8Array) => {
    const frames = Math.floor(bytes.length / 2);
    if (!frames) return;
    const buffer = session.context.createBuffer(1, frames, SPEAKER_RATE);
    const samples = buffer.getChannelData(0);
    const pcm = new DataView(bytes.buffer, bytes.byteOffset, frames * 2);
    for (let i = 0; i < frames; i++) samples[i] = pcm.getInt16(i * 2, true) / 32768;
    const source = session.context.createBufferSource();
    source.buffer = buffer;
    source.connect(session.speaker);
    playback.sources.add(source);
    source.onended = () => {
      source.disconnect();
      playback.sources.delete(source);
    };
    if (nextTime < session.context.currentTime || !last) nextTime = session.context.currentTime + 0.035;
    source.start(nextTime);
    nextTime += buffer.duration;
    if (!last) onPlaying();
    last = source;
  };

  try {
    while (!playback.controller.signal.aborted) {
      const { done, value } = await reader.read();
      if (playback.controller.signal.aborted) return;
      if (done) break;
      const bytes = new Uint8Array(pending.length + value.length);
      bytes.set(pending);
      bytes.set(value, pending.length);
      if (bytes.length < 2400) {
        pending = bytes;
        continue;
      }
      const aligned = bytes.length - (bytes.length % 2);
      schedule(bytes.subarray(0, aligned));
      pending = bytes.slice(aligned);
    }
    if (playback.controller.signal.aborted) return;
    schedule(pending);
    const finalSource = last;
    if (!finalSource) throw new Error("Momo belum mengirim audio.");
    if (!playback.sources.has(finalSource)) return;
    await new Promise<void>(resolve => {
      finalSource.addEventListener("ended", () => resolve(), { once: true });
      playback.controller.signal.addEventListener("abort", () => resolve(), { once: true });
    });
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function useMomoCall(onVoiceEnd?: () => void) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [turns, setTurns] = useState<CallTurn[]>([]);
  const [showCurrent, setShowCurrent] = useState(false);
  const [backup, setBackup] = useState(false);
  const [workspaceLinks, setWorkspaceLinks] = useState<LalaWorkspaceLink[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState("");
  const [deleteTitle, setDeleteTitle] = useState("");
  const deleteDecision = useRef<((allowed: boolean) => void) | null>(null);
  const active = useRef<Session | null>(null);
  const meterSamples = useRef(new Float32Array(512));

  const stop = useCallback(() => {
    const session = active.current;
    active.current = null;
    if (session) dispose(session);
  }, []);
  useEffect(() => stop, [stop]);

  const level = useCallback(() => {
    const session = active.current;
    const analyser = session?.speaking ? session.speaker : session && !micBlocked(session) ? session.mic : undefined;
    if (!analyser) return 0;
    const samples = meterSamples.current;
    analyser.getFloatTimeDomainData(samples);
    let total = 0;
    for (const sample of samples) total += sample * sample;
    return Math.min(1, Math.max(0, Math.sqrt(total / samples.length) - 0.006) * 5);
  }, []);

  function fail(message: string) {
    stop();
    setError(message);
    setPhase("idle");
  }

  function finishVoiceEnd(session: Session) {
    if (active.current !== session) return;
    stop();
    setPhase("idle");
    onVoiceEnd?.();
  }

  function beginFarewell(session: Session) {
    session.ending = true;
    stopPlayback(session);
    session.timers.add(window.setTimeout(() => finishVoiceEnd(session), 8_000));
  }

  function archiveTurn(question: string, answer: string) {
    if (question || answer) setTurns(previous => [...previous, { question, answer }].slice(-80));
    setShowCurrent(false);
  }

  async function answer(session: Session, question: string, greeting?: string) {
    if (session.ending) return;
    const farewell = !greeting && wantsToEndCall(question);
    if (farewell) beginFarewell(session);
    stopPlayback(session);
    const playback: Playback = { controller: new AbortController(), sources: new Set() };
    session.playback = playback;
    const signal = playback.controller.signal;
    const isCurrent = () => active.current === session && session.playback === playback;
    setPhase("thinking");
    setError("");
    setTranscript(question);
    setReply("");
    setShowCurrent(true);
    const history = session.history.slice(-12);
    if (question) session.history = [...history, { role: "user", content: question }];

    let audioQueue = Promise.resolve();
    let audioError: unknown;
    let replyText = "";
    const showReply = (value: string) => {
      if (isCurrent()) setReply(value);
    };
    const queueSpeech = (text: string) => {
      if (!isCurrent() || signal.aborted || audioError) return;
      const pending = apiFetch("/api/call/speech", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }), signal,
      }).catch((cause: unknown) => cause);
      audioQueue = audioQueue.then(async () => {
        const speech = await pending;
        if (!(speech instanceof Response)) throw speech;
        if (!isCurrent() || signal.aborted || audioError) { void speech.body?.cancel().catch(() => {}); return; }
        if (!speech.ok) throw new Error(await readError(speech, "Suara Momo belum bisa diputar."));
        await playPcm(speech, session, playback, () => {
          if (!isCurrent()) return;
          playback.spoken = spokenWords(text);
          session.recorder?.discard();
          session.speaking = true;
          setPhase("speaking");
        });
      }).catch((cause: unknown) => { audioError = cause; });
    };
    try {
      const immediate = farewell ? "Oke, aku tutup panggilannya sekarang, ya. Sampai jumpa!" : greeting ?? correctionReply(question);
      if (immediate) {
        replyText = immediate;
        showReply(immediate);
        queueSpeech(immediate);
      } else {
        const response = await apiFetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, history, stream: true }),
          signal,
        });
        if (!response.ok) throw new Error(await readError(response, "Momo belum bisa menjawab."));
        replyText = await readCallReply(response, showReply, queueSpeech, () => {
          if (isCurrent()) setPhase("searching");
        });
      }

      await audioQueue;
      if (audioError) throw audioError;
      if (isCurrent() && question) {
        const turn: Turn = { role: "assistant", content: replyText };
        session.history = [...session.history, turn].slice(-12);
      }
    } catch (cause) {
      if (isCurrent() && !signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Panggilan sempat terputus.");
      }
    } finally {
      if (isCurrent()) {
        if (farewell) finishVoiceEnd(session);
        else {
          archiveTurn(question, replyText);
          stopPlayback(session);
          setPhase("listening");
        }
      }
    }
  }

  async function connectLala(session: Session, language: "id" | "en") {
    const signal = AbortSignal.any([session.controller.signal, AbortSignal.timeout(CONNECT_TIMEOUT)]);
    const [response] = await Promise.all([
      apiFetch("/api/call/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "lala", language }),
        signal,
      }),
      session.context.audioWorklet.addModule("/audio/call-capture.js"),
    ]);
    if (active.current !== session) return;
    if (!response.ok) throw new Error(await readError(response, "Lala belum bisa terhubung."));
    const { token, model } = await response.json() as { token: string; model: string };
    if (active.current !== session) return;
    if (!token || !model) throw new Error("Sesi Lala belum tersedia.");

    const url = new URL("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained");
    url.searchParams.set("access_token", token);
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    session.socket = socket;
    const capture = new AudioWorkletNode(session.context, "momo-call-capture");
    session.capture = capture;
    session.micSource?.connect(capture);
    capture.connect(session.context.destination);

    let ready = false;
    let inputText = "";
    let outputText = "";
    let audioInput: ReadableStreamDefaultController<Uint8Array> | undefined;
    const searches = new Map<string, AbortController>();
    const workspaceCalls = new Map<string, AbortController>();
    const handledWorkspaceCalls = new Set<string>();
    const send = (message: object) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    const connectionFailed = () => {
      if (active.current !== session) return;
      if (session.ending) {
        closeAudioInput();
        if (!session.playback) finishVoiceEnd(session);
      } else fail("Panggilan Lala terputus. Coba lagi atau pilih Momo.");
    };
    const setupTimer = window.setTimeout(connectionFailed, CONNECT_TIMEOUT);
    session.timers.add(setupTimer);
    session.endMicStream = () => {
      if (ready) send({ realtimeInput: { audioStreamEnd: true } });
    };
    capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (!ready || session.muted || session.ending || active.current !== session) return;
      if (socket.bufferedAmount > 128_000) { connectionFailed(); return; }
      const data = btoa(String.fromCharCode(...new Uint8Array(event.data)));
      send({ realtimeInput: { audio: { data, mimeType: "audio/pcm;rate=16000" } } });
    };

    function closeAudioInput() {
      const input = audioInput;
      audioInput = undefined;
      input?.close();
    }

    function playChunk(data: string) {
      if (!audioInput) {
        stopPlayback(session);
        const playback: Playback = { controller: new AbortController(), sources: new Set() };
        session.playback = playback;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) { audioInput = controller; },
          cancel() { if (session.playback === playback) audioInput = undefined; },
        });
        playback.controller.signal.addEventListener("abort", closeAudioInput, { once: true });
        void playPcm(new Response(stream), session, playback, () => {
          session.speaking = true;
          setPhase("speaking");
        }).catch(() => {
          if (active.current === session && session.playback === playback) setError("Suara Lala belum bisa diputar.");
        }).finally(() => {
          playback.controller.signal.removeEventListener("abort", closeAudioInput);
          if (active.current !== session || session.playback !== playback) return;
          audioInput = undefined;
          if (session.ending) { finishVoiceEnd(session); return; }
          stopPlayback(session);
          setPhase("listening");
        });
      }
      audioInput?.enqueue(Uint8Array.from(atob(data), character => character.charCodeAt(0)));
    }

    async function searchForLala(id: string, query: string) {
      if (searches.has(id)) return;
      const controller = new AbortController();
      searches.set(id, controller);
      const signal = AbortSignal.any([session.controller.signal, controller.signal]);
      setPhase("searching");
      let response: { results: unknown[]; date?: string } = { results: [] };
      try {
        const result = await apiFetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "web-search", question: query.slice(0, 200) }),
          signal,
        });
        if (result.ok) response = await result.json();
      } catch {
        // An empty result tells Lala the lookup could not verify the answer.
      } finally {
        searches.delete(id);
      }
      if (signal.aborted || active.current !== session) return;
      send({ toolResponse: { functionResponses: [{ id, name: "search_call_web", response }] } });
    }

    function confirmDelete(title: string, signal: AbortSignal) {
      if (deleteDecision.current || signal.aborted) return Promise.resolve(false);
      return new Promise<boolean>(resolve => {
        const cancel = () => decide(false);
        const decide = (allowed: boolean) => {
          signal.removeEventListener("abort", cancel);
          deleteDecision.current = null;
          if (active.current === session) setDeleteTitle("");
          resolve(allowed);
        };
        deleteDecision.current = decide;
        signal.addEventListener("abort", cancel, { once: true });
        setDeleteTitle(title);
      });
    }

    async function actForLala(id: string, args: Record<string, unknown>) {
      if (handledWorkspaceCalls.has(id)) return;
      handledWorkspaceCalls.add(id);
      const controller = new AbortController();
      workspaceCalls.set(id, controller);
      const signal = AbortSignal.any([session.controller.signal, controller.signal]);
      const loadingLabel = args.action === "create" ? "Membuat catatan…"
        : args.action === "artifact" ? "Menyusun artefak…"
        : args.action === "chat" ? "Menyiapkan chat…"
        : args.action === "update" ? "Memperbarui catatan…"
        : "Menyiapkan catatan…";
      setWorkspaceLoading(loadingLabel);
      setPhase("working");
      let response: object;
      try {
        response = await runLalaWorkspace(args, signal, title => confirmDelete(title, signal), link => {
          if (active.current !== session || signal.aborted) return;
          setWorkspaceLinks(previous => [...previous.filter(item => item.href !== link.href), link].slice(-5));
        });
      } catch (cause) {
        response = { error: cause instanceof Error ? cause.message : "Tindakan belum berhasil." };
      } finally {
        workspaceCalls.delete(id);
        if (active.current === session && workspaceCalls.size === 0) setWorkspaceLoading("");
      }
      if (signal.aborted || active.current !== session) return;
      send({ toolResponse: { functionResponses: [{ id, name: "lala_workspace", response }] } });
    }

    socket.onopen = () => send({ setup: { model } });
    socket.onerror = connectionFailed;
    socket.onclose = connectionFailed;
    socket.onmessage = event => {
      if (active.current !== session) return;
      try {
        const raw = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
        const message = JSON.parse(raw) as LiveMessage;
        for (const id of message.toolCallCancellation?.ids ?? []) {
          searches.get(id)?.abort();
          workspaceCalls.get(id)?.abort();
        }
        for (const call of message.toolCall?.functionCalls ?? []) {
          if (!call.id) continue;
          if (call.name === "lala_workspace") { void actForLala(call.id, call.args ?? {}); continue; }
          if (call.name !== "search_call_web") continue;
          const query = typeof call.args?.query === "string" ? call.args.query.trim() : "";
          if (query) void searchForLala(call.id, query);
          else send({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { results: [] } }] } });
        }
        if (message.setupComplete && !ready) {
          ready = true;
          window.clearTimeout(setupTimer);
          setPhase("thinking");
          session.sendVideoFrame = data => {
            if (session.ending || socket.bufferedAmount > 16_000 || data.length > 96_000) return;
            send({ realtimeInput: { video: { data, mimeType: "image/jpeg" } } });
          };
          session.sendText = text => {
            inputText = text;
            setTranscript(text);
            setReply("");
            setShowCurrent(true);
            setPhase("thinking");
            send({ realtimeInput: { text } });
          };
          send({ realtimeInput: { text: language === "en"
            ? "Open the call by saying: Hi, I'm Lala. How can I help?"
            : "Buka panggilan dengan hangat: Hai, aku Lala! Mau ngobrol atau mau aku bantu bikin sesuatu?" } });
        }
        const content = message.serverContent;
        if (!content) return;
        if (content.interrupted) {
          stopPlayback(session);
          outputText = "";
          setReply("");
          setPhase("listening");
        }
        if (content.inputTranscription?.text) {
          if (!inputText && !outputText) setReply("");
          inputText += content.inputTranscription.text;
          setTranscript(inputText);
          setShowCurrent(true);
          if (!session.speaking && !content.outputTranscription?.text) setReply("");
        }
        if (!session.ending && !session.muted && wantsToEndCall(inputText)) {
          if (content.turnComplete) {
            beginFarewell(session);
            outputText = "";
            inputText = "";
            setReply("");
            setShowCurrent(true);
            setPhase("thinking");
            send({ realtimeInput: { text: language === "en"
              ? "Say this farewell aloud now, without calling any tool: Okay, I'll end the call now. See you!"
              : "Ucapkan kalimat pamit ini sekarang, tanpa memanggil alat: Oke, aku tutup panggilannya sekarang, ya. Sampai jumpa!" } });
          }
          return;
        }
        if (!content.interrupted) {
          if (content.outputTranscription?.text) {
            outputText += content.outputTranscription.text;
            setReply(outputText);
            setShowCurrent(true);
          }
          for (const part of content.modelTurn?.parts ?? []) {
            const audio = part.inlineData;
            if (audio?.data && audio.mimeType?.startsWith("audio/pcm")) playChunk(audio.data);
          }
        }
        if (content.turnComplete) {
          closeAudioInput();
          if (!session.ending) archiveTurn(inputText, outputText);
          inputText = "";
          outputText = "";
          if (!session.playback && searches.size === 0 && workspaceCalls.size === 0) setPhase("listening");
        }
      } catch {
        connectionFailed();
      }
    };
  }

  async function start(provider: CallProvider = "momo") {
    if (active.current) return;
    setMuted(false);
    setBackup(false);
    setError("");
    setTranscript("");
    setReply("");
    setTurns([]);
    setShowCurrent(false);
    setWorkspaceLinks([]);
    setWorkspaceLoading("");
    setDeleteTitle("");
    if (!navigator.mediaDevices?.getUserMedia) {
      fail("Mikrofon tidak tersedia di browser ini. Buka Eureka lewat HTTPS di Safari atau Chrome.");
      return;
    }
    const AudioContextClass = window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      fail("Browser ini belum mendukung audio panggilan. Coba buka Eureka di Safari atau Chrome.");
      return;
    }

    let context: AudioContext;
    try {
      context = new AudioContextClass();
    } catch {
      fail("Audio tidak bisa dimulai di perangkat ini.");
      return;
    }
    setPhase("permission");
    const speaker = context.createAnalyser();
    speaker.fftSize = 512;
    speaker.connect(context.destination);
    const session: Session = {
      controller: new AbortController(), context, speaker, history: [],
      muted: false, speaking: false, echoUntil: 0, freshSpeech: true, timers: new Set(),
    };
    active.current = session;
    const isCurrent = () => active.current === session;
    const language = getClientLocale() === "en" ? "en" : "id";
    let greeted = false;
    const greet = () => {
      if (greeted) return;
      greeted = true;
      void answer(session, "", language === "en"
        ? "Hi, I'm Momo. How can I help?"
        : "Hai, aku Momo. Ada yang bisa aku bantu?");
    };
    const interrupt = () => {
      if (!session.playback) return;
      stopPlayback(session);
      setReply("");
      setPhase("listening");
    };

    // Keep both requests in the click handler for mobile browser activation.
    void context.resume().catch(() => {});
    let stream: MediaStream;
    try {
      stream = await openCallMicrophone(session.controller.signal);
    } catch (cause) {
      if (!isCurrent()) return;
      const message = await microphoneError(cause);
      if (isCurrent()) fail(message);
      return;
    }

    try {
      if (!isCurrent()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      session.stream = stream;
      const tracks = stream.getAudioTracks();
      if (!tracks.some(track => track.readyState === "live")) {
        fail("Mikrofon terputus sebelum panggilan dimulai. Ketuk mikrofon untuk mencoba lagi.");
        return;
      }
      const mic = context.createAnalyser();
      mic.fftSize = 512;
      session.mic = mic;
      const source = context.createMediaStreamSource(stream);
      session.micSource = source;
      source.connect(mic);
      for (const track of tracks) {
        track.onended = () => { if (isCurrent()) fail("Mikrofon terputus. Coba mulai panggilan lagi."); };
      }

      setPhase("connecting");
      const audioTimer = window.setTimeout(() => {
        if (isCurrent() && context.state !== "running") fail("Audio perangkat belum aktif. Ketuk mikrofon untuk mencoba lagi.");
      }, 5_000);
      session.timers.add(audioTimer);
      await context.resume();
      window.clearTimeout(audioTimer);
      if (!isCurrent()) return;

      session.timers.add(window.setTimeout(() => {
        if (isCurrent()) fail("Sesi suara selesai. Mulai lagi untuk melanjutkan.");
      }, provider === "lala" ? 9 * 60_000 : SESSION_TIMEOUT));

      if (provider === "lala") {
        try {
          await connectLala(session, language);
        } catch (cause) {
          if (isCurrent()) fail(cause instanceof Error && cause.name === "Error"
            ? cause.message : "Lala belum bisa terhubung. Coba lagi atau pilih Momo.");
        }
        return;
      }

      const realtime = new AbortController();
      const switchToRecording = () => {
        if (!isCurrent() || session.recorder || realtime.signal.aborted) return;
        window.clearTimeout(connectTimer);
        realtime.abort();
        disconnectRealtime(session);
        if (typeof MediaRecorder === "undefined") {
          fail("Koneksi realtime gagal dan browser ini tidak mendukung rekaman suara.");
          return;
        }
        session.recorder = recordCallTurns(stream, mic, () => micBlocked(session), interrupt, async audio => {
          if (!isCurrent()) return;
          const controller = new AbortController();
          session.transcription = controller;
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]);
          setError("");
          setReply("");
          setTranscript("");
          setPhase("thinking");
          try {
            const extension = /mp4/i.test(audio.type) ? "m4a" : /ogg/i.test(audio.type) ? "ogg" : "webm";
            const form = new FormData();
            form.append("userId", getUserId());
            form.append("audio", audio, `panggilan.${extension}`);
            const response = await apiFetch("/api/audio/transcribe", { method: "POST", body: form, signal });
            if (response.status === 422) {
              if (isCurrent() && !controller.signal.aborted) setPhase("listening");
              return;
            }
            if (!response.ok) throw new Error(await readError(response, "Ucapan belum bisa ditranskripsi."));
            const { text } = await response.json() as { text?: string };
            if (!isCurrent() || controller.signal.aborted || session.muted) return;
            if (text?.trim()) void answer(session, text.trim());
            else setPhase("listening");
          } catch (cause) {
            if (!isCurrent() || controller.signal.aborted) return;
            setError(signal.aborted ? "Transkripsi terlalu lama. Coba bicara lagi." : cause instanceof Error ? cause.message : "Ucapan belum bisa ditranskripsi.");
            setPhase("listening");
          } finally {
            if (session.transcription === controller) session.transcription = undefined;
          }
        }, () => { if (isCurrent()) fail("Rekaman suara terputus. Coba mulai lagi."); });
        setBackup(true);
        if (!session.playback) setTranscript("");
        setPhase(session.speaking ? "speaking" : session.playback ? "thinking" : "listening");
        greet();
      };

      const connectTimer = window.setTimeout(switchToRecording, CONNECT_TIMEOUT);
      session.timers.add(connectTimer);
      try {
        const signal = AbortSignal.any([session.controller.signal, realtime.signal]);
        const [response] = await Promise.all([
          apiFetch("/api/call/session", { method: "POST", signal }),
          context.audioWorklet.addModule("/audio/call-capture.js"),
        ]);
        if (!isCurrent() || signal.aborted) return;
        if (!response.ok) {
          if ([401, 403, 429].includes(response.status)) {
            const message = await readError(response, "Sesi suara tidak tersedia.");
            if (isCurrent() && !signal.aborted) fail(message);
          } else switchToRecording();
          return;
        }
        const { token } = await response.json() as { token: string };
        if (!isCurrent() || signal.aborted) return;

        const params = new URLSearchParams({
          token, model_id: "scribe_v2_realtime", audio_format: "pcm_16000",
          language_code: language,
          commit_strategy: "vad", vad_silence_threshold_secs: "0.65",
        });
        const capture = new AudioWorkletNode(context, "momo-call-capture");
        session.capture = capture;
        source.connect(capture);
        // The processor writes no output. This keeps capture active on Safari.
        capture.connect(context.destination);
        const socket = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params}`);
        session.socket = socket;

        let ready = false;
        let previousVoiced: Uint8Array | undefined;
        let interruptionAudio = false;
        const sendAudio = (audio: Uint8Array) => socket.send(JSON.stringify({
          message_type: "input_audio_chunk", audio_base_64: btoa(String.fromCharCode(...audio)),
          sample_rate: 16000, commit: false,
        }));
        capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (!ready || !isCurrent() || socket.readyState !== WebSocket.OPEN) return;
          if (socket.bufferedAmount > 128_000) { switchToRecording(); return; }
          const bytes = new Uint8Array(event.data);
          // Browser echo cancellation runs before this gate. Keep the first
          // voiced chunk so opening the gate doesn't cut the start of a word.
          if (!session.ending && session.speaking && !session.muted && !interruptionAudio && hasVoice(bytes)) {
            if (previousVoiced) {
              interruptionAudio = true;
              sendAudio(previousVoiced);
            } else {
              previousVoiced = bytes;
              return;
            }
          }
          previousVoiced = undefined;
          const canInterrupt = !session.ending && session.speaking && !session.muted && interruptionAudio;
          if (!canInterrupt) interruptionAudio = false;
          if (!micBlocked(session) && !session.freshSpeech && hasVoice(bytes)) session.freshSpeech = true;
          sendAudio(micBlocked(session) && !canInterrupt ? new Uint8Array(bytes.length) : bytes);
        };

        socket.onmessage = event => {
          if (!isCurrent() || typeof event.data !== "string") return;
          let message: { message_type?: string; text?: string };
          try { message = JSON.parse(event.data); } catch { return; }
          if (message.message_type === "session_started") {
            ready = true;
            window.clearTimeout(connectTimer);
            greet();
            return;
          }
          const text = typeof message.text === "string" ? message.text.trim() : "";
          const maySpeak = !session.ending && !session.muted && (session.speaking ? interruptionAudio : !micBlocked(session));
          const words = spokenWords(text);
          const echo = session.speaking && words && ` ${session.playback?.spoken ?? ""} `.includes(` ${words} `);
          if (message.message_type === "partial_transcript" && words && maySpeak && !echo) {
            session.freshSpeech = true;
            const wasSpeaking = session.speaking;
            interrupt();
            if (wasSpeaking) session.echoUntil = 0;
            setReply("");
            setTranscript(text);
            setShowCurrent(true);
          } else if (message.message_type === "committed_transcript" && words && maySpeak && !echo && (session.freshSpeech || interruptionAudio)) {
            session.freshSpeech = false;
            interruptionAudio = false;
            void answer(session, text);
          } else if (message.message_type === "error" || message.message_type?.endsWith("_error") || message.message_type === "quota_exceeded" || message.message_type === "rate_limited") {
            switchToRecording();
          }
        };
        socket.onclose = switchToRecording;
        socket.onerror = switchToRecording;
      } catch {
        switchToRecording();
      }
    } catch {
      if (!isCurrent()) return;
      fail("Mikrofon sudah terbuka, tetapi audio panggilan belum bisa dimulai. Ketuk mikrofon untuk mencoba lagi.");
    }
  }

  function toggleMute() {
    const session = active.current;
    if (!session?.stream) return;
    session.muted = !session.muted;
    for (const track of session.stream.getAudioTracks()) track.enabled = !session.muted;
    if (session.muted) {
      session.endMicStream?.();
      session.recorder?.discard();
      if (session.transcription) {
        session.transcription.abort();
        setPhase("listening");
      }
      session.freshSpeech = false;
      if (!session.endMicStream && session.socket?.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: 16000 }));
      }
    }
    setMuted(session.muted);
  }

  function sendText(text: string) {
    const session = active.current;
    const question = text.trim().slice(0, 2000);
    if (!question || phase !== "listening" || !session || session.ending || session.transcription || session.playback) return false;
    session.recorder?.discard();
    if (session.sendText) session.sendText(question);
    else void answer(session, question);
    return true;
  }

  const sendVideoFrame = useCallback((data: string) => {
    active.current?.sendVideoFrame?.(data);
  }, []);

  return {
    phase, muted, error, transcript, reply, backup, level, start, stop, toggleMute,
    workspaceLinks, workspaceLoading, deleteTitle,
    turns, showCurrent, sendText, sendVideoFrame,
    confirmWorkspaceDelete: (allowed: boolean) => deleteDecision.current?.(allowed),
  };
}
