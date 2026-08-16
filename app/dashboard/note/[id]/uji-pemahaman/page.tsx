"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { Loader2, BookOpenCheck } from "lucide-react";
import ComprehensionPage from "@/components/note/ComprehensionPage";

export default function UjiPemahamanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { id } = await params;
        if (cancelled) return;
        const res = await apiFetch(`/api/notes/${id}`);
        if (!res.ok) {
          if (!cancelled) setStatus("missing");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setNoteId(id);
        setNoteTitle(data?.note?.title ?? undefined);
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-clay-primary" />
      </div>
    );
  }

  if (status === "missing" || !noteId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <BookOpenCheck size={40} className="text-clay-muted" />
        <h1 className="text-xl font-extrabold text-clay-dark">
          Catatan tidak ditemukan
        </h1>
        <p className="text-sm font-semibold text-clay-muted">
          Catatan ini tidak ada atau kamu tidak punya akses ke catatan tersebut.
        </p>
        <Link
          href="/dashboard"
          className="btn-clay-primary !min-h-[44px] !px-6 text-sm"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return <ComprehensionPage noteId={noteId} noteTitle={noteTitle} />;
}
