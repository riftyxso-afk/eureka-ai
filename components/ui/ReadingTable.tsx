"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "./reading-table.css";

export default function ReadingTable({ children, label }: { children: ReactNode; label: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const container = viewport.current;
    if (!container) return;
    const measure = () => setOverflow(container.scrollWidth > container.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    const table = container.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="reading-table">
      <div
        ref={viewport}
        className="reading-table-viewport"
        tabIndex={overflow ? 0 : undefined}
        role={overflow ? "region" : undefined}
        aria-label={overflow ? label : undefined}
        aria-describedby={overflow ? hintId : undefined}
      >
        {children}
      </div>
      {overflow && <p id={hintId} className="reading-table-hint">Geser tabel untuk melihat kolom lainnya <span aria-hidden="true">↔</span></p>}
    </div>
  );
}
