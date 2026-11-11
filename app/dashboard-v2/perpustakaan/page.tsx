import ProGate from "@/components/ProGate";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import LibraryWorkspace from "@/components/library/LibraryWorkspace";

export const metadata = { title: "Perpustakaan · Eureka" };
export default function Page() {
  return <V2FeaturePage guide="books" title="Perpustakaan" art={0}><ProGate><LibraryWorkspace /></ProGate></V2FeaturePage>;
}
