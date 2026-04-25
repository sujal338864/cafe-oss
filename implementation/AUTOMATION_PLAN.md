# Automation & Background Queue Plan

To maintain application responsiveness, NO heavy marketing calculations or bulk dispatches will occur on the main Express event loop.

## BullMQ Queues Utilized

### 1. `MarketingBrainQueue` (Background Cron)
- Executed every night at 02:00 AM.
- Assesses sales data from the previous day (identifying slow sellers or low volume days).
- Assesses customer segments (identifying groups migrating from Active -> Inactive).
- Automatically invokes OpenAI to draft a 4-point "Marketing Plan of the Day".
- Commits generated plan to `DailyMarketingIntel`.

### 2. `ScheduledContentQueue`
- Executes an evaluation heartbeat every hour.
- Checks if any `ScheduledContent` is due.
- Dispatches queued content instructions via Webhook or directly pushes emails via `EmailService`.

### 3. `CreativeGenerationQueue`
- Offloads heavy image rendering.
- When an owner requests a "Poster", they receive a "Generating..." toast.
- The `PosterJob` processes via DALL-E or Canvas APIs.
- The backend emits a Socket.io event `CREATIVE_READY` to the frontend, replacing the loading state.

## Rate Limiting & Scalability
- **Concurrency Locks**: Set queue concurrency extremely low (1 or 2) to protect PostgreSQL connections and Third-Party API budgets.
- **Idempotency Checks**: Queue processes confirm uniqueness bounds so an email list isn't accidentally dispatched twice upon retry.
