export function MomoLoadingVideo() {
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-36 overflow-hidden rounded-2xl bg-violet-50">
      <div className="absolute inset-0 hidden bg-[url('/loading/momo-dance.jpg')] bg-cover motion-reduce:block" />
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/loading/momo-dance.jpg"
        src="/loading/momo-dance.mp4"
        className="h-full w-full object-cover motion-reduce:hidden"
      />
    </div>
  );
}
