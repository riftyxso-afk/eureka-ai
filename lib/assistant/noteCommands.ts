export type NoteCommand = { action: "list" | "create" | "rename" | "delete"; title: string };

export function parseNoteCommand(prompt: string): NoteCommand | null {
  const input = prompt.trim();
  const match = /^(?:momo[,]?\s+)?(?:tolong\s+)?(?:\/catatan(?:\s+(lihat|buat|ubah|hapus))?|(lihat|daftar|tampilkan|ubah judul|hapus)\s+catatan)(?:\s+(.*))?$/i.exec(input);
  if (!match) return null;
  const verb = (match[1] ?? match[2] ?? "lihat").toLowerCase();
  const action = verb === "buat" ? "create" : verb.startsWith("ubah") ? "rename" : verb === "hapus" ? "delete" : "list";
  return { action, title: (match[3] ?? "").trim().slice(0, 200) };
}

export function mayManageNote(prompt: string): boolean {
  return /\b(catatan|note)\b/i.test(prompt) && /\b(hapus|menghapus|buang|membuang|hilangkan|menghilangkan|delete|ganti|mengganti|ubah|mengubah|rename|daftar|lihat|melihat|tampilkan|menampilkan|cari|mencari)\b/i.test(prompt);
}

/** AI proposes a bounded action; all changes still require the user to review them. */
export async function proposeNoteCommand(prompt: string): Promise<NoteCommand | null> {
  if (!mayManageNote(prompt)) return null;
  try {
    const { apiFetch } = await import("@/lib/apiClient");
    const response = await apiFetch("/api/assistant/note-intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: prompt }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const { command } = await response.json();
    if (!command || !["list", "rename", "delete"].includes(command.action) || typeof command.title !== "string") return null;
    return { action: command.action, title: command.title.slice(0, 200) };
  } catch { return null; }
}
