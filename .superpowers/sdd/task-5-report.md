
## Task 5
- Added `scripts/studio-planner.ts` with the required stub `createStubRenderPlan` output for the P0 studio template.
- Added worker lifecycle mutations to `convex/studio.ts` for claim, planning, rendering, uploading, completion, and failure with status/worker ownership checks.
- Added `scripts/studio-worker.ts` as a single-pass worker skeleton that loads env, claims one job, runs the planner stub, and fails the job on worker-side planning errors.
- Added worker state machine coverage in `convex/studio-worker.test.ts` and planner coverage in `scripts/studio-planner.test.ts`.
- Verified with `npm run test -- scripts/studio-planner.test.ts convex/studio-worker.test.ts`.
