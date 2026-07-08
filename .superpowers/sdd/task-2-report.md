Status: DONE

Task:
- Implement Task 2 of the AI Studio MVP plan in `convex/schema.ts`
- Create `convex/studio-schema.test.ts`
- Append this report in `.superpowers/sdd/task-2-report.md`

Scope implemented:
- Added the Studio tables to `convex/schema.ts`:
  - `studioTemplates`
  - `generationJobs`
  - `generationJobEvents`
  - `generationArtifacts`
  - `usageLedger`
  - `modelRuns`
  - `renderRuns`
- Added the Studio enum validators in `convex/schema.ts`:
  - `studioRuntime`
  - `studioJobStatus`
  - `studioTemplateStatus`
  - `studioLicenseStatus`
  - `studioEventType`
  - `studioLedgerKind`
  - `studioModelRunType`
- Added all requested indexes:
  - `studioTemplates.by_status_priority`
  - `generationJobs.by_user_created`
  - `generationJobs.by_user_idempotency`
  - `generationJobs.by_status_lock`
  - `generationJobs.by_user_status`
  - `generationArtifacts.by_user_job`
  - `usageLedger.by_idempotency`
  - `usageLedger.by_user_created`
  - `generationJobEvents.by_job_created`
  - `modelRuns.by_job_created`
  - `renderRuns.by_job_created`
- Created `convex/studio-schema.test.ts` with contract inserts for every Studio table.

Verification:
- `npm run test -- convex/studio-schema.test.ts`
  - passed: 7 tests

Type/build gate:
- `npm run ci:types-build`
  - failed before `npm run build` started because of existing type errors in `convex/lib/studio/renderPlan.test.ts`
  - failure details:
    - `allowedAssetIds` in `job` is inferred as a readonly tuple and is not assignable to `string[]`
    - several assertions access `result.errors` on a union that TypeScript does not narrow to the error branch
  - these failures are outside the Task 2 write scope and were not modified

Notes:
- The targeted schema test passed after the schema update.
- I did not modify Task 1 files.
