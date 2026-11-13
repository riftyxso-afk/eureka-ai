import "@/components/ui/page-loader.css";

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden bg-clay-dark/[.07] dark:bg-clay-dark/10 ${className}`}>
      <span className="skeleton-shimmer opacity-70 motion-reduce:hidden dark:opacity-20" />
    </div>
  );
}

export default function ChatSkeleton({ label = "Memuat percakapan…" }: { label?: string }) {
  return (
    <div role="status" data-testid="chat-skeleton" className="mx-auto w-full max-w-3xl">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="page-loader-reveal space-y-8">
        <SkeletonBlock className="ms-auto h-10 w-1/2 max-w-xs rounded-2xl" />
        <div className="flex items-start gap-3">
          <SkeletonBlock className="size-8 shrink-0 rounded-full" />
          <div className="w-full max-w-xl space-y-3 pt-1">
            <SkeletonBlock className="h-3 rounded-full" />
            <SkeletonBlock className="h-3 w-11/12 rounded-full" />
            <SkeletonBlock className="h-3 w-3/5 rounded-full" />
          </div>
        </div>
        <SkeletonBlock className="ms-auto h-10 w-1/3 max-w-[12rem] rounded-2xl" />
      </div>
    </div>
  );
}
