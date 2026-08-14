import { notFound } from "next/navigation";
import { getShare } from "@/lib/assistant/store";
import MarkdownView from "@/components/asisten/MarkdownView";

export const runtime = "nodejs";

/**
 * Halaman share publik — view-only. Siapa pun dengan link bisa melihat
 * snapshot percakapan tanpa login; tidak ada composer/edit/hapus.
 */
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let share: { title: string; messages: { role: string; content: string }[] } | null = null;
  try {
    share = await getShare(token.trim());
  } catch {
    notFound();
  }
  if (!share) notFound();

  const messages = share.messages.filter((m) => m.content.trim());

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
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-clay-dark sm:text-lg">
              {share.title}
            </h1>
            <p className="text-[11px] font-bold text-clay-muted">
              Percakapan dibagikan dari Eureka.AI
            </p>
          </div>
        </header>

        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="rounded-clay-md border-2 border-dashed border-clay-shadow/40 p-6 text-center text-sm font-semibold text-clay-muted">
              Percakapan ini kosong.
            </p>
          ) : (
            messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] break-words rounded-clay-md rounded-br-[8px] bg-clay-primary px-3.5 py-2.5 text-white shadow-clay-sm">
                    <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">
                      {m.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="Logo Eureka.AI"
                    className="mt-1 h-8 w-8 shrink-0 object-contain"
                  />
                  <div className="min-w-0 max-w-[85%] break-words rounded-clay-md rounded-tl-[8px] border-2 border-clay-borderLight bg-white px-4 py-3 shadow-clay-sm">
                    <MarkdownView
                      content={m.content}
                      className="break-words text-[13.5px] leading-relaxed"
                    />
                  </div>
                </div>
              )
            )
          )}
        </div>

        <footer className="mt-10 border-t-2 border-clay-borderLight pt-4 text-center text-[11px] font-bold text-clay-muted">
          Dibagikan via Eureka.AI — hanya tampilan, tanpa akses ke data pemilik
        </footer>
      </div>
    </div>
  );
}
