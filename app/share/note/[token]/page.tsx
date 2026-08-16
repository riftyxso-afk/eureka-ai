import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lock, Share2 } from "lucide-react";
import { db } from "@/lib/supabase/admin";
import { parseNoteContent } from "@/lib/parseNoteContent";
import { ParsedContent } from "@/components/note/ParsedContent";

export const runtime = "nodejs";

// Halaman share publik — jangan diindeks mesin pencari.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface ShareNoteRow {
  id: string;
  title: string;
  subject: string;
  chapters: { id: number; title: string; content: string }[] | null;
}

/** Ambil snapshot catatan via fungsi security definer (publik, read-only). */
async function getSharedNote(token: string): Promise<ShareNoteRow | null> {
  try {
    const { data, error } = await db().rpc("get_public_note_by_token", {
      p_token: token,
    });
    if (error) {
      console.error("[share/note] rpc error:", error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;
    return {
      id: row.id,
      title: String(row.title ?? "Tanpa Judul"),
      subject: String(row.subject ?? ""),
      chapters: Array.isArray(row.chapters) ? row.chapters : [],
    };
  } catch (e) {
    console.error("[share/note] gagal memuat:", e);
    return null;
  }
}

export default async function ShareNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const note = await getSharedNote(String(token ?? "").trim().slice(0, 100));
  if (!note) notFound();

  const chapters = note.chapters ?? [];

  return (
    <div className="min-h-dvh bg-clay-beige">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <header className="mb-6 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo Eureka.AI"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold text-clay-dark sm:text-lg">
              {note.title}
            </h1>
            <p className="flex items-center gap-1 text-[11px] font-bold text-clay-muted">
              <Share2 size={11} />
              Catatan dibagikan dari Eureka.AI{note.subject ? ` · ${note.subject}` : ""}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-clay-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-clay-muted shadow-clay-inset">
            <Lock size={11} className="text-clay-primary" />
            Hanya baca
          </span>
        </header>

        {chapters.length === 0 ? (
          <p className="rounded-clay-md border-2 border-dashed border-clay-shadow/40 p-6 text-center text-sm font-semibold text-clay-muted">
            Catatan ini belum memiliki isi.
          </p>
        ) : (
          <div className="space-y-5">
            {chapters.map((chapter) => {
              const items = parseNoteContent(chapter.content ?? "");
              return (
                <div
                  key={chapter.id}
                  className="rounded-clay bg-white p-5 shadow-clay-sm sm:p-6"
                >
                  <h2 className="mb-4 border-b-2 border-clay-shadow/20 pb-3 text-lg font-extrabold text-clay-dark sm:text-xl">
                    {chapter.title}
                  </h2>
                  {items.length > 0 ? (
                    <ParsedContent items={items} />
                  ) : (
                    <p className="text-sm font-medium text-clay-muted">
                      Bab ini belum memiliki isi.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-8 text-center">
          <p className="text-xs font-bold text-clay-muted">
            Mau belajar seperti ini? Buat catatan otomatis dari materi apa pun di Eureka.AI.
          </p>
        </footer>
      </div>
    </div>
  );
}
