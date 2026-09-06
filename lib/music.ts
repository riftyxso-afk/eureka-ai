/**
 * Library fitur Music Hub (music-hub).
 *
 * - Search YouTube: innertube public API (server-side di /api/music/search)
 * - Metadata video: noembed (CORS-friendly, tanpa kunci)
 * - Player: embed iframe YouTube (modestbranding) & Spotify
 *
 * Tanpa OAuth — user tidak login ke YouTube/Spotify (keputusan scope:
 * embed + search saja).
 */

export interface MusicVideo {
  id: string; // videoId
  title: string;
  author: string; // channel
  duration?: string;
  thumb?: string;
  url: string;
}

export interface NoembedInfo {
  title?: string;
  author?: string;
  thumbnail_url?: string;
}

/** Ambil metadata video via noembed (CORS-friendly). */
export async function fetchNoembed(
  embedUrl: string
): Promise<NoembedInfo | null> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(embedUrl)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    return {
      title: data.title,
      author: data.author_name ?? data.author,
      thumbnail_url: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

/** Ekstrak ID & jenis dari URL YouTube/Spotify untuk embed. */
export function parseMusicUrl(
  url: string
): { kind: "youtube" | "spotify"; embed: string } | null {
  const u = url.trim();
  // YouTube: watch, youtu.be, shorts, embed
  const yt =
    u.match(/[?&]v=([\w-]{6,})/) ||
    u.match(/youtu\.be\/([\w-]{6,})/) ||
    u.match(/youtube\.com\/(?:shorts|embed|live)\/([\w-]{6,})/);
  if (yt) {
    return {
      kind: "youtube",
      embed: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&modestbranding=1&rel=0`,
    };
  }
  // Spotify: track/album/playlist/episode
  const sp = u.match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|album|playlist|episode)\/([\w-]+)/);
  if (sp) {
    return {
      kind: "spotify",
      embed: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}`,
    };
  }
  return null;
}

/** Item riwayat "baru diputar" (localStorage). */
export interface RecentItem {
  id: string;
  kind: "youtube" | "spotify";
  title: string;
  author?: string;
  thumb?: string;
  url: string; // url asli (watch/spotify)
  at: number;
}

const RECENT_KEY = "eureka_music_recent";
const RECENT_MAX = 8;

export function getRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function addRecent(item: Omit<RecentItem, "at">): RecentItem[] {
  if (typeof window === "undefined") return [];
  const entry: RecentItem = { ...item, at: Date.now() };
  const list = [entry, ...getRecent().filter((r) => r.id !== item.id)].slice(
    0,
    RECENT_MAX
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // abaikan
  }
  return list;
}
