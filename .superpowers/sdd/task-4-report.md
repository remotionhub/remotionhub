## Task 4
- Added `convex/lib/studio/ledger.ts` with stable ledger idempotency key helpers.
- Added `convex/lib/studio/jobs.ts` with progress, active-status, and cancellation refund helpers.
- Extended `convex/studio.ts` with authenticated Studio job creation, history/detail queries, cancellation, and refund handling.
- Added test coverage for ledger keys, job helper behavior, create-generation idempotency, active job limit, queued/planning cancellation refunds, refund idempotency, and history ordering.
- Verified with `npm run test -- convex/lib/studio/ledger.test.ts convex/lib/studio/jobs.test.ts convex/studio.test.ts`.
- Note: prompt completeness threshold and blocked keyword list were implemented as a narrow MVP policy because Task 4 brief did not specify exact boundary values.

## Task 4 Review Fixes (2026-07-07)
- Files changed:
  - `convex/studio.ts`
  - `convex/studio.test.ts`
  - `convex/lib/studio/jobs.ts`
  - `convex/lib/studio/jobs.test.ts`
  - `.superpowers/sdd/task-4-report.md`
- Test command:
  - `npm run test -- convex/lib/studio/ledger.test.ts convex/lib/studio/jobs.test.ts convex/studio.test.ts`
- Test output summary:
  - `3` test files passed.
  - `15` tests passed.
  - No failures.
- Self-review:
  - Removed the public arbitrary refund mutation so refunds now only happen through `cancelGenerationJob`.
  - Added a stable user-safe generation job projection and applied it to public job create/detail/history/cancel responses.
  - Restricted cancellation to `queued` and `planning`, preserving refund behavior only for `queued` and pre-model-start `planning` jobs.
  - Added regression coverage for private field redaction, invalid cancel states, and removal of the public refund path.
