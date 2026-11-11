import { requirePro } from "@/lib/assistant/auth";
import { searchLibrary, type LibrarySource } from "@/lib/library-catalog";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await requirePro(request.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const source = url.searchParams.get("source") ?? "all";
  const page = Number(url.searchParams.get("page") ?? 1);
  if (query.length > 160 || !["all", "openlibrary", "gutenberg"].includes(source) || !Number.isInteger(page) || page < 1 || page > 100) return Response.json({ error: "Pencarian tidak valid." }, { status: 400 });
  ensureRateLimitPrune();
  if (!checkRateLimit(`library:${auth.userId}`, 30, 60_000).ok) return Response.json({ error: "Terlalu banyak pencarian. Tunggu sebentar." }, { status: 429 });
  try { return Response.json(await searchLibrary(query, source as LibrarySource, page), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "Katalog buku belum dapat dihubungi. Silakan coba lagi." }, { status: 502 }); }
}
