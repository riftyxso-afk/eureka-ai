/**
 * Generate gambar via OpenAgentic (model image, default ali-qwen-image-2.0-pro).
 *
 * Bentuk API (terverifikasi live):
 *   POST {base}/images/generations
 *   { model, prompt, size, n } → { data: [{ url }] }
 *
 * PENTING: URL hasil bersifat SEMENTARA (OSS, kedaluwarsa ±7 hari) —
 * spesifikasi mewajibkan materialisasi server-side: gambar DIUNDUH lalu
 * dikembalikan sebagai data URL agar awet di sisi klien.
 *
 * Tidak pernah throw — gagal → null (pemanggil fallback ke Cloudflare).
 */
import { OPENAGENTIC_API_KEY, OPENAGENTIC_BASE_URL } from "./ai";

/** Model image bisa di-override via env tanpa deploy kode. */
export const OPENAGENTIC_IMAGE_MODEL =
  process.env.OPENAGENTIC_IMAGE_MODEL ?? "ali-qwen-image-2.0-pro";

/** Batas unduhan hasil (anti memori membengkak dari respons pihak ketiga). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const GENERATE_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;

function mimeFromUrl(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

/** Unduh URL gambar → data URL base64. null bila gagal/terlalu besar. */
async function downloadToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/") && !/\.png|\.jpe?g|\.webp/i.test(url)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    const mime = type.split(";")[0] || mimeFromUrl(url);
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Generate gambar via OpenAgentic.
 * @returns data URL gambar, atau null bila tidak tersedia/gagal.
 */
export async function generateImageViaOpenAgentic(
  prompt: string
): Promise<string | null> {
  if (!OPENAGENTIC_API_KEY || !prompt.trim()) return null;
  try {
    const res = await fetch(`${OPENAGENTIC_BASE_URL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAGENTIC_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAGENTIC_IMAGE_MODEL,
        prompt: prompt.slice(0, 2000),
        size: "1024x1024",
        n: 1,
      }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[image-gen] OpenAgentic HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json().catch(() => null)) as {
      data?: { url?: string; b64_json?: string }[];
    } | null;
    const item = json?.data?.[0];
    // Beberapa gateway mengembalikan b64_json langsung — pakai bila ada.
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    const url = item?.url ?? "";
    if (!url.startsWith("http")) return null;
    const dataUrl = await downloadToDataUrl(url);
    if (!dataUrl) console.warn("[image-gen] unduhan hasil gagal di-materialisasi");
    return dataUrl;
  } catch (e) {
    console.warn("[image-gen] OpenAgentic gagal:", e instanceof Error ? e.message : e);
    return null;
  }
}
