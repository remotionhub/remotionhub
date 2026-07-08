# Task 8 Report

## Scope

Task 8 stayed inside the requested smoke/docs/final-hardening boundary:

- added focused Playwright smoke coverage for the AI Studio P0 path
- documented the local developer flow for seeding templates and running the fake worker
- recorded operational boundaries between local fake artifacts and missing production renderer/storage wiring

No new product features or security relaxations were introduced.

## Files Changed

- `e2e/studio-smoke.pw.test.ts`
- `README.md`
- `specs/2026-07-08-ai-studio-mvp-smoke-ops.md`
- `.superpowers/sdd/task-8-report.md`

## Implementation Notes

### Playwright smoke

- Reused the repository's existing Playwright naming convention, `*.pw.test.ts`, instead of changing the global `testMatch`.
- Covered the intended P0 path:
  - open `/studio`
  - confirm the recommended template
  - submit a prompt
  - observe an in-flight or completed status
  - wait for the MP4 download link

### Documentation

- Updated `README.md` with the local AI Studio P0 smoke workflow.
- Added an ops note in `specs/2026-07-08-ai-studio-mvp-smoke-ops.md` so future agents do not overstate the current renderer/storage capability.

## Verification

Passing focused Studio verification after the change:

```bash
npm run test -- scripts/studio-renderer.test.ts convex/studio-artifacts.test.ts src/components/studio/StudioPage.test.tsx
```

Result: `3` files passed, `21` tests passed.

Additional checks that still fail outside Task 8's changed surface:

```bash
npm run test -- scripts/studio-renderer.test.ts convex/studio-artifacts.test.ts convex/studio-worker.test.ts src/components/studio/StudioPage.test.tsx
```

Result: `convex/studio-worker.test.ts` still fails with `ConvexError: ARTIFACT_PROFILE_MISMATCH` in the existing worker state-machine path.

```bash
npm run ci:types-build
```

Result: fails with pre-existing Task 1-7 TypeScript issues concentrated in `convex/studio.ts`, `convex/studio-worker.test.ts`, `convex/studio-artifacts.test.ts`, `convex/studio.test.ts`, `scripts/seed-studio-templates.ts`, `scripts/studio-planner.test.ts`, `src/components/studio/StudioPage.test.tsx`, and `src/routes/api/studio/artifacts/$kind.ts`.

The Playwright smoke was added for the local P0 path, but it requires a running local Convex backend, seeded template data, and a fake worker process. I did not claim a passing e2e run without that environment.

## Risks And Gaps

- The smoke path still depends on `STUDIO_RENDER_MODE=fake`; it does not validate real Remotion rendering.
- Artifact bytes still come from `STUDIO_FAKE_ARTIFACT_DIR` through the local signed route, not production object storage.

## Review Blocker Follow-Up

- fixed the worker happy-path fixture so its artifact profile matches the current signed local fake-artifact contract
- switched Studio Convex tests to generated `api.studio.*` references so `convex-test` type checks against real function references
- tightened the smoke test from link visibility to signed download-route fetch validation
- added `make convex` directly to the README AI Studio local flow

### Verification Summary

- `npm run test -- convex/studio-worker.test.ts convex/studio.test.ts src/components/studio/StudioPage.test.tsx`
- `npm run test -- scripts/studio-renderer.test.ts convex/studio-artifacts.test.ts src/components/studio/StudioPage.test.tsx`
- `VITE_CONVEX_URL=https://example.invalid npm run ci:types-build`
- `convex/studio.test.ts` exists in the current tree, so the requested focused query/mutation verification used that exact file rather than a substitute.
- Result: all three commands passed after the fixes.
  - first focused command: `3` files passed, `27` tests passed
  - second focused command: `3` files passed, `21` tests passed
  - type/build gate: `tsc --noEmit` passed and `vite build` completed for client and SSR output
- Playwright smoke was kept meaningful but not executed here because it still requires the documented local prerequisites: `make convex`, seeded Studio template data, `STUDIO_RENDER_MODE=fake` worker process, and a running local app/browser target.
