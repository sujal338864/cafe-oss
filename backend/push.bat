@echo off
set PRISMA_TELEMETRY_DISABLED=1
npx prisma db push --accept-data-loss
