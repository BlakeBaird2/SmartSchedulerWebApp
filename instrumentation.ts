import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

function warnMissingConfiguration(variable: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`
    );
  }
}

export const posthogLoggerProvider =
  !projectToken ? (warnMissingConfiguration("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"), null) :
  !host ? (warnMissingConfiguration("NEXT_PUBLIC_POSTHOG_HOST"), null) :
  new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": "smartscheduler-web" }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: new URL("/i/v1/logs", host).toString(),
          headers: {
            Authorization: `Bearer ${projectToken}`,
            "Content-Type": "application/json",
          },
          timeoutMillis: 2000,
        }),
      }),
    ],
  });

// This dedicated logger intentionally keeps existing application logs local.
export const posthogLogger = posthogLoggerProvider?.getLogger("smartscheduler.posthog");

export function register() {}
