# Final Review Fix Report

## Scope

Fixed all Critical and Important findings from the final whole-branch AI Studio MVP review while preserving the accepted MVP boundaries.

## Files Changed

- `convex/lib/studio/renderPlan.ts`
- `convex/lib/studio/renderPlan.test.ts`
- `convex/studio.ts`
- `convex/studio.test.ts`
- `convex/studio-worker.test.ts`

## Fix Summary

1. Asset allowlist boundary:
- `validateRenderPlan` now accepts asset IDs only when they are exact members of the server-derived allowlist.
- Public `createGenerationJob` no longer lets client-supplied `assetIds` become the job allowlist; the server stores only server-approved asset IDs for the job.
- Added negative coverage for arbitrary `catalog:` IDs and unsafe asset strings such as remote URLs, path traversal strings, and dependency-like IDs.

2. Idempotent system-failure refunds:
- Worker failure paths now reuse the existing idempotent refund helper.
- Explicit `failGenerationJob` failures now refund once and emit `credits_refunded`.
- Expired rendering/uploading recovery failures now refund once and emit `credits_refunded`.
- Duplicate refund attempts remain blocked by the existing refund ledger idempotency key.

3. Server-enforced MVP media profile:
- Job creation now normalizes media summary metadata to the MVP profile instead of trusting client `aspectRatio`, `durationSeconds`, or `assetIds`.
- Template validation now enforces `16:9`, `1280x720`, and `30fps` template support before job creation.
- `completePlanning` now syncs stored job summary metadata from the validated render plan output.

4. Error-code alignment:
- Removed the stale `RENDER_NOT_IMPLEMENTED` failure code from lock-recovery failure paths and reused the existing `RENDER_FAILED` code.

## Verification

- `npm run test -- convex/studio.test.ts convex/studio-worker.test.ts convex/studio-artifacts.test.ts scripts/studio-renderer.test.ts src/components/studio/StudioPage.test.tsx`
  - Passed: 5 files, 43 tests
- `VITE_CONVEX_URL=https://example.invalid npm run ci:types-build`
  - Passed: TypeScript check and production build

## Notes

- Follow-up fix: `createGenerationJob` now rejects client durations outside the MVP/render-plan `10..30` range by normalizing them back to the default `30`, so queued/planning job summaries cannot temporarily store sub-MVP durations such as `5`.
- Worker secret validation remains unchanged.
- Artifact signed URL and owner-gating behavior remain unchanged.
- No upload/source download/timeline/HyperFrames live support was added.
- The renderer remains fake/controlled MVP behavior; no production render/storage capability was overclaimed.
