import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://6b17e36c50aa7e67e5a1d22b7d4541f1@o4511233964310528.ingest.us.sentry.io/4511233986330624",
  // Replay may only be enabled for the client-side
  integrations: [
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1,
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
