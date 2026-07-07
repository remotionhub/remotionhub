## Task 4
- Added `convex/lib/studio/ledger.ts` with stable ledger idempotency key helpers.
- Added `convex/lib/studio/jobs.ts` with progress, active-status, and cancellation refund helpers.
- Extended `convex/studio.ts` with authenticated Studio job creation, history/detail queries, cancellation, and refund handling.
- Added test coverage for ledger keys, job helper behavior, create-generation idempotency, active job limit, queued/planning cancellation refunds, refund idempotency, and history ordering.
- Verified with `npm run test -- convex/lib/studio/ledger.test.ts convex/lib/studio/jobs.test.ts convex/studio.test.ts`.
- Note: prompt completeness threshold and blocked keyword list were implemented as a narrow MVP policy because Task 4 brief did not specify exact boundary values.
