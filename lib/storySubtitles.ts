export type StoryCue = { start: number; end: number; text: string };
type Alignment = { characters?: unknown; character_start_times_seconds?: unknown; character_end_times_seconds?: unknown };

/** Build readable captions from the timing returned alongside the generated audio. */
export function storyCues(alignment: Alignment | null | undefined): StoryCue[] {
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends) || chars.length !== starts.length || chars.length !== ends.length) return [];
  const cues: StoryCue[] = [];
  let buffer = "";
  let start = 0;
  let end = 0;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (typeof char !== "string" || typeof starts[i] !== "number" || typeof ends[i] !== "number" || !Number.isFinite(starts[i]) || !Number.isFinite(ends[i])) return [];
    if (!buffer.trim() && char.trim()) start = starts[i];
    buffer += char;
    end = ends[i];
    const sentenceEnd = /[.!?。！？]\s*$/.test(buffer) && (i === chars.length - 1 || /^\s/.test(chars[i + 1]));
    if (sentenceEnd || (buffer.length >= 100 && /\s/.test(char))) {
      const text = buffer.trim().replace(/\s+/g, " ");
      if (text) cues.push({ start, end, text });
      buffer = "";
    }
  }
  const text = buffer.trim().replace(/\s+/g, " ");
  if (text) cues.push({ start, end, text });
  return cues;
}

export function activeStoryCue(cues: StoryCue[], time: number): StoryCue | undefined {
  if (!cues.length || time < cues[0].start) return undefined;
  for (let i = cues.length - 1; i >= 0; i--) if (time >= cues[i].start) return cues[i];
}
