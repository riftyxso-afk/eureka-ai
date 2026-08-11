"use client";

import { useEffect, useState } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onDone?: () => void;
}

export default function TypewriterText({
  text,
  speed = 22,
  onDone,
}: TypewriterTextProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!text) return;
    const interval = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(interval);
          onDone?.();
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  return <>{text.slice(0, count)}</>;
}
