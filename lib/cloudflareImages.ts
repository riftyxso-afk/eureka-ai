/**
 * Provider GAMBAR AI via Cloudflare Workers AI — KHUSUS untuk generate
 * gambar ilustrasi (bukan chat). Dipakai pipeline dokumen PDF sebagai
 * sumber gambar ketiga (saat gambar embedded/Firecrawl kurang).
 *
 * Env:
 * - CLOUDFLARE_ACCOUNT_ID   (ID akun Cloudflare — dashboard kanan atas)
 * - CLOUDFLARE_API_TOKEN    (token API: My Profile → API Tokens → buat token
 *                            dengan permission "Workers AI:Run" — gratis)
 *
 * Biaya (Workers Free): 10.000 neurons/hari GRATIS. Model terpilih:
 * - @cf/black-forest-labs/flux-2-klein-4b  (utama — kualitas bagus, ±100 img/hari gratis)
 * - @cf/black-forest-labs/flux-1-schnell   (fallback — paling hemat kuota)
 *
 * Hasil generate → data URL PNG base64 (`data:image/png;base64,...`) yang
 * langsung bisa dirender reportlab/pdfkit (tanpa upload ke CDN).
 */
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";

/** Model text-to-image — urut prioritas (utama dulu, fallback setelahnya). */
const IMAGE_MODELS = [
  "@cf/black-forest-labs/flux-2-klein-4b",
  "@cf/black-forest-labs/flux-1-schnell",
];

/** Apakah provider gambar AI siap dipakai (account ID + token ada)? */
export function isCloudflareImagesConfigured(): boolean {
  return CLOUDFLARE_ACCOUNT_ID.length > 0 && CLOUDFLARE_API_TOKEN.length > 0;
}

/**
 * Generate satu gambar ilustrasi dari teks (prompt) → data URL PNG.
 * Mencoba model berurutan (klein-4b → schnell). Mengembalikan null bila
 * semua model gagal / belum dikonfigurasi — TIDAK pernah melempar.
 */
export async function generateAiIllustration(
  prompt: string
): Promise<string | null> {
  if (!isCloudflareImagesConfigured()) return null;
  if (!prompt.trim()) return null;

  for (const model of IMAGE_MODELS) {
    try {
      const res = await fetch(
        // Catatan: nama model TIDAK boleh di-encode — Cloudflare menolak
        // "@cf/..." bila `/` menjadi %2F (error 7000 "No route for that URI").
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
          CLOUDFLARE_ACCOUNT_ID
        )}/ai/run/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt.trim().slice(0, 500),
            // Kecilkan step & guidance → hasil lebih konsisten + hemat kuota.
            num_steps: 4,
            guidance: 3.5,
          }),
          signal: AbortSignal.timeout(60_000),
        }
      );
      if (!res.ok) {
        console.warn(`[cloudflareImages] ${model} gagal (${res.status}).`);
        continue;
      }
      const data = (await res.json()) as {
        result?: { image?: string };
        errors?: { message?: string }[];
      };
      const image = data?.result?.image;
      if (typeof image === "string" && image.length > 500) {
        // return type png — bungkus jadi data URL agar renderer langsung pakai.
        return `data:image/png;base64,${image}`;
      }
      console.warn(
        "[cloudflareImages] Respons tanpa gambar:",
        data?.errors?.map((e) => e.message).join("; ") ?? "kosong"
      );
    } catch (e) {
      console.warn("[cloudflareImages] Generate gagal:", e);
    }
  }
  return null;
}

/**
 * Susun prompt ilustrasi edukasi yang konsisten dengan gaya Eureka
 * (ilustrasi buku teks, flat, bersih — cocok untuk catatan pelajaran).
 */
export function buildIllustrationPrompt(input: {
  chapterTitle: string;
  noteTitle?: string;
  subject?: string;
}): string {
  const topic = [input.noteTitle, input.subject].filter(Boolean).join(" — ");
  const chapter = input.chapterTitle.trim() || "Materi";
  return [
    `Ilustrasi edukasi buku teks untuk topik: "${chapter}".`,
    topic ? `Materi: ${topic}.` : "",
    "Gaya flat vector, warna hangat lembut, latar polos bersih, tanpa teks, tanpa watermark, tanpa logo, proporsi 4:3.",
  ]
    .filter(Boolean)
    .join(" ");
}
