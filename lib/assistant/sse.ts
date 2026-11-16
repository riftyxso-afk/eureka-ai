/** Decode SSE incrementally, including UTF-8 and event boundaries split by the network. */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  const lineData = (line: string) => {
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (!line) {
          if (data.length) { yield data.join("\n"); data = []; }
        } else lineData(line);
      }
      if (done) {
        // Some gateways close after a final data line without a blank terminator.
        if (buffer) lineData(buffer.replace(/\r$/, ""));
        if (data.length) yield data.join("\n");
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
