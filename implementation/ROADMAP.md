# AI Marketing OS Roadmap and Safe Output Logic

Follow this strict chronological order to avoid side-effects and cross-dependency bugs.

### Milestone 1: DB & Identity Foundation
1. Deploy Prisma schema additions (`BrandProfile`, `ScheduledContent`, `DailyMarketingIntel`).
2. Run database migrations (`npx prisma migrate dev`).
3. Build the backend API controller to save/get brand profiles.
4. Integrate the `/dashboard/marketing/brand` configuration UI.

### Milestone 2: Generative Toolkit (Stateless)
1. Enhance the `/dashboard/marketing` basic tools into a fully fleshed component library.
2. Build Poster text logic.
3. Build the Reel / Content Idea generator.
4. Integrate Competitor/Trend analysis (using simple prompt design).

### Milestone 3: The Marketing Brain & Calendar
1. Set up `MarketingBrainQueue` chron job in BullMQ structure.
2. Draft the "Daily Intel" algorithm querying Prisma aggregations securely.
3. Push results to UI Dashboard Overview.
4. Construct the UI Calendar view for arranging AI generation elements.

### Milestone 4: Customer Analytics & ROI Sync
1. Tie AI Promo codes dynamically to core `orders`.
2. Compute specific usage metrics.
3. Map existing customer segments into automated "Re-Activation" paths.
4. Complete End-to-End automated testing of module completely independently of POS functionality.
