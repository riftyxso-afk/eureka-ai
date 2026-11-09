import JadwalPage from "@/app/dashboard/jadwal/page";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";

export default function Page() {
  return <V2FeaturePage title="Agenda belajar" art={8} guide="schedule"><JadwalPage /></V2FeaturePage>;
}
