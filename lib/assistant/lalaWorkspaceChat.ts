import { appendMessage, createSession, deleteSession, renameSession } from "./store";

export async function saveLalaChat(userId: string, input: {
  title: string;
  prompt: string;
  content: string;
  artifact: boolean;
}, signal: AbortSignal) {
  signal.throwIfAborted();
  const session = await createSession(userId);
  try {
    await renameSession(session.id, userId, input.title);
    await appendMessage({ sessionId: session.id, role: "user", content: input.prompt });
    signal.throwIfAborted();
    const title = input.title.replace(/["<>\r\n]/g, " ");
    const content = input.artifact
      ? `Artifact “${title}” sudah disiapkan lewat panggilan Lala.\n\n<artifact type="markdown" title="${title}" agent="socra">\n${input.content.replace(/<\/?artifact\b/gi, "&lt;artifact")}\n</artifact>`
      : input.content;
    await appendMessage({ sessionId: session.id, role: "assistant", content });
    return session.id;
  } catch (error) {
    await deleteSession(session.id, userId).catch(() => {});
    throw error;
  }
}
