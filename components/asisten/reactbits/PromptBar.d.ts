import type { ReactNode, Dispatch, SetStateAction } from "react";
export interface PromptSource { key: string; name: string; description?: string; icon: ReactNode; attach?: boolean; }
export interface PromptModel { key: string; name: string; tag?: string; logo?: string; disabled?: boolean; }
export interface PromptCommand { key: string; name: string; description?: string; }
export interface PromptBarProps {
  placeholder?: string; value?: string; onDraftChange?: Dispatch<SetStateAction<string>>; disabled?: boolean;
  voiceSlot?: ReactNode; onSourcesOpen?: () => void; onSourceSelect?: (source: PromptSource) => void;
  sources?: PromptSource[]; commands?: PromptCommand[]; models?: PromptModel[]; defaultModel?: string;
  efforts?: string[]; defaultEffort?: string; onEffortChange?: (effort: string) => void; busy?: boolean;
  clearOnSend?: boolean;
  onModelMenuHeightChange?: (height: number) => void;
  onSend?: (text: string, options: { attachments: string[]; model?: PromptModel; effort: string }) => void;
  onStop?: () => void; onAttach?: () => void | string | string[] | Promise<void | string | string[]>;
  background?: string; color?: string; menuBackground?: string; sparkColor?: string; width?: number; radius?: number; maxRows?: number; className?: string;
}
export default function PromptBar(props: PromptBarProps): ReactNode;
