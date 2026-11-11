import ProGate from "@/components/ProGate";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import StudyStudio from "@/components/dashboard/StudyStudio";
import "../study-flows.css";
import "./studio.css";

export const metadata = { title: "Studio Belajar · Eureka" };

export default function Page() {
  return (
    <V2FeaturePage title="Studio Belajar" art={2} guide="study-studio">
      <ProGate><StudyStudio /></ProGate>
    </V2FeaturePage>
  );
}
