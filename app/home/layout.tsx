import AuthGuard from "@/components/auth/AuthGuard";
import type { ReactNode } from "react";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
