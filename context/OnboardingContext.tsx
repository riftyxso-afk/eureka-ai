"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { OnboardingData } from "@/lib/types";

const STORAGE_KEY = "eureka_onboarding";

const DEFAULT_DATA: OnboardingData = {
  name: "",
  username: "",
  education: "",
  grade: "",
  psyAnswers: {},
  weakTopic: "",
  learningHabit: "",
  peakHour: "",
};

interface OnboardingContextValue {
  data: OnboardingData;
  isComplete: boolean;
  hydrated: boolean;
  update: (patch: Partial<OnboardingData>) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setData({ ...DEFAULT_DATA, ...parsed });
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  const update = (patch: Partial<OnboardingData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable
      }
      return next;
    });
  };

  const reset = () => {
    setData(DEFAULT_DATA);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
  };

  const isComplete =
    Boolean(data.name) &&
    Boolean(data.grade) &&
    Object.keys(data.psyAnswers ?? {}).length > 0 &&
    Boolean(data.weakTopic) &&
    Boolean(data.learningHabit) &&
    Boolean(data.peakHour);

  return (
    <OnboardingContext.Provider value={{ data, isComplete, hydrated, update, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
