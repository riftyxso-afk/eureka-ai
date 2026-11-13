import campusDirectory from "@/lib/institutions/indonesian-campuses-2025.json";

const DIRECTORY = "https://referensi.data.kemendikdasmen.go.id/satpen/cari";
const normalize = (value: string) => value.toLocaleLowerCase("id").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const levelTypes: Record<string, RegExp> = {
  sd: /^(?:SD|MI|SDTK|SPK SD)\b/i,
  smp: /^(?:SMP|MTs|SMPTK|SPK SMP)\b/i,
  sma: /^(?:SMA|SMK|MA|MAK|SPK SMA)\b/i,
  mahasiswa: /^(?:universitas|institut|politeknik|sekolah tinggi|akademi)\b/i,
};

function textContent(html: string) {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return html.replace(/<[^>]+>/g, " ").replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (!key.startsWith("#")) return entities[key.toLowerCase()] ?? entity;
    const value = key[1]?.toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return Number.isInteger(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
  }).replace(/\s+/g, " ").trim();
}

function parseDirectory(html: string) {
  return Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).flatMap(([, row]) => {
    const school = row.match(/<a\b[^>]*href=["']\/satpen\/detail\/([\da-z]+)(?:\?[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/i);
    const cells = Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), match => match[1]);
    if (!school || cells.length < 6) return [];
    const name = textContent(school[2]);
    const city = textContent(cells[5].match(/<div\b[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? cells[5]);
    return name ? [{ id: school[1], name, city, type: textContent(cells[3]) }] : [];
  });
}

async function fetchDirectory(url: URL) {
  for (const timeout of [6_000, 8_000]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout), next: { revalidate: 3600 } });
      if (response.ok) {
        const html = await response.text();
        if (html.includes('class="search-panel"') && html.includes("/satpen/cari")) return html;
      }
    } catch {
      // The public directory can time out on the first request.
    }
  }
  throw new Error("Directory unavailable");
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (query.length < 5 || query.length > 100 || !/^[\p{L}\p{N} .,'’&()/-]+$/u.test(query)) {
    return Response.json({ items: [] });
  }
  const key = normalize(query);
  if (!key) return Response.json({ items: [] });
  const level = params.get("level") || "";
  if (level === "mahasiswa") {
    const words = key.split(" ");
    const matches = campusDirectory.flatMap(([id, name, city]) => {
      const normalizedName = normalize(name);
      const location = normalize(city);
      const rank = id === key || normalizedName === key ? 0 : normalizedName.startsWith(key) ? 1 : normalizedName.includes(key) ? 2
        : words.every(word => (normalizedName + " " + location).includes(word)) ? 3 : -1;
      return rank < 0 ? [] : [{ id, name, city, type: "Perguruan tinggi", rank }];
    }).sort((a, b) => a.rank - b.rank);
    if (matches.length) return Response.json({ items: matches.slice(0, 12).map(({ id, name, city, type }) => ({ id, name, city, type })) });
  }
  try {
    const url = new URL(DIRECTORY);
    url.searchParams.set("q", query);
    const html = await fetchDirectory(url);

    const preferred = Object.hasOwn(levelTypes, level) ? levelTypes[level] : undefined;
    const items = [...new Map(parseDirectory(html).map(item => [item.id, item])).values()];
    const score = (item: typeof items[number]) => {
      const name = normalize(item.name);
      if (normalize(item.id) === key) return -1;
      const match = name === key ? 0 : name.startsWith(key) ? 1 : name.includes(key) ? 2 : 3;
      return match + (preferred && !preferred.test(item.type) ? 4 : 0);
    };
    items.sort((a, b) => score(a) - score(b));
    return Response.json({ items: items.slice(0, 12) });
  } catch {
    return Response.json({ error: "Direktori belum bisa diakses. Kamu tetap bisa mengetik namanya." }, { status: 502 });
  }
}
