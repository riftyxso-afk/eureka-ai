import type { PodcastTurn } from "./podcastHosts";

/** Keep each dialogue request below the provider's combined text limit. */
export function podcastBatches(turns: PodcastTurn[], limit = 1800): PodcastTurn[][] {
  const batches: PodcastTurn[][] = [];
  let batch: PodcastTurn[] = [];
  let size = 0;
  for (const turn of turns) {
    if (turn.text.length > limit) throw new Error("Giliran podcast terlalu panjang.");
    if (size + turn.text.length > limit && batch.length) { batches.push(batch); batch = []; size = 0; }
    batch.push(turn); size += turn.text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

/** Join raw mono PCM without MP3 duration headers or accumulated caption drift. */
export function podcastWave(parts: Uint8Array[], sampleRate = 24000): Uint8Array<ArrayBuffer> {
  const length = parts.reduce((n, part) => n + part.byteLength, 0);
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + length, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, length, true);
  let offset = 44;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}
