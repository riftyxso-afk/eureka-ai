import { extractYoutubeVideoId } from "./assistant/videoUrl";
export type StudyVideo = { id: string; seconds: number; title: string };
export function requestedVideoTime(prompt: string): number | undefined {
  const words: Record<string, number> = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10 };
  prompt = prompt.replace(/\b(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b/gi, word => String(words[word.toLowerCase()]));
  const clock = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/.exec(prompt);
  if (clock) return Math.min(86400, clock[3] ? +clock[1] * 3600 + +clock[2] * 60 + +clock[3] : +clock[1] * 60 + +clock[2]);
  const minutes = /\b(?:menit\s*(?:ke[- ]?)?\s*(\d+)|(\d+)\s*menit)/i.exec(prompt);
  if (minutes) {
    const seconds = /\b(?:detik\s*(\d+)|(\d+)\s*detik)/i.exec(prompt.slice(minutes.index + minutes[0].length));
    return Math.min(86400, +(minutes[1] || minutes[2]) * 60 + +(seconds?.[1] || seconds?.[2] || 0));
  }
  const seconds = /\bdetik\s*(?:ke[- ]?)?\s*(\d+)/i.exec(prompt);
  return seconds ? Math.min(86400, +seconds[1]) : undefined;
}
export function studyVideoFromUrl(url: string, title = "Video yang sedang dibahas"): StudyVideo | undefined {
  const id = extractYoutubeVideoId(url);
  if (!id) return;
  try {
    const raw = new URL(url).searchParams.get("t") || new URL(url).searchParams.get("start") || "0";
    const seconds = /^\d+s?$/.test(raw) ? parseInt(raw, 10) : requestedVideoTime(raw.replace(/(\d+)m(\d+)s/, '$1:$2')) || 0;
    return { id, seconds: Math.min(86400, seconds), title };
  } catch { return; }
}
export function videoTranscriptWindow(segments: { offsetMs: number; durationMs: number; text: string }[], seconds: number) {
  const start = Math.max(0, seconds - 15) * 1000, end = (seconds + 100) * 1000;
  return segments.filter(segment => segment.offsetMs <= end && segment.offsetMs + Math.max(segment.durationMs, 1000) >= start)
    .map(segment => `[${Math.floor(segment.offsetMs / 60000)}:${String(Math.floor(segment.offsetMs / 1000) % 60).padStart(2, '0')}] ${segment.text}`).join(" ").slice(0, 7000);
}
