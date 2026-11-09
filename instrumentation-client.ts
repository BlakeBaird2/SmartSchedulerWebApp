import posthog from "posthog-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// Without both keys (a local copy, say) analytics is off. Say so in development,
// but never stop the app over it: throwing here kept the whole app from loading.
if (!projectToken || !host) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `PostHog is off: set ${!projectToken ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN" : "NEXT_PUBLIC_POSTHOG_HOST"} to record analytics events.`,
    );
  }
} else {
  posthog.init(projectToken, {
    api_host: host,
    defaults: "2025-05-24",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
}
