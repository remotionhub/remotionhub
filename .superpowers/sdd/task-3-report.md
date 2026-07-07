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
