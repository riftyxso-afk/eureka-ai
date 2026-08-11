/**
 * Pecah teks panjang menjadi potongan-potongan (chunks)
 * yang ukurannya aman untuk embedding model.
 */
export function chunkText(text: string, size = 800, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?\n]+[.!?]*/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    const sentence = s.trim();
    if (!sentence) continue;

    if ((current + " " + sentence).trim().length <= size) {
      current = current ? current + " " + sentence : sentence;
      continue;
    }

    if (current) chunks.push(current.trim());
    current = sentence;

    // Kalimat tunggal lebih panjang dari `size` → pecah paksa
    while (current.length > size) {
      chunks.push(current.slice(0, size).trim());
      current = current.slice(size - overlap).trim();
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
}
