"use client";

/**
 * /home → redirect ke /dashboard.
 * Seluruh fitur asisten kini hidup di Dashboard (AssistantHub) — lihat
 * change merge-home-into-dashboard. Redirect tipis agar bookmark lama
 * tidak mati. SENGGAJA tidak menyentuh PENDING_PROMPT_KEY: hanya
 * AssistantHub yang boleh membacanya.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
