/**
 * Normalisasi delimiter LaTeX dari output AI agar KaTeX (remark-math +
 * rehype-katex) bisa merendernya.
 *
 * remark-math hanya mengenal dua bentuk: $...$ (inline) dan $$...$$ (block).
 * Namun AI sangat sering menulis rumus dengan bentuk lain yang TIDAK dirender
 * sama sekali dan muncul mentah sebagai teks biasa:
 *   - \(...\)  (inline)  → harusnya $...$
 *   - \[...\]  (block)   → harusnya $$...$$
 *   - \begin{align}...\end{align} (dan environment lain) → harus dibungkus $$...$$
 *
 * Fungsi ini menormalkan ketiganya SEBELUM markdown di-parse. Aman dipanggil
 * berulang (idempotent untuk bentuk yang sudah benar).
 */

const ENV_RE =
  /\\begin\{(align\*?|equation\*?|gather\*?|split|aligned|cases|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|array)\}([\s\S]*?)\\end\{\1\}/g;

/** Ubah \(...\) → $...$, \[...\] → $$...$$, dan bungkus \begin{env} dalam $$...$$. */
export function normalizeMathDelimiters(text: string): string {
  // Preserve code samples, including LaTeX commands shown as examples.
  return text.split(/(^[ \t]*(?:```|~~~)[^\n]*\n[\s\S]*?(?:^[ \t]*(?:```|~~~)[ \t]*$|(?![\s\S]))|`[^`\n]+`)/m)
    .map((segment, index) => index % 2 ? segment : normalizeProseMath(segment))
    .join("");
}

function displayMath(value: string) {
  return "\n\n$$\n" + value.trim() + "\n$$\n\n";
}

function normalizeProseMath(text: string): string {
  let out = text
    .replace(/^([ \t]*)\$\$([^\n]+?)\$\$[ \t]*$/gm, (_match, indent: string, value: string) =>
      `${indent}$$\n${indent}${value.trim()}\n${indent}$$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (match, value: string, offset: number, source: string) => {
      if (!value.trim()) return match;
      const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
      const prefix = source.slice(lineStart, offset);
      return /\|/.test(prefix) || /^\s*(?:[-*]|\d+\.)\s+/.test(prefix)
        ? `$\\displaystyle ${value.trim()}$`
        : displayMath(value);
    })
    .replace(/\\\(([^]*?)\\\)/g, (match, value: string) =>
      value.trim() ? `$${value.trim()}$` : match);

  out = out.replace(ENV_RE, (block, _env: string, _inner: string, offset: number, source: string) => {
    const before = source.slice(0, offset).trimEnd();
    const after = source.slice(offset + block.length).trimStart();
    if (before.endsWith("$") && after.startsWith("$")) return block;
    const displayOpen = (before.match(/^\s*\$\$\s*$/gm)?.length ?? 0) % 2 === 1;
    if (displayOpen) return block;
    return displayMath(block);
  });

  if (!out.includes("\\")) return out;

  // 4) Rumus LaTeX tanpa tanda $ (misal di dalam tabel markdown atau baris persamaan).
  //    Banyak model AI menulis `v = \frac{s}{t}` atau `\Sigma F = m \cdot a` mentah.
  //    Bungkus dengan $...$ agar KaTeX dapat merendernya dengan baik.
  let inDisplay = false;
  out = out
    .split("\n")
    .map((line) => {
      if (line.trim() === "$$") {
        inDisplay = !inDisplay;
        return line;
      }
      if (inDisplay) return line;
      // 4a. Jika baris tabel (| Besaran | Rumus |)
      if (line.includes("|")) {
        const cells = line.split("|");
        const wrapped = cells.map((c) => {
          const t = c.trim();
          // Sel mengandung command LaTeX tapi tidak diapit $
          if (/\\[a-zA-Z]+/.test(t) && !t.startsWith("$") && !t.endsWith("$")) {
            return ` $${t}$ `;
          }
          return c;
        });
        return wrapped.join("|");
      }

      // 4b. Jika baris tunggal adalah persamaan matematika dengan LaTeX tapi lupa diapit $
      const trimmed = line.trim();
      if (
        /\\[a-zA-Z]+/.test(trimmed) &&
        !trimmed.includes("$") &&
        !trimmed.startsWith("```") &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("http")
      ) {
        // Cek pola persamaan seperti v = ..., E_k = ..., dll.
        if (/[=><≈]|\\approx|\\le|\\ge|\\pm/.test(trimmed)) {
          // Jika diawali bullet list "- " atau "* "
          const listMatch = trimmed.match(/^([-*]|\d+\.)\s+(.*)$/);
          if (listMatch) {
            const prefix = listMatch[1];
            const mathPart = listMatch[2].trim();
            return `${prefix} $${mathPart}$`;
          }
          return displayMath(trimmed);
        }
      }

      return line;
    })
    .join("\n");

  return out;
}

/** Uji cepat (untuk dev/test): contoh umum output AI. */
export function testNormalize(): string[] {
  const cases = [
    "Rumus energi: $E = mc^2$.",
    "Rumus dilatasi waktu: \\[\\Delta t = \\frac{\\Delta t_0}{\\sqrt{1 - \\frac{v^2}{c^2}}}\\]",
    "Turunan: \\(f'(x) = 2x\\).",
    "\\begin{align} E &= mc^2 \\\\ p &= mv \\end{align}",
    "$$\nE = mc^2\n$$",
  ];
  return cases.map((c) => `${JSON.stringify(c)}\n  → ${JSON.stringify(normalizeMathDelimiters(c))}`);
}
