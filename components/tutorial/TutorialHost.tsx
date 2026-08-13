"use client";

import { useSyncExternalStore } from "react";
import TutorialSpotlight from "./TutorialSpotlight";
import {
  completeTutorial,
  getTutorialState,
  nextStep,
  skipTutorial,
  subscribeTutorial,
  TUTORIAL_STEPS,
} from "@/lib/tutorial";

/**
 * Host tutorial realtime — pasang SEKALI per halaman (home, chat, dashboard).
 * Membaca state dari localStorage (berlanjut antar halaman) dan merender
 * spotlight yang menyorot tombol/menu asli.
 */
export default function TutorialHost() {
  const state = useSyncExternalStore(subscribeTutorial, getTutorialState, getTutorialState);

  return (
    <TutorialSpotlight
      active={state.active}
      step={state.step}
      steps={TUTORIAL_STEPS}
      onAdvance={() => void nextStep()}
      onComplete={() => void completeTutorial()}
      onSkip={() => void skipTutorial()}
    />
  );
}
