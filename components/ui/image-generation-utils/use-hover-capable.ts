"use client";
import { useEffect, useState } from "react";
export function useHoverCapable() {
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const query = matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHover(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return hover;
}
