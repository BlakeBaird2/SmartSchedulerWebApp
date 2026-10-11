import type { Metadata } from "next";
import { ClientApp } from "@/components/ClientApp";

// The app itself renders in the browser, so there is nothing here for search engines.
export const metadata: Metadata = {
  title: "SmartScheduler",
  robots: { index: false },
};

export default function Page() {
  return <ClientApp />;
}
