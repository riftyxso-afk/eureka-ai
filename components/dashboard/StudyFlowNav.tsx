"use client";

import type { ReactNode } from "react";

type Item<Id> = { id: Id; label: string; icon: ReactNode };

export default function StudyFlowNav<Id extends string>({
  label, items, current, onChange,
}: {
  label: string;
  items: readonly Item<Id>[];
  current: Id;
  onChange: (id: Id) => void;
}) {
  return (
    <nav className="flow-nav" aria-label={label}>
      {items.map(({ id, label, icon }) => (
        <button
          type="button"
          key={id}
          aria-current={current === id ? "true" : undefined}
          aria-controls="flow-panel"
          onClick={() => onChange(id)}
        >
          <span aria-hidden="true">{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
