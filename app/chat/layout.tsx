import AuthGuard from "@/components/auth/AuthGuard";
import ProGate from "@/components/ProGate";
import type { Metadata, Viewport } from "next";
import ChatViewport from "@/components/asisten/ChatViewport";
import type { ReactNode } from "react";
import "./chat-redesign.css";

// Area login → jangan diindeks Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191919" },
  ],
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <AuthGuard hideLoader><ProGate><ChatViewport />{children}</ProGate></AuthGuard>;
}
