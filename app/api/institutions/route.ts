const DIRECTORY = "https://referensi.data.kemendikdasmen.go.id/pendidikan/cari/";

function parseDirectory(html: string) {
  const rows = html.matchAll(
    /\/pendidikan\/npsn\/([\da-z]+)[^\n]*[\s\S]{0,400}?data\.push\(\[\d+,\s*linknpsn,\s*("(?:[^"\\]|\\.)*"),\s*("(?:[^"\\]|\\.)*"),\s*("(?:[^"\\]|\\.)*"),\s*setatus\]\)/gi,
  );
  return Array.from(rows).flatMap(([, id, name, district, city]) => {
    try {
      return [{ id, name: String(JSON.parse(name)).trim(), city: String(JSON.parse(city) || JSON.parse(district)).trim() }];
    } catch {
      return [];
    }
  }).filter(item => item.name);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (query.length < 3 || query.length > 100 || !/^[\p{L}\p{N} .,'’&()-]+$/u.test(query)) {
    return Response.json({ items: [] });
  }
  try {
    const response = await fetch(DIRECTORY + encodeURIComponent(query), {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error("Directory unavailable");
    const html = await response.text();
    if (!html.includes("HASIL PENCARIAN")) throw new Error("Unexpected directory response");
    const normalize = (value: string) => value.toLocaleLowerCase("id").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const key = normalize(query);
    const level = params.get("level");
    const preferred = level === "mahasiswa" ? /^(universitas|institut|politeknik|sekolah tinggi|akademi|uin|iain)\b/i
      : level === "sd" ? /^(sd\w*|mi\w*)\b/i
      : level === "smp" ? /^(smp\w*|mts\w*)\b/i
      : level === "sma" ? /^(sma\w*|smk\w*|ma\w*)\b/i : null;
    const score = (item: ReturnType<typeof parseDirectory>[number]) => {
      const name = normalize(item.name);
      if (name === key || normalize(item.id) === key) return 0;
      return (name.startsWith(key) ? 1 : name.includes(key) ? 3 : 5) + (preferred && !preferred.test(name) ? 1 : 0);
    };
    const items = [...new Map(parseDirectory(html).map(item => [item.id, item])).values()];
    items.sort((a, b) => score(a) - score(b));
    return Response.json({ items: items.slice(0, 12) });
  } catch {
    return Response.json({ error: "Direktori belum bisa diakses. Kamu tetap bisa mengetik namanya." }, { status: 502 });
  }
}
