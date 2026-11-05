import { getSession } from "@/lib/auth";

type FirstNoteGuide = { stage: "welcome" | "active" | "ready" | "skipped" | "done"; jobId?: string; noteId?: string };

const eventName = "eureka:first-note-guide";
const memory = new Map<string, string>();

function accountKey() {
  const id = getSession()?.userId;
  return id ? `eureka:first-note-guide:${id}` : null;
}

export function readFirstNoteGuide(): string {
  const key = accountKey();
  if (!key) return "";
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}

export function parseFirstNoteGuide(value: string): FirstNoteGuide | null {
  try {
    const guide = JSON.parse(value) as FirstNoteGuide | null;
    return guide && ["welcome", "active", "ready", "skipped", "done"].includes(guide.stage) ? guide : null;
  } catch {
    return null;
  }
}

export function setFirstNoteGuide(guide: FirstNoteGuide) {
  const key = accountKey();
  if (!key) return;
  const value = JSON.stringify(guide);
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // The current tab can still finish the guide.
  }
  window.dispatchEvent(new Event(eventName));
}

export function offerFirstNoteGuide() {
  if (!readFirstNoteGuide()) setFirstNoteGuide({ stage: "welcome" });
}

export function trackFirstNoteJob(jobId: string) {
  const guide = parseFirstNoteGuide(readFirstNoteGuide());
  if (guide?.stage === "active") setFirstNoteGuide({ stage: "active", jobId });
}

export function recordFirstNote(noteId: string, jobId?: string) {
  const guide = parseFirstNoteGuide(readFirstNoteGuide());
  if (guide?.stage !== "active" || !noteId || (jobId && guide.jobId !== jobId)) return;
  setFirstNoteGuide({ stage: "ready", noteId });
}

export function finishFirstNoteGuide(noteId: string) {
  const guide = parseFirstNoteGuide(readFirstNoteGuide());
  if (guide?.stage === "ready" && guide.noteId === noteId) setFirstNoteGuide({ stage: "done" });
}

export function subscribeFirstNoteGuide(update: () => void) {
  window.addEventListener(eventName, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(eventName, update);
    window.removeEventListener("storage", update);
  };
}
