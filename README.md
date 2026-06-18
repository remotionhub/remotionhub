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
