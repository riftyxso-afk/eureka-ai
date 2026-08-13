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
  if (!text.includes("\\")) return text;

  let out = text;

  // 1) \[...\] block → $$...$$ (paling umum untuk rumus besar / turunan).
  //    Hati-hati jangan menyentuh \\[... yang ada di dalam blok kode —
  //    output chat AI jarang memuat itu, dan block math jauh lebih sering.
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => {
    const trimmed = inner.trim();
    return trimmed ? `$$${trimmed}$$` : "$$$$";
  });

  // 2) \(...\) inline → $...$
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => {
    const trimmed = inner.trim();
    return trimmed ? `$${trimmed}$` : "$$";
  });

  // 3) Environment \begin{align}...\end{align} dkk → bungkus $$...$$ bila
  //    belum berada di dalam $$...$$ (hindari dobel bungkus).
  out = out.replace(ENV_RE, (_m, env: string, inner: string) => {
    const block = `\\begin{${env}}${inner}\\end{${env}}`;
    const idx = out.indexOf(block);
    if (idx < 0) return block;
    const before = out.slice(0, idx).replace(/\s+$/, "");
    const after = out.slice(idx + block.length).replace(/^\s+/, "");
    const prev = before.slice(-2);
    const next = after.slice(0, 2);
    // Sudah dibungkus $$...$$ atau $...$? → biarkan.
    if (prev === "$$" && next === "$$") return block;
    if (prev.endsWith("$") && next.startsWith("$")) return block;
    return `$$${block}$$`;
  });

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
