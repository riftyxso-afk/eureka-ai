import type { ReactNode } from "react";
import "@/app/chat/chat-redesign.css";

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="v2-chat">{children}</div>;
}
