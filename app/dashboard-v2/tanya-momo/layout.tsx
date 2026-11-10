import type { ReactNode } from "react";
import ProGate from "@/components/ProGate";
import "@/app/chat/chat-redesign.css";

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="v2-chat"><ProGate>{children}</ProGate></div>;
}
