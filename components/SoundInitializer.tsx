"use client";

import { useEffect } from "react";

export default function SoundInitializer() {
  useEffect(() => {
    // Init cuelume + global click sound (menu/apapun)
    import("@/lib/sound/cuelume").then((m) => {
      m.initCuelume();
      // bind sudah dipanggil di dalam init, global click juga auto-enable
    });
  }, []);
  return null;
}
