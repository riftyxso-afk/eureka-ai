export type LoadingStage = "combining" | "synchronizing" | "reading" | "retrieving" | "thinking";

export function isLoadingStage(value: unknown): value is LoadingStage {
  return typeof value === "string" && ["combining", "synchronizing", "reading", "retrieving", "thinking"].includes(value);
}

export function noteLoadingStage(phase?: string, message = ""): LoadingStage {
  switch (phase) {
    case "extract": return "reading";
    case "chapters": return "thinking";
    case "enrichment": return "retrieving";
    case "rag": return "synchronizing";
    case "study_tools": return "combining";
  }
  // Older persisted jobs may have only a progress message.
  if (/mengirim|menunggu|menyiapkan|menyimpan|sinkron|indeks|index|embedding/i.test(message)) return "synchronizing";
  if (/ekstrak|mengambil materi|membaca|transkrip|mengunduh/i.test(message)) return "reading";
  if (/mencari|pencarian|penelusuran|search|retriev/i.test(message)) return "retrieving";
  if (/menggabung|merangkai|kuis|kartu hafalan|flashcard/i.test(message)) return "combining";
  return "thinking";
}
