# RemotionHub

Database-backed catalog MVP for Remotion and HyperFrames components.

The current vertical slice supports:

- versioned component catalog data in Convex
- local JSON fixtures as import inputs
- Remotion and HyperFrames browse routes
- preview-first catalog cards
- runtime detail pages with source, usage notes, and agent prompts
- unit, Convex contract, and Playwright smoke tests

## Local Development

Install dependencies:

```bash
npm install
```

Start the local test environment:

```bash
make dev
```

This starts local Convex if it is not already running, imports the fixture catalog, opens `http://localhost:3000/`, and starts the Vite dev server. To use another app port:

```bash
APP_PORT=3001 make dev
```

Start local Convex:

```bash
make convex
```

If the Convex CLI cannot fetch the latest local backend version, use the already downloaded backend version:

```bash
npx convex dev --local-backend-version precompiled-2026-06-09-b6aaa1a
```

Validate and import the fixture catalog into local Convex:

```bash
make validate
make seed
```

Start the app:

```bash
make app
```

## Catalog Data

Fixture inputs live under `catalog/components/*.json`.

Production catalog reads should come from Convex. JSON files are only validation/import inputs for local development, testing, and initial catalog seeding.

The import workflow is one Convex mutation per component, preserving transactionality for each component and its versions/artifacts.

## Routes

- `/` lists all active catalog items.
- `/remotion` lists Remotion components.
- `/remotion/$owner/$slug` shows a Remotion component detail page.
- `/hyperframes` lists HyperFrames components.
- `/hyperframes/$owner/$slug` shows a HyperFrames component detail page.

## UI Language

The platform UI supports Chinese and English. Chinese is the default UI language.

The header exposes a `中文 / EN` toggle. The selected language is stored in `localStorage` under `remotionhub.locale`.

URLs do not include locale prefixes.

Catalog data is not translated. Uploaded names, summaries, changelogs, usage notes, and agent prompts render exactly as stored in Convex.

## Verification

Run unit and Convex contract tests:

```bash
make test
```

Run static validation and build:

```bash
make check
```

Run Playwright smoke tests against local Convex:

```bash
make convex
make e2e
```

`PLAYWRIGHT_USE_SYSTEM_CHROME=1` uses the local Google Chrome installation when Playwright browser download is unavailable.

## AI Studio P0

The AI Studio MVP smoke path currently validates a local-only bridge:

- planner stub in `scripts/studio-planner.ts`
- fake renderer mode via `STUDIO_RENDER_MODE=fake`
- local artifact serving through `/api/studio/artifacts/*`

This is suitable for local development and Task 8 smoke coverage only. It does not mean production Remotion rendering or production object storage is wired.

Required local env for the Studio smoke path:

```bash
VITE_CONVEX_URL=http://127.0.0.1:3210
STUDIO_TEMPLATE_IMPORT_SECRET=dev-studio-template-import-secret
STUDIO_WORKER_SECRET=dev-studio-worker-secret
STUDIO_ARTIFACT_SIGNING_SECRET=dev-studio-artifact-signing-secret
STUDIO_FAKE_ARTIFACT_DIR=/tmp/remotionhub-studio-artifacts
```

Seed the first Studio template:

```bash
npx tsx scripts/seed-studio-templates.ts
```

Run the worker in fake render mode:

```bash
STUDIO_RENDER_MODE=fake npx tsx scripts/studio-worker.ts
```

Run the app against local Convex:

```bash
make app
```

Open `/studio`, confirm the recommended template, submit a prompt, and wait for the job to move from queued/planning into a completed artifact with playback and download links.

Run the focused Studio Playwright smoke once the local app, Convex backend, seeded template, and fake worker are all ready:

```bash
npm run test:e2e -- e2e/studio-smoke.pw.test.ts
```
