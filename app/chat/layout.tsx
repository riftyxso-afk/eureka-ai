import AuthGuard from "@/components/auth/AuthGuard";
import ProGate from "@/components/ProGate";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./chat-redesign.css";

// Area login → jangan diindeks Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <AuthGuard hideLoader><ProGate>{children}</ProGate></AuthGuard>;
}
