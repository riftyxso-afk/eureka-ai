export type TaskCommand = { action: "list" | "create" | "update" | "delete"; title: string; dueDate?: string; status?: "belum" | "progres" | "selesai" };

export function parseTaskCommand(prompt: string): TaskCommand | null {
  const match = /^\/tugas(?:\s+(lihat|buat|ubah|hapus))?(?:\s+(.+))?$/i.exec(prompt.trim());
  if (!match) return null;
  const actions = { lihat: "list", buat: "create", ubah: "update", hapus: "delete" } as const;
  return { action: actions[(match[1]?.toLowerCase() ?? "lihat") as keyof typeof actions], title: (match[2] ?? "").trim().slice(0, 200) };
}

export function mayManageTask(prompt: string): boolean {
  return /\b(tugas|pengingat)\b/i.test(prompt) && /\b(buat|membuat|tambahkan|tambah|simpan|lihat|melihat|tampilkan|daftar|ubah|mengubah|ganti|mengganti|hapus|menghapus|selesaikan|tandai)\b/i.test(prompt);
}

export async function proposeTaskCommand(prompt: string): Promise<TaskCommand | null> {
  if (!mayManageTask(prompt)) return null;
  try {
    const { apiFetch } = await import("@/lib/apiClient");
    const response = await apiFetch("/api/assistant/note-intent", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ text:prompt, resource:"task" }), signal:AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const { command } = await response.json();
    if (!command || !["list", "create", "update", "delete"].includes(command.action) || typeof command.title !== "string") return null;
    const dueDate = prompt.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
    const status = /\b(belum selesai|belum dimulai)\b/i.test(prompt) ? "belum" : /\b(sudah selesai|selesaikan|tandai\b.{0,80}\bselesai)\b/i.test(prompt) ? "selesai" : /\b(sedang dikerjakan|dalam proses)\b/i.test(prompt) ? "progres" : undefined;
    return { action:command.action, title:command.title.slice(0, 200), ...(dueDate ? { dueDate } : {}), ...(status ? { status } : {}) };
  } catch { return null; }
}
