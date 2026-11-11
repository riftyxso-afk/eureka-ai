"use client";

import { useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";

export default function ChatViewport() {
  const { resolved } = useTheme();

  useEffect(() => {
    const color = resolved === "dark" ? "#191919" : "#ffffff";
    const tags = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const previous = tags.map(tag => ({ tag, content: tag.content }));
    tags.forEach(tag => { tag.content = color; });
    return () => {
      previous.forEach(({ tag, content }) => {
        if (tag.isConnected && tag.content === color) tag.content = content;
      });
    };
  }, [resolved]);

  return null;
}
