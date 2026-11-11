import type { ReactNode } from "react";
import ProGate from "@/components/ProGate";
import type { Viewport } from "next";
import ChatViewport from "@/components/asisten/ChatViewport";
import "@/app/chat/chat-redesign.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191919" },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="v2-chat"><ProGate><ChatViewport />{children}</ProGate></div>;
}
