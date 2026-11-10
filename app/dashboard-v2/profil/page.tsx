import ProfileContent from "@/components/dashboard/ProfileContent";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";

export default function Page() {
  return <V2FeaturePage title="Akun Eureka" art={10} guide="profile"><ProfileContent v2 /></V2FeaturePage>;
}
