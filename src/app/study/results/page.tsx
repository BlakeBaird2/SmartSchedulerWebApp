import type { Metadata } from "next";
import { StudyClient } from "@/components/study/StudyClient";

// For the research team: export the CSV and cut a clip from a recording.
export const metadata: Metadata = {
  title: "Usability test results",
  robots: { index: false },
};

export default function Page() {
  return <StudyClient view="results" />;
}
