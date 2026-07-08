# AI Studio MVP Smoke Ops Note

## Purpose

This note defines the Task 8 smoke path for the AI Studio MVP and documents the deliberate gap between local developer scaffolding and production-grade rendering/storage.

## Local P0 Smoke Scope

Task 8 validates the narrow path below:

1. Seed the approved Studio template into local Convex.
2. Create a generation job from `/studio`.
3. Let the external worker claim the queued job.
4. Produce a fake MP4 artifact through `STUDIO_RENDER_MODE=fake`.
5. Serve playback and download bytes through the signed local artifact route.

This is a smoke path, not a claim that production video rendering is complete.

## Required Local Inputs

The Studio P0 smoke path expects these local environment values:

```bash
VITE_CONVEX_URL=http://127.0.0.1:3210
STUDIO_TEMPLATE_IMPORT_SECRET=dev-studio-template-import-secret
STUDIO_WORKER_SECRET=dev-studio-worker-secret
STUDIO_ARTIFACT_SIGNING_SECRET=dev-studio-artifact-signing-secret
STUDIO_FAKE_ARTIFACT_DIR=/tmp/remotionhub-studio-artifacts
```

`scripts/seed-studio-templates.ts` and `scripts/studio-worker.ts` both load `.env.local`, so local operators can keep the values there.

## Local Smoke Procedure

1. Start local Convex with `make convex`.
2. Seed the Studio template with `npx tsx scripts/seed-studio-templates.ts`.
3. Start the worker with `STUDIO_RENDER_MODE=fake npx tsx scripts/studio-worker.ts`.
4. Start the app with `make app`.
5. Sign in locally so `/studio` has an authenticated Convex identity.
6. Run `STUDIO_E2E=1 npm run test:e2e -- e2e/studio-smoke.pw.test.ts`.

If the e2e smoke is run manually in a browser, use `/studio`, confirm the recommended template, submit a prompt, and wait for the download link.

## Storage And Renderer Boundary

The current worker path is intentionally local-only:

- `scripts/studio-renderer.ts` writes fake MP4 and thumbnail bytes into `STUDIO_FAKE_ARTIFACT_DIR`.
- `src/routes/api/studio/artifacts/$kind.ts` can read those local bytes and stream them back through short-lived signed URLs.
- The fake renderer is explicitly disabled when `NODE_ENV=production`.
- `STUDIO_RENDER_MODE=remotion` is reserved and still throws until a real Remotion render command and storage upload path are wired.

Because of those constraints, Task 8 must not be described as production rendering/storage support. The local smoke proves the Studio state machine, access control, and artifact route integration only.

## Operational Caveats

- If local Convex is up but the Studio template was not seeded, `/studio` will render the empty-template state and the smoke will fail before job creation.
- If the worker is not running, job creation can still succeed but the smoke will stall before a download link appears.
- If `STUDIO_E2E=1` is omitted, the Studio Playwright spec is skipped so the default e2e gate does not fail without Studio-specific auth, template, and worker prerequisites.
- If only local artifact storage is configured in a production runtime, the artifact route should fail safely instead of pretending remote storage exists.
