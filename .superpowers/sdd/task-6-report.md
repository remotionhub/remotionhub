# Task 6 Report

## Scope

- Added a fake-first studio renderer adapter with an explicit `remotion` handoff failure branch.
- Wired the studio worker through `rendering -> uploading -> completed` using the existing worker-secret mutations.
- Added owner-gated artifact access that issues short-lived bearer URLs and never persists signed URLs in `generationArtifacts`.
- Kept the MVP runtime on the Remotion whitelist path only and did not introduce any arbitrary code execution path.

## Files Changed

- `convex/studio.ts`
- `convex/lib/studio/artifacts.ts`
- `convex/studio-artifacts.test.ts`
- `scripts/studio-worker.ts`
- `scripts/studio-renderer.ts`
- `scripts/studio-renderer.test.ts`
- `scripts/studio-planner.test.ts`
- `.superpowers/sdd/task-6-report.md`

## Implementation Notes

- `scripts/studio-renderer.ts` defaults to `STUDIO_RENDER_MODE=fake` and returns a controlled MP4 artifact payload for the fixed MVP profile: `16:9`, `1280x720`, `30 FPS`.
- `STUDIO_RENDER_MODE=remotion` now throws `RENDER_FAILED` until a real Remotion renderer command and asset repo handoff are wired.
- `scripts/studio-worker.ts` now performs:
  - `markModelStarted`
  - `completePlanning`
  - `startRendering`
  - fake `renderStudioArtifact(...)`
  - `startUploading`
  - `completeGenerationJob`
- `convex/studio.ts#getGenerationArtifactAccess` is authenticated, owner-gated, and reads `generationArtifacts` by `userId + jobId`.
- Signed artifact URLs are issued on demand from `convex/lib/studio/artifacts.ts` with a 5 minute TTL and are not persisted.
- Thumbnail access falls back in order:
  - artifact thumbnail
  - signed template preview URL
  - embedded default thumbnail URL

## Tests

- `scripts/studio-renderer.test.ts`
- `scripts/studio-planner.test.ts`
- `convex/studio-artifacts.test.ts`

## Configuration

- New required environment variable for artifact signing:
  - `STUDIO_ARTIFACT_SIGNING_SECRET`

## Constraints Preserved

- Worker mutations still require `STUDIO_WORKER_SECRET`.
- No `/studio` UI work was added.
- No HyperFrames live generation path was added.
- The worker still does not execute arbitrary model-generated code.

## Task 6 Review Fixes

- Added a real TanStack Start responder at `/api/studio/artifacts/$kind` for `playback`, `download`, `thumbnail`, and `preview`.
- Verifies `key`, `expires`, and `sig`, rejects expired URLs, and binds the HMAC payload to both `kind` and `storageKey` so tampering fails.
- Streams bytes from the local/dev fake artifact backing used by Task 6 and falls back to the default SVG thumbnail when `thumbnail` or `preview` bytes are missing.
- Fake renderer now writes deterministic local fixture bytes and rejects `STUDIO_RENDER_MODE=fake` when `NODE_ENV=production`.

### Focused Test Run

- Command: `npm run test -- scripts/studio-renderer.test.ts scripts/studio-planner.test.ts convex/studio-artifacts.test.ts src/routes/api/studio/artifacts/-$kind.test.ts`
- Output: `4 passed, 16 passed`

## Task 6 Re-review Fixes (Round 2)

- Replaced fake renderer placeholder bytes with a real tiny MP4 fixture and asserted MP4 container boxes (`ftyp`, `moov`, `mdat`) in tests.
- Added completion-time artifact profile validation so only Remotion MP4 artifacts matching the fixed MVP output profile can be persisted.
- Moved local artifact storage access behind runtime-safe dynamic Node imports and return `501` in production instead of pretending production artifact storage exists.

### Focused Test Run (Round 2)

- Command: `npm run test -- scripts/studio-renderer.test.ts scripts/studio-planner.test.ts convex/studio-artifacts.test.ts src/routes/api/studio/artifacts/-$kind.test.ts`
- Output: `4 passed, 21 passed`

## Task 6 Re-review Fixes (Round 3)

- Removed module-load `process.cwd()` assumptions from `lib/studio/artifact-store.ts`; local artifact storage now resolves env and cwd lazily and returns `501`-compatible unsupported results instead of crashing non-Node production route imports.
- Hardened `completeGenerationJob` so completed artifacts must have a positive `fileSizeBytes`, match the controlled MVP storage key shape `studio/<job>/artifact.mp4`, and exactly match `renderRun.outputStorageKey` before metadata is persisted.
- Added regression coverage for mismatched render output keys, non-positive file sizes, invalid storage key shapes, and sanitized artifact download filenames in `content-disposition`.

### Focused Test Run (Round 3)

- Command: `npm run test -- scripts/studio-renderer.test.ts scripts/studio-planner.test.ts convex/studio-artifacts.test.ts 'src/routes/api/studio/artifacts/-$kind.test.ts'`
- Output: `4 passed, 25 passed`
