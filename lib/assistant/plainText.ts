/**
 * Konversi konten markdown jawaban AI → teks bersih (plain text).
 *
 * Dipakai untuk tombol copy per pesan & "Salin chat": hasil tanpa simbol
 * markdown (`*`, `#`, backtick, dll) tapi tetap mempertahankan struktur —
 * heading/paragraf jadi baris terpisah, list ber-prefix, kode & math
 * isinya dipertahankan, tautan jadi teks labelnya.
 *
 * Memakai mdast (unified + remark-parse + remark-gfm + remark-math),
 * bukan regex, agar tahan terhadap penulisan bersarang.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { normalizeMathDelimiters } from "../mathText.ts";

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  ordered?: boolean;
  start?: number;
}

export function markdownToPlainText(content: string): string {
  if (!content || !content.trim()) return "";

  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    // remark-math hanya kenal $...$ / $$...$$ — normalisasi bentuk \(...\),
    // \[...\] dan \begin{env} dulu (sama seperti MarkdownView).
    .parse(normalizeMathDelimiters(content)) as unknown as MdNode;

  const lines: string[] = [];
  collectLines(tree, lines, []);

  return lines
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Kumpulkan baris teks bersih dari pohon mdast.
 * `listStack` mencatat konteks list saat ini: null = bullet, angka = nomor
 * item ordered (untuk prefix "1.", "2.", …), kedalaman = panjang stack.
 */
function collectLines(
  node: MdNode,
  out: string[],
  listStack: (number | null)[]
): void {
  switch (node.type) {
    case "root":
    case "blockquote": {
      const children = node.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const before = out.length;
        collectLines(children[i], out, listStack);
        // Pisahkan blok level atas (heading/paragraf/kode) dengan baris kosong
        // agar struktur paragraf tetap terbaca; item list tidak kena.
        if (out.length > before && i < children.length - 1) {
          out.push("");
        }
      }
      break;
    }
    case "paragraph":
    case "heading":
      out.push(inline(node));
      break;
    case "list": {
      const ordered = node.ordered === true;
      (node.children ?? []).forEach((item, i) => {
        const index = ordered ? (node.start ?? 1) + i : null;
        collectLines(item, out, [...listStack, index]);
      });
      break;
    }
    case "listItem": {
      const indent = "  ".repeat(Math.max(0, listStack.length - 1));
      const last = listStack[listStack.length - 1];
      const marker = last === null || last === undefined ? "- " : `${last}. `;
      const sub: string[] = [];
      for (const child of node.children ?? []) {
        collectLines(child, sub, listStack);
      }
      sub.forEach((line, i) => {
        if (!line) {
          out.push("");
          return;
        }
        out.push(i === 0 ? indent + marker + line : indent + "  " + line);
      });
      break;
    }
    case "code":
      for (const line of (node.value ?? "").split("\n")) {
        out.push(line);
      }
      break;
    case "math":
      out.push(node.value ?? "");
      break;
    case "table": {
      const children = node.children ?? [];
      const head = children[0];
      const rows = head ? [head, ...children.slice(1)] : [];
      for (const row of rows) {
        out.push((row.children ?? []).map((c) => inline(c)).join(" | "));
      }
      break;
    }
    case "thematicBreak":
    case "html":
      // Pemisah halaman & HTML mentah tidak punya teks yang bisa disalin.
      break;
    default:
      out.push(inline(node));
  }
}

/** Gabungkan konten inline node menjadi satu string teks. */
function inline(node: MdNode): string {
  switch (node.type) {
    case "text":
    case "inlineCode":
    case "inlineMath":
      return node.value ?? "";
    case "break":
      return "\n";
    case "image":
      // Gambar tidak punya teks — lewati.
      return "";
    default:
      return (node.children ?? []).map(inline).join("");
  }
}
