"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getSession } from "@/lib/auth";
import { capturePageView, identifyAnalyticsUser } from "@/lib/productAnalytics";

export default function ProductAnalytics() {
  const pathname = usePathname();
  const previous = useRef("");
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const session = getSession();
    if (session?.userId) identifyAnalyticsUser(session.userId);
    capturePageView(pathname);
  }, [pathname]);
  return null;
}
