import { after, NextResponse, type NextRequest } from "next/server";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { posthogLogger, posthogLoggerProvider } from "../../../../instrumentation";
import { parseFeed } from "@/lib/feeds/parse";
import { FeedUrlError, normalizeFeedUrl } from "@/lib/feeds/url";
import { DEMO_FEEDS, demoFeedText, isDemoKey } from "@/lib/feeds/demo";
import { FeedFetchError, fetchFeedText } from "@/lib/server/fetchFeed";
import { safeTimezone } from "@/lib/tz";
import type { FeedRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Read one calendar feed and return it as classes, things due, and busy time.
 *
 * Stateless by design: the link arrives with the request, is fetched, parsed and
 * answered, and nothing is kept. Each visitor's links live only in their browser.
 */
export async function POST(req: NextRequest) {
  after(async () => {
    await posthogLoggerProvider?.forceFlush().catch(() => undefined);
  });

  let body: { url?: unknown; role?: unknown; tz?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Send a JSON body with a url.", 400);
  }

  const raw = typeof body.url === "string" ? body.url.trim() : "";
  const role: FeedRole | "auto" = body.role === "school" || body.role === "personal" ? body.role : "auto";
  const timezone = safeTimezone(typeof body.tz === "string" ? body.tz : null);
  const source = isDemoKey(raw) ? "demo" : "external";

  posthogLogger?.emit({
    body: "calendar_feed_import_started",
    severityNumber: SeverityNumber.INFO,
    attributes: { source, role },
  });

  try {
    if (isDemoKey(raw)) {
      const result = parseFeed(demoFeedText(raw, timezone), { url: DEMO_FEEDS[raw], role, timezone });
      posthogLogger?.emit({
        body: "calendar_feed_import_succeeded",
        severityNumber: SeverityNumber.INFO,
        attributes: { source, role },
      });
      return NextResponse.json({ ...result, url: raw }, { headers: { "Cache-Control": "no-store" } });
    }

    const url = normalizeFeedUrl(raw);
    const text = await fetchFeedText(url);
    const result = parseFeed(text, { url, role, timezone });
    posthogLogger?.emit({
      body: "calendar_feed_import_succeeded",
      severityNumber: SeverityNumber.INFO,
      attributes: { source, role },
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof FeedUrlError ? 400 : e instanceof FeedFetchError ? e.status : 422;
    posthogLogger?.emit({
      body: "calendar_feed_import_failed",
      severityNumber: SeverityNumber.WARN,
      attributes: { source, role, status },
    });
    if (e instanceof FeedUrlError) return fail(e.message, 400);
    if (e instanceof FeedFetchError) return fail(e.message, e.status);
    return fail(e instanceof Error ? e.message : "That calendar could not be read.", 422);
  }
}
