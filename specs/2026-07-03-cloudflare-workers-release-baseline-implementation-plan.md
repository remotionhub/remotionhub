# Cloudflare Workers Release Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a minimal Cloudflare Workers deployable baseline for the TanStack Start frontend while replacing stale Vercel production assumptions.

**Architecture:** This is a release-configuration change with explicit boundaries. The implementation updates active guidance and env contracts, adds Cloudflare Workers tooling and Wrangler baseline configuration, wires the Cloudflare Vite plugin into the TanStack Start build, and verifies that existing local tests, typecheck, and production build still pass. It does not create the GitHub production deploy workflow, configure remote environments, or perform a real production deploy.

**Tech Stack:** TanStack Start, Vite 8, React 19, Cloudflare Workers, `@cloudflare/vite-plugin`, Wrangler, npm, TypeScript, Vitest.

## Global Constraints

- Write project documentation in `specs/` unless the user explicitly asks for another location.
- User-facing explanation and Markdown prose may use Chinese.
- Code, comments, identifiers, commit messages, and Markdown code blocks must use English only.
- Do not commit real `.env.local`, `.env.production`, `.dev.vars`, deploy keys, API tokens, account ids, DNS routes, TLS config, or other secrets.
- Do not create `.github/workflows/deploy.yml` in this task.
- Do not configure GitHub `Production` environment in this task.
- Do not configure Cloudflare custom domains, routes, DNS, or TLS in this task.
- Do not execute a real remote deploy in this task.
- Preserve `CONVEX_DEPLOYMENT` as local Convex CLI metadata; do not convert it to a Cloudflare value.
- Treat `VITE_CONVEX_URL` as the public frontend build-time Convex endpoint.
- Treat `CONVEX_DEPLOY_KEY` as a backend deploy secret that must not enter browser bundles or plaintext Wrangler vars.
- Keep Cloudflare Workers deployment commands explicitly named; do not introduce a bare `deploy` script.
- Keep `devtools()` first in the Vite plugin list.
- Keep `cloudflare({ viteEnvironment: { name: 'ssr' } })` before `tanstackStart()`.

---

## File Structure

- Modify `AGENTS.md`
  - Replace stale Vercel release assumptions with Cloudflare Workers frontend target language.
  - Clarify the Cloudflare build-time `VITE_CONVEX_URL` contract.
  - Preserve the boundary that `.github/workflows/deploy.yml` does not yet exist.

- Modify `.gitignore`
  - Ignore `.env*` and `.dev.vars*`.
  - Preserve committed `.env.example`.

- Create `.env.example`
  - Document non-secret public frontend env keys with placeholder values only.

- Modify `package.json`
  - Add Cloudflare Workers scripts.
  - Add dev dependencies through npm, not manual JSON-only edits.

- Modify `package-lock.json`
  - Let npm update this file when installing Cloudflare dependencies.

- Create `wrangler.jsonc`
  - Define the Worker baseline only: schema, name, compatibility date, Node compatibility flag, and TanStack Start server entry.

- Modify `vite.config.ts`
  - Import the Cloudflare Vite plugin.
  - Use function-form `defineConfig`.
  - Include Cloudflare plugin for non-test modes.
  - Preserve Vitest configuration.

- Read-only reference `specs/2026-07-03-cloudflare-workers-release-baseline-design.md`
  - Use it as the source of truth while implementing and reviewing.

---

## Task 1: Update Active Guidance and Env Safety

**Files:**
- Modify: `AGENTS.md`
- Modify: `.gitignore`
- Create: `.env.example`
- Read: `specs/2026-07-03-cloudflare-workers-release-baseline-design.md`

**Interfaces:**
- Consumes: The approved Cloudflare Workers release baseline design.
- Produces: Active repository guidance that no longer points frontend production release work at Vercel, plus env-file safety rules used by later Cloudflare tasks.

- [ ] **Step 1: Confirm current stale guidance**

Run:

```bash
rg -n "Vercel|vercel|VITE_CONVEX_SITE_URL|Production Release|Configuration & Security" AGENTS.md
```

Expected: output includes the current Vercel frontend release line and the `VITE_CONVEX_SITE_URL` line.

- [ ] **Step 2: Update `AGENTS.md` Production Release wording**

Replace the `frontend` bullet in `AGENTS.md` with:

```markdown
- `frontend` currently means: deploy the TanStack Start frontend to Cloudflare Workers, then run production smoke checks once that workflow exists. It does not call `wrangler deploy` directly yet.
```

Keep the existing deploy workflow availability warning:

```markdown
- The deploy workflow command is only valid once `.github/workflows/deploy.yml` exists on `main`; if it is absent, treat production release automation as not yet implemented and do not use this document as proof that the release chain is fixed.
```

- [ ] **Step 3: Update `AGENTS.md` Configuration & Security wording**

Replace:

```markdown
- Convex env holds JWT keys; Vercel only needs `VITE_CONVEX_URL` + `VITE_CONVEX_SITE_URL`.
```

With:

```markdown
- Convex env holds JWT keys and backend-only secrets. Cloudflare frontend builds need the public `VITE_CONVEX_URL`; do not expose `CONVEX_DEPLOY_KEY` or other backend secrets to browser bundles or plaintext Wrangler vars.
```

- [ ] **Step 4: Tighten ignored env files**

Change `.gitignore` so its env-related section contains these lines:

```gitignore
.env*
!.env.example
.dev.vars*
```

Keep existing ignore entries such as `node_modules`, `dist`, `.wrangler`, `.output`, `coverage/`, and `.worktrees/`.

- [ ] **Step 5: Add `.env.example`**

Create `.env.example` with exactly:

```bash
VITE_CONVEX_URL=https://example.convex.cloud
```

- [ ] **Step 6: Verify active guidance no longer points to Vercel**

Run:

```bash
rg -n "Vercel|vercel|VITE_CONVEX_SITE_URL" AGENTS.md README.md .env.example
```

Expected: no output.

- [ ] **Step 7: Verify env ignore behavior**

Run:

```bash
git check-ignore -v .env.local .env.production .dev.vars .dev.vars.production
git check-ignore -v .env.example || true
```

Expected:

- `.env.local`, `.env.production`, `.dev.vars`, and `.dev.vars.production` are ignored.
- `.env.example` is not ignored.

- [ ] **Step 8: Commit Task 1**

```bash
git add AGENTS.md .gitignore .env.example
git commit -m "docs: target cloudflare workers frontend release"
```

---

## Task 2: Add Cloudflare Tooling and Wrangler Baseline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `wrangler.jsonc`

**Interfaces:**
- Consumes: Task 1 env safety rules and Cloudflare frontend target guidance.
- Produces: Installed Cloudflare deployment tooling and a minimal Worker configuration that Task 3 can use during Vite build wiring.

- [ ] **Step 1: Install Cloudflare dev dependencies**

Run:

```bash
npm install --save-dev @cloudflare/vite-plugin wrangler
```

Expected:

- `package.json` includes `@cloudflare/vite-plugin` and `wrangler` under `devDependencies`.
- `package-lock.json` is updated.
- Command exits 0.

- [ ] **Step 2: Add Cloudflare npm scripts**

Update `package.json` scripts so the scripts object includes:

```json
{
  "deploy:cloudflare": "npm run build && wrangler deploy",
  "cf-typegen": "wrangler types"
}
```

Keep all existing scripts unchanged.

- [ ] **Step 3: Create `wrangler.jsonc`**

Create `wrangler.jsonc` with exactly:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "remotionhub",
  "compatibility_date": "2026-07-03",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry"
}
```

- [ ] **Step 4: Verify scripts and dependency metadata**

Run:

```bash
npm pkg get scripts.\"deploy:cloudflare\" scripts.\"cf-typegen\" devDependencies.\"@cloudflare/vite-plugin\" devDependencies.wrangler
```

Expected: output includes the two script values and version ranges for both dev dependencies.

- [ ] **Step 5: Verify Wrangler config parses**

Run:

```bash
npx wrangler types --dry-run
```

Expected: command exits 0 or prints Wrangler type generation help without requiring a Cloudflare login. If `--dry-run` is not supported by the installed Wrangler version, run:

```bash
npx wrangler types --help
```

Expected: command exits 0 and documents the `types` command.

- [ ] **Step 6: Commit Task 2**

```bash
git add package.json package-lock.json wrangler.jsonc
git commit -m "chore: add cloudflare workers tooling"
```

---

## Task 3: Wire Cloudflare Vite Plugin

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `@cloudflare/vite-plugin` from Task 2.
- Produces: Vite build configuration that targets Cloudflare Workers outside test mode while keeping Vitest config stable.

- [ ] **Step 1: Replace `vite.config.ts` with function-form config**

Update `vite.config.ts` to:

```ts
import { defineConfig, configDefaults } from 'vitest/config'
import { cloudflare } from '@cloudflare/vite-plugin'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const plugins = [
    devtools(),
    ...(mode === 'test' ? [] : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ]

  return {
    resolve: { tsconfigPaths: true },
    plugins,
    test: {
      exclude: [...configDefaults.exclude, '.worktrees/**'],
      coverage: {
        provider: 'v8',
        include: [
          'src/**/*.{ts,tsx}',
          'convex/**/*.{ts,tsx}',
          'shared/**/*.{ts,tsx}',
          'scripts/generate-catalog.ts',
          'scripts/import-catalog.ts',
        ],
        exclude: [
          '**/*.test.{ts,tsx}',
          '**/*.spec.{ts,tsx}',
          'src/routeTree.gen.ts',
          'convex/_generated/**',
          '**/*.d.ts',
        ],
        reporter: ['text', 'json', 'html'],
        thresholds: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  }
})
```

- [ ] **Step 2: Run unit tests**

Run:

```bash
npm run test
```

Expected: all Vitest unit and contract tests pass.

- [ ] **Step 3: Run typecheck and production build**

Run:

```bash
VITE_CONVEX_URL=https://example.invalid npm run ci:types-build
```

Expected: TypeScript check and Vite production build pass.

- [ ] **Step 4: Verify Cloudflare references are limited to intended files**

Run:

```bash
rg -n "cloudflare|Cloudflare|wrangler|Wrangler" vite.config.ts package.json package-lock.json wrangler.jsonc AGENTS.md specs/2026-07-03-cloudflare-workers-release-baseline-design.md
```

Expected: matches are limited to the Cloudflare baseline files and docs.

- [ ] **Step 5: Commit Task 3**

```bash
git add vite.config.ts
git commit -m "chore: wire cloudflare workers vite plugin"
```

---

## Task 4: Run Final Verification and Document Remaining Release Gaps

**Files:**
- Read: `AGENTS.md`
- Read: `.gitignore`
- Read: `.env.example`
- Read: `package.json`
- Read: `wrangler.jsonc`
- Read: `vite.config.ts`
- Read: `specs/2026-07-03-cloudflare-workers-release-baseline-design.md`

**Interfaces:**
- Consumes: Tasks 1 through 3.
- Produces: A verified local Cloudflare Workers release baseline and a clear handoff that production workflow, remote environment, DNS/TLS, and smoke remain separate tasks.

- [ ] **Step 1: Run intent skill check**

Run:

```bash
npx @tanstack/intent@latest list
```

Expected: command exits 0 and lists TanStack Start skills.

- [ ] **Step 2: Run main local verification gate**

Run:

```bash
make check
```

Expected: unit tests, catalog validation, TypeScript check, and production build pass.

- [ ] **Step 3: Run Cloudflare dry-run deploy check**

Run:

```bash
VITE_CONVEX_URL=https://example.invalid npx wrangler deploy --dry-run
```

Expected: Wrangler validates and builds the Worker without uploading a real deploy. If Wrangler requires Cloudflare login even for dry run, stop and record that local build/typecheck passed but dry-run upload validation needs authenticated Wrangler state.

- [ ] **Step 4: Confirm no real env or secret files are staged**

Run:

```bash
git status --short
git diff --cached --name-only
```

Expected: no `.env.local`, `.env.production`, `.dev.vars`, `.dev.vars.production`, `.wrangler`, or secret-containing files are staged.

- [ ] **Step 5: Confirm remaining release gaps are still explicit**

Run:

```bash
rg -n "deploy.yml|Production environment|DNS|TLS|production smoke|CONVEX_DEPLOY_KEY|Cloudflare API token" AGENTS.md specs/2026-07-03-cloudflare-workers-release-baseline-design.md
```

Expected: output confirms deploy workflow, GitHub `Production` environment, DNS/TLS, production smoke, and secret configuration are still documented as separate follow-up work.

- [ ] **Step 6: Commit final verification note only if files changed**

If no files changed during final verification, do not commit.

If verification required a small documentation correction, commit it:

```bash
git add AGENTS.md specs/2026-07-03-cloudflare-workers-release-baseline-design.md
git commit -m "docs: clarify cloudflare release baseline verification"
```

- [ ] **Step 7: Report final status**

Final response must include:

```markdown
Implemented Cloudflare Workers release baseline.

Verification:
- `npm run test`: <result>
- `VITE_CONVEX_URL=https://example.invalid npm run ci:types-build`: <result>
- `make check`: <result>
- `VITE_CONVEX_URL=https://example.invalid npx wrangler deploy --dry-run`: <result or blocker>

Remaining release work:
- `.github/workflows/deploy.yml`
- GitHub `Production` environment and secrets
- Cloudflare custom domains / DNS / TLS
- production smoke
- Convex backend production deploy path
```

---

## Self-Review Checklist

- Spec coverage:
  - Vercel active guidance replacement: Task 1.
  - Cloudflare Workers tooling: Task 2.
  - Wrangler baseline: Task 2.
  - Vite Cloudflare plugin: Task 3.
  - `VITE_CONVEX_URL` and Convex env boundary: Task 1.
  - Env file safety: Task 1.
  - No deploy workflow, DNS/TLS, production smoke, or real deploy: Global Constraints and Task 4.
  - Verification: Task 3 and Task 4.
- Placeholder scan: no placeholder instructions are present.
- Type and name consistency:
  - Script names are consistently `deploy:cloudflare` and `cf-typegen`.
  - Wrangler file is consistently `wrangler.jsonc`.
  - Cloudflare plugin call is consistently `cloudflare({ viteEnvironment: { name: 'ssr' } })`.
  - Convex variables are consistently `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, and `CONVEX_DEPLOY_KEY`.
