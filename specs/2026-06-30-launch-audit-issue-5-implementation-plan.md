# 上线审计问题 5 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 清除生产依赖的 Critical/High 漏洞，建立真实的 80% 全局覆盖率硬门禁，并启用 GitHub 仓库安全治理与 required checks。

**架构：** 使用一个有顺序依赖的实施计划完成三个可独立验证和回滚的阶段。先升级依赖，再通过可测试性边界和行为测试达到真实覆盖率，随后增加两个独立 GitHub checks；所有远端设置修改都在获得单独授权后执行。

**技术栈：** npm 11、Node.js 22、TypeScript 6、Vitest 4 with V8 coverage、React 19 Testing Library、Convex/convex-test、GitHub Actions、GitHub REST API。

---

## Scope and file map

该设计虽然包含三个风险面，但它们不是可任意并行的独立项目：workflow 必须引用已经可通过的审计和覆盖率命令，branch protection 又必须等待 workflow 产生稳定 check context。因此保留一个计划，使用阶段检查点隔离失败与回滚。

计划涉及以下文件：

- `package.json`：提高 Convex 最低版本。
- `package-lock.json`：锁定安全的 Convex、ws 和 undici 解析结果。
- `vite.config.ts`：定义 V8 coverage、真实 include/exclude 和最终四项 80% threshold。
- `.gitignore`：忽略本地 coverage 报告。
- `scripts/import-catalog.ts`、`scripts/import-catalog.test.ts`：分离可测试的导入核心与 CLI 入口。
- `scripts/generate-catalog.ts`、`scripts/generate-catalog.test.ts`：参数化文件系统、Git 和路径边界，覆盖生成行为。
- `convex/lib/catalog.test.ts`、`convex/components.test.ts`：覆盖版本选择、facets 和异常数据分支。
- `src/components/catalog/CatalogGrid.test.tsx`、`CopyButton.test.tsx`、`PreviewMedia.test.tsx`：覆盖加载、翻页、复制和媒体降级分支。
- `src/components/AppProviders.test.tsx`、`src/components/catalog/CatalogPageShell.test.tsx`、`src/router.test.tsx`、`src/routes/-routes.test.tsx`：覆盖应用装配和路由薄层。
- `.github/workflows/issue-5-security-quality.yml`：提供两个稳定、独立的 required checks。
- `specs/2026-06-30-launch-audit-issue-5-design.md`：只在实现发现已批准设计与实际不一致时更新事实说明。

未经用户明确授权，不执行 commit、push、PR、GitHub 设置修改或 secret 轮换。

### Task 1: Record immutable baselines

**Files:**
- Read: `package.json`
- Read: `package-lock.json`
- Read: `vite.config.ts`
- Read: `specs/2026-06-30-launch-audit-issue-5-design.md`

- [ ] **Step 1: Confirm a clean implementation starting point**

Run:

```bash
git status --short --branch
git diff --check
```

Expected: only the approved design and implementation-plan documents are untracked or modified; no source, dependency, workflow, or generated coverage files are present.

- [ ] **Step 2: Capture dependency and audit baselines without mutation**

Run:

```bash
npm ls convex ws undici --all
npm audit --omit=dev --audit-level=high
```

Expected baseline: `convex@1.41.0`, nested `ws@8.20.1`, `undici@7.27.2`, and 3 High findings. Save terminal output in the execution record, not in the repository.

- [ ] **Step 3: Capture test and strict coverage baselines**

Run the existing test suite, then the exact future coverage boundary through CLI flags:

```bash
npm run test
npx vitest run --exclude 'e2e/**' --coverage \
  --coverage.provider=v8 \
  --coverage.include='src/**/*.{ts,tsx}' \
  --coverage.include='convex/**/*.{ts,tsx}' \
  --coverage.include='shared/**/*.{ts,tsx}' \
  --coverage.include='scripts/generate-catalog.ts' \
  --coverage.include='scripts/import-catalog.ts' \
  --coverage.exclude='**/*.test.{ts,tsx}' \
  --coverage.exclude='**/*.spec.{ts,tsx}' \
  --coverage.exclude='src/routeTree.gen.ts' \
  --coverage.exclude='convex/_generated/**' \
  --coverage.exclude='**/*.d.ts'
rm -rf coverage
```

Expected: 15 test files and 58 tests pass. Strict baseline is approximately Statements 57.53%, Branches 50%, Functions 57.14%, Lines 58.37%. The explicit `--exclude 'e2e/**'` is required so Vitest does not collect Playwright tests.

- [ ] **Step 4: Record unrelated failure signatures**

Run:

```bash
npm run ci:types-build
```

Expected: either success or the already-known issue 1/2 failures. Record exact file, line, and error text. Do not edit those files in this task.

### Task 2: Upgrade the vulnerable dependency chain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Verify published compatibility metadata**

Run:

```bash
npm view convex@1.42.1 dependencies peerDependencies engines --json
npm view convex-test@0.0.53 peerDependencies --json
npm view undici@7.28.0 version engines --json
```

Expected: Convex depends on `ws@8.21.0`, supports Node >=18 and React 19; convex-test declares `convex ^1.32.0`; undici 7.28.0 exists.

- [ ] **Step 2: Update only the approved direct dependency and affected lock entries**

Run:

```bash
npm install --package-lock-only --ignore-scripts 'convex@^1.42.1'
npm update --package-lock-only --ignore-scripts undici
git diff -- package.json package-lock.json
```

Expected: `package.json` changes only `convex` from `^1.41.0` to `^1.42.1`; lockfile resolves Convex 1.42.1, its ws 8.21.0, and undici 7.28.0. Reject and redo the lock update if unrelated direct dependencies move.

- [ ] **Step 3: Materialize and validate the new lockfile**

Run:

```bash
npm ci
npm ls convex ws undici --all
npm audit --omit=dev --audit-level=high
```

Expected: dependency tree is valid and the audit exits 0 with no Critical/High findings. Moderate/Low findings, if any, are recorded but do not fail this gate.

- [ ] **Step 4: Run compatibility checks**

Run:

```bash
npm run test -- convex/components.test.ts
npm run test
npm run ci:types-build
```

Expected: Convex and full unit tests pass. `ci:types-build` must introduce no failure beyond Task 1's recorded issue 1/2 signatures. If convex-test fails specifically against 1.42.1, inspect `convex-test@0.0.54`; do not add an override.

- [ ] **Step 5: Preserve the verified dependency diff without committing**

Run `git diff --check` and leave the dependency changes unstaged. Commit authorization is requested once, after the complete local change set passes autoreview in Task 8.

### Task 3: Establish the real V8 coverage boundary

**Files:**
- Modify: `vite.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add the exact coverage configuration without thresholds**

Add this `coverage` object inside the existing `test` block:

```ts
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
},
```

Append the generated report directory to `.gitignore`:

```gitignore
coverage/
```

- [ ] **Step 2: Prove uncovered files are included**

Run:

```bash
npm run coverage
node -e "const c=require('./coverage/coverage-final.json'); const files=Object.keys(c); for (const suffix of ['convex/lib/catalog.ts','scripts/generate-catalog.ts','scripts/import-catalog.ts','src/routes/about.tsx']) { if (!files.some((file) => file.endsWith(suffix))) throw new Error('missing '+suffix); }"
git status --short
```

Expected: coverage still reports approximately 57.53/50/57.14/58.37; all four probe files exist in JSON; `coverage/` does not appear in Git status.

### Task 4: Make catalog import behavior testable and cover its branches

**Files:**
- Create: `scripts/import-catalog.test.ts`
- Modify: `scripts/import-catalog.ts`

- [ ] **Step 1: Write failing tests for argument and environment handling**

The new test file must import these public boundaries, which do not exist yet:

```ts
import {
  loadLocalEnv,
  parseArgs,
  readCatalogFiles,
  runImportCatalog,
  toImportPayload,
} from './import-catalog'
```

Add cases with these exact expectations:

```ts
expect(parseArgs([])).toEqual({
  apply: false,
  dryRun: true,
  localOnly: false,
  target: 'dev',
})
expect(parseArgs(['--apply', '--target=production'])).toEqual({
  apply: true,
  dryRun: false,
  localOnly: false,
  target: 'production',
})
expect(parseArgs(['--apply', '--dry-run', '--local-only'])).toMatchObject({
  apply: true,
  dryRun: true,
  localOnly: true,
})
```

Use a temporary directory to verify `loadLocalEnv` ignores comments and malformed lines, strips surrounding quotes, preserves an existing environment value, tolerates a missing file, and propagates a non-ENOENT read error. Verify `readCatalogFiles` ignores non-JSON files and returns JSON files in lexical order.

The exported signatures are fixed as:

```ts
export async function loadLocalEnv(
  env: NodeJS.ProcessEnv = process.env,
  envPath = path.resolve('.env.local'),
): Promise<void>

export async function readCatalogFiles(
  directory = path.resolve('catalog/components'),
): Promise<Array<{ filePath: string; json: unknown }>>
```

- [ ] **Step 2: Run the focused test and confirm the missing-export failure**

Run:

```bash
npm run test -- scripts/import-catalog.test.ts
```

Expected: FAIL because the five named functions are not exported and importing the module currently executes `main()`.

- [ ] **Step 3: Introduce an injectable import boundary**

Export the existing pure functions and replace direct process/client coupling with this interface:

```ts
export type ImportCatalogDependencies = {
  env: NodeJS.ProcessEnv
  loadEnv: () => Promise<void>
  readFiles: () => Promise<Array<{ filePath: string; json: unknown }>>
  createClient: (url: string) => Pick<ConvexHttpClient, 'mutation'>
  log: (message: string) => void
}

export async function runImportCatalog(
  argv: string[],
  dependencies: ImportCatalogDependencies,
) {
  await dependencies.loadEnv()
  const args = parseArgs(argv)
  const configuredConvexUrl =
    dependencies.env.CONVEX_URL ?? dependencies.env.VITE_CONVEX_URL
  const importSecret = dependencies.env.CATALOG_IMPORT_SECRET
  const willWrite = args.apply && !args.dryRun && !args.localOnly

  if (willWrite && !configuredConvexUrl) {
    throw new Error('CONVEX_URL or VITE_CONVEX_URL is required for --apply.')
  }
  if (willWrite && !importSecret) {
    throw new Error('CATALOG_IMPORT_SECRET is required for --apply.')
  }
  if (willWrite && args.target === 'production' && !dependencies.env.CONVEX_DEPLOY_KEY) {
    throw new Error('CONVEX_DEPLOY_KEY is required for production imports.')
  }

  const files = await dependencies.readFiles()
  const payloads = files.map(({ filePath, json }) =>
    toImportPayload(catalogComponentSchema.parse(json), filePath, importSecret ?? ''),
  )
  dependencies.log(`Validated ${payloads.length} catalog component(s).`)

  if (args.dryRun || args.localOnly) {
    dependencies.log('Dry-run complete. No Convex writes performed.')
    return
  }

  const client = dependencies.createClient(configuredConvexUrl as string)
  for (const payload of payloads) {
    await client.mutation(api.components.importCatalogComponent, payload)
  }
}
```

Create default dependencies in the same file and guard the CLI with `pathToFileURL`, matching `generate-catalog.ts`, so tests can import without executing:

```ts
import { pathToFileURL } from 'node:url'

const defaultDependencies: ImportCatalogDependencies = {
  env: process.env,
  loadEnv: () => loadLocalEnv(),
  readFiles: () => readCatalogFiles(),
  createClient: (url) => new ConvexHttpClient(url),
  log: (message) => console.log(message),
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runImportCatalog(process.argv.slice(2), defaultDependencies).catch(
    (error: unknown) => {
      console.error(error)
      process.exitCode = 1
    },
  )
}
```

- [ ] **Step 4: Test payload and write-safety branches**

Define the test helper explicitly so no production environment or client is used:

```ts
function runWith(argv: string[], env: NodeJS.ProcessEnv) {
  return runImportCatalog(argv, {
    env,
    loadEnv: vi.fn(async () => undefined),
    readFiles: vi.fn(async () => []),
    createClient: vi.fn(() => ({ mutation: vi.fn() })),
    log: vi.fn(),
  })
}
```

Add tests that assert:

```ts
await expect(runWith([], {})).resolves.toBeUndefined()
await expect(runWith(['--apply'], {})).rejects.toThrow('CONVEX_URL')
await expect(runWith(['--apply'], { CONVEX_URL: 'https://example.invalid' }))
  .rejects.toThrow('CATALOG_IMPORT_SECRET')
await expect(runWith(['--apply', '--target=production'], {
  CONVEX_URL: 'https://example.invalid',
  CATALOG_IMPORT_SECRET: 'test-secret',
})).rejects.toThrow('CONVEX_DEPLOY_KEY')
```

Use a valid in-memory catalog fixture to verify both publisher-display-name branches, pinned and unpinned GitHub commit branches, dry-run creating no client, local-only creating no client, and apply invoking one mutation per payload in sorted file order.

- [ ] **Step 5: Verify the focused behavior and operational dry-run**

Run:

```bash
npm run test -- scripts/import-catalog.test.ts
npm run catalog:validate
```

Expected: focused tests pass; catalog validation reports the catalog count and explicitly reports no Convex writes.

### Task 5: Cover catalog generation without real external services

**Files:**
- Modify: `scripts/generate-catalog.ts`
- Modify: `scripts/generate-catalog.test.ts`

- [ ] **Step 1: Write failing tests for configuration and generation**

Add imports for the intended public boundary:

```ts
import {
  generateCatalogEntry,
  parseGenerateOptions,
  resolveAssetCommit,
} from './generate-catalog'
```

Assert CLI options override environment values and that no-slug input throws `Please specify slugs to generate.`. Build a temporary Git repository containing:

```text
remotion/logo-reveal/remotionhub.asset.json
remotion/logo-reveal/src/LogoReveal.tsx
remotion/logo-reveal/src/runtime-assets.ts
```

Use a temporary Markdown directory and output directory; do not write to `catalog/components`.

- [ ] **Step 2: Run the focused test and verify the missing-boundary failure**

Run:

```bash
npm run test -- scripts/generate-catalog.test.ts
```

Expected: FAIL because `parseGenerateOptions` and `generateCatalogEntry` are not exported.

- [ ] **Step 3: Parameterize path and Git dependencies**

Introduce this configuration type and remove import-time reads of argv/environment:

```ts
export type GenerateOptions = {
  assetRepo: string
  sourceMdDir: string
  targetDir: string
  assetCommit?: string
  slugs: string[]
}

export function parseGenerateOptions(
  argv: string[],
  env: NodeJS.ProcessEnv,
): GenerateOptions {
  const get = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  return {
    assetRepo:
      get('asset-repo') ?? env.REMOTIONHUB_ASSET_REPO ??
      '/Users/tangwz/workspace/git/remotionhub-assets',
    sourceMdDir:
      get('source-md-dir') ?? env.REMOTIONLAB_SOURCE_MD_DIR ?? '/tmp/remotionlab/案例',
    targetDir: get('target-dir') ?? 'catalog/components',
    assetCommit: get('asset-commit'),
    slugs: argv.filter((arg) => !arg.startsWith('--')),
  }
}
```

Change helper functions to receive `GenerateOptions` rather than module globals. Export `generateCatalogEntry(slug, commit, options)` and keep the existing direct-execution guard.

- [ ] **Step 4: Cover generator behavior branches**

Using real temporary Git repositories and files, add cases for:

- clean symbolic ref resolution and dirty-repository rejection;
- worktree manifest versus pinned-commit manifest;
- `displayNameZh` from manifest versus Markdown fallback;
- missing Markdown title rejection;
- missing asset path rejection;
- runtime-assets present versus absent usage text;
- all category prefixes plus `other`;
- tag match plus minimal fallback;
- generated JSON containing immutable commit, pinned asset path, localized summary, and no writes outside the temporary target.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- scripts/generate-catalog.test.ts
```

Expected: all generator tests pass without network access or writes under the repository catalog directory.

### Task 6: Cover domain, component, application, and route branches

**Files:**
- Create: `convex/lib/catalog.test.ts`
- Modify: `convex/components.test.ts`
- Modify: `src/components/catalog/CatalogGrid.test.tsx`
- Create: `src/components/catalog/CopyButton.test.tsx`
- Create: `src/components/catalog/PreviewMedia.test.tsx`
- Create: `src/components/AppProviders.test.tsx`
- Create: `src/components/catalog/CatalogPageShell.test.tsx`
- Create: `src/router.test.tsx`
- Create: `src/routes/-routes.test.tsx`

- [ ] **Step 1: Add pure Convex catalog tests**

Test the complete decision table:

```ts
const stableAndPrerelease = [
  { _id: 'stable-id', version: '1.10.0', createdAt: 1 },
  { _id: 'prerelease-id', version: '2.0.0-beta.1', createdAt: 2 },
] as Array<Pick<Doc<'componentVersions'>, '_id' | 'version' | 'createdAt'>>
const prereleaseOnly = [
  { _id: 'alpha-id', version: '2.0.0-alpha.1', createdAt: 1 },
  { _id: 'beta-id', version: '2.0.0-beta.1', createdAt: 2 },
] as Array<Pick<Doc<'componentVersions'>, '_id' | 'version' | 'createdAt'>>

expect(isActiveStatus('published')).toBe(true)
expect(isActiveStatus('unlisted')).toBe(false)
expect(isPrereleaseVersion('2.0.0-beta.1')).toBe(true)
expect(isPrereleaseVersion('2.0.0')).toBe(false)
expect(chooseLatestVersionDoc([])).toBeNull()
expect(chooseLatestVersionDoc(stableAndPrerelease)?.version).toBe('1.10.0')
expect(chooseLatestVersionDoc(prereleaseOnly)?.latestIsPrerelease).toBe(true)
```

Construct typed fixture documents with `as Doc<'components'>` only at the fixture boundary, then verify `buildLatestVersionSummary` and `buildDigestDoc`, including the default `latestIsPrerelease: false` branch.

- [ ] **Step 2: Extend Convex integration branches**

Add tests to `convex/components.test.ts` for:

```ts
const allFacets = await t.query(api.components.getCatalogFacets, {})
expect(allFacets.categories).toEqual({ card: 1 })
expect(allFacets.tags).toEqual({ personal: 1, minimal: 1 })

const remotionFacets = await t.query(api.components.getCatalogFacets, {
  runtime: 'remotion',
})
expect(remotionFacets).toEqual(allFacets)
```

Also cover removed/draft detail returning null, an explicit missing version returning null, and a compatible tag-only update where source provenance exists and receives the new fingerprint.

- [ ] **Step 3: Extend CatalogGrid state coverage**

Use the existing mocked `queryState` and a controllable `MockIntersectionObserver`. Add cases for undefined facets, combined intro/outro counts, category selection mapping to `['intro', 'outro']`, `LoadingFirstPage`, `LoadingMore`, `CanLoadMore`, intersecting versus non-intersecting entries, observer disconnect, and exhausted non-empty state.

Representative assertions:

```ts
let observerCallback: IntersectionObserverCallback
const disconnect = vi.fn()
const observer = { disconnect } as unknown as IntersectionObserver

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback
  }
  disconnect = disconnect
  observe = vi.fn()
  unobserve = vi.fn()
}

expect(screen.getAllByTestId('skeleton')).toHaveLength(6)
expect(screen.getByText('Loading more…')).toBeTruthy()
observerCallback([{ isIntersecting: false } as IntersectionObserverEntry], observer)
expect(loadMore).not.toHaveBeenCalled()
observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], observer)
expect(loadMore).toHaveBeenCalledWith(12)
```

- [ ] **Step 4: Add CopyButton and PreviewMedia behavior tests**

Mock `navigator.clipboard.writeText` and `sonner.toast.success`; verify default and explicit labels and that success toast occurs only after the write resolves. For PreviewMedia, cover image, video, custom aria-label, missing media fallback, image error fallback, video error fallback, and empty-title fallback initial.

- [ ] **Step 5: Add composition and route thin-layer tests**

Mock external providers rather than their internals. Verify:

- `AppProviders` nests Convex, I18n, children, and Toaster once;
- `CatalogPageShell` renders the supplied heading and children;
- `getRouter()` calls TanStack Router with `scrollRestoration: true`, `defaultPreload: 'intent'`, and `defaultPreloadStaleTime: 0`;
- root and catalog route head functions return the documented titles/descriptions;
- both detail loaders pass runtime, owner, and slug to Convex;
- missing detail calls `notFound()`;
- detail head functions cover loader data present and absent.

- [ ] **Step 6: Run all focused additions**

Run:

```bash
npm run test -- \
  convex/lib/catalog.test.ts \
  convex/components.test.ts \
  scripts/import-catalog.test.ts \
  scripts/generate-catalog.test.ts \
  src/components/catalog/CatalogGrid.test.tsx \
  src/components/catalog/CopyButton.test.tsx \
  src/components/catalog/PreviewMedia.test.tsx \
  src/components/AppProviders.test.tsx \
  src/components/catalog/CatalogPageShell.test.tsx \
  src/router.test.tsx \
  src/routes/-routes.test.tsx
```

Expected: all listed tests pass with no external network, Convex deployment, or persistent catalog writes.

### Task 7: Enable and prove the 80% hard threshold

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Run coverage before enabling thresholds**

Run:

```bash
npm run coverage
```

Expected: Statements, Branches, Functions, and Lines are each at least 80%. If any metric is lower, stop: do not change include/exclude. Use the Task 4-6 decision tables to identify the missed named branch and add its behavior assertion before continuing.

- [ ] **Step 2: Add all four thresholds atomically**

Add to the existing coverage object:

```ts
thresholds: {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
},
```

- [ ] **Step 3: Prove the gate passes and detects regression**

Run:

```bash
npm run ci:unit
npx vitest run --exclude 'e2e/**' --coverage --coverage.thresholds.branches=100
```

Expected: `ci:unit` exits 0 with all four metrics >=80; the deliberate 100% branch override exits non-zero with a threshold failure. Do not retain the CLI override anywhere.

- [ ] **Step 4: Run source verification**

Run:

```bash
npm run test
npm run ci:types-build
git diff --check
git status --short
```

Expected: tests and coverage-related checks pass with no new type/build failures beyond Task 1. Leave the verified changes unstaged until Task 8's review and authorization checkpoint.

### Task 8: Add isolated GitHub checks

**Files:**
- Create: `.github/workflows/issue-5-security-quality.yml`

- [ ] **Step 1: Create the workflow exactly**

```yaml
name: Issue 5 Security and Quality

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  production-audit:
    name: Issue 5 / Production audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm audit --omit=dev --audit-level=high

  unit-coverage:
    name: Issue 5 / Unit coverage
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run ci:unit
```

- [ ] **Step 2: Reproduce both jobs locally under Node 22**

Run in a Node 22 shell:

```bash
node --version
npm ci
npm audit --omit=dev --audit-level=high
npm run ci:unit
```

Expected: Node reports v22.x and both gates exit 0.

- [ ] **Step 3: Run repository-required review and handoff gates**

Invoke `$autoreview` on the complete local diff and address accepted findings until none remain. Then run:

```bash
VITE_CONVEX_URL=https://example.invalid bun run coverage
bun run ci:static
```

Expected: coverage passes. `ci:static` must pass before a commit/PR handoff; if the current branch lacks that script, record the exact pre-existing command-map mismatch and ask the user whether handoff may rely on the isolated issue-5 checks instead.

- [ ] **Step 4: Pause for commit/push/PR authorization**

The check contexts cannot exist remotely until the workflow is committed and pushed. If authorized:

```bash
git add package.json package-lock.json
git commit -m 'fix: update vulnerable production dependencies'
git add .gitignore vite.config.ts scripts convex src
git commit -m 'test: enforce global coverage threshold'
git add .github/workflows/issue-5-security-quality.yml
git commit -m 'ci: enforce security and coverage gates'
git push
```

Open or update a PR only if separately authorized. Confirm both checks succeed on the exact target SHA before Task 9.

### Task 9: Enable GitHub security settings and branch protection

**Files:**
- No repository file changes
- External state: `remotionhub/remotionhub` GitHub settings

- [ ] **Step 1: Hard stop for remote-state authorization**

Request explicit approval to modify secret scanning, push protection, Dependabot security updates, and `main` branch protection. Do not execute later steps without that approval.

- [ ] **Step 2: Snapshot current settings to ignored temporary files**

Run:

```bash
gh api repos/remotionhub/remotionhub > .tmp-issue-5-repo.json
gh api repos/remotionhub/remotionhub/branches/main/protection \
  > .tmp-issue-5-protection.json 2> .tmp-issue-5-protection.err || true
gh api repos/remotionhub/remotionhub/automated-security-fixes \
  > .tmp-issue-5-dependabot.json
```

Expected baseline: secret scanning and push protection disabled, automated security fixes disabled, and branch protection absent.

- [ ] **Step 3: Enable secret scanning only**

Run:

```bash
gh api --method PATCH repos/remotionhub/remotionhub --input - <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" }
  }
}
JSON
```

Expected: repository response reports `secret_scanning.status` as `enabled`.

- [ ] **Step 4: Enumerate and resolve historical alerts without exposing secrets**

Run:

```bash
gh api --method GET --paginate \
  repos/remotionhub/remotionhub/secret-scanning/alerts \
  -f state=open \
  --jq '.[] | {number, secret_type_display_name, state, resolution, created_at}'
```

Expected: no secret value appears in captured output. For each alert, pause for provider-specific rotation/revocation authorization. After the provider confirms the old credential is invalid, resolve it as `revoked`; resolve verified false positives with `false_positive`. Use a non-sensitive explanation:

```bash
read -r alert_number
gh api --method PATCH \
  "repos/remotionhub/remotionhub/secret-scanning/alerts/$alert_number" \
  -f state=resolved \
  -f resolution=revoked \
  -f resolution_comment='Credential revoked and invalidation verified during launch audit issue 5.'
```

Do not proceed while any valid credential remains active or any false positive lacks evidence.

- [ ] **Step 5: Enable push protection and Dependabot security updates**

Run only after open secret alerts are zero and the production audit is green:

```bash
gh api --method PATCH repos/remotionhub/remotionhub --input - <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON
gh api --method PUT repos/remotionhub/remotionhub/automated-security-fixes
```

- [ ] **Step 6: Create minimal branch protection with the two stable contexts**

Run only after both contexts have succeeded on the target SHA:

```bash
gh api --method PUT repos/remotionhub/remotionhub/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Issue 5 / Production audit",
      "Issue 5 / Unit coverage"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```

- [ ] **Step 7: Verify final remote state**

Run:

```bash
gh api repos/remotionhub/remotionhub \
  --jq '.security_and_analysis | {secret_scanning, secret_scanning_push_protection, dependabot_security_updates}'
gh api --method GET --paginate \
  repos/remotionhub/remotionhub/secret-scanning/alerts \
  -f state=open --jq 'length'
gh api repos/remotionhub/remotionhub/branches/main/protection \
  --jq '{required_status_checks, enforce_admins, allow_force_pushes, allow_deletions}'
```

Expected: all three security features enabled, open alert count 0, both required contexts present, admin enforcement enabled, force pushes and deletion disabled.

### Task 10: Final verification and rollback record

**Files:**
- Verify all files listed in the file map

- [ ] **Step 1: Run the complete issue-5 verification matrix**

```bash
npm ls convex ws undici --all
npm audit --omit=dev --audit-level=high
npm run test
npm run ci:unit
npm run ci:types-build
git diff --check
git status --short
```

Expected: audit and tests pass; all four coverage metrics are >=80; no new type/build failures beyond the immutable Task 1 baseline; no generated coverage files are tracked.

- [ ] **Step 2: Compare scope against the approved design**

Run:

```bash
git diff --stat
git diff -- package.json package-lock.json vite.config.ts .gitignore scripts convex src .github
```

Expected: no changes to issue 1/2 code, retired scripts, deployment configuration, public API contracts, or unrelated dependencies.

- [ ] **Step 3: Record rollback commands without executing them**

Dependency and coverage code rollback uses a normal revert of the authorized commits; do not rewrite history. Remote rollback, only if required and explicitly approved, restores the saved baseline by deleting the newly created branch protection and disabling only the settings that were disabled in Task 9's snapshot:

```bash
gh api --method DELETE repos/remotionhub/remotionhub/branches/main/protection
gh api --method DELETE repos/remotionhub/remotionhub/automated-security-fixes
gh api --method PATCH repos/remotionhub/remotionhub --input - <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "disabled" },
    "secret_scanning_push_protection": { "status": "disabled" }
  }
}
JSON
```

Never restore revoked credentials. Any temporary gate bypass requires an audit note and immediate restoration after GitHub/npm service recovery.
