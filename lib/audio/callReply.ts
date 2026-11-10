/** Read each speech segment as soon as it arrives, before generation completes. */
export async function readCallReply(response: Response, onText: (text: string) => void, onSpeech: (text: string) => void, onSearch?: () => void) {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    const { reply } = await response.json() as { reply?: string };
    if (!reply?.trim()) throw new Error("Momo belum mengirim jawaban.");
    onText(reply); onSpeech(reply);
    return reply;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Jawaban Momo tidak tersedia.");
  const decoder = new TextDecoder();
  let buffer = "", text = "", complete = false;
  function line(value: string) {
    if (!value.trim()) return;
    const message = JSON.parse(value);
    if (message.type === "error") throw new Error(message.error || "Jawaban Momo terputus.");
    if (message.type === "searching") onSearch?.();
    if (message.type === "text" && typeof message.text === "string") { text += message.text; onText(text); }
    if (message.type === "speech" && typeof message.text === "string") onSpeech(message.text);
    if (message.type === "done") complete = true;
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) { line(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
      if (done) { line(buffer); break; }
    }
    if (!complete || !text.trim()) throw new Error("Jawaban Momo terputus. Coba lagi.");
    return text;
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
