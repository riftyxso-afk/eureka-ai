"use client";

/**
 * Music Hub (music-hub) — dengarkan musik & belajar di satu tempat.
 *
 * - Search video/musik YouTube via search box (server-side scraping, tanpa
 *   kunci API) → hasil klik-untuk-putar di player embed.
 * - Spotify: paste link track/album/playlist → langsung diputar via embed
 *   resmi (tanpa login/OAuth).
 * - Riwayat "Baru diputar" (localStorage) untuk akses cepat.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock,
  Link2,
  Music2,
  Play,
  Search,
  X,

} from "lucide-react";

import { apiFetch } from "@/lib/apiClient";
import {
  addRecent,
  getRecent,
  parseMusicUrl,
  type MusicVideo,
  type RecentItem,
} from "@/lib/music";

interface NowPlaying {
  kind: "youtube" | "spotify";
  embed: string;
  title: string;
  author?: string;
  thumb?: string;
}

export default function MusicPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicVideo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  const doSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (!term) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await apiFetch(`/api/music/search?q=${encodeURIComponent(term)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Pencarian gagal.");
      setResults(Array.isArray(data?.videos) ? data.videos : []);
      if ((data?.videos ?? []).length === 0) {
        setSearchError("Tidak ada hasil — coba kata kunci lain.");
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Pencarian gagal.");
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce pencarian saat mengetik (hemat request).
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => void doSearch(term), 700);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const playVideo = useCallback((v: MusicVideo) => {
    setNow({
      kind: "youtube",
      embed: `https://www.youtube.com/embed/${v.id}?autoplay=1&modestbranding=1&rel=0`,
      title: v.title,
      author: v.author,
      thumb: v.thumb,
    });
    setRecent(
      addRecent({
        id: v.id,
        kind: "youtube",
        title: v.title,
        author: v.author,
        thumb: v.thumb,
        url: v.url,
      })
    );
    // Scroll ke player.
    requestAnimationFrame(() =>
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }, []);

  const playSpotify = useCallback(() => {
    const parsed = parseMusicUrl(spotifyUrl);
    setSpotifyError(null);
    if (!parsed || parsed.kind !== "spotify") {
      setSpotifyError("Link Spotify tidak valid — tempel link track/album/playlist (open.spotify.com/…).");
      return;
    }
    const id = parsed.embed.split("/").pop() ?? parsed.embed;
    setNow({
      kind: "spotify",
      embed: parsed.embed,
      title: `Spotify · ${parsed.embed.split("/")[4] ?? "musik"}`,
      author: "Spotify",
    });
    setRecent(
      addRecent({
        id: `sp-${id}`,
        kind: "spotify",
        title: `Spotify: ${id}`,
        url: spotifyUrl.trim(),
      })
    );
    setSpotifyUrl("");
    requestAnimationFrame(() =>
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }, [spotifyUrl]);

  const playRecent = useCallback((r: RecentItem) => {
    if (r.kind === "spotify") {
      const parsed = parseMusicUrl(r.url);
      if (parsed) setNow({ kind: "spotify", embed: parsed.embed, title: r.title, author: r.author });
      return;
    }
    setNow({
      kind: "youtube",
      embed: `https://www.youtube.com/embed/${r.id}?autoplay=1&modestbranding=1&rel=0`,
      title: r.title,
      author: r.author,
      thumb: r.thumb,
    });
    requestAnimationFrame(() =>
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }, []);

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-primary/10">
          <Music2 size={24} className="text-clay-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Musik & Video</h1>
          <p className="mt-1 text-sm font-semibold text-clay-muted sm:text-base">
            Cari musik pengiring belajar — YouTube & Spotify, langsung di Eureka
          </p>
        </div>
      </div>

      {/* Search box YouTube */}
      <div className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void doSearch(query);
              }
            }}
            placeholder="Cari musik atau video belajar… (contoh: lofi study, lagu nasional)"
            className="w-full rounded-clay-full border-2 border-clay-shadow/40 bg-clay-cream py-3 pl-11 pr-10 text-sm font-bold text-clay-dark shadow-clay-inset outline-none transition-colors focus:border-clay-primary"
            aria-label="Cari video YouTube"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearchError(null);
              }}
              aria-label="Bersihkan pencarian"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-clay-muted hover:bg-clay-beige hover:text-clay-dark"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => void doSearch(query)}
          disabled={searching || !query.trim()}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-clay-full bg-clay-primary px-5 text-sm font-extrabold text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 disabled:opacity-50"
        >
          {searching ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Search size={15} />
          )}
          Cari
        </button>
      </div>

      {/* Spotify paste */}
      <div className="mt-3 rounded-clay-md border-2 border-clay-borderLight/60 bg-clay-cream p-3 shadow-clay-sm">
        <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-clay-muted">
          <Link2 size={12} /> Putar dari Spotify
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") playSpotify();
            }}
            placeholder="Tempel link track / album / playlist (open.spotify.com/…)"
            className="flex-1 rounded-clay-full border-2 border-clay-shadow/40 bg-clay-inputBg px-4 py-2.5 text-xs font-bold text-clay-dark outline-none focus:border-clay-primary"
            aria-label="Link Spotify"
          />
          <button
            onClick={playSpotify}
            disabled={!spotifyUrl.trim()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-clay-full bg-clay-success px-4 text-xs font-extrabold text-white shadow-clay-sm transition-all hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-50"
          >
            <Play size={13} /> Putar
          </button>
        </div>
        {spotifyError && (
          <p className="mt-2 text-xs font-bold text-red-500">{spotifyError}</p>
        )}
      </div>

      {/* Player */}
      {now && (
        <div ref={playerRef} className="mt-5 scroll-mt-6">
          <div className="overflow-hidden rounded-clay-md border-2 border-clay-borderLight bg-clay-cream shadow-clay-sm">
            <div className="flex items-center justify-between gap-2 border-b-2 border-clay-borderLight/60 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-clay-dark">{now.title}</p>
                {now.author && (
                  <p className="truncate text-xs font-bold text-clay-muted">{now.author}</p>
                )}
              </div>
              <button
                onClick={() => setNow(null)}
                aria-label="Tutup player"
                className="shrink-0 rounded-full p-2 text-clay-muted transition-colors hover:bg-clay-beige hover:text-clay-dark"
              >
                <X size={16} />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                key={now.embed}
                src={now.embed}
                title={now.title}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Baru diputar */}
      {recent.length > 0 && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-clay-muted">
            <Clock size={13} /> Baru diputar
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => playRecent(r)}
                className="group flex items-center gap-2 rounded-clay-md border-2 border-clay-borderLight/60 bg-clay-cream p-2 text-left shadow-clay-sm transition-all hover:-translate-y-0.5 hover:border-clay-primary/40"
                title={r.title}
              >
                {r.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumb} alt="" className="h-9 w-14 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded bg-clay-beige">
                    <Music2 size={14} className="text-clay-muted" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-extrabold text-clay-dark group-hover:text-clay-primary">
                    {r.title}
                  </span>
                  {r.author && (
                    <span className="block truncate text-[10px] font-bold text-clay-muted">{r.author}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hasil pencarian */}
      {(results.length > 0 || searching || searchError) && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-clay-muted">
            <Music2 size={14} /> Hasil pencarian
          </h2>
          {searching && (
            <div className="mt-4 flex justify-center py-10">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-clay-primary/30 border-t-clay-primary" />
            </div>
          )}
          {searchError && !searching && (
            <p className="mt-4 rounded-clay-md border-2 border-clay-borderLight/60 bg-clay-cream px-4 py-3 text-sm font-bold text-clay-muted">
              {searchError}
            </p>
          )}
          {!searching && results.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((v) => (
                <button
                  key={v.id}
                  onClick={() => playVideo(v)}
                  className="group flex items-center gap-3 rounded-clay-md border-2 border-clay-borderLight/60 bg-clay-cream p-2.5 text-left shadow-clay-sm transition-all hover:-translate-y-0.5 hover:border-clay-primary/40"
                >
                  <span className="relative shrink-0">
                    {v.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumb} alt="" className="h-16 w-24 rounded object-cover" />
                    ) : (
                      <span className="flex h-16 w-24 items-center justify-center rounded bg-clay-beige">
                        <Music2 size={18} className="text-clay-muted" />
                      </span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center rounded bg-black/0 transition-colors group-hover:bg-black/25">
                      <Play size={20} className="text-white opacity-0 transition-opacity group-hover:opacity-100" fill="currentColor" />
                    </span>
                    {v.duration && (
                      <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[9px] font-extrabold text-white">
                        {v.duration}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[12.5px] font-extrabold leading-snug text-clay-dark group-hover:text-clay-primary">
                      {v.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] font-bold text-clay-muted">
                      {v.author}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info mode */}
      <div className="mt-8 rounded-clay-md bg-clay-primary/5 px-4 py-3 text-xs font-semibold text-clay-muted">
        Tanpa login — putar langsung dari YouTube & Spotify. Riwayat hanya
        tersimpan di perangkatmu. Untuk belajar dengan Eureka,{" "}
        <a href="/chat" className="font-extrabold text-clay-primary underline underline-offset-2">
          buka chat asisten
        </a>
        .
      </div>
    </div>
  );
}
