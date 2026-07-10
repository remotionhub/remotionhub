# RemotionHub Studio Prompt-to-Motion MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated `/studio` workflow that generates private Remotion animations from natural-language prompts, previews them in the browser, supports conversational revisions and rollback, and opens compatible Catalog versions as Remix projects.

**Architecture:** Convex owns Studio projects, immutable revisions, messages, generation runs, ownership checks, and OpenAI orchestration. The browser receives only a complete generated TSX candidate, compiles it with Babel Standalone, and renders it through Remotion Player; no source editor is exposed. Catalog Remix is opt-in through a validated, self-contained Studio Bundle imported from local Catalog declarations.

**Tech Stack:** React 19, TypeScript 6, TanStack Start/Router, Convex + Convex Auth, Zod 4, AI SDK 5, OpenAI provider 2, Babel Standalone 7, Remotion 4, Vitest 4, Testing Library, Playwright.

## Global Constraints

- Implement only under `/studio` plus the minimal Header, root shell, Catalog detail, importer, schema, and documentation integrations required by the feature.
- Any authenticated Convex user may generate; Studio authorization must depend on `users` ID, not the GitHub provider. Future WeChat authentication must not require a Studio ownership migration.
- Do not expose Monaco, generated source, source copy, manual source editing, image attachments, model selection, direct Composition forms, download, sharing, collaboration, or Catalog publishing.
- Keep Preview execution behavior aligned with the approved design: complete generated TSX is compiled in the authenticated page with Babel and `new Function`; do not describe this as a sandbox.
- Compile only complete candidates. Preserve `lastRunnableRevisionId` until the next candidate compiles successfully.
- FPS is always `30`. Supported aspect ratios are `16:9`, `9:16`, and `1:1`. Duration is `30..900` frames; default is `240`.
- A Catalog version is Studio-compatible only when a validated, self-contained Studio Bundle exists. Do not expose bundle source through the public Catalog detail query.
- Keep all backend secrets in Convex env. Never add `OPENAI_API_KEY` or other secrets to Vite, Wrangler plaintext vars, committed env files, logs, or browser payloads.
- Treat the reference repository as behavioral guidance. Do not copy its source or Skill prose verbatim unless licensing is independently confirmed.
- Follow repository style: strict TypeScript, ESM, 2 spaces, single quotes, English identifiers/comments/code, Chinese and English UI through `I18nProvider`.
- Use TDD for every behavior change. Run targeted tests after each red/green cycle and commit each task separately with Conventional Commits.

## File and Responsibility Map

- `shared/studio.ts` — Composition limits, validators, types, normalization, and candidate serialization.
- `convex/schema.ts` — all five Studio tables.
- `convex/lib/access.ts` — provider-neutral authenticated project ownership guard.
- `convex/lib/studioGeneration.ts` — response schemas, Skills, exact edits, bounded context, errors.
- `convex/lib/studioModel.ts` — OpenAI and deterministic test-stub adapters.
- `convex/studio.ts` — Studio queries, mutations, internal Action, candidate handshake, rollback, Remix.
- `src/lib/studio/sanitize.ts` — code-fence removal and exported component extraction.
- `src/lib/studio/compiler.ts` — import validation, Babel transform, runtime injection, component construction.
- `src/components/studio/StudioPreview.tsx` — Remotion Player and last-good Preview behavior.
- `src/components/studio/StudioLanding.tsx` — prompt entry, auth handoff, restoration, examples, recent projects.
- `src/components/studio/StudioWorkspace.tsx` — queries, candidate compile handshake, responsive shell.
- `src/components/studio/StudioChatPanel.tsx` — messages, phases, Follow-up input, retry.
- `src/components/studio/StudioProjectBar.tsx` — title, saved state, source, Composition, History trigger.
- `src/components/studio/StudioHistoryDialog.tsx` — revisions and rollback.
- `src/components/AppChrome.tsx` — Header everywhere and Footer only outside Studio.
- `src/routes/studio/index.tsx` and `src/routes/studio/$projectId.tsx` — Studio routes.
- `shared/catalog.ts`, `scripts/import-catalog.ts`, `convex/components.ts` — Studio Bundle declaration, hydration, persistence, compatibility projection.
- `catalog/studio/card-avatar.tsx`, `catalog/components/card-avatar.json` — first compatible fixture.
- `src/components/catalog/DetailPage.tsx` — conditional Remix action without source exposure.
- `e2e/studio-smoke.pw.test.ts` — signed-out and authenticated smoke.
- `.env.example`, `README.md`, `Makefile`, `playwright.config.ts` — environment and verification workflow.

---

### Task 1: Pin Dependencies and Add the Shared Studio Contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `shared/studio.ts`
- Create: `shared/studio.test.ts`
- Modify: `convex/schema.ts`
- Regenerate: `convex/_generated/dataModel.d.ts`

**Interfaces:**
- Produces: `StudioAspectRatio`, `StudioCompositionInput`, `StudioComposition`, `normalizeStudioComposition(input)`, `serializeStudioCandidate(code, composition)`.
- Produces: the five Studio tables consumed by later tasks.

- [ ] **Step 1: Write the failing Composition tests**

Create `shared/studio.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  normalizeStudioComposition,
  serializeStudioCandidate,
} from './studio'

describe('Studio composition contract', () => {
  it('applies the 16:9 eight-second default at 30 fps', () => {
    expect(normalizeStudioComposition({})).toEqual({
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 240,
    })
  })

  it.each([
    ['16:9', 1920, 1080],
    ['9:16', 1080, 1920],
    ['1:1', 1080, 1080],
  ] as const)('normalizes %s', (aspectRatio, width, height) => {
    expect(
      normalizeStudioComposition({ aspectRatio, durationInFrames: 300 }),
    ).toEqual({ aspectRatio, width, height, fps: 30, durationInFrames: 300 })
  })

  it.each([29, 901])('rejects duration %s', (durationInFrames) => {
    expect(() => normalizeStudioComposition({ durationInFrames })).toThrow()
  })

  it('serializes source and composition deterministically', () => {
    const composition = normalizeStudioComposition({
      aspectRatio: '1:1',
      durationInFrames: 120,
    })
    expect(
      serializeStudioCandidate(
        'export const MyAnimation = () => null',
        composition,
      ),
    ).toBe(
      '{"code":"export const MyAnimation = () => null","composition":{"aspectRatio":"1:1","durationInFrames":120,"fps":30,"height":1080,"width":1080}}',
    )
  })
})
```

- [ ] **Step 2: Verify the red state**

Run:

```bash
npm run test -- shared/studio.test.ts
```

Expected: FAIL because `shared/studio.ts` does not exist.

- [ ] **Step 3: Install exact, reference-compatible dependencies**

```bash
npm install @ai-sdk/openai@2.0.74 ai@5.0.104 @babel/standalone@7.28.5 @remotion/lottie@4.0.487 @remotion/player@4.0.487 @remotion/shapes@4.0.487 @remotion/three@4.0.487 @remotion/transitions@4.0.487 @react-three/fiber@9.1.0 remotion@4.0.487 three@0.178.0
npm install --save-dev @types/babel__standalone@7.1.9 @types/three@0.176.0
```

Expected: `package.json` and `package-lock.json` use the exact versions above.

- [ ] **Step 4: Implement the shared contract**

Create `shared/studio.ts`:

```ts
import { z } from 'zod'

export const STUDIO_FPS = 30
export const STUDIO_DEFAULT_DURATION_IN_FRAMES = 240
export const STUDIO_MIN_DURATION_IN_FRAMES = 30
export const STUDIO_MAX_DURATION_IN_FRAMES = 900

export const studioAspectRatioSchema = z.enum(['16:9', '9:16', '1:1'])
export type StudioAspectRatio = z.infer<typeof studioAspectRatioSchema>

export const studioCompositionInputSchema = z.object({
  aspectRatio: studioAspectRatioSchema.default('16:9'),
  durationInFrames: z
    .number()
    .int()
    .min(STUDIO_MIN_DURATION_IN_FRAMES)
    .max(STUDIO_MAX_DURATION_IN_FRAMES)
    .default(STUDIO_DEFAULT_DURATION_IN_FRAMES),
})

export type StudioCompositionInput = z.input<typeof studioCompositionInputSchema>
export type StudioComposition = {
  aspectRatio: StudioAspectRatio
  width: number
  height: number
  fps: typeof STUDIO_FPS
  durationInFrames: number
}

const dimensions: Record<StudioAspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
}

export function normalizeStudioComposition(
  input: StudioCompositionInput,
): StudioComposition {
  const parsed = studioCompositionInputSchema.parse(input)
  return {
    aspectRatio: parsed.aspectRatio,
    ...dimensions[parsed.aspectRatio],
    fps: STUDIO_FPS,
    durationInFrames: parsed.durationInFrames,
  }
}

export function serializeStudioCandidate(
  code: string,
  composition: StudioComposition,
) {
  return JSON.stringify({
    code,
    composition: {
      aspectRatio: composition.aspectRatio,
      durationInFrames: composition.durationInFrames,
      fps: composition.fps,
      height: composition.height,
      width: composition.width,
    },
  })
}
```

- [ ] **Step 5: Add the Studio validators and tables**

In `convex/schema.ts`, add these validators before `defineSchema()`:

```ts
const studioAspectRatio = v.union(
  v.literal('16:9'),
  v.literal('9:16'),
  v.literal('1:1'),
)

const studioComposition = v.object({
  aspectRatio: studioAspectRatio,
  width: v.number(),
  height: v.number(),
  fps: v.number(),
  durationInFrames: v.number(),
})

const studioSource = v.union(
  v.object({ kind: v.literal('prompt') }),
  v.object({
    kind: v.literal('catalog-remix'),
    componentId: v.id('components'),
    componentVersionId: v.id('componentVersions'),
    ownerHandle: v.string(),
    slug: v.string(),
    version: v.string(),
    commit: v.string(),
    entryPoint: v.string(),
    bundleHash: v.string(),
  }),
)
```

Add these tables inside `defineSchema()`:

```ts
studioProjects: defineTable({
  ownerId: v.id('users'),
  title: v.string(),
  status: v.union(v.literal('active'), v.literal('archived')),
  source: studioSource,
  currentRevisionId: v.optional(v.id('studioRevisions')),
  lastRunnableRevisionId: v.optional(v.id('studioRevisions')),
  currentRunId: v.optional(v.id('studioGenerationRuns')),
  composition: studioComposition,
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_owner_updated', ['ownerId', 'updatedAt'])
  .index('by_owner_status_updated', ['ownerId', 'status', 'updatedAt']),

studioRevisions: defineTable({
  projectId: v.id('studioProjects'),
  sequence: v.number(),
  parentRevisionId: v.optional(v.id('studioRevisions')),
  previousRunnableRevisionId: v.optional(v.id('studioRevisions')),
  origin: v.union(
    v.literal('prompt'),
    v.literal('catalog-remix'),
    v.literal('follow-up'),
    v.literal('correction'),
    v.literal('rollback'),
  ),
  code: v.string(),
  codeHash: v.string(),
  composition: studioComposition,
  promptMessageId: v.optional(v.id('studioMessages')),
  assistantSummary: v.string(),
  createdAt: v.number(),
}).index('by_project_sequence', ['projectId', 'sequence']),

studioMessages: defineTable({
  projectId: v.id('studioProjects'),
  role: v.union(v.literal('user'), v.literal('assistant'), v.literal('system')),
  kind: v.union(
    v.literal('prompt'),
    v.literal('response'),
    v.literal('status'),
    v.literal('error'),
  ),
  content: v.string(),
  generationRunId: v.optional(v.id('studioGenerationRuns')),
  revisionId: v.optional(v.id('studioRevisions')),
  createdAt: v.number(),
}).index('by_project_created', ['projectId', 'createdAt']),

studioGenerationRuns: defineTable({
  projectId: v.id('studioProjects'),
  ownerId: v.id('users'),
  status: v.union(
    v.literal('queued'),
    v.literal('validating'),
    v.literal('selecting-skills'),
    v.literal('generating'),
    v.literal('compiling'),
    v.literal('succeeded'),
    v.literal('failed'),
    v.literal('cancelled'),
  ),
  inputRevisionId: v.optional(v.id('studioRevisions')),
  promptMessageId: v.id('studioMessages'),
  modelAlias: v.string(),
  detectedSkills: v.array(v.string()),
  correctionAttempt: v.number(),
  candidateCode: v.optional(v.string()),
  candidateComposition: v.optional(studioComposition),
  candidateFingerprint: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  tokenUsage: v.optional(
    v.object({ inputTokens: v.number(), outputTokens: v.number() }),
  ),
  durationMs: v.optional(v.number()),
  idempotencyKey: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_project_updated', ['projectId', 'updatedAt'])
  .index('by_owner_idempotency', ['ownerId', 'idempotencyKey']),

studioBundles: defineTable({
  componentVersionId: v.id('componentVersions'),
  entryPoint: v.string(),
  code: v.string(),
  allowedDependencies: v.array(v.string()),
  composition: studioComposition,
  commit: v.string(),
  sourcePath: v.string(),
  contentHash: v.string(),
  status: v.union(v.literal('validated'), v.literal('removed')),
  createdAt: v.number(),
}).index('by_version', ['componentVersionId']),
```

- [ ] **Step 6: Regenerate types and verify green**

```bash
npx convex codegen
npm run test -- shared/studio.test.ts
npm run ci:types-build
```

Expected: shared tests PASS; codegen and type/build exit `0`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json shared/studio.ts shared/studio.test.ts convex/schema.ts convex/_generated/dataModel.d.ts
git commit -m "feat: add studio domain contract"
```

---

### Task 2: Enforce Provider-Neutral Ownership and Revision Semantics

**Files:**
- Modify: `convex/lib/access.ts`
- Create: `convex/studio.ts`
- Create: `convex/studio.test.ts`

**Interfaces:**
- Produces: `requireStudioProjectOwner(ctx, projectId)`.
- Produces public queries: `listRecentProjects`, `getProject`, `listMessages`, `listRevisions`.
- Produces public mutation: `rollbackRevision({ projectId, revisionId, expectedCurrentRevisionId })`.

- [ ] **Step 1: Write failing authorization and rollback tests**

Create `convex/studio.test.ts` using the repository's existing `getAuthUserId` mock pattern. Seed one owner, one second user, one project, and two immutable revisions. Cover these cases:

```ts
it('lists only projects owned by the authenticated user', async () => {
  const owner = t.withIdentity({ subject: ownerId })
  const projects = await owner.query(api.studio.listRecentProjects, {
    limit: 10,
  })
  expect(projects.map((project) => project._id)).toEqual([projectId])
})

it('returns the same unavailable error for missing and foreign projects', async () => {
  const other = t.withIdentity({ subject: otherUserId })
  await expect(
    other.query(api.studio.getProject, { projectId }),
  ).rejects.toThrow('Studio project unavailable')
})

it('rolls back by appending a revision instead of deleting history', async () => {
  const owner = t.withIdentity({ subject: ownerId })
  const result = await owner.mutation(api.studio.rollbackRevision, {
    projectId,
    revisionId: firstRevisionId,
    expectedCurrentRevisionId: secondRevisionId,
  })
  expect(result.sequence).toBe(3)
  expect(result.origin).toBe('rollback')
  expect(result.parentRevisionId).toBe(secondRevisionId)
})

it('rejects a rollback based on a stale current revision', async () => {
  const owner = t.withIdentity({ subject: ownerId })
  await expect(
    owner.mutation(api.studio.rollbackRevision, {
      projectId,
      revisionId: firstRevisionId,
      expectedCurrentRevisionId: firstRevisionId,
    }),
  ).rejects.toThrow('Studio project changed')
})
```

- [ ] **Step 2: Verify the red state**

```bash
npm run test -- convex/studio.test.ts
```

Expected: FAIL because `api.studio` and `requireStudioProjectOwner` do not exist.

- [ ] **Step 3: Add the ownership guard**

Append to `convex/lib/access.ts`:

```ts
export async function requireStudioProjectOwner(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<'studioProjects'>,
) {
  const { userId } = await requireUser(ctx)
  const project = await ctx.db.get(projectId)
  if (!project || project.ownerId !== userId) {
    throw new Error('Studio project unavailable')
  }
  return { project, userId }
}
```

Import `QueryCtx`, `MutationCtx`, and `Id` from the generated Convex types. Do not inspect OAuth provider fields; ownership is the stable `users` document ID returned by `requireUser()`.

- [ ] **Step 4: Implement owner-scoped reads**

Create `convex/studio.ts` with:

```ts
export const listRecentProjects = query({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const { userId } = await requireUser(ctx)
    return await ctx.db
      .query('studioProjects')
      .withIndex('by_owner_status_updated', (q) =>
        q.eq('ownerId', userId).eq('status', 'active'),
      )
      .order('desc')
      .take(Math.min(Math.max(limit, 1), 20))
  },
})

export const getProject = query({
  args: { projectId: v.id('studioProjects') },
  handler: async (ctx, { projectId }) => {
    const { project } = await requireStudioProjectOwner(ctx, projectId)
    const revision = project.currentRevisionId
      ? await ctx.db.get(project.currentRevisionId)
      : null
    const run = project.currentRunId
      ? await ctx.db.get(project.currentRunId)
      : null
    return { project, revision, run }
  },
})
```

Add the two bounded history queries:

```ts
export const listMessages = query({
  args: { projectId: v.id('studioProjects'), limit: v.number() },
  handler: async (ctx, { projectId, limit }) => {
    await requireStudioProjectOwner(ctx, projectId)
    return await ctx.db
      .query('studioMessages')
      .withIndex('by_project_created', (q) => q.eq('projectId', projectId))
      .order('desc')
      .take(Math.min(Math.max(limit, 1), 100))
      .then((messages) => messages.reverse())
  },
})

export const listRevisions = query({
  args: { projectId: v.id('studioProjects'), limit: v.number() },
  handler: async (ctx, { projectId, limit }) => {
    await requireStudioProjectOwner(ctx, projectId)
    return await ctx.db
      .query('studioRevisions')
      .withIndex('by_project_sequence', (q) => q.eq('projectId', projectId))
      .order('desc')
      .take(Math.min(Math.max(limit, 1), 100))
  },
})
```

- [ ] **Step 5: Implement append-only rollback**

Add `rollbackRevision` to `convex/studio.ts`:

```ts
export const rollbackRevision = mutation({
  args: {
    projectId: v.id('studioProjects'),
    revisionId: v.id('studioRevisions'),
    expectedCurrentRevisionId: v.id('studioRevisions'),
  },
  handler: async (ctx, args) => {
    const { project } = await requireStudioProjectOwner(ctx, args.projectId)
    if (project.currentRevisionId !== args.expectedCurrentRevisionId) {
      throw new Error('Studio project changed')
    }
    if (project.currentRunId) throw new Error('Studio generation in progress')
    const target = await ctx.db.get(args.revisionId)
    if (!target || target.projectId !== args.projectId) {
      throw new Error('Studio revision unavailable')
    }
    const latest = await ctx.db
      .query('studioRevisions')
      .withIndex('by_project_sequence', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .first()
    const now = Date.now()
    const revisionId = await ctx.db.insert('studioRevisions', {
      projectId: args.projectId,
      sequence: (latest?.sequence ?? 0) + 1,
      parentRevisionId: args.expectedCurrentRevisionId,
      previousRunnableRevisionId: project.lastRunnableRevisionId,
      origin: 'rollback',
      code: target.code,
      codeHash: target.codeHash,
      composition: target.composition,
      assistantSummary: `Restored revision ${target.sequence}`,
      createdAt: now,
    })
    await ctx.db.patch(args.projectId, {
      currentRevisionId: revisionId,
      lastRunnableRevisionId: revisionId,
      composition: target.composition,
      updatedAt: now,
    })
    return await ctx.db.get(revisionId)
  },
})
```

- [ ] **Step 6: Verify authorization and history semantics**

```bash
npx convex codegen
npm run test -- convex/studio.test.ts
```

Expected: PASS, including unauthenticated, cross-user, stale-write, and append-only rollback cases.

- [ ] **Step 7: Commit**

```bash
git add convex/lib/access.ts convex/studio.ts convex/studio.test.ts convex/_generated
git commit -m "feat: add studio ownership and revision reads"
```

---

### Task 3: Define the Model Contract, Skills, Exact Edits, and Bounded Context

**Files:**
- Create: `convex/lib/studioGeneration.ts`
- Create: `convex/lib/studioGeneration.test.ts`

**Interfaces:**
- Produces: `generatedMotionSchema`, `followUpResponseSchema`, `applyExactEdits`, `selectNewSkills`, `buildStudioContext`, `normalizeGenerationError`.
- Keeps model output structured and Composition server-validated.

- [ ] **Step 1: Write failing pure-function tests**

Create `convex/lib/studioGeneration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyExactEdits,
  buildStudioContext,
  generatedMotionSchema,
  selectNewSkills,
} from './studioGeneration'

describe('Studio generation contract', () => {
  it('accepts complete source plus a supported composition', () => {
    const result = generatedMotionSchema.parse({
      code: 'export const MyAnimation = () => null',
      summary: 'Created a title animation',
      composition: { aspectRatio: '9:16', durationInFrames: 300 },
    })
    expect(result.composition.aspectRatio).toBe('9:16')
  })

  it('rejects unsupported ratios and duration bounds', () => {
    expect(() =>
      generatedMotionSchema.parse({
        code: 'export const MyAnimation = () => null',
        summary: 'Invalid',
        composition: { aspectRatio: '4:3', durationInFrames: 20 },
      }),
    ).toThrow()
  })

  it('applies exact edits only when old_string has one match', () => {
    expect(
      applyExactEdits('const color = "red"', [
        { oldString: '"red"', newString: '"blue"', description: 'Color' },
      ]),
    ).toBe('const color = "blue"')
    expect(() =>
      applyExactEdits('red red', [
        { oldString: 'red', newString: 'blue', description: 'Color' },
      ]),
    ).toThrow('exactly once')
    expect(() =>
      applyExactEdits('green', [
        { oldString: 'red', newString: 'blue', description: 'Color' },
      ]),
    ).toThrow('exactly once')
  })

  it('does not reinject skills already used in the conversation', () => {
    expect(selectNewSkills(['Typography', 'Charts'], ['Typography'])).toEqual([
      'Charts',
    ])
  })

  it('bounds recent messages and source length', () => {
    const context = buildStudioContext({
      code: 'x'.repeat(120_000),
      messages: Array.from({ length: 30 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `message-${index}`,
      })),
    })
    expect(context.code.length).toBe(100_000)
    expect(context.messages).toHaveLength(12)
    expect(context.messages[0]?.content).toBe('message-18')
  })
})
```

- [ ] **Step 2: Verify the red state**

```bash
npm run test -- convex/lib/studioGeneration.test.ts
```

Expected: FAIL because the generation contract does not exist.

- [ ] **Step 3: Implement schemas and the fixed Skill vocabulary**

Create `convex/lib/studioGeneration.ts`:

```ts
import { z } from 'zod'
import { studioCompositionInputSchema } from '../../shared/studio'

export const STUDIO_SKILLS = [
  'Typography',
  'Charts',
  'Messaging',
  'Transitions',
  'Sequencing',
  'Spring Physics',
  'Social Media',
  '3D',
] as const

const skillSchema = z.enum(STUDIO_SKILLS)
const exactEditSchema = z.object({
  oldString: z.string().min(1),
  newString: z.string(),
  description: z.string().min(1).max(200),
})

export const generatedMotionSchema = z.object({
  code: z.string().min(1).max(100_000),
  summary: z.string().min(1).max(500),
  composition: studioCompositionInputSchema,
})

export const followUpResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('edits'),
    edits: z.array(exactEditSchema).min(1).max(20),
    summary: z.string().min(1).max(500),
    composition: studioCompositionInputSchema.optional(),
  }),
  z.object({
    kind: z.literal('replacement'),
    code: z.string().min(1).max(100_000),
    summary: z.string().min(1).max(500),
    composition: studioCompositionInputSchema,
  }),
])

export const skillSelectionSchema = z.object({
  skills: z.array(skillSchema).max(STUDIO_SKILLS.length),
})

export const promptValidationSchema = z.object({
  allow: z.boolean(),
  reason: z.string().max(300),
})
```

Write original, concise internal prompt text for these eight skills in this file. Each entry should define output constraints and allowed Remotion APIs, not reproduce prose from the reference repository.

- [ ] **Step 4: Implement exact edits, bounded context, and stable errors**

Add:

```ts
export function applyExactEdits(
  source: string,
  edits: Array<z.infer<typeof exactEditSchema>>,
) {
  return edits.reduce((current, edit) => {
    const first = current.indexOf(edit.oldString)
    const second = current.indexOf(edit.oldString, first + edit.oldString.length)
    if (first < 0 || second >= 0) {
      throw new Error('old_string must match exactly once')
    }
    return `${current.slice(0, first)}${edit.newString}${current.slice(
      first + edit.oldString.length,
    )}`
  }, source)
}

export function selectNewSkills(detected: string[], used: string[]) {
  const usedSet = new Set(used)
  return detected.filter(
    (skill): skill is (typeof STUDIO_SKILLS)[number] =>
      skillSchema.safeParse(skill).success && !usedSet.has(skill),
  )
}

export function buildStudioContext(input: {
  code: string
  messages: Array<{ role: string; content: string }>
}) {
  return {
    code: input.code.slice(0, 100_000),
    messages: input.messages.slice(-12).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4_000),
    })),
  }
}

export function normalizeGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('old_string')) return 'EDIT_NOT_UNIQUE'
  if (message.includes('rate') || message.includes('429')) return 'MODEL_RATE_LIMIT'
  if (message.includes('timeout')) return 'MODEL_TIMEOUT'
  return 'MODEL_FAILED'
}

export async function validatePromptWithFallback(
  validate: () => Promise<z.infer<typeof promptValidationSchema>>,
) {
  try {
    return promptValidationSchema.parse(await validate())
  } catch {
    return { allow: true, reason: 'validation-unavailable' }
  }
}

export async function detectSkillsWithFallback(
  detect: () => Promise<z.infer<typeof skillSelectionSchema>>,
) {
  try {
    return skillSelectionSchema.parse(await detect()).skills
  } catch {
    return []
  }
}
```

Append these degradation tests:

```ts
it('allows generation when prompt validation is unavailable', async () => {
  await expect(
    validatePromptWithFallback(async () => {
      throw new Error('timeout')
    }),
  ).resolves.toEqual({ allow: true, reason: 'validation-unavailable' })
})

it('uses no skills when skill detection is unavailable', async () => {
  await expect(
    detectSkillsWithFallback(async () => {
      throw new Error('timeout')
    }),
  ).resolves.toEqual([])
})
```

- [ ] **Step 5: Verify green and commit**

```bash
npm run test -- convex/lib/studioGeneration.test.ts
git add convex/lib/studioGeneration.ts convex/lib/studioGeneration.test.ts
git commit -m "feat: define studio generation contract"
```

Expected: all pure generation tests PASS and the commit succeeds.

---

### Task 4: Implement Generation Runs, the OpenAI Adapter, and Candidate Confirmation

**Files:**
- Create: `convex/lib/studioModel.ts`
- Create: `convex/lib/studioModel.test.ts`
- Modify: `convex/studio.ts`
- Modify: `convex/studio.test.ts`
- Modify: `.env.example`
- Regenerate: `convex/_generated/api.d.ts`

**Interfaces:**
- Produces mutations: `startPromptProject`, `startFollowUp`, `acceptCandidate`, `rejectCandidate`, `reportRuntimeFailure`.
- Produces internal Action: `runGeneration` plus internal read/write helpers.
- Produces `createStudioModel(env)` with real OpenAI and deterministic stub modes.

- [ ] **Step 1: Add failing run-state tests**

Extend `convex/studio.test.ts` with tests proving:

```ts
it('creates the project, prompt message, and run atomically', async () => {
  const result = await owner.mutation(api.studio.startPromptProject, {
    prompt: 'Animate a cyan title entering with spring motion',
    idempotencyKey: 'prompt-1',
  })
  expect(result).toMatchObject({ status: 'queued' })
  const snapshot = await owner.query(api.studio.getProject, {
    projectId: result.projectId,
  })
  expect(snapshot.project.currentRunId).toBe(result.runId)
  expect(snapshot.project.ownerId).toBe(ownerId)
})

it('returns the existing run for the same owner idempotency key', async () => {
  const first = await startPrompt('same-key')
  const second = await startPrompt('same-key')
  expect(second).toEqual(first)
})

it('allows only one active run per project', async () => {
  await expect(startFollowUp(projectId, 'run-2')).rejects.toThrow(
    'Studio generation in progress',
  )
})

it('accepts only the current candidate fingerprint', async () => {
  await expect(
    owner.mutation(api.studio.acceptCandidate, {
      projectId,
      runId,
      candidateFingerprint: 'stale',
    }),
  ).rejects.toThrow('Studio candidate changed')
})

it('preserves the last runnable revision after rejection', async () => {
  await owner.mutation(api.studio.rejectCandidate, {
    projectId,
    runId,
    candidateFingerprint,
    normalizedError: 'Unexpected token at line 3',
  })
  const snapshot = await owner.query(api.studio.getProject, { projectId })
  expect(snapshot.project.lastRunnableRevisionId).toBe(previousRevisionId)
})

it('restores the previous runnable revision after a committed runtime error', async () => {
  const result = await owner.mutation(api.studio.reportRuntimeFailure, {
    projectId,
    revisionId: failingRevisionId,
    normalizedError: 'Runtime error at frame 90',
  })
  const snapshot = await owner.query(api.studio.getProject, { projectId })
  expect(snapshot.project.currentRevisionId).toBe(previousRevisionId)
  expect(snapshot.project.lastRunnableRevisionId).toBe(previousRevisionId)
  expect(snapshot.project.currentRunId).toBe(result.runId)
})
```

Also test that a fourth rejection marks the Run `failed`, clears `currentRunId`, and does not change `currentRevisionId`.

- [ ] **Step 2: Verify the red state**

```bash
npm run test -- convex/studio.test.ts
```

Expected: FAIL because the run mutations and Action are missing.

- [ ] **Step 3: Build an injectable model adapter**

Create `convex/lib/studioModel.ts`. Keep Convex Action orchestration out of this module so its model behavior is unit-testable:

```ts
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import {
  followUpResponseSchema,
  generatedMotionSchema,
  promptValidationSchema,
  skillSelectionSchema,
} from './studioGeneration'

type StudioModelInput = {
  prompt: string
  system: string
}

type StudioModelResult<T> = {
  data: T
  usage: { inputTokens: number; outputTokens: number }
}

export type StudioModel = {
  validatePrompt(input: StudioModelInput): Promise<StudioModelResult<z.infer<typeof promptValidationSchema>>>
  detectSkills(input: StudioModelInput): Promise<StudioModelResult<z.infer<typeof skillSelectionSchema>>>
  generateInitial(input: StudioModelInput): Promise<StudioModelResult<z.infer<typeof generatedMotionSchema>>>
  generateFollowUp(input: StudioModelInput): Promise<StudioModelResult<z.infer<typeof followUpResponseSchema>>>
  correct(input: StudioModelInput): Promise<StudioModelResult<z.infer<typeof generatedMotionSchema>>>
}

const stubMotion = {
  code: [
    'export const MyAnimation = () => {',
    '  const frame = useCurrentFrame()',
    '  return <AbsoluteFill style={{backgroundColor: "#090b10", color: "#8de8e8", justifyContent: "center", alignItems: "center"}}><div style={{fontSize: 96, opacity: interpolate(frame, [0, 30], [0, 1], {extrapolateRight: "clamp"})}}>RemotionHub Studio</div></AbsoluteFill>',
    '}',
  ].join('\n'),
  summary: 'Created a cyan title reveal',
  composition: { aspectRatio: '16:9' as const, durationInFrames: 240 },
}

export function createStudioModel(
  env: Record<string, string | undefined>,
): StudioModel {
  if (env.STUDIO_MODEL_MODE === 'stub') {
    const result = <T,>(data: T): StudioModelResult<T> => ({
      data,
      usage: { inputTokens: 0, outputTokens: 0 },
    })
    return {
      async validatePrompt() {
        return result({ allow: true, reason: 'stub' })
      },
      async detectSkills() {
        return result({ skills: [] })
      },
      async generateInitial() {
        return result(stubMotion)
      },
      async generateFollowUp() {
        return result({
          kind: 'replacement',
          ...stubMotion,
          summary: 'Updated the title motion',
        })
      },
      async correct() {
        return result(stubMotion)
      },
    }
  }

  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const openai = createOpenAI({ apiKey })
  const modelName = env.STUDIO_OPENAI_MODEL ?? 'gpt-5.2'
  async function structured<TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    input: StudioModelInput,
  ): Promise<StudioModelResult<z.infer<TSchema>>> {
    const { object, usage } = await generateObject({
      model: openai(modelName),
      schema,
      system: input.system,
      prompt: input.prompt,
    })
    return {
      data: object,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
    }
  }
  return {
    validatePrompt: (input) => structured(promptValidationSchema, input),
    detectSkills: (input) => structured(skillSelectionSchema, input),
    generateInitial: (input) => structured(generatedMotionSchema, input),
    generateFollowUp: (input) => structured(followUpResponseSchema, input),
    correct: (input) => structured(generatedMotionSchema, input),
  }
}
```

The production system prompt must require one exported `MyAnimation` component, no imports beyond the runtime allowlist, no network/storage/DOM APIs, no dynamic import, no eval-like APIs, and a structured Composition. The stub is for deterministic local/CI smoke only and must never be selected by a browser value.

- [ ] **Step 4: Test the model adapter without network calls**

Create `convex/lib/studioModel.test.ts`:

```ts
it('returns a schema-valid deterministic stub', async () => {
  const model = createStudioModel({ STUDIO_MODEL_MODE: 'stub' })
  const result = generatedMotionSchema.parse(
    (await model.generateInitial({ prompt: 'test', system: 'test' })).data,
  )
  expect(result.summary).toBe('Created a cyan title reveal')
  expect(
    followUpResponseSchema.parse(
      (await model.generateFollowUp({ prompt: 'test', system: 'test' })).data,
    ).kind,
  ).toBe('replacement')
})

it('requires a backend key outside stub mode', () => {
  expect(() => createStudioModel({})).toThrow('OPENAI_API_KEY')
})
```

Run:

```bash
npm run test -- convex/lib/studioModel.test.ts
```

Expected: PASS without internet access.

- [ ] **Step 5: Implement atomic Run creation and scheduling**

Add validators for Prompt length `1..4000` and idempotency key length `8..200`. Implement `startPromptProject` so one Mutation:

1. calls `requireUser()`;
2. returns the existing Run found by `by_owner_idempotency`;
3. inserts project, user message, and queued Run;
4. patches `currentRunId` and the message's `generationRunId`;
5. schedules `internal.studio.runGeneration` with `{ runId }`.

Every inserted Run stores `modelAlias: 'studio-default'`; the browser never receives or chooses the environment model name behind that alias.

Use this return contract consistently:

```ts
return { projectId, runId, status: 'queued' as const }
```

Implement `startFollowUp` with `{ projectId, prompt, idempotencyKey, expectedCurrentRevisionId }`. It must call `requireStudioProjectOwner`, reject a stale revision or active Run, attach `inputRevisionId`, and perform message/Run/scheduling writes in the same Mutation.

- [ ] **Step 6: Implement the internal Action state machine**

Implement `runGeneration` as an `internalAction` using only `internalQuery`/`internalMutation` helpers to load and update the Run. The exact state order is:

```text
queued -> validating -> selecting-skills -> generating -> compiling
```

The Action must:

- load the Run, Project, prompt message, current Revision, and at most 12 recent messages server-side;
- validate motion intent, degrading open only when the validation model itself fails; an explicit `{ allow: false }` ends the Run with `INVALID_PROMPT` while preserving the project and prompt message;
- detect only the eight allowed Skills, degrading to no Skill on detector failure; union Skills from the latest 20 project Runs and call `selectNewSkills()` before prompt injection;
- generate initial complete source, or parse `followUpResponseSchema` and either apply unique exact edits or accept its complete replacement; retain the current Composition when an edit response omits it;
- normalize the Composition with `normalizeStudioComposition()`;
- compute `candidateFingerprint` as lower-case SHA-256 hex of `serializeStudioCandidate(code, composition)`;
- store the complete candidate and fingerprint, set status `compiling`, and never create a Revision here;
- aggregate adapter token usage into `tokenUsage`, measure wall-clock generation time into `durationMs`, store the complete candidate and fingerprint, set status `compiling`, and never create a Revision here;
- on model failure set the stable `errorCode`, status `failed`, clear `project.currentRunId`, and preserve both Revision pointers.

Set Revision origin to `prompt` for the first successful Run, `follow-up` for a normal update, and `correction` whenever `correctionAttempt > 0`.

Call the degradation helpers on adapter data, while accumulating each call's usage separately:

```ts
const validation = await validatePromptWithFallback(async () => {
  const call = await model.validatePrompt(validationInput)
  addUsage(call.usage)
  return call.data
})

const detectedSkills = await detectSkillsWithFallback(async () => {
  const call = await model.detectSkills(skillInput)
  addUsage(call.usage)
  return call.data
})
```

Hash helper:

```ts
export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
```

Do not log full Prompt, source, raw model response, or browser error. Log only Run ID, phase, model alias, elapsed time, token counts, and stable error code.

- [ ] **Step 7: Implement accept/reject with optimistic guards**

`acceptCandidate` must re-check owner, `project.currentRunId`, Run ownership/project/status, and exact fingerprint. In one Mutation it must create the next immutable Revision with `previousRunnableRevisionId: project.lastRunnableRevisionId`, create the assistant response message, set Run `succeeded`, clear `candidateCode`, update both project Revision pointers and Composition, and clear `currentRunId`.

`rejectCandidate` accepts a browser-normalized error capped at 2,000 characters. It must re-check the same identity/fingerprint constraints, increment `correctionAttempt`, clear the candidate, and either:

- set status back to `queued` and schedule `runGeneration` with sanitized correction context when attempt is `1..3`; or
- mark failed and clear `currentRunId` after attempt `3` has already been used.

Every correction remains part of the same Run; a successful correction creates a Revision with origin `correction`.

Add `reportRuntimeFailure({ projectId, revisionId, normalizedError })`. It must be idempotent per owner and Revision using `idempotencyKey: runtime-failure:${revisionId}`. After owner and current-Revision checks, load `revision.previousRunnableRevisionId`, restore both project Revision pointers to that value, keep the failed Revision immutable, insert a system error message, create a queued Run with `inputRevisionId` set to the failed Revision and `correctionAttempt: 1`, set `currentRunId`, and schedule `runGeneration`. If there is no previous runnable Revision, clear both optional pointers while retaining the project Composition until correction succeeds. Repeated reports return the already-created Run.

Cover cross-user reporting, stale Revision reporting, repeat idempotency, no-fallback initial generation, and successful correction creating a new Revision whose `previousRunnableRevisionId` is the restored project pointer.

- [ ] **Step 8: Document backend-only environment values**

Append to `.env.example` as comments, without values that look usable:

```dotenv
# Studio backend values live in Convex env, never in VITE_* browser env.
# OPENAI_API_KEY=set-with-convex-env
# STUDIO_OPENAI_MODEL=gpt-5.2
# STUDIO_MODEL_MODE=stub
```

- [ ] **Step 9: Verify and commit**

```bash
npx convex codegen
npm run test -- convex/studio.test.ts convex/lib/studioGeneration.test.ts convex/lib/studioModel.test.ts
npm run ci:types-build
git add convex/studio.ts convex/studio.test.ts convex/lib/studioModel.ts convex/lib/studioModel.test.ts .env.example convex/_generated
git commit -m "feat: orchestrate studio generation runs"
```

Expected: all Run, ownership, correction, and stub adapter tests PASS; type/build exits `0`.

---

### Task 5: Build the Browser Compiler and Last-Good Remotion Preview

**Files:**
- Create: `shared/studioSource.ts`
- Create: `shared/studioSource.test.ts`
- Create: `src/lib/studio/sanitize.ts`
- Create: `src/lib/studio/sanitize.test.ts`
- Create: `src/lib/studio/compiler.ts`
- Create: `src/lib/studio/compiler.test.tsx`
- Create: `src/components/studio/StudioPreview.tsx`
- Create: `src/components/studio/StudioPreview.test.tsx`

**Interfaces:**
- Produces: `validateAndStripStudioImports(source, declaredDependencies?)`, `sanitizeGeneratedSource(raw)`, `compileStudioComponent(source)`, `StudioPreview`.
- Compiles complete source only and preserves the last renderable component on candidate failure.

- [ ] **Step 1: Write failing sanitizer and compiler tests**

Create tests for:

```ts
it('removes one markdown fence without accepting prose', () => {
  expect(
    sanitizeGeneratedSource(
      '```tsx\nexport const MyAnimation = () => <div />\n```',
    ),
  ).toBe('export const MyAnimation = () => <div />')
  expect(() =>
    sanitizeGeneratedSource('Here is the code:\nexport const MyAnimation = () => null'),
  ).toThrow('Generated response must contain source only')
})

it('accepts only allowlisted static imports', () => {
  expect(() =>
    compileStudioComponent(
      "import leftPad from 'left-pad'\nexport const MyAnimation = () => null",
    ),
  ).toThrow('Unsupported Studio dependency')
})

it.each(['window', 'document', 'localStorage', 'fetch(', 'import(', 'require('])(
  'rejects forbidden source token %s',
  (token) => {
    expect(() =>
      compileStudioComponent(
        `export const MyAnimation = () => { ${token}; return null }`,
      ),
    ).toThrow('Unsupported Studio API')
  },
)

it('returns the required exported component', () => {
  const Component = compileStudioComponent(
    'export const MyAnimation = () => <AbsoluteFill data-testid="motion" />',
  )
  render(<Component />)
  expect(screen.getByTestId('motion')).toBeInTheDocument()
})

it('rejects responses larger than 100 KB', () => {
  expect(() =>
    compileStudioComponent(
      `export const MyAnimation = () => null;/*${'x'.repeat(100_001)}*/`,
    ),
  ).toThrow('Studio source is too large')
})
```

- [ ] **Step 2: Verify the red state**

```bash
npm run test -- src/lib/studio/sanitize.test.ts src/lib/studio/compiler.test.tsx
```

Expected: FAIL because the runtime modules do not exist.

- [ ] **Step 3: Implement strict response sanitization**

In `sanitize.ts`, trim the response; unwrap exactly one full-response `tsx`, `ts`, `jsx`, or `javascript` fence; reject leading/trailing prose; require `export const MyAnimation` or `export function MyAnimation`; normalize line endings. Do not try to recover source from an arbitrary mixed Markdown response.

Core fence rule:

```ts
const fencedSource = /^```(?:tsx|ts|jsx|javascript)?\s*\n([\s\S]*?)\n```$/
```

- [ ] **Step 4: Implement shared import and API validation before Babel**

Create `shared/studioSource.ts` and define this exact package allowlist:

```ts
const ALLOWED_IMPORTS = new Set([
  'react',
  'remotion',
  '@remotion/player',
  '@remotion/shapes',
  '@remotion/transitions',
  '@remotion/lottie',
  '@remotion/three',
  '@react-three/fiber',
  'three',
])

const FORBIDDEN_PATTERNS = [
  /\bwindow\b/,
  /\bdocument\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
]
```

Parse static import declarations, reject any source package outside the allowlist, and remove accepted import declarations because those APIs are injected. When `declaredDependencies` is provided, require every imported package to appear in it. Reject relative paths, side-effect imports, and unresolved import/export-from syntax after removal. These checks reduce accidental misuse; add a code comment stating they are not a security boundary. Import this function from `compiler.ts` and cover it in `shared/studioSource.test.ts`; Task 8 reuses the same validator during Catalog import.

- [ ] **Step 5: Transform and construct the component**

Import React and the public exports from all allowlisted runtime packages. Build a frozen runtime map, then transform:

```ts
const transformed = Babel.transform(sourceWithoutImports, {
  filename: 'studio-candidate.tsx',
  presets: ['typescript', 'react'],
  plugins: ['transform-modules-commonjs'],
  sourceType: 'module',
}).code

const module = { exports: {} as Record<string, unknown> }
const names = Object.keys(runtime)
const values = Object.values(runtime)
const factory = new Function(
  ...names,
  'module',
  'exports',
  '"use strict";\n' + transformed,
)
factory(...values, module, module.exports)
const component = module.exports.MyAnimation
if (typeof component !== 'function') {
  throw new Error('MyAnimation export is required')
}
return component as React.ComponentType
```

Reject source above 100,000 UTF-16 code units before any parse or transform. Keep compiler errors normalized to a message, generated line/column, and error code; do not attach browser globals, account information, or full stack traces to `rejectCandidate`.

- [ ] **Step 6: Verify compiler tests green**

```bash
npm run test -- shared/studioSource.test.ts src/lib/studio/sanitize.test.ts src/lib/studio/compiler.test.tsx
```

Expected: PASS for fenced source, allowlist, forbidden APIs, size limit, export extraction, and a minimal Remotion render.

- [ ] **Step 7: Write failing last-good Preview tests**

Create `StudioPreview.test.tsx` and mock `@remotion/player` with a component that renders the supplied `component`. Prove:

```ts
it('keeps the last runnable component when a candidate fails', async () => {
  const { rerender } = render(
    <StudioPreview revisionCode={goodSource} candidate={null} onCandidateResult={vi.fn()} />,
  )
  expect(await screen.findByText('Last good')).toBeInTheDocument()

  rerender(
    <StudioPreview
      revisionCode={goodSource}
      candidate={{ code: brokenSource, fingerprint: 'bad', composition }}
      onCandidateResult={onCandidateResult}
    />,
  )
  expect(await screen.findByText('Last good')).toBeInTheDocument()
  expect(onCandidateResult).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'rejected', fingerprint: 'bad' }),
  )
})
```

Also cover a successful candidate replacing the Player and a caught runtime Error Boundary restoring the previous component.

- [ ] **Step 8: Implement `StudioPreview`**

The component accepts:

```ts
type StudioPreviewProps = {
  revisionId: string | null
  revisionCode: string | null
  revisionComposition: StudioComposition
  candidate: {
    code: string
    fingerprint: string
    composition: StudioComposition
  } | null
  onCandidateResult(result: {
    status: 'accepted' | 'rejected'
    fingerprint: string
    error?: string
  }): void
  onRevisionRuntimeError(result: {
    revisionId: string
    error: string
  }): void
}
```

Compile `revisionCode` on load and candidate source only when the complete fingerprint changes. Hold `lastGood` as `{ component, composition }`. Notify `accepted` only after compilation and the first error-free React commit. Wrap the Player in an Error Boundary; on candidate runtime failure before acceptance, restore `lastGood`, stop candidate playback, and notify one normalized rejection. When the failing component belongs to a committed `revisionId`, call `onRevisionRuntimeError` once for that Revision so the backend restores `previousRunnableRevisionId` and starts correction. Render textual loading/error states outside the video rectangle for accessibility.

Configure Player from Composition only:

```tsx
<Player
  component={lastGood.component}
  durationInFrames={lastGood.composition.durationInFrames}
  fps={30}
  compositionWidth={lastGood.composition.width}
  compositionHeight={lastGood.composition.height}
  controls
  loop
/>
```

- [ ] **Step 9: Verify and commit**

```bash
npm run test -- shared/studioSource.test.ts src/lib/studio/sanitize.test.ts src/lib/studio/compiler.test.tsx src/components/studio/StudioPreview.test.tsx
npm run ci:types-build
git add shared/studioSource.ts shared/studioSource.test.ts src/lib/studio src/components/studio/StudioPreview.tsx src/components/studio/StudioPreview.test.tsx
git commit -m "feat: add studio browser preview runtime"
```

Expected: sanitizer, compiler, and last-good Preview tests PASS; type/build exits `0`.

---

### Task 6: Add Studio App Chrome and the Auth-Aware Landing Route

**Files:**
- Create: `src/components/AppChrome.tsx`
- Create: `src/components/AppChrome.test.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/routes/-routes.test.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Header.test.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/lib/i18n.test.ts`
- Create: `src/components/studio/StudioLanding.tsx`
- Create: `src/components/studio/StudioLanding.test.tsx`
- Create: `src/routes/studio/index.tsx`
- Regenerate: `src/routeTree.gen.ts`

**Interfaces:**
- Produces `/studio` as a public viewing route with authenticated submission.
- Persists an unauthenticated draft only in `sessionStorage` under `remotionhub.studio.pendingPrompt`.
- Hides Footer for all `/studio` paths while retaining the global Header.

- [ ] **Step 1: Write failing shell and route tests**

Add tests that prove:

```ts
it('keeps Header but removes Footer for the Studio namespace', () => {
  renderAppChrome('/studio/project-1')
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
})

it('keeps Footer outside Studio', () => {
  renderAppChrome('/remotion')
  expect(screen.getByRole('contentinfo')).toBeInTheDocument()
})

it('registers the Studio landing route', () => {
  expect(route('/studio/').component).toBeTypeOf('function')
})
```

Import `./studio/index` beside the existing route side-effect imports and mock `StudioLanding` with a small labeled test component so this route test stays focused on registration and metadata. Task 7 adds the project route assertion when that file exists.

In `Header.test.tsx`, assert a visible Studio navigation link. In `i18n.test.ts`, rely on the existing key-parity test to fail until both dictionaries contain every Studio key.

- [ ] **Step 2: Verify the shell tests are red**

```bash
npm run test -- src/components/AppChrome.test.tsx src/components/Header.test.tsx src/routes/-routes.test.tsx src/lib/i18n.test.ts
```

Expected: FAIL because AppChrome, navigation, route entries, and translations are missing.

- [ ] **Step 3: Implement route-aware app chrome**

Create `AppChrome.tsx`:

```tsx
export default function AppChrome({ children }: PropsWithChildren) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isStudio = pathname === '/studio' || pathname.startsWith('/studio/')
  return (
    <>
      <Header />
      {children}
      {!isStudio && <Footer />}
    </>
  )
}
```

Replace the direct Header/Footer composition in `__root.tsx` with `<AppChrome>{children}</AppChrome>`. Add a `Studio` Link to Header between Catalog and Remotion and give it the same active treatment as existing nav items.

- [ ] **Step 4: Add the complete bilingual Studio dictionary**

Add matching Chinese and English keys for:

```text
nav.studio
studio.landing.eyebrow
studio.landing.title
studio.landing.description
studio.landing.placeholder
studio.landing.submit
studio.landing.examples
studio.landing.recent
studio.landing.emptyRecent
studio.auth.required
studio.status.validating
studio.status.selectingSkills
studio.status.generating
studio.status.compiling
studio.status.ready
studio.status.failed
studio.chat.label
studio.chat.placeholder
studio.chat.send
studio.preview.label
studio.preview.unavailable
studio.history.label
studio.history.restore
studio.history.confirm
studio.revision.originPrompt
studio.revision.originRemix
studio.revision.originFollowUp
studio.revision.originCorrection
studio.revision.originRollback
studio.project.saved
studio.project.saving
studio.project.sourcePrompt
studio.project.sourceRemix
studio.tabs.chat
studio.tabs.preview
studio.retry
studio.error.invalidPrompt
studio.error.modelUnavailable
studio.error.previewFailed
studio.error.projectChanged
studio.unavailable.title
studio.unavailable.description
detail.remixInStudio
```

Use concise UI copy; do not mention source execution or security limits in routine controls.

- [ ] **Step 5: Write failing landing interaction tests**

Mock `useAuthStatus`, `useAuthActions`, Convex `useQuery`/`useMutation`, and navigation. Cover:

```ts
it('stores the draft and starts sign-in when a signed-out user submits', async () => {
  renderLanding({ authenticated: false })
  await user.type(screen.getByRole('textbox'), 'Animate a product launch')
  await user.click(screen.getByRole('button', { name: /生成|generate/i }))
  expect(sessionStorage.getItem(PENDING_PROMPT_KEY)).toBe(
    'Animate a product launch',
  )
  expect(signIn).toHaveBeenCalledWith('github', { redirectTo: '/studio' })
})

it('restores and submits the draft after authentication', async () => {
  sessionStorage.setItem(PENDING_PROMPT_KEY, 'Animate a product launch')
  renderLanding({ authenticated: true })
  expect(screen.getByRole('textbox')).toHaveValue('Animate a product launch')
  await user.click(screen.getByRole('button', { name: /生成|generate/i }))
  expect(startPromptProject).toHaveBeenCalledWith(
    expect.objectContaining({ prompt: 'Animate a product launch' }),
  )
  expect(sessionStorage.getItem(PENDING_PROMPT_KEY)).toBeNull()
})

it('does not put the prompt in navigation or redirect parameters', async () => {
  renderLanding({ authenticated: false })
  await submitPrompt('private draft')
  expect(signIn.mock.calls[0]).toEqual(['github', { redirectTo: '/studio' }])
})
```

Also assert recent projects query is skipped while signed out and project navigation uses the returned `projectId`.

- [ ] **Step 6: Implement the refined landing UI**

Create `StudioLanding.tsx` with one centered work surface, not a dashboard grid:

- max content width `960px`, generous top spacing, small Studio eyebrow, one restrained headline;
- one bordered Prompt composer with 4-line textarea and a single cyan-accent Generate button;
- three short example chips that replace, not append to, the current draft;
- a compact recent-project list shown only to authenticated users;
- no model picker, asset upload, direct dimensions, duration controls, marketing feature grid, or code terminology.

Submission flow:

```ts
const PENDING_PROMPT_KEY = 'remotionhub.studio.pendingPrompt'

if (!isAuthenticated) {
  sessionStorage.setItem(PENDING_PROMPT_KEY, prompt.trim())
  await signIn('github', { redirectTo: '/studio' })
  return
}
const result = await startPromptProject({
  prompt: prompt.trim(),
  idempotencyKey: crypto.randomUUID(),
})
sessionStorage.removeItem(PENDING_PROMPT_KEY)
await navigate({ to: '/studio/$projectId', params: { projectId: result.projectId } })
```

Disable submission for an empty Prompt and while auth or mutation state is loading. Keep a failed restored draft in storage so the user can retry.

- [ ] **Step 7: Add and generate the route**

Create `src/routes/studio/index.tsx` with `createFileRoute('/studio/')` and render `<StudioLanding />`. Set route head title to `Studio · RemotionHub` and a localized-independent description that contains no user Prompt.

Run:

```bash
npm run generate-routes
npm run test -- src/components/AppChrome.test.tsx src/components/Header.test.tsx src/components/studio/StudioLanding.test.tsx src/routes/-routes.test.tsx src/lib/i18n.test.ts
```

Expected: route generation succeeds and all shell/landing tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/AppChrome.tsx src/components/AppChrome.test.tsx src/components/Header.tsx src/components/Header.test.tsx src/components/studio/StudioLanding.tsx src/components/studio/StudioLanding.test.tsx src/routes/__root.tsx src/routes/-routes.test.tsx src/routes/studio/index.tsx src/routeTree.gen.ts src/lib/i18n.ts src/lib/i18n.test.ts
git commit -m "feat: add studio landing experience"
```

---

### Task 7: Build the Guided-Split Workspace, Conversation, and History

**Files:**
- Modify: `convex/studio.ts`
- Modify: `convex/studio.test.ts`
- Create: `src/components/studio/StudioWorkspace.tsx`
- Create: `src/components/studio/StudioWorkspace.test.tsx`
- Create: `src/components/studio/StudioChatPanel.tsx`
- Create: `src/components/studio/StudioChatPanel.test.tsx`
- Create: `src/components/studio/StudioProjectBar.tsx`
- Create: `src/components/studio/StudioHistoryDialog.tsx`
- Create: `src/components/studio/StudioHistoryDialog.test.tsx`
- Create: `src/routes/studio/$projectId.tsx`
- Modify: `src/styles.css`
- Regenerate: `src/routeTree.gen.ts`

**Interfaces:**
- Produces the owner-only `/studio/$projectId` workspace.
- Produces `updateProjectTitle` with autosave and stale-project-safe rollback wiring.
- Converts candidate compile/runtime outcomes into `acceptCandidate` or `rejectCandidate` exactly once per fingerprint.

- [ ] **Step 1: Add failing title and workspace-state tests**

Extend `convex/studio.test.ts`:

```ts
it('trims and saves an owner project title', async () => {
  await owner.mutation(api.studio.updateProjectTitle, {
    projectId,
    title: '  Product launch  ',
  })
  expect((await owner.query(api.studio.getProject, { projectId })).project.title).toBe(
    'Product launch',
  )
})

it('rejects an empty or oversized project title', async () => {
  await expect(updateTitle('   ')).rejects.toThrow('Studio title is invalid')
  await expect(updateTitle('x'.repeat(121))).rejects.toThrow(
    'Studio title is invalid',
  )
})
```

Create `StudioWorkspace.test.tsx` with mocked Convex hooks and prove:

- missing, unauthenticated, and foreign projects render the same unavailable state;
- a Run candidate is passed to `StudioPreview`, never rendered as text or into a code editor;
- an accepted fingerprint calls `acceptCandidate` once despite re-renders;
- a rejected fingerprint calls `rejectCandidate` once with a normalized error;
- a committed Revision runtime error calls `reportRuntimeFailure` once and keeps the failed Revision source out of the visible Preview;
- the last revision remains in Preview while Run status advances;
- desktop contains Chat and Preview simultaneously; mobile tab buttons have correct selected semantics.

- [ ] **Step 2: Verify the red state**

```bash
npm run test -- convex/studio.test.ts src/components/studio/StudioWorkspace.test.tsx
```

Expected: FAIL because title mutation and workspace components do not exist.

- [ ] **Step 3: Add title autosave backend support**

Add `updateProjectTitle` to `convex/studio.ts`:

```ts
export const updateProjectTitle = mutation({
  args: { projectId: v.id('studioProjects'), title: v.string() },
  handler: async (ctx, { projectId, title }) => {
    await requireStudioProjectOwner(ctx, projectId)
    const normalized = title.trim()
    if (!normalized || normalized.length > 120) {
      throw new Error('Studio title is invalid')
    }
    await ctx.db.patch(projectId, { title: normalized, updatedAt: Date.now() })
    return normalized
  },
})
```

- [ ] **Step 4: Build Chat and generation phase presentation**

`StudioChatPanel` receives messages, current Run, disabled state, and `onSubmit(prompt)`. Render normal user/assistant messages and one compact active phase row using this mapping:

```ts
const runPhaseKey = {
  validating: 'studio.status.validating',
  'selecting-skills': 'studio.status.selectingSkills',
  generating: 'studio.status.generating',
  compiling: 'studio.status.compiling',
  succeeded: 'studio.status.ready',
  failed: 'studio.status.failed',
} as const
```

Keep the composer pinned to the bottom of the left pane. Use one multiline input and one Send button. Do not stream source tokens, render detected Skill details by default, or expose model selection. A failed Run shows a short localized error and Retry using the last user message.

Write component tests for phase text, disabled in-flight submit, Enter versus Shift+Enter, and retry.

- [ ] **Step 5: Build the project bar and debounced title save**

`StudioProjectBar` contains only:

- editable project title;
- saved/saving state;
- Prompt or Catalog Remix source label;
- read-only Composition summary such as `16:9 · 8s · 30fps`;
- History button.

Debounce title writes by 600 ms, flush on blur, and ignore an outdated mutation resolution by comparing the saved value to the latest input ref. Do not add a Settings dialog or direct Composition controls.

- [ ] **Step 6: Build append-only History**

`StudioHistoryDialog` renders revision sequence, localized origin, timestamp, summary, and a Restore action. Require a confirmation step. Call:

```ts
rollbackRevision({
  projectId,
  revisionId: selectedRevisionId,
  expectedCurrentRevisionId: currentRevisionId,
})
```

Close after success; on `Studio project changed`, keep the dialog open and show a refresh-oriented message. Tests must prove the selected revision ID and current revision guard are both submitted and no history entry is deleted.

- [ ] **Step 7: Assemble `StudioWorkspace` and the candidate handshake**

Use `useAuthStatus()` before owner queries. Query `getProject`, `listMessages`, and `listRevisions`; use `'skip'` until authenticated. Treat query errors and `null` uniformly as unavailable.

Wire Preview outcomes with a processed-fingerprint ref:

```ts
async function handleCandidateResult(result: CandidateResult) {
  if (!snapshot?.run || processed.current.has(result.fingerprint)) return
  processed.current.add(result.fingerprint)
  try {
    if (result.status === 'accepted') {
      await acceptCandidate({
        projectId,
        runId: snapshot.run._id,
        candidateFingerprint: result.fingerprint,
      })
    } else {
      await rejectCandidate({
        projectId,
        runId: snapshot.run._id,
        candidateFingerprint: result.fingerprint,
        normalizedError: result.error ?? 'Preview failed',
      })
    }
  } catch {
    processed.current.delete(result.fingerprint)
  }
}
```

Clear processed entries only when the server exposes a different candidate fingerprint. Follow-up submission includes `expectedCurrentRevisionId`; disable it until an initial Revision exists and whenever a Run is active.

Track reported runtime Revision IDs in a second ref and wire the committed callback separately from candidate fingerprints:

```ts
async function handleRevisionRuntimeError(result: {
  revisionId: Id<'studioRevisions'>
  error: string
}) {
  if (reportedRuntimeFailures.current.has(result.revisionId)) return
  reportedRuntimeFailures.current.add(result.revisionId)
  try {
    await reportRuntimeFailure({
      projectId,
      revisionId: result.revisionId,
      normalizedError: result.error,
    })
  } catch {
    reportedRuntimeFailures.current.delete(result.revisionId)
  }
}
```

- [ ] **Step 8: Implement the refined responsive layout**

Use the approved Guided Split without a third persistent panel:

```text
Global Header
Project Bar (48px)
Workspace
  Chat pane (356px desktop)
  Preview stage (remaining width)
```

Desktop (`min-width: 900px`): fixed `356px` left rail with a single right border; Preview sits in a muted stage with a centered 16:9/9:16/1:1 canvas. Avoid nested card grids and strong shadows.

Mobile: Project Bar remains single-line/scroll-safe; Chat and Preview are mutually exclusive tabs implemented as `role="tablist"`, `role="tab"`, and `role="tabpanel"`. The selected tab owns `aria-selected` and keyboard Left/Right navigation. Do not mount two Players on mobile.

Add only Studio-scoped class rules/tokens to `styles.css`. Respect `prefers-reduced-motion` for UI transitions without changing generated animation playback.

- [ ] **Step 9: Add the project route and verify**

Create `$projectId.tsx`, render `StudioWorkspace` with the route param cast to `Id<'studioProjects'>`, and set a static head title without querying or exposing the project name. Regenerate routes.

In `src/routes/-routes.test.tsx`, import `./studio/$projectId`, mock `StudioWorkspace`, and add:

```ts
it('registers the Studio project route', () => {
  expect(route('/studio/$projectId').component).toBeTypeOf('function')
  expect(metaValue(route('/studio/$projectId'), 'title')).toBe(
    'Studio · RemotionHub',
  )
})
```

```bash
npm run generate-routes
npm run test -- convex/studio.test.ts src/components/studio/StudioChatPanel.test.tsx src/components/studio/StudioHistoryDialog.test.tsx src/components/studio/StudioWorkspace.test.tsx src/routes/-routes.test.tsx
npm run ci:types-build
```

Expected: backend/UI tests PASS; the generated route exists; type/build exits `0`.

- [ ] **Step 10: Commit**

```bash
git add convex/studio.ts convex/studio.test.ts src/components/studio src/routes/studio/\$projectId.tsx src/routeTree.gen.ts src/styles.css
git commit -m "feat: add guided studio workspace"
```

---

### Task 8: Add Validated Catalog Studio Bundles and Remix Creation

**Files:**
- Modify: `shared/catalog.ts`
- Modify: `shared/catalog.test.ts`
- Modify: `scripts/import-catalog.ts`
- Modify: `scripts/import-catalog.test.ts`
- Modify: `convex/components.ts`
- Modify: `convex/components.test.ts`
- Modify: `convex/studio.ts`
- Modify: `convex/studio.test.ts`
- Create: `catalog/studio/card-avatar.tsx`
- Modify: `catalog/components/card-avatar.json`
- Modify: `src/components/catalog/DetailPage.tsx`
- Modify: `src/components/catalog/DetailPage.test.tsx`

**Interfaces:**
- Adds optional Catalog declaration `studioBundle` and hydrated import payload.
- Projects only `studioCompatible: boolean` to public Catalog detail.
- Produces authenticated `createRemixProject({ componentVersionId })` using an immutable bundle snapshot.

- [ ] **Step 1: Write failing declaration and safe-file tests**

Extend `shared/catalog.test.ts` and `scripts/import-catalog.test.ts`:

```ts
it('accepts an opt-in Remotion Studio Bundle declaration', () => {
  const result = catalogVersionSchema.parse({
    ...versionFixture,
    studioBundle: {
      sourcePath: 'catalog/studio/card-avatar.tsx',
      allowedDependencies: ['remotion'],
      composition: { aspectRatio: '16:9', durationInFrames: 120 },
    },
  })
  expect(result.studioBundle?.sourcePath).toBe(
    'catalog/studio/card-avatar.tsx',
  )
})

it.each([
  '../secret.tsx',
  'catalog/components/card-avatar.json',
  'catalog/studio/link.tsx',
])('rejects unsafe bundle path %s', async (sourcePath) => {
  await expect(loadStudioBundle(sourcePath, fixtureRoot)).rejects.toThrow()
})

it('keeps the immutable version fingerprint stable when a bundle is attached', () => {
  expect(buildCatalogVersionFingerprint(versionFixture)).toBe(
    buildCatalogVersionFingerprint({
      ...versionFixture,
      studioBundle: validBundleDeclaration,
    }),
  )
})
```

The `link.tsx` fixture must be a symlink inside the temporary `catalog/studio` directory pointing outside it. Also test a file larger than 200,000 bytes, a relative import, an undeclared dependency, invalid TSX, and a missing `MyAnimation` export.

- [ ] **Step 2: Verify the red state**

```bash
npm run test -- shared/catalog.test.ts scripts/import-catalog.test.ts
```

Expected: FAIL because Studio Bundle declarations and hydration do not exist.

- [ ] **Step 3: Extend the Catalog declaration without changing version identity**

In `shared/catalog.ts`, add:

```ts
export const studioBundleDeclarationSchema = z.object({
  sourcePath: z.string().regex(/^catalog\/studio\/[a-z0-9-]+\.tsx$/),
  allowedDependencies: z.array(z.enum([
    'react',
    'remotion',
    '@remotion/shapes',
    '@remotion/transitions',
    '@remotion/lottie',
    '@remotion/three',
    '@react-three/fiber',
    'three',
  ])).max(8),
  composition: studioCompositionInputSchema,
})
```

Add `studioBundle: studioBundleDeclarationSchema.optional()` to `catalogVersionSchema`. Introduce `buildCatalogVersionFingerprint(version)` that removes only `studioBundle` before calling the existing stable hash implementation. Change the importer to call this wrapper; do not change the fingerprint of versions that already exist in Convex.

- [ ] **Step 4: Hydrate and validate bundle source locally**

In `scripts/import-catalog.ts`, implement `loadStudioBundle(sourcePath, repoRoot, allowedDependencies)`:

1. resolve the real repository root and `catalog/studio` root;
2. require the lexical path and `realpath` to remain below `catalog/studio`;
3. reject a symlink via `lstat`;
4. reject files larger than 200,000 bytes before reading;
5. read UTF-8, call `sanitizeGeneratedSource`, `validateAndStripStudioImports(source, allowedDependencies)`, and Babel transform without executing the result;
6. require the `MyAnimation` export;
7. compute lower-case SHA-256 over `serializeStudioCandidate(source, normalizedComposition)`.

Map the declaration to the Convex payload:

```ts
studioBundle: version.studioBundle
  ? {
      entryPoint: version.metadata.entryPoint,
      sourcePath: version.studioBundle.sourcePath,
      code: hydrated.code,
      allowedDependencies: version.studioBundle.allowedDependencies,
      composition: normalizeStudioComposition(
        version.studioBundle.composition,
      ),
      commit: version.artifact.githubSource?.commit,
      contentHash: hydrated.contentHash,
      status: 'validated' as const,
    }
  : undefined
```

Reject a bundle unless runtime is `remotion`, artifact is pinned `github-source`, `entryPoint` exists, and commit is present. Local validation must occur for dry-run and apply modes.

- [ ] **Step 5: Persist bundles immutably in the Catalog import transaction**

Add an optional hydrated `studioBundle` validator to `importVersion` in `convex/components.ts`. For each existing version:

- no imported bundle: leave any existing bundle unchanged;
- imported bundle and no stored bundle: insert it;
- imported bundle and identical `contentHash`, commit, entry point, source path, dependency list, and Composition: no-op;
- imported bundle and any mismatch: reject with `Studio Bundle is immutable.`

For a newly inserted version, insert its bundle after the Artifact. Never accept `status: validated` from a public browser function; only `importCatalogComponent`, protected by `CATALOG_IMPORT_SECRET`, creates validated bundles.

Extend `getCatalogDetail`:

```ts
const studioBundle = await ctx.db
  .query('studioBundles')
  .withIndex('by_version', (q) =>
    q.eq('componentVersionId', selectedVersion._id),
  )
  .unique()

return {
  ...existingDetail,
  studioCompatible: studioBundle?.status === 'validated',
}
```

Do not return `studioBundle`, `code`, `contentHash`, or dependency details.

- [ ] **Step 6: Add Convex persistence and privacy tests**

Extend `convex/components.test.ts` to prove initial insert, attach-to-existing, idempotent re-import, immutable mismatch rejection, removed bundle compatibility false, and public detail containing only the boolean. Explicitly assert:

```ts
expect(JSON.stringify(detail)).not.toContain('MyAnimation')
expect(detail).not.toHaveProperty('studioBundle')
expect(detail?.studioCompatible).toBe(true)
```

Run:

```bash
npm run test -- convex/components.test.ts
```

Expected: PASS for bundle persistence, immutability, and public source privacy.

- [ ] **Step 7: Implement owner-only Remix project creation**

Add `createRemixProject` to `convex/studio.ts`. In one Mutation:

1. call `requireUser()`;
2. load Component Version, Component, Publisher, and its unique Studio Bundle;
3. reject missing/removed/non-Remotion/unpublished sources with the same `Studio Remix unavailable` error;
4. create the Project with source snapshot IDs, handle, slug, version, commit, entry point, and bundle hash;
5. create sequence `1` Revision with origin `catalog-remix`, bundle code/hash/Composition, and a concise summary;
6. update `currentRevisionId` and `lastRunnableRevisionId` to that Revision;
7. return `{ projectId }`.

Do not read the bundle again when opening or rolling back the project; the Revision is the fixed source snapshot.

Add tests for unauthenticated access, removed bundle, foreign client-supplied IDs that do not belong together, private snapshot ownership, and an existing Remix still opening after its Catalog Bundle becomes removed.

- [ ] **Step 8: Add the first curated self-contained Studio Bundle**

Create `catalog/studio/card-avatar.tsx` as a complete, import-only-from-Remotion fixture:

```tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export const MyAnimation = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const entrance = spring({ frame, fps, config: { damping: 16 } })
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#eef4f2',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Geist, sans-serif',
      }}
    >
      <div
        style={{
          width: 720,
          border: '1px solid rgba(15, 45, 42, 0.16)',
          borderRadius: 32,
          padding: 48,
          backgroundColor: '#ffffff',
          color: '#16312e',
          opacity,
          transform: `translateY(${(1 - entrance) * 48}px) scale(${0.96 + entrance * 0.04})`,
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 650 }}>Terence</div>
        <div style={{ marginTop: 12, fontSize: 34, color: '#47706b' }}>
          Motion systems · RemotionHub
        </div>
      </div>
    </AbsoluteFill>
  )
}
```

Declare it in `card-avatar.json` with `allowedDependencies: ["remotion"]`, aspect ratio `16:9`, and duration `120` frames.

- [ ] **Step 9: Add the conditional Detail action**

Extend the local Detail type with `studioCompatible: boolean`. Render `Remix in Studio` only for a compatible Remotion version. On click:

- if signed out, preserve only `{ componentVersionId }` under `remotionhub.studio.pendingRemix` in `sessionStorage`, sign in with redirect to the same canonical Detail URL, then resume;
- if authenticated, call `createRemixProject({ componentVersionId })` and navigate to `/studio/$projectId`;
- disable during mutation and show a localized toast on failure.

Do not show a disabled or teaser Remix button for incompatible versions.

Resume with this exact shape and delete it only after `createRemixProject` succeeds:

```ts
const PENDING_REMIX_KEY = 'remotionhub.studio.pendingRemix'
function readPendingRemix() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_REMIX_KEY) ?? 'null')
    return typeof value?.componentVersionId === 'string' ? value : null
  } catch {
    sessionStorage.removeItem(PENDING_REMIX_KEY)
    return null
  }
}

const pending = readPendingRemix()
if (pending?.componentVersionId === detail.selectedVersion._id) {
  const result = await createRemixProject({
    componentVersionId: detail.selectedVersion._id,
  })
  sessionStorage.removeItem(PENDING_REMIX_KEY)
  await navigate({
    to: '/studio/$projectId',
    params: { projectId: result.projectId },
  })
}
```

Extend `DetailPage.test.tsx` for compatible signed-in, compatible signed-out/resume, and incompatible hidden states.

- [ ] **Step 10: Verify and commit**

```bash
npx convex codegen
npm run catalog:validate
npm run test -- shared/catalog.test.ts scripts/import-catalog.test.ts convex/components.test.ts convex/studio.test.ts src/components/catalog/DetailPage.test.tsx
npm run ci:types-build
git add shared/catalog.ts shared/catalog.test.ts scripts/import-catalog.ts scripts/import-catalog.test.ts convex/components.ts convex/components.test.ts convex/studio.ts convex/studio.test.ts convex/_generated catalog/studio/card-avatar.tsx catalog/components/card-avatar.json src/components/catalog/DetailPage.tsx src/components/catalog/DetailPage.test.tsx
git commit -m "feat: add catalog studio remix bundles"
```

Expected: Catalog validation, target tests, typecheck, and build all succeed.

---

### Task 9: Add Deterministic Browser Smoke, Operator Docs, Visual Proof, and Final Gates

**Files:**
- Create: `e2e/studio-smoke.pw.test.ts`
- Modify: `package.json`
- Modify: `Makefile`
- Modify: `README.md`
- Modify: `specs/2026-07-10-studio-prompt-to-motion-design.md`

**Interfaces:**
- Adds `npm run test:e2e:studio` and `make studio-smoke`.
- Documents local backend-only model configuration and accepted MVP execution risk.
- Produces real desktop/mobile browser proof from the running application.

- [ ] **Step 1: Write the signed-out browser smoke**

Create `e2e/studio-smoke.pw.test.ts`:

```ts
test('signed-out Studio shows the focused composer without project data', async ({
  page,
}) => {
  await page.goto('/studio')
  await expect(page.getByRole('heading', { name: /创作|Create/i })).toBeVisible()
  await expect(page.getByRole('textbox')).toBeVisible()
  await expect(page.getByRole('contentinfo')).not.toBeVisible()
  await expect(page.getByRole('link', { name: /Studio/ })).toBeVisible()
})

test('Studio landing has no horizontal overflow on mobile', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile-only smoke')
  await page.goto('/studio')
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(hasOverflow).toBe(false)
})
```

Run before adding authenticated setup:

```bash
VITE_CONVEX_URL=https://example.invalid npm run build
npx playwright test e2e/studio-smoke.pw.test.ts
```

Expected: signed-out tests PASS on desktop and mobile.

- [ ] **Step 2: Add conditional authenticated smoke state**

Parse `PLAYWRIGHT_AUTH_STORAGE_STATE_JSON` once in the test file:

```ts
const authStorageState = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE_JSON
  ? JSON.parse(process.env.PLAYWRIGHT_AUTH_STORAGE_STATE_JSON)
  : undefined

test.describe('authenticated Studio', () => {
  test.skip(!authStorageState, 'PLAYWRIGHT_AUTH_STORAGE_STATE_JSON is required')
  test.use({
    storageState: authStorageState ?? { cookies: [], origins: [] },
  })

  test('generates, previews, follows up, refreshes, and rolls back', async ({
    page,
  }) => {
    await page.goto('/studio')
    await page.getByRole('textbox').fill('Animate a cyan product title')
    await page.getByRole('button', { name: /生成|Generate/i }).click()
    await expect(page).toHaveURL(/\/studio\/[^/]+$/)
    await expect(page.getByText(/预览已就绪|Preview ready/i)).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByLabel(/预览|Preview/i)).toBeVisible()

    await page.getByRole('textbox').fill('Make the title feel softer')
    await page.getByRole('button', { name: /发送|Send/i }).click()
    await expect(page.getByText(/Created|创建|Updated|更新/i)).toBeVisible({
      timeout: 45_000,
    })

    await page.reload()
    await expect(page.getByLabel(/预览|Preview/i)).toBeVisible()
    await page.getByRole('button', { name: /历史|History/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
```

Add a separate compatible Catalog test that opens Card Avatar, sees `Remix in Studio`, creates the project, and sees its initial Preview. Keep authenticated tests skipped rather than failed when no storage state is supplied.

- [ ] **Step 3: Add repeatable local commands**

Add to `package.json`:

```json
"test:e2e:studio": "playwright test e2e/studio-smoke.pw.test.ts"
```

Add `studio-smoke` to `.PHONY` and Makefile:

```make
studio-smoke: ensure-convex seed build-local ## Run deterministic Studio browser smoke.
	npx convex env set --deployment local STUDIO_MODEL_MODE stub
	PLAYWRIGHT_USE_SYSTEM_CHROME="$(PLAYWRIGHT_USE_SYSTEM_CHROME)" VITE_CONVEX_URL="$(CONVEX_URL)" npm run test:e2e:studio
```

Do not add the OpenAI key to the Make command. The deterministic stub is selected in the Convex deployment environment and is not controllable by a browser request.

- [ ] **Step 4: Document setup and security truthfully**

In `README.md`, add a Studio section with:

```bash
npx convex env set --deployment local OPENAI_API_KEY '<your-key>'
npx convex env set --deployment local STUDIO_OPENAI_MODEL 'gpt-5.2'
```

Document `STUDIO_MODEL_MODE=stub` only for deterministic local/CI smoke. State that generation/save require login, auth provider identity is normalized to a Convex user, and the MVP performs same-page dynamic execution with allowlists but without a trustworthy sandbox. Link to the design spec for the scope restrictions.

After all implementation tests pass, update the design spec status to “MVP 已实现并通过本地验收，等待发布”. Add one implementation note that direct Composition controls remain intentionally absent and all model-returned Composition values pass the shared normalizer.

- [ ] **Step 5: Run targeted automated verification**

```bash
npm run test -- shared/studio.test.ts shared/studioSource.test.ts shared/catalog.test.ts convex/lib/studioGeneration.test.ts convex/lib/studioModel.test.ts convex/studio.test.ts convex/components.test.ts scripts/import-catalog.test.ts src/lib/studio/sanitize.test.ts src/lib/studio/compiler.test.tsx src/components/studio/StudioPreview.test.tsx src/components/studio/StudioLanding.test.tsx src/components/studio/StudioChatPanel.test.tsx src/components/studio/StudioHistoryDialog.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/catalog/DetailPage.test.tsx src/routes/-routes.test.tsx
npm run ci:unit
npm run ci:types-build
make check
```

Expected: every command exits `0`; coverage remains at or above the repository's 80% global thresholds.

- [ ] **Step 6: Run authenticated deterministic smoke**

Start local Convex if needed, set a valid local auth storage state, then run:

```bash
export PLAYWRIGHT_AUTH_STORAGE_STATE_JSON="$(< /absolute/path/to/local-auth-storage-state.json)"
make studio-smoke
```

Expected: Prompt generation, Follow-up, refresh recovery, History, mobile tabs, and Card Avatar Remix PASS against the real local Convex deployment with stub model mode.

- [ ] **Step 7: Perform real-browser visual acceptance**

Run the real app with local Convex and fixtures:

```bash
make dev
```

Using the Browser control skill, inspect and capture the actual application at:

- `http://127.0.0.1:3000/studio` at `1440x1000` and `412x915`;
- one generated `/studio/<projectId>` at `1440x1000` and `412x915`;
- Card Avatar Detail with the compatible Remix action.

Verify no horizontal overflow, readable Prompt text, a `356px` desktop chat rail, centered Preview, one mobile Player, no Footer in Studio, no code/source UI, no direct Composition form, and visual continuity with the existing Header, Geist typography, gray surfaces, cyan accent, and fine borders. Screenshot proof must come from these real URLs and fixture state, never from a static mockup.

- [ ] **Step 8: Review and final commit**

Run `$autoreview` over all non-trivial source/test changes. Accept and fix every actionable finding, rerun the affected target tests plus `make check`, then inspect scope:

```bash
git status --short
git diff --check
git diff --stat HEAD~8
```

Expected: no whitespace errors, no unrelated files, and no accepted review finding left unresolved.

Commit the final verification/documentation task:

```bash
git add e2e/studio-smoke.pw.test.ts package.json Makefile README.md specs/2026-07-10-studio-prompt-to-motion-design.md
git commit -m "test: add studio end-to-end verification"
```

Final acceptance evidence must report the exact commands run, their exit status, the local URL/fixture used for screenshots, and these confirmed boundaries:

- only authenticated users generate/save;
- ownership is provider-neutral and every Studio read/write checks it;
- generated source is never displayed or manually editable;
- failed candidates preserve the last runnable Preview;
- committed runtime failures restore `previousRunnableRevisionId` and start a Correction Run;
- successful changes and rollback append immutable Revisions;
- incompatible Catalog versions do not show Remix;
- the MVP does not claim same-page execution is a sandbox.
