"use client";

import dynamic from "next/dynamic";

/*
 * The study and its results use the browser throughout (recording, storage,
 * Firebase), so they render only on the client, like the app itself.
 */
const Runner = dynamic(() => import("./StudyRunner").then((m) => m.StudyRunner), { ssr: false, loading: () => <Loading /> });
const Results = dynamic(() => import("./ResultsDashboard").then((m) => m.ResultsDashboard), { ssr: false, loading: () => <Loading /> });

function Loading() {
  return (
    <div className="study-shell">
      <main className="study-card" aria-busy="true">
        <div className="skeleton h-8 w-60" />
        <div className="skeleton h-32 w-full mt-6" />
      </main>
    </div>
  );
}

export function StudyClient({ view }: { view: "participant" | "results" }) {
  return view === "participant" ? <Runner /> : <Results />;
}
