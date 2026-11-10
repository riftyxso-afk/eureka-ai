import ImportAccount from "@/components/auth/ImportAccount";
import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "Impor akun Eureka", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ImportPage() {
  return <main className="grid min-h-dvh place-items-center bg-clay-cream px-5 py-10">
    <section className="w-full max-w-md text-clay-dark">
      <Image src="/icons/momo-192.png" alt="" width={72} height={72} className="mb-6 rounded-2xl" />
      <h1 className="text-2xl font-extrabold">Bawa akunmu ke Eureka</h1>
      <p className="mt-3 leading-relaxed text-clay-muted">Catatan, riwayat chat, dan progres mengikuti akunmu setelah impor.</p>
      <ImportAccount fromLink />
      <Link href="/login" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-clay-primary">Kembali ke halaman masuk</Link>
    </section>
  </main>;
}
