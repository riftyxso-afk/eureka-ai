import MataPelajaranPage from "@/app/dashboard/mata-pelajaran/page";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";

export default function Page() {
  return <V2FeaturePage title="Peta materi" art={2} guide="subjects"><MataPelajaranPage /></V2FeaturePage>;
}
