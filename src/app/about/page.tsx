import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { metadata as home } from "../page";

// The home page again, at an address that never skips ahead to the app, so people
// who already use SmartScheduler can still read it. Search engines list it once, at "/".
export const metadata: Metadata = { ...home, robots: { index: false } };

export default function Page() {
  return <Landing variant="about" />;
}
