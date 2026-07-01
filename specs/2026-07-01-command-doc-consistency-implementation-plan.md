# Command Doc Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the active agent guidance with the repository's real npm, Makefile, and CI commands without changing executable release infrastructure.

**Architecture:** This is a documentation-only correction centered on `AGENTS.md`. The implementation replaces stale Bun and monorepo command guidance with the current npm and Makefile gates, while preserving the boundary that production release automation remains out of scope.

**Tech Stack:** Markdown, npm scripts, Makefile targets, GitHub Actions documentation.

---

## Scope and File Map

只修改当前会直接指导 agent 或维护者行动的文件：

- Modify: `AGENTS.md`
  - 负责仓库级 agent 指引、命令地图、提交/PR gate、生产发布注意事项。

不修改以下文件：

- `package.json`
- `Makefile`
- `.github/workflows/issue-5-security-quality.yml`
- `README.md`
- 任何 secrets、remote settings、deployment workflow 或 runtime source files

## Task 1: Confirm Command Baseline

**Files:**
- Read: `package.json`
- Read: `Makefile`
- Read: `.github/workflows/issue-5-security-quality.yml`
- Read: `AGENTS.md`

- [ ] **Step 1: Confirm available package scripts**

Run:

```bash
npm pkg get scripts
```

Expected: output includes `ci:unit`, `ci:types-build`, and `ci:playwright-smoke`; output does not include `ci:static`, `ci:packages`, or `ci:e2e-http`.

- [ ] **Step 2: Confirm available Makefile targets**

Run:

```bash
make help
```

Expected: output includes `check`, `e2e`, `smoke`, `typecheck`, and `build`.

- [ ] **Step 3: Confirm issue-5 workflow commands**

Run:

```bash
sed -n '1,120p' .github/workflows/issue-5-security-quality.yml
```

Expected: workflow runs `npm audit --omit=dev --audit-level=high` and `npm run ci:unit`.

## Task 2: Update `AGENTS.md` Command Map

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Extend the build and test command map**

In `AGENTS.md`, update `Build, Test, and Development Commands` so it includes the existing npm commands plus the current Makefile verification targets.

Use this command list as the target content:

```markdown
- `npm run dev` — foreground local app server at `http://localhost:3000`.
- `npm run build` — production build (Vite + Nitro SSR).
- `npm run preview` — preview production build locally.
- `npm run test` — Vitest test suite.
- `npm run coverage` — Vitest coverage suite; also used by `npm run ci:unit`.
- `npm run ci:unit` — CI coverage gate.
- `npm run ci:types-build` — TypeScript check plus production build.
- `npm run ci:playwright-smoke` — production build plus Playwright tests; requires the Playwright and backend prerequisites for the tested flow.
- `npm run generate-routes` — regenerate TanStack Router route tree (`routeTree.gen.ts`).
- `make check` — main local verification gate after dependencies are installed; runs tests, catalog validation, TypeScript check, and build with a stable placeholder Convex URL.
- `make e2e` / `make smoke` — local Convex-backed Playwright smoke path.
```

- [ ] **Step 2: Preserve dependency prerequisite wording**

Ensure `make check` is described as requiring installed dependencies. Do not describe it as a fresh-clone command unless paired with `npm ci` or `make install`.

## Task 3: Update Commit and PR Guidelines

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace the stale pre-handoff gate**

Replace the existing `bun run ci:static` paragraph with guidance that uses `make check`.

Use this target wording:

```markdown
- Before commit/PR handoff, run `make check` after dependencies are installed. This is the main local verification gate: unit tests, catalog validation, TypeScript check, and build. For faster inner loops, use targeted commands such as `npm run test`, `npm run catalog:validate`, `make typecheck`, or `make build`, but do not treat them as the final pre-handoff gate unless the change is docs-only or the user explicitly narrows verification.
```

- [ ] **Step 2: Replace source and runtime PR gate guidance**

Replace stale Bun and nonexistent script references in the source/test PR paragraph.

Use this target wording:

```markdown
- Before opening a PR for source or test changes, run the targeted tests for the touched behavior and `npm run ci:unit` unless the change is docs/config-only or the user explicitly asks to rely on CI. For runtime, build, or package changes, also run the matching broader gate when it covers the touched surface: `npm run ci:types-build`, `npm run ci:playwright-smoke`, `make e2e`, or `make smoke`.
```

- [ ] **Step 3: Replace monorepo TypeScript merge guidance**

Replace the `bunx tsc -p packages/...` paragraph with current single-app guidance.

Use this target wording:

```markdown
- Before merging any PR that touches TypeScript, build, runtime, or Convex code, verify TypeScript cleanly with `npm run ci:types-build` or the narrower `make typecheck` when build output is irrelevant. If Convex code changed, also run the repository typecheck/build path used before deploy so a later Convex deploy is not surprised by TypeScript failures.
```

## Task 4: Clarify Production Release Scope

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Avoid presenting missing deploy automation as proven**

In `Production Release`, keep the manual-only release boundary, but add a note that the workflow command depends on a real `deploy.yml` existing on `main`.

Use this target wording near the deploy command:

```markdown
- The deploy workflow command is only valid once `.github/workflows/deploy.yml` exists on `main`; if it is absent, treat production release automation as not yet implemented and do not use this document as proof that the release chain is fixed.
```

- [ ] **Step 2: Preserve non-goals**

Do not add new instructions for configuring GitHub environments, Vercel, Convex secrets, DNS, TLS, or production deployment execution.

## Task 5: Verify Documentation Consistency

**Files:**
- Read: `AGENTS.md`
- Read: `README.md`

- [ ] **Step 1: Run command discovery checks**

Run:

```bash
npx @tanstack/intent@latest list
npm pkg get scripts
make help
```

Expected: all commands exit 0.

- [ ] **Step 2: Search for stale active guidance**

Run:

```bash
rg -n "bun|ci:static|ci:packages|ci:e2e-http|packages/schema|packages/remotionhub" AGENTS.md README.md
```

Expected: no matches in active guidance. If a match remains, either remove it or justify it as a historical reference outside active guidance. For this task, `AGENTS.md` should have no matches for these patterns.

- [ ] **Step 3: Check Markdown diff**

Run:

```bash
git diff -- AGENTS.md
git diff --check
```

Expected: the diff only changes command documentation; whitespace check exits 0.

- [ ] **Step 4: Skip heavy tests for docs-only change**

Do not rerun `make check` unless implementation touches executable files. The design phase already verified `make check` after `npm ci`, and this task changes only Markdown guidance.

## Task 6: Commit Implementation

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Review final status**

Run:

```bash
git status --short
```

Expected: only `AGENTS.md` is modified.

- [ ] **Step 2: Commit the documentation fix**

Run:

```bash
git add AGENTS.md
git commit -m "docs: align agent command guidance"
```

Expected: commit succeeds with only `AGENTS.md` included.

## Final Verification Record

Implementation handoff should report:

- `npx @tanstack/intent@latest list`
- `npm pkg get scripts`
- `make help`
- stale-guidance `rg` command and result
- `git diff --check`

Do not claim the full production release chain is fixed. The completed scope is limited to command-documentation consistency.
