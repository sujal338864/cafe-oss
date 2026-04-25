# UI Implementation Plan

The UI will inject deeply into the existing `frontend/src/app/dashboard/marketing/` directory.

## App Structure

```text
/dashboard/marketing/
├── layout.tsx                # Marketing sub-navigation wrapper
├── page.tsx                  # "The Brain" - Overview & Daily intel
├── brand/page.tsx            # Brand Identity configurator
├── calendar/page.tsx         # Monthly planner grid 15/30 day overview
├── creative/page.tsx         # Poster / Image generation UI
├── copywriting/page.tsx      # Reel, Text, and SMS/Email copy generator
├── campaigns/page.tsx        # Email & Automated Campaign manager
└── reputation/page.tsx       # Review monitoring and auto-reply templates
```

## Component Architecture

1.  **AI Insight Widget**: A specialized card on the Marketing root page displaying the daily marketing directives fetched from the backend.
2.  **Creative Canvas**: A split-screen UI for Poster generation. Left side: Form parameters. Right side: Generated output with download/share bounds.
3.  **Tone & Identity Sliders**: Pre-built form selectors for configuring brand identity.
4.  **Content Calendar Grid**: A UI element built from standard HTML/CSS allowing click-to-edit days.

## Interaction Priorities

- **Zero-Wait Generation**: Ensure loading states use Skeleton spinners so users don't think the POS is frozen while waiting 10s for an AI API.
- **Visual Distinction**: The Marketing module uses purple/violet gradients to visually separate it from the cold, operational green/blue aesthetic of the Checkout POS.
