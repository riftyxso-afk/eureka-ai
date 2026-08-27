/**
 * Cek kontras WCAG palet mata pelajaran (lib/palette.ts).
 * Jalankan: node scripts/check-palette-contrast.mjs
 * Target: tier light vs permukaan terang ≥ 4.5 (AA normal),
 *         tier dark  vs permukaan gelap  ≥ 4.5 (konsisten AA).
 */
import { readFileSync } from "node:fs";

function lum(hex) {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const accents = [
  ...readFileSync(new URL("../lib/palette.ts", import.meta.url), "utf8").matchAll(
    /id: "(\w+)", light: "(#\w{6})", dark: "(#\w{6})"/g
  ),
].map((m) => ({ id: m[1], light: m[2], dark: m[3] }));

const cases = [
  ["light", "#FFFFFF", "kartu terang"],
  ["light", "#F9F3EC", "kanvas terang"],
  ["dark", "#282320", "kartu gelap"],
];

let fail = 0;
for (const a of accents) {
  for (const [tier, bg, label] of cases) {
    const r = ratio(a[tier], bg);
    const ok = r >= 4.5;
    if (!ok) fail++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${a.id.padEnd(8)} ${tier} ${a[tier]} vs ${label}: ${r.toFixed(2)}`
    );
  }
}
console.log(fail === 0 ? "\nSemua kontras memenuhi AA (4.5)." : `\n${fail} cek GAGAL.`);
process.exit(fail === 0 ? 0 : 1);
