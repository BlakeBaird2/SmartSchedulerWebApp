import type { Metadata } from "next";
import { Landing } from "@/components/Landing";

const title = "SmartScheduler — One plan for school, work and life";
const description =
  "SmartScheduler pulls assignments, classes, work schedules and plans from Canvas, Google, Outlook and Apple into one calendar, then fills your free time with whatever's due soonest. Free, no account.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
};

export default function Page() {
  return <Landing />;
}
