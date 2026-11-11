import ProGate from "@/components/ProGate";
import StudyDirection from "@/components/dashboard/StudyDirection";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";

export const metadata = { title: "Arah Belajar · Eureka" };

export default function Page() {
  return <V2FeaturePage guide="direction" title="Progres belajar" art={2}>
    <ProGate><StudyDirection /></ProGate>
  </V2FeaturePage>;
}
