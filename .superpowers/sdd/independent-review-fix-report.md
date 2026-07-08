# Independent Review Fix Report

- Fixed cancellation behavior so `cancelGenerationJob` keeps `job_canceled` but never creates refund ledger entries/events and never sets `refundedAt`.
- Added scoped expired-active-job recovery before `ACTIVE_JOB_LIMIT` checks in `createGenerationJob`; expired planning/rendering/uploading jobs now fail through the existing system-failure refund path before retrying the limit check.
- Tightened render-plan validation so total scene duration must exactly match `output.durationSeconds`.
- Tightened optional `thumbnailStorageKey` validation to require the same job prefix and a safe `artifact-thumbnail.(jpg|jpeg|png|webp)` filename.
- Added `Cache-Control: private, no-store` to signed artifact responses and default-thumbnail fallback responses.

## Verification

- `npm run test -- convex/studio.test.ts convex/studio-worker.test.ts convex/studio-artifacts.test.ts scripts/studio-renderer.test.ts src/components/studio/StudioPage.test.tsx`
- `VITE_CONVEX_URL=https://example.invalid npm run ci:types-build`
