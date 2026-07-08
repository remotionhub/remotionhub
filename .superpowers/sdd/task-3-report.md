Status: DONE

Task:
- Implement Task 3 of the AI Studio MVP plan in `convex/lib/studio/templates.ts`
- Modify `convex/studio.ts`
- Create `scripts/seed-studio-templates.ts`
- Create `convex/lib/studio/templates.test.ts`
- Create `convex/studio.test.ts`
- Append this report in `.superpowers/sdd/task-3-report.md`

Scope implemented:
- Added `StudioTemplateSeed` and the `p0StudioTemplateSeed` payload in `convex/lib/studio/templates.ts`.
- Added template helper functions in `convex/lib/studio/templates.ts`:
  - `listActiveApprovedStudioTemplates`
  - `getDefaultStudioTemplate`
- Added `convex/studio.ts` with:
  - `upsertStudioTemplate`
  - `listStudioTemplates`
  - `getDefaultStudioTemplate`
- Added `scripts/seed-studio-templates.ts` to seed `yt-simple-ai-product` through `api.studio.upsertStudioTemplate`.
- Created `convex/lib/studio/templates.test.ts` to cover:
  - inactive templates are ignored
  - non-approved templates are ignored
  - lowest numeric priority wins
  - `p0StudioTemplateSeed` matches the required payload
- Created `convex/studio.test.ts` to cover:
  - active approved template listing
  - default template selection
  - idempotent upsert behavior

Verification:
- `npm run test -- convex/lib/studio/templates.test.ts convex/studio.test.ts`
  - passed: 2 files, 6 tests

Notes:
- No Convex code generation step was required for the targeted tests.
- I did not modify unrelated existing work in `.superpowers/sdd/task-2-report.md`.

## Task 3 fix pass

Changes made:
- Added `importSecret` validation to `convex/studio.ts` so `upsertStudioTemplate` now rejects unauthenticated writes against `process.env.STUDIO_TEMPLATE_IMPORT_SECRET`.
- Tightened `convex/lib/studio/templates.ts` so active/approved selection also requires `runtime === 'remotion'`.
- Updated `scripts/seed-studio-templates.ts` to pass `STUDIO_TEMPLATE_IMPORT_SECRET` into the seed mutation.
- Expanded `convex/lib/studio/templates.test.ts` and `convex/studio.test.ts` to cover secret rejection, secret acceptance, and remotion-only filtering.

Test summary:
- Target command: `npm run test -- convex/lib/studio/templates.test.ts convex/studio.test.ts`
- Result: passed, 2 files and 8 tests.
- Output: `Test Files  2 passed (2)` and `Tests  8 passed (8)`.

Self-review:
- The new secret check matches the existing catalog import-secret pattern and keeps the whitelist mutation off the public trust boundary.
- Query helpers and end-to-end tests now explicitly exclude hyperframes templates from the studio template whitelist.
- Remaining risk is limited to the external seed environment needing `STUDIO_TEMPLATE_IMPORT_SECRET` set before running the script.
