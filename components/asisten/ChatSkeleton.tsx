import "@/components/ui/page-loader.css";

export default function ChatSkeleton({ label = "Memuat percakapan…" }: { label?: string }) {
  return (
    <div role="status" data-testid="chat-skeleton" className="mx-auto w-full max-w-3xl space-y-6">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="page-loader-reveal space-y-3">
        <div className="ml-auto h-9 w-2/5 rounded-xl bg-clay-primary/10" />
        <div className="flex gap-3 pt-3">
          <div className="size-8 shrink-0 rounded-full bg-clay-primary/10" />
          <div className="w-4/5 space-y-2.5 pt-1">
            <div className="h-2.5 rounded-full bg-clay-primary/10" />
            <div className="h-2.5 w-5/6 rounded-full bg-clay-primary/10" />
            <div className="h-2.5 w-3/5 rounded-full bg-clay-primary/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
