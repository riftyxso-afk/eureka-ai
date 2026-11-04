import { MomoLoadingVideo } from "@/components/note/MomoLoadingVideo";

export default function Loading() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-violet-50 p-4 dark:bg-[#18131e]">
      <div className="text-center">
        <MomoLoadingVideo />
        <p className="mt-3 text-sm font-bold text-violet-800 dark:text-violet-200">Memuat halaman…</p>
      </div>
    </div>
  );
}
