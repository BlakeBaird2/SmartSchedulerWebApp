import type { Metadata } from "next";
import { DesignLibrary } from "@/components/DesignLibrary";

export const metadata: Metadata = {
  title: "Design library · SmartScheduler",
  description: "The components every SmartScheduler screen is built from, with when to use each one and why it exists.",
  robots: { index: false },
};

export default function Page() {
  return <DesignLibrary />;
}
