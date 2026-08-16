import { CheckCircle2, Wrench } from "lucide-react";
import type { ToolCall } from "@/lib/types";

export default function ToolCallBadge({ name, status }: ToolCall) {
  const isCalled = status === "called";
  return (
    <div className="inline-flex items-center gap-2 rounded-clay-md bg-clay-inputBg px-4 py-2 text-sm font-bold text-clay-dark shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]">
      <span className="text-clay-primary">
        {isCalled ? <Wrench size={14} /> : <CheckCircle2 size={14} />}
      </span>
      <span>
        {isCalled ? `Memanggil ${name} Tool...` : `${name} Tool selesai`}
      </span>
    </div>
  );
}
