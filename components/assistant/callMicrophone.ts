// An idle track stays disabled briefly so reopening a call does not ask for capture again.
// The lease is exclusive, and leaving the page releases a parked track immediately.
const REOPEN_WINDOW = 20_000;

let stream: MediaStream | undefined;
let opening: Promise<void> | undefined;
let expiry: ReturnType<typeof setTimeout> | undefined;
let holder: AbortSignal | undefined;

export async function microphonePermission(): Promise<PermissionState | undefined> {
  try {
    return (await navigator.permissions?.query({ name: "microphone" as PermissionName }))?.state;
  } catch {
    return undefined;
  }
}

function live(stream: MediaStream | undefined): stream is MediaStream {
  return Boolean(stream?.getAudioTracks().some(track => track.readyState === "live"));
}

function discardParkedMicrophone() {
  if (holder) return;
  clearTimeout(expiry);
  window.removeEventListener("pagehide", discardParkedMicrophone);
  document.removeEventListener("visibilitychange", discardIfHidden);
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
}

function discardIfHidden() {
  if (document.visibilityState === "hidden") discardParkedMicrophone();
}

function parkMicrophone() {
  stream?.getAudioTracks().forEach(track => {
    track.enabled = false;
    track.onended = null;
  });
  if (!live(stream) || document.visibilityState === "hidden") {
    discardParkedMicrophone();
    return;
  }
  clearTimeout(expiry);
  expiry = setTimeout(discardParkedMicrophone, REOPEN_WINDOW);
  window.addEventListener("pagehide", discardParkedMicrophone, { once: true });
  document.addEventListener("visibilitychange", discardIfHidden);
}

async function openMicrophone() {
  // Simple constraints avoid a second permission request on stricter mobile browsers.
  async function requestTrack() {
    const opened = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (opened.getAudioTracks().some(track => track.readyState === "live")) return opened;
    opened.getTracks().forEach(track => track.stop());
    throw new DOMException("No live microphone track", "NotReadableError");
  }
  try {
    return await requestTrack();
  } catch (error) {
    // Retry a capture interruption only if the browser can reopen without prompting.
    if (!(error instanceof DOMException) || !["NotReadableError", "NotAllowedError", "AbortError"].includes(error.name)
      || await microphonePermission() !== "granted" || !holder || holder.aborted) throw error;
    return requestTrack();
  }
}

export async function acquireCallMicrophone(signal: AbortSignal) {
  signal.throwIfAborted();
  if (holder) throw new DOMException("Microphone is in use by another call", "InvalidStateError");
  holder = signal;
  clearTimeout(expiry);

  const release = () => {
    if (holder !== signal) return;
    signal.removeEventListener("abort", release);
    holder = undefined;
    parkMicrophone();
  };
  signal.addEventListener("abort", release, { once: true });

  try {
    if (!live(stream)) {
      opening ??= openMicrophone().then(opened => {
        if (holder) stream = opened;
        else opened.getTracks().forEach(track => track.stop());
      }).finally(() => { opening = undefined; });
      await opening;
    }
    signal.throwIfAborted();
    if (!live(stream)) throw new DOMException("No live microphone track", "NotReadableError");
    for (const track of stream.getAudioTracks()) {
      track.enabled = true;
      void track.applyConstraints({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }).catch(() => {});
    }
    return { stream, release };
  } catch (error) {
    release();
    throw error;
  }
}
