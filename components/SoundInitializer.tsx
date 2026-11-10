"use client";

import { useEffect } from "react";
import { initCuelume } from "@/lib/sound/cuelume";

export default function SoundInitializer() {
  useEffect(initCuelume, []);
  return null;
}
