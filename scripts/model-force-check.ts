// @ts-nocheck
/** Cek model mana yang benar-benar menjawab (jalur chat & non-chat). */
import { aiChatStream } from "../lib/ai";

async function probe(label: string, forChat: boolean) {
  let model = "";
  let text = "";
  await aiChatStream(
    { user: "Balas hanya satu kata: SIAP", maxTokens: 10, speedMode: "fast", forChat },
    (ev) => {
      if (ev.type === "meta" && ev.model) model = ev.model;
      if (ev.type === "token") text += ev.text;
    }
  );
  console.log(`${label}: model=${model || "?"} jawaban=${JSON.stringify(text.trim().slice(0, 30))}`);
}

async function main() {
  await probe("chat (forChat=true)", true);
  await probe("non-chat (catatan/judul)", false);
}
void main();
