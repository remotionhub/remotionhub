# yt-* Assets Migration Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 blocking issues across 113 yt-* Remotion assets so they become mergeable, installable, independently renderable, and traceably published.

**Architecture:** Two-repo repair following spec phases. Assets repo gets infrastructure fixes first (AST parsing, runtime media, validation), then data fixes (durations, media upload, 5 missing assets). Main repo regenerates catalogs from the final assets commit. All work happens in existing feature worktrees.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, TS compiler API, ali-oss, Remotion CLI

**Worktrees:**
- Assets: `/Users/tangwz/workspace/git/remotionhub-assets/.worktrees/feat-migrate-yt-animation-assets`
- Main: `/Users/tangwz/workspace/git/remotionhub/.worktrees/feat-animation-category-i18n`

**Spec:** `specs/2026-06-25-remotionhub-yt-assets-migration-repair.md`

---

## Task 1: Fix lint errors in assets repo

**Covers:** §2.2.5

**Files:**
- Modify: `scripts/run-migration-pipeline.ts` (remove unused import)
- Modify: `scripts/scaffold-batch.ts` (fix invalid regex escape)

The dirty worktree already has these fixes partially. Verify and commit.

- [ ] **Step 1: Check current lint status**

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets/.worktrees/feat-migrate-yt-animation-assets
npm run lint 2>&1 | head -40
```

- [ ] **Step 2: Fix lint errors**

Read `scripts/run-migration-pipeline.ts` and `scripts/scaffold-batch.ts`, fix unused imports and invalid regex escapes.

- [ ] **Step 3: Run lint to verify**

```bash
npm run lint
```
Expected: PASS

- [ ] **Step 4: Run format check**

```bash
npm run format:check
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/run-migration-pipeline.ts scripts/scaffold-batch.ts
git commit -m "fix: resolve lint errors in migration scripts"
```

---

## Task 2: Add canonical slug list file

**Covers:** §2.2.6, §4.6

**Files:**
- Create: `manifest/yt-animation-slugs.json`

Create a single machine-readable source of truth for the 113 yt-* slugs. All scripts will read from this file instead of maintaining separate lists.

- [ ] **Step 1: Create the canonical slug file**

Write `manifest/yt-animation-slugs.json` with the exact 113 slugs from spec §4.6, sorted alphabetically:

```json
[
  "yt-acq-ret-ref",
  "yt-ai-not-understand",
  "yt-ai-reads-only",
  "yt-ai-report-doubt",
  "yt-ai-skill-network",
  "yt-ai-use-cases",
  "yt-ai-wrappers-dead",
  "yt-animation-suffice",
  "yt-arcade-beat-em-up",
  "yt-ask-ai-tip",
  "yt-audio-add-vocals",
  "yt-audio-complex-pop-question",
  "yt-audio-control",
  "yt-audio-fast-results",
  "yt-audio-lets-start",
  "yt-audio-prompt-skill",
  "yt-audio-rock-remix",
  "yt-audio-software-criteria",
  "yt-brand-value-stripped",
  "yt-bug-fix-loop",
  "yt-build-stability",
  "yt-build-trust-first",
  "yt-can-do-animation",
  "yt-char-animations",
  "yt-cloudflare-api-key",
  "yt-code-controls",
  "yt-connection-recap-outro",
  "yt-consistent-output",
  "yt-core-dist-card",
  "yt-core-flow",
  "yt-customize-own",
  "yt-deploy-cloudflare",
  "yt-dev-flow-intro",
  "yt-dev-flow-steps",
  "yt-distribution-first",
  "yt-distribution-hard",
  "yt-easy-channel-hard-dist",
  "yt-engine-abilities",
  "yt-engine-criteria",
  "yt-equity-design",
  "yt-exclusive-app",
  "yt-execute-validate",
  "yt-experiment-conclusion",
  "yt-extract-tool",
  "yt-far-stranger-pains",
  "yt-far-strangers",
  "yt-far-to-near",
  "yt-faster-higher-quality",
  "yt-first-deal-hard",
  "yt-first-version",
  "yt-focus-one-topic",
  "yt-four-ai-tools",
  "yt-from-scratch",
  "yt-game-mashup",
  "yt-generic-chatbot",
  "yt-generic-means-lacking",
  "yt-growth-24",
  "yt-idea-check",
  "yt-idea-feasibility",
  "yt-influencer-dms",
  "yt-inside-the-problem",
  "yt-iterate-two-days",
  "yt-like-subscribe-bell",
  "yt-line-phase-intro",
  "yt-magazine-layout",
  "yt-manual-first",
  "yt-mcp-chapter-card",
  "yt-mcp-pipeline",
  "yt-mid-ask-experts",
  "yt-mobile-patience",
  "yt-narrative-redesign",
  "yt-near-self-friends",
  "yt-no-3d-needed",
  "yt-not-about-analysis",
  "yt-not-just-effects",
  "yt-not-that-simple",
  "yt-page-scroll-metrics",
  "yt-pencil-intro",
  "yt-product-overflow",
  "yt-prompt-dev",
  "yt-prompt-spec",
  "yt-reach-pain-points",
  "yt-rejected-ideas",
  "yt-report-transform",
  "yt-scatter-shot",
  "yt-service-first",
  "yt-shadcn-prompt",
  "yt-shadcn-results",
  "yt-shortest-path",
  "yt-simple-ai-product",
  "yt-skill-showcase",
  "yt-solve-first-point",
  "yt-start-small",
  "yt-start-with-service",
  "yt-success-path",
  "yt-svg-cards",
  "yt-tailor-for-audience",
  "yt-tech-boosts-stability",
  "yt-think-distribution",
  "yt-three-dimensions",
  "yt-three-questions",
  "yt-too-many-coincidences",
  "yt-tool-selection",
  "yt-tool-showcase",
  "yt-trust-is-currency",
  "yt-trust-transfer",
  "yt-two-errors-detail",
  "yt-two-focus",
  "yt-two-lessons",
  "yt-user-iterate",
  "yt-version-2-card",
  "yt-version-3-card",
  "yt-zero-revenue"
]
```

- [ ] **Step 2: Verify count**

```bash
python3 -c "import json; d=json.load(open('manifest/yt-animation-slugs.json')); print(len(d), len(set(d)))"
```
Expected: `113 113`

- [ ] **Step 3: Commit**

```bash
git add manifest/yt-animation-slugs.json
git commit -m "feat: add canonical yt animation slug inventory"
```

---

## Task 3: Create composition metadata parser (AST-based)

**Covers:** §2.2.4, §3.2, §4.1

**Files:**
- Create: `scripts/lib/compositionMetadata.ts`
- Create: `scripts/lib/compositionMetadata.test.ts`

Use TypeScript compiler API to:
1. Find exported `*_DURATION_FRAMES` constants from component source files
2. Require exactly one positive integer candidate
3. Provide manifest/Root/source consistency checks

- [ ] **Step 1: Write failing tests**

Create `scripts/lib/compositionMetadata.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { parseDurationFrames, assertDurationConsistency } from './compositionMetadata'

async function writeTempFile(name: string, content: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'comp-meta-'))
  const filePath = path.join(dir, name)
  await fs.writeFile(filePath, content, 'utf8')
  return filePath
}

describe('parseDurationFrames', () => {
  it('parses a single exported duration constant', async () => {
    const filePath = await writeTempFile('comp.tsx', `
      export const MY_DURATION_FRAMES = 240;
      export const Component = () => null;
    `)
    const result = parseDurationFrames(filePath)
    expect(result).toEqual({ name: 'MY_DURATION_FRAMES', value: 240, filePath })
  })

  it('throws when no duration constant found', async () => {
    const filePath = await writeTempFile('comp.tsx', `
      export const Component = () => null;
    `)
    expect(() => parseDurationFrames(filePath)).toThrow(/no .*DURATION_FRAMES/i)
  })

  it('throws when multiple duration constants found', async () => {
    const filePath = await writeTempFile('comp.tsx', `
      export const A_DURATION_FRAMES = 120;
      export const B_DURATION_FRAMES = 240;
    `)
    expect(() => parseDurationFrames(filePath)).toThrow(/multiple/i)
  })

  it('throws when value is not a positive integer', async () => {
    const filePath = await writeTempFile('comp.tsx', `
      export const MY_DURATION_FRAMES = 0;
    `)
    expect(() => parseDurationFrames(filePath)).toThrow(/positive integer/i)
  })
})

describe('assertDurationConsistency', () => {
  it('passes when all durations match', () => {
    expect(() => assertDurationConsistency({
      slug: 'test',
      manifestDuration: 240,
      rootDuration: 240,
      sourceDuration: 240,
    })).not.toThrow()
  })

  it('throws when manifest and root differ', () => {
    expect(() => assertDurationConsistency({
      slug: 'test',
      manifestDuration: 120,
      rootDuration: 240,
      sourceDuration: 240,
    })).toThrow(/manifest.*root/i)
  })

  it('throws when manifest and source differ', () => {
    expect(() => assertDurationConsistency({
      slug: 'test',
      manifestDuration: 120,
      rootDuration: 120,
      sourceDuration: 240,
    })).toThrow(/manifest.*source/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run scripts/lib/compositionMetadata.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement compositionMetadata.ts**

Create `scripts/lib/compositionMetadata.ts` using TS compiler API (`ts.createProgram`) to:
- Parse the source file AST
- Find exported `const` declarations matching `*_DURATION_FRAMES`
- Extract numeric literal values
- Return the duration info or throw descriptive errors

```typescript
import ts from 'typescript'
import path from 'node:path'

export type DurationInfo = {
  name: string
  value: number
  filePath: string
}

export function parseDurationFrames(sourceFilePath: string): DurationInfo {
  const program = ts.createProgram([sourceFilePath], {
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  })
  const sourceFile = program.getSourceFile(sourceFilePath)
  if (!sourceFile) {
    throw new Error(`Cannot read source file: ${sourceFilePath}`)
  }

  const candidates: DurationInfo[] = []

  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node)) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
      const isExport = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      )
      if (isExport) {
        for (const decl of node.declarationList.declarations) {
          const name = decl.name.getText(sourceFile)
          if (name.endsWith('_DURATION_FRAMES')) {
            if (
              decl.initializer &&
              ts.isNumericLiteral(decl.initializer)
            ) {
              const value = Number(decl.initializer.text)
              if (Number.isInteger(value) && value > 0) {
                candidates.push({ name, value, filePath: sourceFilePath })
              } else {
                throw new Error(
                  `${name} in ${sourceFilePath} is not a positive integer: ${decl.initializer.text}`,
                )
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (candidates.length === 0) {
    throw new Error(
      `No *_DURATION_FRAMES export found in ${sourceFilePath}`,
    )
  }

  if (candidates.length > 1) {
    const names = candidates.map((c) => c.name).join(', ')
    throw new Error(
      `Multiple *_DURATION_FRAMES exports found in ${sourceFilePath}: ${names}`,
    )
  }

  return candidates[0]
}

export function parseRootDuration(rootFilePath: string): number {
  const program = ts.createProgram([rootFilePath], {
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  })
  const sourceFile = program.getSourceFile(rootFilePath)
  if (!sourceFile) {
    throw new Error(`Cannot read Root file: ${rootFilePath}`)
  }

  let duration: number | undefined

  function visit(node: ts.Node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sourceFile) === 'durationInFrames' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isNumericLiteral(node.initializer.expression)
    ) {
      duration = Number(node.initializer.expression.text)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (duration === undefined) {
    throw new Error(
      `durationInFrames not found in ${rootFilePath}`,
    )
  }

  return duration
}

export function assertDurationConsistency(args: {
  slug: string
  manifestDuration: number
  rootDuration: number
  sourceDuration?: number
}) {
  if (args.manifestDuration !== args.rootDuration) {
    throw new Error(
      `[${args.slug}] Duration mismatch: manifest=${args.manifestDuration}, Root=${args.rootDuration}`,
    )
  }
  if (
    args.sourceDuration !== undefined &&
    args.manifestDuration !== args.sourceDuration
  ) {
    throw new Error(
      `[${args.slug}] Duration mismatch: manifest=${args.manifestDuration}, source constant=${args.sourceDuration}`,
    )
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run scripts/lib/compositionMetadata.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/compositionMetadata.ts scripts/lib/compositionMetadata.test.ts
git commit -m "feat: add AST-based composition metadata parser"
```

---

## Task 4: Create runtime assets module (AST-based staticFile parser)

**Covers:** §2.2.2, §3.1, §4.1, §4.3

**Files:**
- Create: `scripts/lib/runtimeAssets.ts`
- Create: `scripts/lib/runtimeAssets.test.ts`

Use TS compiler API to:
1. Find `staticFile()` calls with static string arguments
2. Resolve paths against a `public/` base directory
3. Generate deterministic `runtimeAssets` manifest entries
4. Generate `src/runtime-assets.ts` module
5. Replace `staticFile()` calls with `runtimeAsset()` calls via AST transformation

- [ ] **Step 1: Write failing tests**

Create `scripts/lib/runtimeAssets.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { parseStaticFileCalls, generateRuntimeAssetsModule } from './runtimeAssets'

async function writeTempFile(name: string, content: string, dir?: string) {
  const baseDir = dir ?? await fs.mkdtemp(path.join(os.tmpdir(), 'rt-asset-'))
  const filePath = path.join(baseDir, name)
  await fs.writeFile(filePath, content, 'utf8')
  return { filePath, dir: baseDir }
}

describe('parseStaticFileCalls', () => {
  it('finds static string staticFile calls', async () => {
    const { filePath } = await writeTempFile('comp.tsx', `
      import { staticFile } from 'remotion';
      const audio = staticFile("audio/connection/woosh.wav");
      const img = staticFile("avatar-2.png");
    `)
    const calls = parseStaticFileCalls(filePath)
    expect(calls).toEqual([
      { arg: 'audio/connection/woosh.wav', line: expect.any(Number) },
      { arg: 'avatar-2.png', line: expect.any(Number) },
    ])
  })

  it('ignores non-staticFile calls', async () => {
    const { filePath } = await writeTempFile('comp.tsx', `
      const x = someOtherFn("test.wav");
    `)
    const calls = parseStaticFileCalls(filePath)
    expect(calls).toEqual([])
  })

  it('throws on dynamic staticFile arguments', async () => {
    const { filePath } = await writeTempFile('comp.tsx', `
      import { staticFile } from 'remotion';
      const x = staticFile(dynamicVar);
    `)
    expect(() => parseStaticFileCalls(filePath)).toThrow(/dynamic/i)
  })
})

describe('generateRuntimeAssetsModule', () => {
  it('generates module with sorted entries', () => {
    const entries = [
      { sourcePath: 'avatar-2.png', url: 'https://example.com/avatar', sha256: 'abc', byteSize: 100, contentType: 'image/png' },
      { sourcePath: 'audio/connection/woosh.wav', url: 'https://example.com/woosh', sha256: 'def', byteSize: 200, contentType: 'audio/wav' },
    ]
    const module = generateRuntimeAssetsModule(entries)
    expect(module).toContain("audio/connection/woosh.wav")
    expect(module).toContain("avatar-2.png")
    // Verify sorted order (audio before avatar)
    expect(module.indexOf('audio/connection/woosh.wav')).toBeLessThan(module.indexOf('avatar-2.png'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run scripts/lib/runtimeAssets.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement runtimeAssets.ts**

Create `scripts/lib/runtimeAssets.ts`:

```typescript
import ts from 'typescript'

export type StaticFileCall = {
  arg: string
  line: number
}

export type RuntimeAssetEntry = {
  sourcePath: string
  url: string
  sha256: string
  byteSize: number
  contentType: string
}

export function parseStaticFileCalls(sourceFilePath: string): StaticFileCall[] {
  const program = ts.createProgram([sourceFilePath], {
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  })
  const sourceFile = program.getSourceFile(sourceFilePath)
  if (!sourceFile) {
    throw new Error(`Cannot read source file: ${sourceFilePath}`)
  }

  const calls: StaticFileCall[] = []

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'staticFile'
    ) {
      if (node.arguments.length !== 1) {
        throw new Error(
          `staticFile() in ${sourceFilePath} at line ${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}: expected 1 argument`,
        )
      }

      const arg = node.arguments[0]
      if (!ts.isStringLiteral(arg)) {
        const line = sourceFile.getLineAndCharacterOfPosition(arg.getStart()).line + 1
        throw new Error(
          `staticFile() in ${sourceFilePath} at line ${line}: dynamic argument not allowed`,
        )
      }

      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
      calls.push({ arg: arg.text, line })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return calls
}

export function generateRuntimeAssetsModule(entries: RuntimeAssetEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))
  const lines = sorted.map(
    (e) => `  '${e.sourcePath}': '${e.url}'`,
  )
  return `export const runtimeAssets = {
${lines.join(',\n')}
} as const

export type RuntimeAssetPath = keyof typeof runtimeAssets

export function runtimeAsset(path: RuntimeAssetPath): string {
  return runtimeAssets[path]
}
`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run scripts/lib/runtimeAssets.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/runtimeAssets.ts scripts/lib/runtimeAssets.test.ts
git commit -m "feat: add AST-based runtime assets parser and generator"
```

---

## Task 5: Extend manifest schema with runtimeAssets

**Covers:** §3.1

**Files:**
- Modify: `scripts/lib/assetManifest.ts`
- Modify: `scripts/lib/assetManifest.test.ts`

Add `runtimeAssets` optional array to `assetManifestSchema`.

- [ ] **Step 1: Read current assetManifest.ts and tests**

- [ ] **Step 2: Add runtimeAssets schema**

Add to `assetManifestSchema`:

```typescript
runtimeAssets: z.array(z.object({
  sourcePath: z.string().min(1),
  url: remotionHubMediaUrlSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  byteSize: z.number().int().positive(),
  contentType: z.string().min(1),
})).default([]),
```

- [ ] **Step 3: Add tests for runtimeAssets field**

- [ ] **Step 4: Run tests**

```bash
npx vitest run scripts/lib/assetManifest.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/assetManifest.ts scripts/lib/assetManifest.test.ts
git commit -m "feat: add runtimeAssets field to manifest schema"
```

---

## Task 6: Remove 120-frame hardcoding from scaffolding scripts

**Covers:** §2.2.4, §4.1

**Files:**
- Modify: `scripts/extract-case.ts` (line ~394: `durationFrames: 120`)
- Modify: `scripts/scaffold-batch.ts` (line ~358: `durationInFrames={120}`)
- Modify: `scripts/generate-readme.ts` (line ~46: `durationInFrames={120}`)

These scripts hardcode 120 frames. Fix them to use the actual duration from manifest or source.

- [ ] **Step 1: Fix extract-case.ts**

The draft manifest is created with `durationFrames: 120`. This should remain as a draft default (extraction doesn't know the real duration yet). No change needed here — the duration is corrected during validation.

Actually, re-reading the spec: "删除 extract-case.ts、scaffold-batch.ts 和 generate-readme.ts 中的 120 帧硬编码". The scaffold generates Root.tsx with `durationInFrames={120}`. This should read from the manifest.

- [ ] **Step 2: Fix scaffold-batch.ts**

Change the Root.tsx template to read duration from the draft manifest instead of hardcoding 120. The scaffold script already runs extract-case first, which creates the draft manifest. Read duration from there.

- [ ] **Step 3: Fix generate-readme.ts**

Change the README template to use `manifest.durationFrames` instead of hardcoding 120.

- [ ] **Step 4: Verify changes compile**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add scripts/extract-case.ts scripts/scaffold-batch.ts scripts/generate-readme.ts
git commit -m "fix: remove hardcoded 120-frame duration from scaffolding scripts"
```

---

## Task 7: Extend validate-case.ts with metadata consistency check

**Covers:** §2.2.4, §3.3, §4.1

**Files:**
- Modify: `scripts/validate-case.ts`

Before rendering, validate that manifest duration matches Root.tsx duration and source constant (if exported).

- [ ] **Step 1: Add metadata check before render**

In `runValidation()`, before the `npx remotion render` call:
1. Read manifest duration
2. Parse Root.tsx duration using `parseRootDuration()`
3. Try to parse source component duration using `parseDurationFrames()`
4. Call `assertDurationConsistency()`

- [ ] **Step 2: Test with a known duration mismatch**

```bash
# Temporarily set a wrong duration in a test asset and verify validation catches it
```

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-case.ts
git commit -m "feat: add metadata consistency check before render in validate-case"
```

---

## Task 8: Extend upload-media.ts for runtime media

**Covers:** §2.2.2, §3.1, §4.3

**Files:**
- Modify: `scripts/upload-media.ts`
- Modify: `scripts/lib/media.ts`

Extend to support:
1. Scanning `staticFile()` calls from component source
2. Reading local files from `public/` directory
3. Uploading with content-addressed key `runtime/sha256/<sha256>`
4. Updating manifest with `runtimeAssets` entries
5. Generating `src/runtime-assets.ts`

- [ ] **Step 1: Add buildRuntimeObjectKey to media.ts**

```typescript
export function buildRuntimeObjectKey(hash: string) {
  return `runtime/sha256/${hash}`
}
```

- [ ] **Step 2: Add content type detection for audio formats**

Extend `contentTypeFor()` in `upload-media.ts` to handle `.mp3` (audio/mpeg), `.wav` (audio/wav), `.jpeg`/`.jpg` (image/jpeg), `.png` (image/png).

- [ ] **Step 3: Add runtime media mirror function**

Add `mirrorRuntimeMedia()` function that:
1. Scans component source for `staticFile()` calls using `parseStaticFileCalls()`
2. For each call, reads the file from `public/` directory
3. Computes SHA-256, byte size, content type
4. Uploads to `runtime/sha256/<sha256>` (skip if already exists via HEAD check)
5. Returns `RuntimeAssetEntry[]`

- [ ] **Step 4: Integrate into runMediaMirror**

When `runtimeAssets` are detected, update the manifest and generate `src/runtime-assets.ts`.

- [ ] **Step 5: Test with dry-run**

```bash
npx tsx scripts/upload-media.ts --slug=yt-ai-not-understand --dry-run
```

- [ ] **Step 6: Commit**

```bash
git add scripts/upload-media.ts scripts/lib/media.ts
git commit -m "feat: extend upload-media for runtime media with content-addressed storage"
```

---

## Task 9: Create verify-yt-assets.ts script

**Covers:** §3.3, §4.1

**Files:**
- Create: `scripts/verify-yt-assets.ts`
- Create: `scripts/verify-yt-assets.test.ts`

Read-only verification script that checks:
1. Slug set matches canonical list
2. Duration consistency across manifest/Root/source
3. Runtime asset consistency
4. No remaining `staticFile()` calls in yt-* components
5. Workspace packages in lockfile
6. Catalog commit contains artifact path (cross-repo check)

- [ ] **Step 1: Write the verify script**

Create `scripts/verify-yt-assets.ts` with read-only checks. It must NOT update timestamps, rewrite manifests, or trigger uploads.

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Add npm script**

Add to `package.json` scripts: `"verify:yt-assets": "tsx scripts/verify-yt-assets.ts"`

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-yt-assets.ts scripts/verify-yt-assets.test.ts package.json
git commit -m "feat: add read-only yt assets verification script"
```

---

## Task 10: Fix durations for 69 assets

**Covers:** §2.2.4, §4.2

**Files:**
- Modify: 69 asset directories (manifest, Root.tsx, README)

Batch update duration from 120 to actual value for each asset. The spec lists exact target durations.

- [ ] **Step 1: Create batch update script**

Write a script that:
1. Reads canonical slug list
2. For each slug, reads the component source to find `*_DURATION_FRAMES`
3. Updates `remotionhub.asset.json` durationFrames
4. Updates `remotionhub.asset.draft.json` durationFrames
5. Updates `src/Root.tsx` durationInFrames
6. Updates `README.md` durationInFrames in usage example

- [ ] **Step 2: Run the batch update**

- [ ] **Step 3: Verify with metadata check**

Run the updated validate-case.ts in manifest-only mode for all 69 assets.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: restore correct duration for 69 yt assets"
```

---

## Task 11: Upload runtime media for 13 assets

**Covers:** §2.2.2, §4.3

**Files:**
- Modify: 13 asset directories (manifest, component source, new runtime-assets.ts)

Upload the 13 media files from `public/` to OSS, update manifests, generate runtime-assets.ts, replace `staticFile()` calls.

- [ ] **Step 1: Run upload-media.ts for each of the 13 assets**

The 13 assets: yt-ai-not-understand, yt-ai-skill-network, yt-audio-control, yt-audio-lets-start, yt-audio-prompt-skill, yt-audio-software-criteria, yt-from-scratch, yt-like-subscribe-bell, yt-line-phase-intro, yt-mcp-chapter-card, yt-mcp-pipeline, yt-pencil-intro, yt-svg-cards

- [ ] **Step 2: Verify no remaining staticFile() calls**

```bash
grep -r 'staticFile' remotion/yt-*/src/*.tsx | grep -v node_modules
```
Expected: no matches

- [ ] **Step 3: Verify runtime-assets.ts generated for each**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: upload runtime media to OSS and replace staticFile calls"
```

---

## Task 12: Add 5 missing assets and update inventory

**Covers:** §2.2.1, §4.4

**Files:**
- Add: 5 asset directories (already in dirty worktree as untracked)
- Modify: `manifest/remotionlab-showcase.json`

The 5 untracked assets need to be committed: yt-audio-add-vocals, yt-audio-complex-pop-question, yt-audio-fast-results, yt-audio-rock-remix, yt-connection-recap-outro.

- [ ] **Step 1: Verify the 5 assets have correct structure**

Check each has: src/, package.json, remotionhub.asset.json, README.md, LICENSE

- [ ] **Step 2: Fix durations for these 5 if needed**

- [ ] **Step 3: Update inventory**

- [ ] **Step 4: Commit**

```bash
git add remotion/yt-audio-add-vocals remotion/yt-audio-complex-pop-question remotion/yt-audio-fast-results remotion/yt-audio-rock-remix remotion/yt-connection-recap-outro manifest/remotionlab-showcase.json
git commit -m "feat: add 5 missing yt animation assets"
```

---

## Task 13: Update lockfile for all 113 workspaces

**Covers:** §2.2.3

**Files:**
- Modify: `package-lock.json`

- [ ] **Step 1: Run npm install**

```bash
npm install
```

- [ ] **Step 2: Verify lockfile contains all 113 yt-* workspaces**

```bash
grep -c '"remotion/yt-' package-lock.json
```
Expected: 113

- [ ] **Step 3: Verify npm ci dry-run passes**

```bash
npm ci --dry-run --ignore-scripts
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package-lock.json
git commit -m "fix: update lockfile for all 113 yt workspaces"
```

---

## Task 14: Full validation and render tests

**Covers:** §3.3, §5 (Phase 2.7-2.9)

Run full validation on all assets.

- [ ] **Step 1: Run metadata validation on all 113 assets**

- [ ] **Step 2: Run full render on 69 duration-fixed assets**

- [ ] **Step 3: Run isolated render on 13 media assets (with network)**

- [ ] **Step 4: Run remote runtime URL verification**

- [ ] **Step 5: Run all tests and lint**

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run verify:yt-assets
```

---

## Task 15: Assets clean-checkout gate

**Covers:** §5 (Phase 3)

- [ ] **Step 1: Create clean worktree from candidate commit**

```bash
git worktree add --detach /tmp/remotionhub-assets-repair-check HEAD
cd /tmp/remotionhub-assets-repair-check
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run verify:yt-assets
```

- [ ] **Step 2: Clean up temporary worktree**

```bash
git worktree remove /tmp/remotionhub-assets-repair-check
```

---

## Task 16: Fix catalog generator and regenerate catalogs (main repo)

**Covers:** §2.2.7, §4.5, §5 (Phase 4)

**Files:**
- Modify: `.worktrees/feat-animation-category-i18n/scripts/generate-catalog.ts`
- Regenerate: 113 catalog JSONs

- [ ] **Step 1: Fix Chinese fallback in generate-catalog.ts**

Change:
```typescript
const titleZh = manifest.displayNameZh ?? (await readMarkdownTitle(slug))
const summaryZh = manifest.summaryZh ?? `适用于 Remotion 的${titleZh}组件。`
```
To:
```typescript
const titleZh = manifest.displayNameZh?.trim() || (await readMarkdownTitle(slug))
const summaryZh = manifest.summaryZh?.trim() || `适用于 Remotion 的「${titleZh}」组件。`
```

- [ ] **Step 2: Add asset commit verification**

Before generating each catalog, verify the asset path exists in the commit:
```bash
git -C <asset-repo> cat-file -e <commit>:remotion/<slug>
```

- [ ] **Step 3: Get final assets commit SHA**

```bash
ASSET_COMMIT=$(git -C /Users/tangwz/workspace/git/remotionhub-assets/.worktrees/feat-migrate-yt-animation-assets rev-parse HEAD)
```

- [ ] **Step 4: Regenerate all 113 catalogs**

```bash
cd /Users/tangwz/workspace/git/remotionhub/.worktrees/feat-animation-category-i18n
npx tsx scripts/generate-catalog.ts --asset-repo=/Users/tangwz/workspace/git/remotionhub-assets/.worktrees/feat-migrate-yt-animation-assets --asset-commit="$ASSET_COMMIT" <all 113 slugs>
```

- [ ] **Step 5: Verify catalogs**

- [ ] **Step 6: Commit**

```bash
git add catalog/components/yt-*.json scripts/generate-catalog.ts
git commit -m "fix: regenerate yt catalogs from pinned asset commit"
```

---

## Task 17: Fix durable spec and cleanup

**Covers:** §5 (Phase 5)

- [ ] **Step 1: Remove or exclude main repo root Scene*.tsx files (if they exist)**

- [ ] **Step 2: Update final-batch spec with correct canonical slug list**

- [ ] **Step 3: Final cross-repo verification**

---

## Commit Strategy (per spec §8)

1. `fix: validate yt asset metadata and runtime files` — infrastructure, tests, canonical slugs, lint
2. `fix: restore yt asset durations and mirror runtime media` — 69 duration fixes, 13 media uploads
3. `feat: complete 113 yt animation assets` — 5 missing assets, inventory, lockfile
4. `fix: regenerate yt catalogs from pinned asset commit` — main repo generator and catalogs
5. `docs: correct yt migration inventory and repair rationale` — spec corrections
