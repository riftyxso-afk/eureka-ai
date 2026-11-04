"use client";

import { useState } from "react";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import "./loading-momo.css";

export function LoadingMomo({ reading = false }: { reading?: boolean }) {
  const [waving, setWaving] = useState(false);

  return (
    <button
      type="button"
      aria-label="Sapa Momo"
      aria-pressed={waving}
      onClick={() => setWaving(value => !value)}
      className="grid w-28 shrink-0 justify-items-center rounded-2xl border border-violet-200 bg-violet-50 px-2 pb-2 text-violet-800 hover:bg-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100 sm:w-32"
    >
      <span aria-hidden="true" className="loading-momo-stage">
        <MomoCompanion className="h-full w-full" mode={waving ? "fast" : reading ? "deep" : "normal"} thinking={!waving} response={waving ? "Halo!" : ""} />
      </span>
      <span className="text-xs font-bold">{waving ? "Halo juga!" : "Sapa Momo"}</span>
    </button>
  );
}
