import ProGate from "@/components/ProGate";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <ProGate>{children}</ProGate>;
}
