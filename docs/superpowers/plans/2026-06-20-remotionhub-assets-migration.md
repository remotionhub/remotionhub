# RemotionHub Assets Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working RemotionHub asset migration slice by publishing `card-avatar` in `remotionhub/remotionhub-assets` and wiring it into RemotionHub catalog with mirrored preview media.

**Architecture:** `remotionhub/remotionhub-assets` is the canonical source repository for reusable Remotion code and migration tooling. The RemotionHub app repository remains the catalog and presentation layer, storing metadata and GitHub source pointers only. The first vertical slice migrates one source Markdown file, mirrors media, validates a workspace package, and imports a catalog record.

**Tech Stack:** TypeScript, npm workspaces, Remotion, React, Zod, AWS SDK S3 client for R2/S3-compatible uploads, Vitest, TanStack Start, Convex catalog import.

## Global Constraints

- Asset source repository: `remotionhub/remotionhub-assets`.
- Local RemotionHub repository: `/Users/tangwz/workspace/git/remotionhub`.
- Local asset repository path: `/Users/tangwz/workspace/git/remotionhub-assets`.
- Source archive path: `/tmp/remotionlab/案例`.
- First migrated case: `card-avatar`.
- RemotionHub spec file: `/Users/tangwz/workspace/git/remotionhub/specs/2026-06-20-remotionhub-assets-migration.md`.
- RemotionHub must not store reusable Remotion source code; it stores catalog metadata and source pointers.
- Preview media in published catalog entries must use RemotionHub-controlled object storage URLs, not source-site R2 URLs.
- Asset repository must use npm workspaces with `workspaces: ["remotion/*"]`.
- Asset repository root owns core dependencies: `react`, `react-dom`, `remotion`, `typescript`, format/lint/test tooling.
- Case-level `package.json` files describe case metadata, scripts, and extra dependencies only.
- `githubSource.repo` for migrated assets must be `remotionhub/remotionhub-assets`.
- First phase does not publish an npm CLI.

---

## Scope Check

The spec spans two repositories, but this first phase is one testable vertical slice: asset workspace, migration tooling, one migrated case, RemotionHub catalog metadata, and browser verification. Splitting this further would leave intermediate states that cannot prove the migration works end to end.

This plan intentionally does not migrate all 264 cases and does not publish a CLI. It creates the structure and checks that make later batch migration repeatable.

## File Structure

Asset repository `/Users/tangwz/workspace/git/remotionhub-assets`:

- `package.json` — workspace root scripts and shared dependencies.
- `tsconfig.base.json` — shared strict TypeScript config for scripts and cases.
- `vitest.config.ts` — Node test environment for migration tooling.
- `scripts/lib/assetManifest.ts` — Zod schemas and types for asset manifests and inventory.
- `scripts/lib/remotionlabMarkdown.ts` — parser for `/tmp/remotionlab/案例/*.md` source files.
- `scripts/lib/media.ts` — media URL extraction, hashing, and R2/S3 upload helpers.
- `scripts/extract-case.ts` — extract a source Markdown case into a draft asset directory.
- `scripts/upload-media.ts` — mirror preview media and update manifest/inventory.
- `scripts/sanitize-case.ts` — normalize generated source files and case metadata.
- `scripts/validate-case.ts` — run manifest, TypeScript, and render validation for one case.
- `scripts/generate-readme.ts` — generate README from manifest props schema and prompt.
- `scripts/lib/*.test.ts` — unit tests for parser, manifest validation, and media planning.
- `manifest/remotionlab-showcase.json` — full migration inventory with `card-avatar` progressed through the pipeline.
- `remotion/card-avatar/package.json` — workspace package metadata for the first case.
- `remotion/card-avatar/remotion.config.ts` — Remotion config for the case workspace.
- `remotion/card-avatar/src/CardAvatar.tsx` — reusable Remotion component.
- `remotion/card-avatar/src/Root.tsx` — composition registration.
- `remotion/card-avatar/src/index.ts` — public export.
- `remotion/card-avatar/remotionhub.asset.json` — machine-readable asset manifest.
- `remotion/card-avatar/README.md` — standardized user-facing usage guide.
- `remotion/card-avatar/LICENSE` — license file.

RemotionHub repository `/Users/tangwz/workspace/git/remotionhub`:

- `shared/catalog.ts` — optionally add canonical asset repo validation.
- `shared/catalog.test.ts` — update fixture repo and add canonical repo test.
- `catalog/components/card-avatar.json` — new catalog entry for the migrated case.
- `catalog/components/kinetic-title-pack.json` — update existing fixture repo owner if it still points at `tangwz/remotionhub-assets`.
- `catalog/components/hyperframes-lower-third.json` — update existing fixture repo owner if it still points at `tangwz/remotionhub-assets`.

## Task 1: Prepare Asset Workspace Baseline

**Files:**
- Create or modify: `/Users/tangwz/workspace/git/remotionhub-assets/package.json`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/tsconfig.base.json`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/vitest.config.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/assetManifest.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/assetManifest.test.ts`

**Interfaces:**
- Produces: `assetManifestSchema`, `inventorySchema`, `readAssetManifest(pathname: string): Promise<AssetManifest>`, `writeAssetManifest(pathname: string, manifest: AssetManifest): Promise<void>`.
- Later tasks consume these schemas to write `remotionhub.asset.json` and `manifest/remotionlab-showcase.json`.

- [ ] **Step 1: Ensure local asset repository exists**

Run:

```bash
cd /Users/tangwz/workspace/git
test -d remotionhub-assets/.git || git clone https://github.com/remotionhub/remotionhub-assets.git remotionhub-assets
cd /Users/tangwz/workspace/git/remotionhub-assets
git remote -v
```

Expected:

```text
origin points to https://github.com/remotionhub/remotionhub-assets.git or git@github.com:remotionhub/remotionhub-assets.git.
```

- [ ] **Step 2: Create root workspace package**

Write `/Users/tangwz/workspace/git/remotionhub-assets/package.json`:

```json
{
  "name": "@remotionhub/assets",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "workspaces": ["remotion/*"],
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.base.json --noEmit",
    "extract": "tsx scripts/extract-case.ts",
    "media:mirror": "tsx scripts/upload-media.ts",
    "sanitize": "tsx scripts/sanitize-case.ts",
    "validate": "tsx scripts/validate-case.ts",
    "manifest:validate": "tsx scripts/validate-case.ts --manifest-only",
    "readme:generate": "tsx scripts/generate-readme.ts"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.731.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@remotion/cli": "^4.0.366",
    "@types/node": "^22.10.2",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.1",
    "remotion": "^4.0.366",
    "tsx": "^4.22.4",
    "typescript": "^6.0.2",
    "vite": "^8.0.0",
    "vitest": "^4.1.5",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

- [ ] **Step 3: Install dependencies once at workspace root**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm install
```

Expected:

```text
package-lock.json is created or updated.
node_modules exists only at the workspace root.
```

- [ ] **Step 4: Add TypeScript and Vitest config**

Write `/Users/tangwz/workspace/git/remotionhub-assets/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": ["scripts/**/*.ts", "remotion/**/*.ts", "remotion/**/*.tsx", "vitest.config.ts"]
}
```

Write `/Users/tangwz/workspace/git/remotionhub-assets/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Write failing manifest schema tests**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/assetManifest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { assetManifestSchema, inventorySchema } from './assetManifest'

const baseManifest = {
  slug: 'card-avatar',
  displayName: 'Card Avatar',
  runtime: 'remotion',
  sourceUrl: 'https://remotionlab.com/showcase/card-avatar',
  originalPreviewUrl:
    'https://pub-1cc20f8a898349ab9b2823b040fcd0b8.r2.dev/showcase/card-avatar/preview.mp4',
  originalThumbnailUrl:
    'https://pub-1cc20f8a898349ab9b2823b040fcd0b8.r2.dev/showcase/card-avatar/thumb.jpg',
  previewUrl: 'https://assets.remotionhub.ai/showcase/card-avatar/preview.mp4',
  thumbnailUrl: 'https://assets.remotionhub.ai/showcase/card-avatar/thumb.jpg',
  entryPoint: 'src/CardAvatar.tsx',
  compositionId: 'CardAvatar',
  durationFrames: 120,
  fps: 30,
  width: 1920,
  height: 1080,
  aspectRatios: ['16:9'],
  license: 'MIT',
  prompt: 'Add this Remotion component to my project.',
  propsSchema: [
    {
      name: 'name',
      type: 'string',
      defaultValue: 'Jane Smith',
      description: 'Primary display name.',
    },
  ],
  extraDependencies: [],
  migration: {
    status: 'published',
    sourceFile: '/tmp/remotionlab/案例/card-avatar.md',
    updatedAt: '2026-06-20T00:00:00.000Z',
  },
}

describe('asset manifest schema', () => {
  it('accepts the card-avatar manifest shape', () => {
    expect(assetManifestSchema.parse(baseManifest).slug).toBe('card-avatar')
  })

  it('rejects source-site media as published preview media', () => {
    expect(() =>
      assetManifestSchema.parse({
        ...baseManifest,
        previewUrl: baseManifest.originalPreviewUrl,
      }),
    ).toThrow(/RemotionHub-controlled/)
  })

  it('tracks inventory status for every case', () => {
    const parsed = inventorySchema.parse({
      cases: [
        {
          slug: 'card-avatar',
          status: 'published',
          sourceFile: '/tmp/remotionlab/案例/card-avatar.md',
          assetPath: 'remotion/card-avatar',
          blockedReason: undefined,
          updatedAt: '2026-06-20T00:00:00.000Z',
        },
      ],
    })

    expect(parsed.cases).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run test -- scripts/lib/assetManifest.test.ts
```

Expected:

```text
FAIL because scripts/lib/assetManifest.ts does not exist.
```

- [ ] **Step 7: Implement manifest schema**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/assetManifest.ts`:

```ts
import fs from 'node:fs/promises'
import { z } from 'zod'

const migrationStatusSchema = z.union([
  z.literal('pending'),
  z.literal('extracted'),
  z.literal('media-mirrored'),
  z.literal('sanitized'),
  z.literal('validated'),
  z.literal('published'),
  z.literal('blocked'),
])

const httpsUrlSchema = z.string().url().startsWith('https://')
const remotionHubMediaUrlSchema = httpsUrlSchema.refine(
  (value) => !value.includes('pub-1cc20f8a898349ab9b2823b040fcd0b8.r2.dev'),
  { message: 'Published media URLs must be RemotionHub-controlled.' },
)

export const propSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().min(1),
})

export const assetManifestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/),
  displayName: z.string().min(1),
  runtime: z.literal('remotion'),
  sourceUrl: httpsUrlSchema,
  originalPreviewUrl: httpsUrlSchema,
  originalThumbnailUrl: httpsUrlSchema,
  previewUrl: remotionHubMediaUrlSchema,
  thumbnailUrl: remotionHubMediaUrlSchema,
  entryPoint: z.string().min(1),
  compositionId: z.string().min(1),
  durationFrames: z.number().int().positive(),
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatios: z.array(z.string().min(1)).min(1),
  license: z.string().min(1),
  prompt: z.string().min(1),
  propsSchema: z.array(propSchema),
  extraDependencies: z.array(z.string().min(1)),
  migration: z.object({
    status: migrationStatusSchema,
    sourceFile: z.string().min(1),
    updatedAt: z.string().datetime(),
    blockedReason: z.string().min(1).optional(),
  }),
})

export type AssetManifest = z.infer<typeof assetManifestSchema>

export const inventoryCaseSchema = z.object({
  slug: z.string().min(1),
  status: migrationStatusSchema,
  sourceFile: z.string().min(1),
  assetPath: z.string().min(1).optional(),
  blockedReason: z.string().min(1).optional(),
  updatedAt: z.string().datetime(),
})

export const inventorySchema = z.object({
  cases: z.array(inventoryCaseSchema),
})

export type Inventory = z.infer<typeof inventorySchema>

export async function readAssetManifest(pathname: string) {
  const raw = await fs.readFile(pathname, 'utf8')
  return assetManifestSchema.parse(JSON.parse(raw))
}

export async function writeAssetManifest(
  pathname: string,
  manifest: AssetManifest,
) {
  const parsed = assetManifestSchema.parse(manifest)
  await fs.writeFile(pathname, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
}
```

- [ ] **Step 8: Verify baseline passes**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run test -- scripts/lib/assetManifest.test.ts
npm run typecheck
```

Expected:

```text
Both commands exit with code 0.
```

- [ ] **Step 9: Commit checkpoint**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git add package.json package-lock.json tsconfig.base.json vitest.config.ts scripts/lib/assetManifest.ts scripts/lib/assetManifest.test.ts
git commit -m "chore: set up remotion asset workspace"
```

Expected:

```text
Commit succeeds in remotionhub-assets.
```

## Task 2: Add RemotionLab Extraction and Inventory

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/remotionlabMarkdown.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/remotionlabMarkdown.test.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/extract-case.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`

**Interfaces:**
- Consumes: `assetManifestSchema`, `inventorySchema`.
- Produces: `parseRemotionLabMarkdown(markdown: string, sourceFile: string): RemotionLabCase`.
- Produces draft `remotion/<slug>/remotionhub.asset.draft.json` during extraction.

- [ ] **Step 1: Write parser test for `card-avatar`**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/remotionlabMarkdown.test.ts`:

```ts
import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parseRemotionLabMarkdown } from './remotionlabMarkdown'

describe('parseRemotionLabMarkdown', () => {
  it('extracts card-avatar metadata, prompt, code, and media URLs', async () => {
    const sourceFile = '/tmp/remotionlab/案例/card-avatar.md'
    const markdown = await fs.readFile(sourceFile, 'utf8')
    const parsed = parseRemotionLabMarkdown(markdown, sourceFile)

    expect(parsed.slug).toBe('card-avatar')
    expect(parsed.title).toBe('头像字卡')
    expect(parsed.sourceUrl).toBe('https://remotionlab.com/showcase/card-avatar')
    expect(parsed.previewUrl).toContain('/showcase/card-avatar/preview.mp4')
    expect(parsed.thumbnailUrl).toContain('/showcase/card-avatar/thumb.jpg')
    expect(parsed.prompt).toContain('Jane Smith')
    expect(parsed.code).toContain('export const CardAvatar')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run test -- scripts/lib/remotionlabMarkdown.test.ts
```

Expected:

```text
FAIL because scripts/lib/remotionlabMarkdown.ts does not exist.
```

- [ ] **Step 3: Implement Markdown parser**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/remotionlabMarkdown.ts`:

```ts
export type RemotionLabCase = {
  slug: string
  title: string
  sourceUrl: string
  lastmod: string
  sourceFile: string
  previewUrl: string
  thumbnailUrl: string
  prompt: string
  code: string
}

function readFrontmatterValue(markdown: string, key: string) {
  const match = markdown.match(new RegExp(`^${key}:\\s+"?([^"\\n]+)"?$`, 'm'))
  if (!match?.[1]) {
    throw new Error(`Missing frontmatter key ${key}.`)
  }
  return match[1]
}

function readCodeBlocks(markdown: string) {
  const blocks: Array<{ language: string; body: string }> = []
  const pattern = /```([a-zA-Z]*)\n([\s\S]*?)\n```/g
  for (const match of markdown.matchAll(pattern)) {
    blocks.push({ language: match[1] ?? '', body: match[2] ?? '' })
  }
  return blocks
}

export function parseRemotionLabMarkdown(
  markdown: string,
  sourceFile: string,
): RemotionLabCase {
  const slug = readFrontmatterValue(markdown, 'slug')
  const title = readFrontmatterValue(markdown, 'title')
  const sourceUrl = readFrontmatterValue(markdown, 'source')
  const lastmod = readFrontmatterValue(markdown, 'lastmod')
  const previewMatch = markdown.match(/\[Video\]\((https:\/\/[^)]+preview\.mp4)\)/)
  const thumbnailMatch = markdown.match(/\[Poster\]\((https:\/\/[^)]+thumb\.jpg)\)/)
  const blocks = readCodeBlocks(markdown)
  const prompt = blocks.find((block) => block.language === 'text')?.body.trim()
  const code = blocks.find((block) => block.body.includes('export const'))?.body.trim()

  if (!previewMatch?.[1]) {
    throw new Error(`Missing preview video URL for ${slug}.`)
  }
  if (!thumbnailMatch?.[1]) {
    throw new Error(`Missing thumbnail URL for ${slug}.`)
  }
  if (!prompt) {
    throw new Error(`Missing prompt block for ${slug}.`)
  }
  if (!code) {
    throw new Error(`Missing code block for ${slug}.`)
  }

  return {
    slug,
    title,
    sourceUrl,
    lastmod,
    sourceFile,
    previewUrl: previewMatch[1],
    thumbnailUrl: thumbnailMatch[1],
    prompt,
    code,
  }
}
```

- [ ] **Step 4: Implement extraction command**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/extract-case.ts`:

```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseRemotionLabMarkdown } from './lib/remotionlabMarkdown'

function readArg(name: string) {
  return process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
}

function nowIso() {
  return new Date().toISOString()
}

async function main() {
  const slug = readArg('slug') ?? 'card-avatar'
  const sourceFile =
    readArg('source') ?? `/tmp/remotionlab/案例/${slug}.md`
  const markdown = await fs.readFile(sourceFile, 'utf8')
  const parsed = parseRemotionLabMarkdown(markdown, sourceFile)
  const assetDir = path.join('remotion', parsed.slug)

  await fs.mkdir(assetDir, { recursive: true })
  await fs.mkdir('manifest', { recursive: true })
  await fs.writeFile(
    path.join(assetDir, 'remotionhub.asset.draft.json'),
    `${JSON.stringify(
      {
        slug: parsed.slug,
        displayName: 'Card Avatar',
        runtime: 'remotion',
        sourceUrl: parsed.sourceUrl,
        originalPreviewUrl: parsed.previewUrl,
        originalThumbnailUrl: parsed.thumbnailUrl,
        previewUrl: parsed.previewUrl,
        thumbnailUrl: parsed.thumbnailUrl,
        entryPoint: 'src/CardAvatar.tsx',
        compositionId: 'CardAvatar',
        durationFrames: 120,
        fps: 30,
        width: 1920,
        height: 1080,
        aspectRatios: ['16:9'],
        license: 'MIT',
        prompt: parsed.prompt,
        propsSchema: [],
        extraDependencies: [],
        migration: {
          status: 'extracted',
          sourceFile,
          updatedAt: nowIso(),
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  await fs.writeFile(path.join(assetDir, 'source.raw.tsx'), `${parsed.code}\n`, 'utf8')
  await fs.writeFile(
    'manifest/remotionlab-showcase.json',
    `${JSON.stringify(
      {
        cases: [
          {
            slug: parsed.slug,
            status: 'extracted',
            sourceFile,
            assetPath: assetDir,
            updatedAt: nowIso(),
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  console.log(`Extracted ${parsed.slug} to ${assetDir}.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 5: Run extraction**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run test -- scripts/lib/remotionlabMarkdown.test.ts
npm run extract -- --slug=card-avatar
test -f remotion/card-avatar/source.raw.tsx
test -f remotion/card-avatar/remotionhub.asset.draft.json
```

Expected:

```text
Tests pass.
Extraction prints "Extracted card-avatar to remotion/card-avatar."
Both test commands exit with code 0.
```

- [ ] **Step 6: Commit checkpoint**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git add scripts/lib/remotionlabMarkdown.ts scripts/lib/remotionlabMarkdown.test.ts scripts/extract-case.ts manifest/remotionlab-showcase.json remotion/card-avatar/source.raw.tsx remotion/card-avatar/remotionhub.asset.draft.json
git commit -m "feat: extract card avatar source case"
```

Expected:

```text
Commit succeeds in remotionhub-assets.
```

## Task 3: Mirror Preview Media

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/media.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/media.test.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/upload-media.ts`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/remotionhub.asset.draft.json`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`

**Interfaces:**
- Consumes: draft manifest from Task 2.
- Produces: `remotion/card-avatar/remotionhub.asset.json` with RemotionHub-controlled `previewUrl` and `thumbnailUrl`.

- [ ] **Step 1: Write media planning tests**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildObjectKey, isSourceSiteMediaUrl } from './media'

describe('media helpers', () => {
  it('detects source-site media URLs', () => {
    expect(
      isSourceSiteMediaUrl(
        'https://pub-1cc20f8a898349ab9b2823b040fcd0b8.r2.dev/showcase/card-avatar/preview.mp4',
      ),
    ).toBe(true)
  })

  it('builds stable object keys for mirrored assets', () => {
    expect(buildObjectKey('card-avatar', 'preview.mp4', 'abc123')).toBe(
      'showcase/card-avatar/abc123-preview.mp4',
    )
  })
})
```

- [ ] **Step 2: Implement media helpers**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/media.ts`:

```ts
import crypto from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export function isSourceSiteMediaUrl(url: string) {
  return url.includes('pub-1cc20f8a898349ab9b2823b040fcd0b8.r2.dev')
}

export function buildObjectKey(slug: string, filename: string, hash: string) {
  return `showcase/${slug}/${hash.slice(0, 12)}-${filename}`
}

export async function downloadMedia(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

export function sha256(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function createS3ClientFromEnv() {
  const accountId = process.env.ASSETS_R2_ACCOUNT_ID
  const accessKeyId = process.env.ASSETS_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.ASSETS_R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export async function uploadMediaObject(args: {
  client: S3Client
  bucket: string
  key: string
  body: Buffer
  contentType: string
}) {
  await args.client.send(
    new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
    }),
  )
}
```

- [ ] **Step 3: Implement upload command**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/upload-media.ts`:

```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  buildObjectKey,
  createS3ClientFromEnv,
  downloadMedia,
  sha256,
  uploadMediaObject,
} from './lib/media'

function readArg(name: string) {
  return process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
}

function filenameFor(url: string) {
  return path.basename(new URL(url).pathname)
}

function contentTypeFor(filename: string) {
  if (filename.endsWith('.mp4')) {
    return 'video/mp4'
  }
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  if (filename.endsWith('.png')) {
    return 'image/png'
  }
  return 'application/octet-stream'
}

async function mirrorOne(args: {
  slug: string
  url: string
  publicBaseUrl: string
  dryRun: boolean
}) {
  const body = await downloadMedia(args.url)
  const hash = sha256(body)
  const filename = filenameFor(args.url)
  const key = buildObjectKey(args.slug, filename, hash)
  const targetUrl = `${args.publicBaseUrl.replace(/\/$/, '')}/${key}`
  const client = createS3ClientFromEnv()
  const bucket = process.env.ASSETS_R2_BUCKET

  if (!args.dryRun) {
    if (!client || !bucket) {
      throw new Error('R2 credentials and ASSETS_R2_BUCKET are required.')
    }
    await uploadMediaObject({
      client,
      bucket,
      key,
      body,
      contentType: contentTypeFor(filename),
    })
  }

  return { sourceUrl: args.url, targetUrl, hash, byteSize: body.byteLength }
}

async function main() {
  const slug = readArg('slug') ?? 'card-avatar'
  const dryRun = process.argv.includes('--dry-run')
  const publicBaseUrl =
    process.env.ASSETS_PUBLIC_BASE_URL ?? 'https://assets.remotionhub.ai'
  const draftPath = `remotion/${slug}/remotionhub.asset.draft.json`
  const finalPath = `remotion/${slug}/remotionhub.asset.json`
  const raw = JSON.parse(await fs.readFile(draftPath, 'utf8'))

  const preview = await mirrorOne({
    slug,
    url: raw.originalPreviewUrl,
    publicBaseUrl,
    dryRun,
  })
  const thumbnail = await mirrorOne({
    slug,
    url: raw.originalThumbnailUrl,
    publicBaseUrl,
    dryRun,
  })

  const nextManifest = {
    ...raw,
    previewUrl: preview.targetUrl,
    thumbnailUrl: thumbnail.targetUrl,
    migration: {
      ...raw.migration,
      status: dryRun ? 'extracted' : 'media-mirrored',
      updatedAt: new Date().toISOString(),
    },
  }

  await fs.writeFile(finalPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ slug, preview, thumbnail, dryRun }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 4: Run dry-run tests**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run test -- scripts/lib/media.test.ts
npm run media:mirror -- --slug=card-avatar --dry-run
test -f remotion/card-avatar/remotionhub.asset.json
```

Expected:

```text
Tests pass.
Dry-run prints sourceUrl, targetUrl, hash, and byteSize for preview and thumbnail.
```

- [ ] **Step 5: Run real media mirror with credentials**

Run with real values:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
ASSETS_R2_ACCOUNT_ID="$ASSETS_R2_ACCOUNT_ID" \
ASSETS_R2_ACCESS_KEY_ID="$ASSETS_R2_ACCESS_KEY_ID" \
ASSETS_R2_SECRET_ACCESS_KEY="$ASSETS_R2_SECRET_ACCESS_KEY" \
ASSETS_R2_BUCKET="$ASSETS_R2_BUCKET" \
ASSETS_PUBLIC_BASE_URL="$ASSETS_PUBLIC_BASE_URL" \
npm run media:mirror -- --slug=card-avatar
```

Expected:

```text
Command exits with code 0.
remotion/card-avatar/remotionhub.asset.json has migration.status "media-mirrored".
previewUrl and thumbnailUrl start with ASSETS_PUBLIC_BASE_URL.
```

- [ ] **Step 6: Commit checkpoint**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git add scripts/lib/media.ts scripts/lib/media.test.ts scripts/upload-media.ts remotion/card-avatar/remotionhub.asset.json
git commit -m "feat: mirror card avatar preview media"
```

Expected:

```text
Commit succeeds in remotionhub-assets.
```

## Task 4: Create Valid Card Avatar Workspace

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/package.json`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/remotion.config.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/src/CardAvatar.tsx`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/src/Root.tsx`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/src/index.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/LICENSE`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/remotionhub.asset.json`

**Interfaces:**
- Consumes: mirrored manifest from Task 3.
- Produces: export `CardAvatar`, `CardAvatarProps`, `cardAvatarDefaultProps`.
- Produces Remotion composition id `CardAvatar`.

- [ ] **Step 1: Create package metadata**

Write `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/package.json`:

```json
{
  "name": "@remotionhub/card-avatar",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc -p ../../tsconfig.base.json --noEmit",
    "render": "remotion render src/Root.tsx CardAvatar out/card-avatar.mp4"
  },
  "dependencies": {}
}
```

- [ ] **Step 2: Create reusable component**

Create `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/src/CardAvatar.tsx`:

```tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export type CardAvatarProps = {
  name: string
  title: string
  avatarBorderColor: string
  avatarBackgroundColor: string
  avatarTextColor: string
  titleColor: string
  avatarStiffness: number
}

export const cardAvatarDefaultProps: CardAvatarProps = {
  name: 'Jane Smith',
  title: 'Creative Director',
  avatarBorderColor: '#a78bfa',
  avatarBackgroundColor: '#312e81',
  avatarTextColor: '#a78bfa',
  titleColor: '#c4b5fd',
  avatarStiffness: 160,
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function CardAvatar(props: CardAvatarProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const initials = getInitials(props.name)

  const slideProgress = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 140 },
  })
  const avatarProgress = spring({
    frame: frame - 6,
    fps,
    config: { damping: 18, stiffness: props.avatarStiffness },
  })
  const textProgress = spring({
    frame: frame - 16,
    fps,
    config: { damping: 25, stiffness: 110 },
  })

  const x = interpolate(slideProgress, [0, 1], [-700, 0])
  const avatarScale = interpolate(avatarProgress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const textOpacity = interpolate(textProgress, [0, 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f0e1a 100%)',
        justifyContent: 'flex-end',
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          transform: `translateX(${x}px)`,
          display: 'flex',
          alignItems: 'center',
          height: 90,
          background: '#1e1b4b',
          paddingRight: 52,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: `3px solid ${props.avatarBorderColor}`,
            background: props.avatarBackgroundColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: 12,
            marginRight: 20,
            transform: `scale(${avatarScale})`,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: props.avatarTextColor,
              fontFamily: 'sans-serif',
              lineHeight: 1,
            }}
          >
            {initials}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            opacity: textOpacity,
          }}
        >
          <div
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: '#ffffff',
              fontFamily: 'sans-serif',
              lineHeight: 1.15,
            }}
          >
            {props.name}
          </div>
          <div
            style={{
              fontSize: 20,
              color: props.titleColor,
              fontFamily: 'sans-serif',
              marginTop: 2,
            }}
          >
            {props.title}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 3: Create Remotion root and export**

Create `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/src/Root.tsx`:

```tsx
import { Composition } from 'remotion'
import { CardAvatar, cardAvatarDefaultProps } from './CardAvatar'

export function RemotionRoot() {
  return (
    <Composition
      id="CardAvatar"
      component={CardAvatar}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={cardAvatarDefaultProps}
    />
  )
}
```

Create `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/src/index.ts`:

```ts
export {
  CardAvatar,
  cardAvatarDefaultProps,
  type CardAvatarProps,
} from './CardAvatar'
```

Create `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/remotion.config.ts`:

```ts
import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
```

Create `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/LICENSE`:

```text
MIT License

Copyright (c) 2026 RemotionHub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Update final manifest props schema**

Modify `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/remotionhub.asset.json` so these fields are exact:

```json
{
  "entryPoint": "src/CardAvatar.tsx",
  "compositionId": "CardAvatar",
  "durationFrames": 120,
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "aspectRatios": ["16:9"],
  "propsSchema": [
    {
      "name": "name",
      "type": "string",
      "defaultValue": "Jane Smith",
      "description": "Primary display name."
    },
    {
      "name": "title",
      "type": "string",
      "defaultValue": "Creative Director",
      "description": "Secondary role or title."
    },
    {
      "name": "avatarBorderColor",
      "type": "string",
      "defaultValue": "#a78bfa",
      "description": "CSS color for the avatar border."
    },
    {
      "name": "avatarBackgroundColor",
      "type": "string",
      "defaultValue": "#312e81",
      "description": "CSS color for the avatar circle background."
    },
    {
      "name": "avatarTextColor",
      "type": "string",
      "defaultValue": "#a78bfa",
      "description": "CSS color for the avatar initials."
    },
    {
      "name": "titleColor",
      "type": "string",
      "defaultValue": "#c4b5fd",
      "description": "CSS color for the title text."
    },
    {
      "name": "avatarStiffness",
      "type": "number",
      "defaultValue": 160,
      "description": "Spring stiffness for the avatar pop-in animation."
    }
  ],
  "extraDependencies": []
}
```

Keep the mirrored `previewUrl` and `thumbnailUrl` from Task 3.

- [ ] **Step 5: Verify TypeScript**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run typecheck
```

Expected:

```text
tsc exits with code 0.
```

- [ ] **Step 6: Render the composition**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npx remotion render remotion/card-avatar/src/Root.tsx CardAvatar remotion/card-avatar/out/card-avatar.mp4
test -s remotion/card-avatar/out/card-avatar.mp4
```

Expected:

```text
Render exits with code 0.
The output mp4 exists and is not empty.
```

- [ ] **Step 7: Commit checkpoint**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git add remotion/card-avatar/package.json remotion/card-avatar/remotion.config.ts remotion/card-avatar/src remotion/card-avatar/LICENSE remotion/card-avatar/remotionhub.asset.json
git commit -m "feat: add card avatar remotion asset"
```

Expected:

```text
Commit succeeds in remotionhub-assets.
```

## Task 5: Generate README and Validate Asset

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/generate-readme.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/validate-case.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/README.md`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`

**Interfaces:**
- Consumes: `readAssetManifest()`.
- Produces: validated README and `migration.status: "validated"` for the case.

- [ ] **Step 1: Implement README generator**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/generate-readme.ts`:

```ts
import fs from 'node:fs/promises'
import process from 'node:process'
import { readAssetManifest } from './lib/assetManifest'

function readArg(name: string) {
  return process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
}

async function main() {
  const slug = readArg('slug') ?? 'card-avatar'
  const manifest = await readAssetManifest(`remotion/${slug}/remotionhub.asset.json`)
  const propsTable = manifest.propsSchema
    .map(
      (prop) =>
        `| \`${prop.name}\` | \`${prop.type}\` | \`${String(prop.defaultValue)}\` | ${prop.description} |`,
    )
    .join('\n')
  const readme = `# ${manifest.displayName}

![Preview](${manifest.thumbnailUrl})

Reusable Remotion component migrated from ${manifest.sourceUrl}.

## Usage

Copy \`src/CardAvatar.tsx\` into your Remotion project and register it in your composition root.

\\\`\\\`\\\`tsx
import { Composition } from 'remotion'
import { CardAvatar, cardAvatarDefaultProps } from './CardAvatar'

export function RemotionRoot() {
  return (
    <Composition
      id="CardAvatar"
      component={CardAvatar}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={cardAvatarDefaultProps}
    />
  )
}
\\\`\\\`\\\`

## Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
${propsTable}

## Extra Dependencies

${manifest.extraDependencies.length > 0 ? manifest.extraDependencies.map((dep) => `- \`${dep}\``).join('\n') : 'None.'}

## Agent Prompt

\\\`\\\`\\\`text
${manifest.prompt}
\\\`\\\`\\\`

## Links

- RemotionHub: https://remotionhub.ai/terence/${manifest.slug}
- Source: https://github.com/remotionhub/remotionhub-assets/tree/main/remotion/${manifest.slug}

## License

${manifest.license}
`

  await fs.writeFile(`remotion/${slug}/README.md`, readme, 'utf8')
  console.log(`Generated remotion/${slug}/README.md`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 2: Implement validation command**

Create `/Users/tangwz/workspace/git/remotionhub-assets/scripts/validate-case.ts`:

```ts
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'
import { readAssetManifest, writeAssetManifest } from './lib/assetManifest'

function readArg(name: string) {
  return process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`)
  }
}

async function main() {
  const slug = readArg('slug') ?? 'card-avatar'
  const manifestPath = `remotion/${slug}/remotionhub.asset.json`
  const manifest = await readAssetManifest(manifestPath)

  if (!process.argv.includes('--manifest-only')) {
    run('npx', ['tsc', '-p', 'tsconfig.base.json', '--noEmit'])
    run('npx', [
      'remotion',
      'render',
      `remotion/${slug}/src/Root.tsx`,
      manifest.compositionId,
      `remotion/${slug}/out/${slug}.mp4`,
    ])
  }

  const readme = await fs.readFile(`remotion/${slug}/README.md`, 'utf8')
  if (!readme.includes('## Props') || !readme.includes('## Agent Prompt')) {
    throw new Error(`README for ${slug} is missing required sections.`)
  }

  await writeAssetManifest(manifestPath, {
    ...manifest,
    migration: {
      ...manifest.migration,
      status: 'validated',
      updatedAt: new Date().toISOString(),
    },
  })
  console.log(`Validated ${slug}.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 3: Generate README and validate**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run readme:generate -- --slug=card-avatar
npm run validate -- --slug=card-avatar
```

Expected:

```text
README is generated.
Validation exits with code 0.
remotion/card-avatar/remotionhub.asset.json has migration.status "validated".
```

- [ ] **Step 4: Update inventory status**

Edit `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json` so `card-avatar` is:

```json
{
  "slug": "card-avatar",
  "status": "validated",
  "sourceFile": "/tmp/remotionlab/案例/card-avatar.md",
  "assetPath": "remotion/card-avatar",
  "updatedAt": "2026-06-20T00:00:00.000Z"
}
```

Use the current timestamp for `updatedAt`.

- [ ] **Step 5: Commit checkpoint**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git add scripts/generate-readme.ts scripts/validate-case.ts remotion/card-avatar/README.md remotion/card-avatar/remotionhub.asset.json manifest/remotionlab-showcase.json
git commit -m "feat: validate card avatar asset"
```

Expected:

```text
Commit succeeds in remotionhub-assets.
```

## Task 6: Add RemotionHub Catalog Entry

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub/shared/catalog.ts`
- Modify: `/Users/tangwz/workspace/git/remotionhub/shared/catalog.test.ts`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-avatar.json`
- Modify: `/Users/tangwz/workspace/git/remotionhub/catalog/components/kinetic-title-pack.json`
- Modify: `/Users/tangwz/workspace/git/remotionhub/catalog/components/hyperframes-lower-third.json`

**Interfaces:**
- Consumes: final asset manifest from `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/remotionhub.asset.json`.
- Produces: RemotionHub catalog JSON importable by `npm run catalog:validate`.

- [ ] **Step 1: Add catalog validation test for canonical repo**

Modify `/Users/tangwz/workspace/git/remotionhub/shared/catalog.test.ts`:

```ts
it('accepts only the canonical RemotionHub asset repository for migrated source', () => {
  const parsed = catalogComponentSchema.parse({
    publisher: 'terence',
    runtime: 'remotion',
    slug: 'card-avatar',
    displayName: 'Card Avatar',
    summary: 'Animated avatar lower-third card for Remotion videos.',
    categories: ['card', 'lower-third'],
    tags: ['remotion', 'avatar', 'profile'],
    status: 'published',
    versions: [
      {
        ...baseVersion,
        artifact: {
          ...baseVersion.artifact,
          githubSource: {
            repo: 'remotionhub/remotionhub-assets',
            ref: 'main',
            commit: 'abc123def456',
            path: 'remotion/card-avatar',
          },
        },
      },
    ],
  })

  expect(parsed.versions[0]?.artifact.githubSource.repo).toBe(
    'remotionhub/remotionhub-assets',
  )
})
```

Also update the existing `baseVersion.artifact.githubSource.repo` value from `tangwz/remotionhub-assets` to `remotionhub/remotionhub-assets`.

- [ ] **Step 2: Add canonical repo refinement**

Modify `/Users/tangwz/workspace/git/remotionhub/shared/catalog.ts` inside `artifactSchema.githubSource.repo`:

```ts
repo: z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
  .refine((value) => value === 'remotionhub/remotionhub-assets', {
    message: 'RemotionHub catalog source must use remotionhub/remotionhub-assets.',
  }),
```

If existing non-migrated fixtures must remain accepted, do not add this refinement yet. Instead, add the test from Step 1 only and update all checked-in catalog fixture repos to the canonical repository. Prefer the refinement if `npm run catalog:validate` passes after fixture updates.

- [ ] **Step 3: Update existing fixture repo references**

In both fixture JSON files, replace:

```json
"repo": "tangwz/remotionhub-assets"
```

with:

```json
"repo": "remotionhub/remotionhub-assets"
```

Update agent prompt strings to say `remotionhub/remotionhub-assets`.

- [ ] **Step 4: Capture asset commit**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git rev-parse HEAD
```

Expected:

```text
Prints the commit hash that contains remotion/card-avatar.
```

- [ ] **Step 5: Add card-avatar catalog JSON**

Run this command from the RemotionHub repository to generate `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-avatar.json` from the final asset manifest and the exact asset repository commit:

```bash
cd /Users/tangwz/workspace/git/remotionhub
node --input-type=module <<'NODE'
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const assetRepo = '/Users/tangwz/workspace/git/remotionhub-assets'
const manifestPath = `${assetRepo}/remotion/card-avatar/remotionhub.asset.json`
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const commit = execFileSync('git', ['-C', assetRepo, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim()

const catalog = {
  publisher: 'terence',
  runtime: 'remotion',
  slug: 'card-avatar',
  displayName: 'Card Avatar',
  summary: 'Animated avatar lower-third card for Remotion videos.',
  categories: ['card', 'lower-third'],
  tags: ['remotion', 'avatar', 'profile'],
  status: 'published',
  versions: [
    {
      version: '1.0.0',
      changelog: 'Initial migrated release from RemotionLab source archive.',
      preview: {
        thumbnailUrl: manifest.thumbnailUrl,
        previewVideoUrl: manifest.previewUrl,
        demoUrl: manifest.sourceUrl,
      },
      metadata: {
        runtime: 'remotion',
        entryPoint: manifest.entryPoint,
        aspectRatios: manifest.aspectRatios,
        durationFrames: manifest.durationFrames,
        fps: manifest.fps,
      },
      tags: ['avatar', 'profile', 'lower-third'],
      artifact: {
        kind: 'github-source',
        githubSource: {
          repo: 'remotionhub/remotionhub-assets',
          ref: 'main',
          commit,
          path: 'remotion/card-avatar',
        },
        license: manifest.license,
        usageMarkdown:
          'Copy `remotion/card-avatar/src/CardAvatar.tsx` into your Remotion project, import `CardAvatar` and `cardAvatarDefaultProps`, then register the `CardAvatar` composition with duration 120, fps 30, width 1920, and height 1080.',
        agentPrompt:
          'Add the Card Avatar Remotion asset from remotionhub/remotionhub-assets at remotion/card-avatar to my project. Preserve the exported CardAvatarProps API and register the CardAvatar composition with the default props.',
      },
    },
  ],
}

await fs.writeFile(
  'catalog/components/card-avatar.json',
  `${JSON.stringify(catalog, null, 2)}\n`,
  'utf8',
)
console.log(`Wrote catalog/components/card-avatar.json at asset commit ${commit}.`)
NODE
```

Expected:

```text
The command prints "Wrote catalog/components/card-avatar.json at asset commit ..." with a real commit hash.
The generated catalog JSON uses the mirrored thumbnailUrl and previewVideoUrl from remotionhub.asset.json.
```

- [ ] **Step 6: Validate catalog and tests**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts
```

Expected:

```text
Catalog validation prints the card-avatar component.
shared/catalog.test.ts passes.
```

- [ ] **Step 7: Commit checkpoint**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
git add shared/catalog.ts shared/catalog.test.ts catalog/components/card-avatar.json catalog/components/kinetic-title-pack.json catalog/components/hyperframes-lower-third.json
git commit -m "feat: add card avatar catalog asset"
```

Expected:

```text
Commit succeeds in remotionhub.
```

## Task 7: Import and Browser-Verify RemotionHub Detail Page

**Files:**
- No required source file changes if Task 6 works.
- Create only local proof artifacts if needed under an ignored proof directory.

**Interfaces:**
- Consumes: `catalog/components/card-avatar.json`.
- Produces: local proof that `/remotion/terence/card-avatar` works in a real browser.

- [ ] **Step 1: Import catalog into local or development Convex**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run catalog:validate
npm run catalog:import -- --apply
```

Expected:

```text
catalog:validate succeeds.
catalog:import imports remotion/terence/card-avatar or skips an identical existing version.
```

If Convex environment variables are missing, create a local fixture route or seed only after recording the missing variable names:

```bash
printf '%s\n' "Missing CONVEX_URL or VITE_CONVEX_URL for catalog import."
```

- [ ] **Step 2: Run RemotionHub locally**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run dev
```

Expected:

```text
Dev server starts on http://localhost:3000.
```

Keep this process running for browser verification.

- [ ] **Step 3: Verify detail page manually in a real browser**

Open:

```text
http://localhost:3000/remotion/terence/card-avatar
```

Expected:

```text
The page shows Card Avatar.
The preview video controls are visible and the video loads.
The thumbnail poster does not show a broken image.
The GitHub source link points to https://github.com/remotionhub/remotionhub-assets/tree/main/remotion/card-avatar.
The usage tab contains the CardAvatar composition setup.
The prompt tab contains the migrated Card Avatar agent prompt.
```

- [ ] **Step 4: Run targeted app tests**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run test -- --run src/components/catalog/DetailPage.test.tsx src/components/catalog/CatalogCard.test.tsx
```

Expected:

```text
Both test files pass.
```

- [ ] **Step 5: Run final gates for this slice**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

Expected:

```text
All commands exit with code 0.
```

- [ ] **Step 6: Record proof values for handoff**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
printf 'Local URL verified: %s\n' 'http://localhost:3000/remotion/terence/card-avatar'
printf 'Asset repository commit: %s\n' "$(git -C /Users/tangwz/workspace/git/remotionhub-assets rev-parse HEAD)"
printf 'RemotionHub repository commit: %s\n' "$(git rev-parse HEAD)"
node --input-type=module <<'NODE'
import fs from 'node:fs/promises'
const catalog = JSON.parse(await fs.readFile('catalog/components/card-avatar.json', 'utf8'))
const preview = catalog.versions[0].preview.previewVideoUrl
const mediaHost = new URL(preview).origin
console.log(`Media host: ${mediaHost}`)
NODE
```

Expected:

```text
The commands print actual commit hashes and the real media host.
Copy these exact output lines into the final implementation handoff.
```

- [ ] **Step 7: Confirm no verification-only source changes were needed**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
git status --short
```

Expected:

```text
No source changes are shown after browser verification.
If source changes are shown, stop and create a focused fix task before committing.
```

## Task 8: Final Review and Handoff

**Files:**
- No planned file changes.

**Interfaces:**
- Consumes: completed commits from asset repo and RemotionHub repo.
- Produces: concise handoff with commands run, URLs, and known follow-ups.

- [ ] **Step 1: Verify both repository statuses**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git status --short
git log --oneline -5
cd /Users/tangwz/workspace/git/remotionhub
git status --short
git log --oneline -5
```

Expected:

```text
Both worktrees are clean or only contain explicitly documented ignored proof artifacts.
Recent commits show the asset workspace and catalog entry commits.
```

- [ ] **Step 2: Re-run core verification**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run test
npm run typecheck
npm run manifest:validate -- --slug=card-avatar
cd /Users/tangwz/workspace/git/remotionhub
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

Expected:

```text
All commands exit with code 0.
```

- [ ] **Step 3: Prepare final handoff**

The final handoff must include:

```text
Summary:
- Created remotionhub-assets workspace and migration tooling.
- Migrated card-avatar into remotion/card-avatar.
- Mirrored preview media to RemotionHub-controlled object storage.
- Added RemotionHub catalog entry pointing at remotionhub/remotionhub-assets.

Verification:
- npm run test
- npm run typecheck
- npm run manifest:validate -- --slug=card-avatar
- npm run catalog:validate
- npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
- Browser URL: http://localhost:3000/remotion/terence/card-avatar

Known follow-ups:
- Batch-generate inventory for the remaining RemotionLab cases.
- Migrate the next small batch only after Terence accepts card-avatar.
- Publish npx workflow only after 3 to 5 assets prove the manifest shape.
```

## Plan Self-Review

Spec coverage:

- Workspace monorepo: Task 1.
- `card-avatar` first migration: Tasks 2, 4, 5, 6, 7.
- Media mirroring: Task 3.
- Sanitization and validation pipeline: Tasks 2, 4, 5.
- README and props template: Task 5.
- RemotionHub catalog source pointer: Task 6.
- Browser preview verification: Task 7.
- CLI direction but no publish: Task 1 manifest shape and Task 8 follow-ups.

Placeholder scan:

- No unresolved template values remain. Runtime-specific values such as mirrored media URLs and asset repository commits are read by commands from generated manifests and `git rev-parse`.
- No task says to add validation or tests without exact commands or expected results.

Type consistency:

- `AssetManifest` is produced by `scripts/lib/assetManifest.ts` and consumed by `upload-media.ts`, `generate-readme.ts`, and `validate-case.ts`.
- `CardAvatarProps`, `cardAvatarDefaultProps`, and `CardAvatar` are exported from `src/CardAvatar.tsx` and re-exported by `src/index.ts`.
- Remotion composition id is consistently `CardAvatar`.
