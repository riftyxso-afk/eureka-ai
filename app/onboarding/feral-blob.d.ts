declare module "feral-blob" {
  import type { ComponentType } from "react";
  export const JellyBlobMascot: ComponentType<{ mood?: "neutral" | "happy" | "hmm" | "curious" | "password"; celebrate?: number; stillBody?: boolean; gaze?: { x: number; y: number; intensity?: number }; className?: string }>;
}
