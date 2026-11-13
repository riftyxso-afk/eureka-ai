import type { StudyBrowserContext, StudyInteraction } from "./study-interaction";
import type { StudySource } from "./study-sources-types";

import type { BrowserActivity } from "./study-browser";

import type { StudyFile } from "./study-file-types";

export type StudyAgentEvent =
  | { type: "video"; video: import("./study-video").StudyVideo }
  | { type: "mindmap"; nodes: import("./study-mindmap").StudyMapNode[] }
  | { type: "browser"; activity: BrowserActivity }
  | { type: "status"; stage: "thinking" | "retrieving" | "reading" | "combining" | "synchronizing"; label: string }
  | { type: "sources"; sources: StudySource[] }
  | { type: "token"; text: string }
  | { type: "reset" }
  | { type: "done"; title: string; document: boolean; interaction?: StudyInteraction; browser?: StudyBrowserContext; computerUse?: boolean; files?: StudyFile[]; fileErrors?: string[] }
  | { type: "error"; message: string };
