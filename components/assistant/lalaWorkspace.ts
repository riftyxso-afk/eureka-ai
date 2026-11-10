import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

type Note = { id: string; title: string; summary?: string | null };
export type LalaWorkspaceLink = { href: string; label: string; title: string };

function field(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function callApi(path: string, signal: AbortSignal, method = "GET", payload?: object) {
  const response = await apiFetch(path, {
    signal, method,
    ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Tindakan belum berhasil.");
  return data;
}

function noteLink(note: Note): LalaWorkspaceLink {
  return { href: `/dashboard-v2/note/${encodeURIComponent(note.id)}?tab=notes`, label: "Buka catatan", title: note.title };
}

export async function runLalaWorkspace(
  args: Record<string, unknown>,
  signal: AbortSignal,
  confirmDelete: (title: string) => Promise<boolean>,
  showLink: (link: LalaWorkspaceLink) => void,
) {
  const title = field(args.title, 200);
  const action = args.action;
  if (action === "chat" || action === "artifact") {
    const prompt = field(args.prompt, 2000);
    const content = field(args.content, 16000);
    if (!prompt || !content) return { error: "Sertakan permintaan pengguna dan isi jawaban." };
    const chatTitle = title || (action === "artifact" ? "Artifact dari Lala" : "Percakapan dengan Lala");
    const { sessionId } = await callApi("/api/call", signal, "POST", {
      action: "save-lala-chat", title: chatTitle, question: prompt, content, artifact: action === "artifact",
    });
    showLink({
      href: `/dashboard-v2/tanya-momo/${encodeURIComponent(sessionId)}`,
      label: action === "artifact" ? "Buka artifact" : "Buka chat", title: chatTitle,
    });
    return { saved: true, title: chatTitle, artifact: action === "artifact" };
  }
  if (action === "create") {
    const summary = field(args.content, 16000);
    if (!title || !summary || summary.length > 1200) return { error: "Isi judul dan catatan singkat hingga 1.200 karakter." };
    const { note } = await callApi("/api/notes", signal, "POST", { title, summary });
    window.dispatchEvent(new Event("note-ready"));
    showLink(noteLink(note));
    return { saved: true, title: note.title };
  }

  if (action !== "list" && action !== "read" && action !== "update" && action !== "delete") {
    return { error: "Tindakan tidak dikenal." };
  }
  const userId = getUserId();
  if (!userId) return { error: "Masuk ke akun Eureka terlebih dahulu." };
  const { notes }: { notes: Note[] } = await callApi(`/api/notes?userId=${encodeURIComponent(userId)}`, signal);
  if (action === "list") return { titles: notes.slice(0, 10).map(note => note.title), total: notes.length };
  if (!title) return { error: "Sebutkan judul catatan." };

  const needle = title.toLocaleLowerCase("id");
  const exact = notes.filter(note => note.title.toLocaleLowerCase("id") === needle);
  const matches = exact.length ? exact : notes.filter(note => note.title.toLocaleLowerCase("id").includes(needle));
  if (matches.length !== 1) return {
    error: matches.length ? "Ada beberapa catatan dengan judul serupa. Minta judul yang tepat." : "Catatan tidak ditemukan.",
    titles: matches.slice(0, 5).map(note => note.title),
  };
  const path = `/api/notes/${encodeURIComponent(matches[0].id)}`;
  const { note }: { note: Note } = await callApi(path, signal);
  if (action === "read") {
    showLink(noteLink(note));
    return { title: note.title, summary: note.summary?.slice(0, 8000) ?? "", excerpt: true };
  }
  if (action === "delete") {
    if (!await confirmDelete(note.title) || signal.aborted) return { deleted: false, message: "Penghapusan dibatalkan." };
    await callApi(path, signal, "DELETE");
    window.dispatchEvent(new Event("note-ready"));
    return { deleted: true, title: note.title };
  }
  const newTitle = field(args.newTitle, 200);
  const content = field(args.content, 16000);
  if (!newTitle && !content) return { error: "Sebutkan judul baru atau isi ringkasan yang ingin diubah." };
  await callApi(`${path}/document`, signal, "PUT", {
    title: newTitle || note.title, content: content || note.summary || "",
    originalTitle: note.title, original: note.summary ?? "",
  });
  window.dispatchEvent(new Event("note-ready"));
  showLink(noteLink({ ...note, title: newTitle || note.title }));
  return { saved: true, title: newTitle || note.title };
}
