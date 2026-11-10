/** Local silence detection for connections that cannot stream microphone audio. */
export function recordCallTurns(
  stream: MediaStream,
  analyser: AnalyserNode,
  isMuted: () => boolean,
  onSpeech: () => void,
  onTurn: (audio: Blob) => Promise<void>,
  onError: () => void,
) {
  const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]
    .find(type => MediaRecorder.isTypeSupported(type));
  const samples = new Float32Array(analyser.fftSize);
  let recording: MediaRecorder | undefined;
  let startedAt = 0;
  let lastSpeechAt = 0;
  let busy = false;
  let closed = false;

  function discard() {
    const current = recording;
    recording = undefined;
    if (current?.state === "recording") current.stop();
  }

  const timer = window.setInterval(() => {
    if (isMuted() || busy) return;
    analyser.getFloatTimeDomainData(samples);
    const volume = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
    const now = performance.now();
    if (volume > 0.018) lastSpeechAt = now;

    if (recording) {
      if (recording.state === "recording" && (now - lastSpeechAt >= 900 || now - startedAt >= 25_000)) {
        recording.stop();
      }
      return;
    }
    if (volume <= 0.018) return;

    try {
      const current = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      current.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      current.onerror = () => { discard(); if (!closed) onError(); };
      current.onstop = () => {
        if (recording !== current) return;
        recording = undefined;
        if (closed || isMuted() || lastSpeechAt - startedAt < 100) return;
        const audio = new Blob(chunks, { type: current.mimeType || mime || "audio/webm" });
        if (!audio.size) return;
        busy = true;
        void onTurn(audio).finally(() => { busy = false; });
      };
      startedAt = now;
      current.start();
      recording = current;
      onSpeech();
    } catch {
      onError();
    }
  }, 40);

  return {
    discard,
    stop() {
      closed = true;
      window.clearInterval(timer);
      discard();
    },
  };
}
