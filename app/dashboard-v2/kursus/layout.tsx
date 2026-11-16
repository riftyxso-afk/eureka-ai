import ProGate from "@/components/ProGate";
import type { ReactNode } from "react";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import "@/app/dashboard/kursus/kursus.css";
import "@/app/dashboard/kursus/[courseId]/pelajaran/[lessonId]/learning-room.css";
import "./courses-v2.css";
export default function Layout({ children }: { children: ReactNode }) {
  const content = <V2FeaturePage title="Kursus · Beta" art={4} guide="courses"><div className="courses-v2">{children}</div></V2FeaturePage>;
  return process.env.NODE_ENV === "development" ? content : <ProGate>{content}</ProGate>;
}
