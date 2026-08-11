"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MindMapProps {
  content: string;
}

/**
 * Komponen untuk render mindmap visual menggunakan Mermaid.
 * Input: Mermaid mindmap syntax
 * Output: SVG diagram interaktif
 */
export function MindMap({ content }: MindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize mermaid dengan konfigurasi custom
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      themeVariables: {
        primaryColor: "#8B5CF6",
        primaryTextColor: "#fff",
        primaryBorderColor: "#7C3AED",
        lineColor: "#D1C4B4",
        secondaryColor: "#F59E0B",
        tertiaryColor: "#10B981",
        background: "#FFF9F5",
        mainBkg: "#8B5CF6",
        secondBkg: "#F59E0B",
        tertiaryBkg: "#10B981",
        textColor: "#2D2D2D",
        fontSize: "14px",
        fontFamily: "Nunito, sans-serif",
      },
    });

    // Render mindmap
    const renderMindMap = async () => {
      if (!containerRef.current) return;

      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, content);
        containerRef.current.innerHTML = svg;
      } catch (error) {
        console.error("Error rendering mindmap:", error);
        containerRef.current.innerHTML = `
          <div class="text-red-600 p-4 border-2 border-red-300 rounded-clay-md bg-red-50">
            <strong>Error rendering mindmap</strong>
            <p class="text-sm mt-1">Format mindmap tidak valid. Pastikan syntax Mermaid benar.</p>
          </div>
        `;
      }
    };

    renderMindMap();
  }, [content]);

  return (
    <div className="my-6 overflow-x-auto rounded-clay-md border-2 border-clay-shadow/20 bg-white p-6 shadow-clay-sm">
      <div ref={containerRef} className="flex justify-center" />
    </div>
  );
}
