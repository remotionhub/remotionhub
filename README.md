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

## Studio

`/studio` provides prompt-to-motion generation and private project history. The
landing page is public, but generation and saving require login. Authentication
providers are normalized to a Convex `users` ID before Studio ownership checks;
adding a provider such as WeChat does not require a Studio data migration.

Configure the model in the local Convex deployment. These values are backend
environment variables and must not be exposed to the browser bundle:

```bash
npx convex env set --deployment local OPENAI_API_KEY '<your-key>'
npx convex env set --deployment local STUDIO_OPENAI_MODEL 'gpt-5.2'
```

For deterministic local or CI smoke tests, select the stub model in the Convex
deployment environment:

```bash
npx convex env set --deployment local STUDIO_MODEL_MODE stub
```

The browser cannot select the model mode. `make studio-smoke` sets the local
Convex deployment to stub mode, seeds the catalog, builds the application, and
always runs the signed-out desktop/mobile checks. Authenticated generation,
follow-up, refresh/history, and Card Avatar Remix checks run only when a valid
Playwright storage state is supplied:

```bash
export PLAYWRIGHT_AUTH_STORAGE_STATE_JSON="$(< /absolute/path/to/local-auth-storage-state.json)"
make studio-smoke
```

The MVP executes validated generated code with `new Function` on the same page.
Dependency/API allowlists and source limits reduce accidental misuse but are not
a trustworthy sandbox. Generated source is not displayed or manually editable,
projects remain private, and only validated Catalog Studio Bundles can be
remixed. See the
[Studio Prompt-to-Motion MVP design](specs/2026-07-10-studio-prompt-to-motion-design.md)
for the accepted risk and scope restrictions.

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
make studio-smoke
```

`PLAYWRIGHT_USE_SYSTEM_CHROME=1` uses the local Google Chrome installation when Playwright browser download is unavailable.
