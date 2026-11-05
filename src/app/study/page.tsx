import type { Metadata } from "next";
import { StudyClient } from "@/components/study/StudyClient";

// The one link participants get. Kept out of search engines.
export const metadata: Metadata = {
  title: "Help us test Schedule Smart",
  description: "A 10-minute usability test of Schedule Smart, done on your own.",
  robots: { index: false },
};

export default function Page() {
  return <StudyClient view="participant" />;
}
