/**
 * Skrip Uji Menyeluruh: Artifact Canvas & Streaming Parser
 *
 * Menguji 3 skenario utama:
 * 1. Parser Streaming Tag Artifact (Pemisahan Bubble Chat vs Canvas)
 * 2. Multi-Artifact & 3 Tipe (markdown, terminal, image)
 * 3. Toleransi Tag Terpotong, Rusak & Flush Menggantung
 */

import { ArtifactStreamParser, type ArtifactParserEvent } from "../lib/agents/artifactParser";

const label = (ok: boolean) => (ok ? "✅" : "❌");

async function runArtifactTests() {
  console.log("==================================================");
  console.log("🚀 MEMULAI PENGUJIAN ARTIFACT CANVAS & PARSER");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  // -------------------------------------------------------------
  // SKENARIO 1: Pemisahan Chat vs Markdown Artifact (Jejak)
  // -------------------------------------------------------------
  total++;
  console.log("📌 Uji 1: Alur Jejak (Markdown Artifact dari potongan token)");
  {
    const parser = new ArtifactStreamParser();
    let chatText = "";
    const artifacts: Record<string, { title: string; type: string; content: string; agent: string }> = {};
    let openId: string | null = null;
    let closeCount = 0;

    const chunks = [
      "Halo adik-adik! ",
      "Berikut adalah materi yang dirangkum: ",
      "<art",
      "ifact type=\"markdown\" title=\"Hukum Newton\" agent=\"jejak\">",
      "# Hukum II Newton\n\n",
      "Rumus: **F = m . a**\n",
      "- Satuan gaya: Newton (N)\n",
      "- Satuan massa: kg",
      "</art",
      "ifact>",
      " Silakan dipelajari di samping ya!"
    ];

    for (const chunk of chunks) {
      const events = parser.push(chunk);
      for (const ev of events) {
        if (ev.kind === "chat") chatText += ev.text;
        if (ev.kind === "artifact-open") {
          openId = ev.artifact.id;
          artifacts[openId] = {
            title: ev.artifact.title,
            type: ev.artifact.type,
            content: "",
            agent: ev.artifact.sourceAgent,
          };
        }
        if (ev.kind === "artifact-chunk") {
          if (artifacts[ev.id]) artifacts[ev.id].content += ev.text;
        }
        if (ev.kind === "artifact-close") {
          closeCount++;
          openId = null;
        }
      }
    }
    parser.flush();

    const expectedChat = "Halo adik-adik! Berikut adalah materi yang dirangkum:  Silakan dipelajari di samping ya!";
    const art = Object.values(artifacts)[0];
    const isChatClean = chatText === expectedChat;
    const isArtValid = art && art.title === "Hukum Newton" && art.type === "markdown" && art.agent === "jejak" && art.content.includes("F = m . a");
    const isClosed = closeCount === 1 && openId === null;

    const ok = isChatClean && isArtValid && isClosed;
    console.log(`   ${label(ok)} Chat bubble bersih tanpa tag: "${chatText}"`);
    console.log(`   ${label(ok)} Artifact tertangkap di Canvas: [${art?.type}] "${art?.title}" (Agent: ${art?.agent})`);
    console.log(`   ${label(ok)} Isi konten: ${JSON.stringify(art?.content.slice(0, 35))}...`);
    if (ok) passed++;
  }
  console.log("");

  // -------------------------------------------------------------
  // SKENARIO 2: Terminal Artifact (Solve-then-Guide) & Image (Palet)
  // -------------------------------------------------------------
  total++;
  console.log("📌 Uji 2: Tipe Artifact Terminal & Image");
  {
    const parser = new ArtifactStreamParser();
    const captured: Record<string, { title: string; type: string; content: string }> = {};

    const streamInput =
      'Verifikasi selesai. <artifact type="terminal" title="Log Python" agent="socra">>>> x = solve(2*x + 4)\n>>> x = -2\nVERIFIKASI_OK: -2</artifact>' +
      ' Gambar konsep: <artifact type="image" title="Grafik Fungsi" agent="palet">data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==</artifact>';

    const events = parser.push(streamInput);
    for (const ev of events) {
      if (ev.kind === "artifact-open") {
        captured[ev.artifact.id] = { title: ev.artifact.title, type: ev.artifact.type, content: "" };
      }
      if (ev.kind === "artifact-chunk") {
        if (captured[ev.id]) captured[ev.id].content += ev.text;
      }
    }
    parser.flush();

    const arts = Object.values(captured);
    const terminalArt = arts.find(a => a.type === "terminal");
    const imageArt = arts.find(a => a.type === "image");

    const ok = Boolean(terminalArt?.content.includes("VERIFIKASI_OK: -2") && imageArt?.content.startsWith("data:image/png"));
    console.log(`   ${label(ok)} Terminal Artifact ter-parse: "${terminalArt?.title}" -> ${terminalArt?.content.split('\n')[0]}`);
    console.log(`   ${label(ok)} Image Artifact ter-parse: "${imageArt?.title}" -> Data URL length: ${imageArt?.content.length}`);
    if (ok) passed++;
  }
  console.log("");

  // -------------------------------------------------------------
  // SKENARIO 3: Ketahanan (Fault-tolerance & Tag Menggantung)
  // -------------------------------------------------------------
  total++;
  console.log("📌 Uji 3: Toleransi Terhadap Tag Rusak & Stream Terputus Mendadak");
  {
    const parser = new ArtifactStreamParser();
    let chatOut = "";
    let autoClosed = false;

    // Stream terputus di tengah tag artifact tanpa penutup </artifact>
    const brokenStream = "Berikut catatan: <artifact type=\"markdown\" title=\"Materi Menggantung\" agent=\"jejak\"># Bab 1\nBelum selesai...";
    for (const ev of parser.push(brokenStream)) {
      if (ev.kind === "chat") chatOut += ev.text;
    }
    const flushEvents = parser.flush();
    for (const ev of flushEvents) {
      if (ev.kind === "artifact-close") autoClosed = true;
    }

    const ok = autoClosed;
    console.log(`   ${label(!!ok)} Stream terputus auto-close artifact tanpa crash: ${autoClosed}`);
    if (ok) passed++;
  }
  console.log("\n==================================================");
  console.log(`HASIL AKHIR: ${passed}/${total} PENGUJIAN LOLOS`);
  console.log("==================================================");

  process.exit(passed === total ? 0 : 1);
}

runArtifactTests();
