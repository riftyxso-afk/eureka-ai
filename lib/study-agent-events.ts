import type { StudySource } from "./study-sources-types";

export type StudyAgentEvent =
  | { type: "status"; stage: "thinking" | "retrieving" | "reading" | "combining" | "synchronizing"; label: string }
  | { type: "sources"; sources: StudySource[] }
  | { type: "token"; text: string }
  | { type: "reset" }
  | { type: "done"; title: string; document: boolean }
  | { type: "error"; message: string };
