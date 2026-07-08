# AI Studio MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the RemotionHub AI Studio MVP so a logged-in user can create a queued generation job from a prompt, consume a free credit, run a template-driven planner/render path, and play/download a generated `16:9` MP4 artifact.

**Architecture:** The MVP is template-driven and Remotion-only at runtime, while preserving runtime fields for future HyperFrames support. Convex owns user-facing state, credit ledger, template whitelist, job state transitions, and artifact metadata. An external worker owns planner and renderer execution, using a deterministic planner stub before real model integration.

**Tech Stack:** TanStack Start, React 19, TanStack Router file routes, Convex, TypeScript, Zod, Vitest, convex-test, Playwright smoke tests, object storage signing through backend-controlled helpers.

## Global Constraints

- Output format is MP4 only; no Remotion or HyperFrames source download in MVP.
- Runtime execution is Remotion-only for MVP; HyperFrames is schema-reserved only.
- Output media defaults: `16:9`, `1280x720`, `30fps`, `10-30` seconds.
- A new user receives 2 free generation credits through idempotent `ensureInitialGrant` before first Studio use or first task creation.
- `createGenerationJob` must first resolve `(userId, idempotencyKey)` before active job checks.
- Job creation and `consume:{jobId}` ledger insert must be one transaction.
- Max active generation jobs per user is 1; active statuses are `queued`, `planning`, `rendering`, and `uploading`.
- MVP uses a whitelist of `studioTemplates`; default template selection requires `status = active` and `licenseStatus = approved`.
- Render plan and template props schemas must be strict and reject unknown fields.
- Artifact playback/download URLs must be short-lived bearer URLs issued by an authenticated owner-only read endpoint.
- Model input/output, render plan, render logs, and event metadata are private operational data, not ordinary user-visible content.
- First P0 template candidate is catalog slug `yt-simple-ai-product`, because it matches product-demo semantics.

---

## File Structure

- Create `convex/lib/studio/constants.ts`: statuses, error codes, event types, media constants, progress mapping, active status helpers.
- Create `convex/lib/studio/renderPlan.ts`: Zod render plan schema and strict validation helpers.
- Create `convex/lib/studio/ledger.ts`: pure ledger idempotency key helpers and balance calculations.
- Create `convex/lib/studio/templates.ts`: whitelist template helpers and default-template selection.
- Create `convex/lib/studio/jobs.ts`: pure job transition helpers, progress helpers, cancellation/refund decisions.
- Modify `convex/schema.ts`: add `studioTemplates`, `generationJobs`, `generationJobEvents`, `generationArtifacts`, `usageLedger`, `modelRuns`, `renderRuns`.
- Create `convex/studio.ts`: public Convex queries/mutations/actions for Studio.
- Create `convex/lib/studio/*.test.ts` and `convex/studio.test.ts`: pure and Convex contract coverage.
- Create `scripts/seed-studio-templates.ts`: seed first whitelist template from catalog metadata.
- Create `scripts/studio-worker.ts`: P0 worker entry that polls jobs and executes planner stub plus renderer adapter.
- Create `scripts/studio-renderer.ts`: renderer adapter, initially capable of fake artifact mode and later real Remotion invocation.
- Create `src/lib/studio.ts`: frontend types and status copy helpers.
- Create `src/routes/studio.tsx`: Studio route.
- Create `src/components/studio/StudioPage.tsx`: shell for prompt, templates, history, and result pane.
- Create `src/components/studio/PromptComposer.tsx`: prompt input, template confirmation, create action.
- Create `src/components/studio/TemplatePicker.tsx`: whitelist template cards.
- Create `src/components/studio/GenerationStatus.tsx`: status/progress/error renderer.
- Create `src/components/studio/GenerationResult.tsx`: video player and download action.
- Create `src/components/studio/GenerationHistory.tsx`: current user's 10 latest jobs.
- Add tests under `src/components/studio/*.test.tsx` and `src/routes/-routes.test.tsx`.
- Add Playwright smoke `e2e/studio-smoke.spec.ts` after P0 product loop exists.

## Shared Interfaces

Use these names consistently across tasks:

```typescript
export type StudioRuntime = 'remotion' | 'hyperframes'
export type StudioJobStatus =
  | 'queued'
  | 'planning'
  | 'rendering'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'canceled'

export type StudioErrorCode =
  | 'AUTH_REQUIRED'
  | 'INSUFFICIENT_CREDITS'
  | 'ACTIVE_JOB_LIMIT'
  | 'PROMPT_INCOMPLETE'
  | 'CONTENT_BLOCKED'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_NOT_ALLOWED'
  | 'TEMPLATE_INACTIVE'
  | 'TEMPLATE_LICENSE_BLOCKED'
  | 'TEMPLATE_VERSION_MISMATCH'
  | 'PLAN_VALIDATION_FAILED'
  | 'PROPS_VALIDATION_FAILED'
  | 'MODEL_PROVIDER_ERROR'
  | 'RENDER_TIMEOUT'
  | 'RENDER_FAILED'
  | 'UPLOAD_FAILED'
  | 'JOB_CANCELED'

export type StudioEventType =
  | 'job_created'
  | 'credits_consumed'
  | 'planning_started'
  | 'model_started'
  | 'plan_validation_failed'
  | 'plan_repaired'
  | 'rendering_started'
  | 'uploading_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_canceled'
  | 'credits_refunded'
```

```typescript
export type StudioRenderPlan = {
  schemaVersion: 1
  templateId: string
  templateVersion: string
  propsSchemaVersion: string
  runtime: 'remotion'
  output: {
    aspectRatio: '16:9'
    width: 1280
    height: 720
    fps: 30
    durationSeconds: number
    format: 'mp4'
  }
  intentSummary: string
  style: {
    tone: string
    primaryColor: string
    backgroundStyle: string
  }
  scenes: Array<{
    id: string
    durationSeconds: number
    headline: string
    subtitle: string
    body: string
    visualHint: string
  }>
  props: Record<string, unknown>
  assetIds: string[]
}
```

### Task 1: Studio Domain Constants And Validators

**Files:**
- Create: `convex/lib/studio/constants.ts`
- Create: `convex/lib/studio/renderPlan.ts`
- Test: `convex/lib/studio/renderPlan.test.ts`
- Test: `convex/lib/studio/constants.test.ts`

**Interfaces:**
- Produces: `STUDIO_JOB_STATUSES`, `ACTIVE_JOB_STATUSES`, `STUDIO_ERROR_CODES`, `STUDIO_EVENT_TYPES`, `STUDIO_PROGRESS_BY_STATUS`, `isActiveStudioStatus(status)`, `validateRenderPlan(plan, job, template)`
- Consumes: none

- [ ] **Step 1: Write failing domain tests**

```typescript
import { describe, expect, it } from 'vitest'
import {
  ACTIVE_JOB_STATUSES,
  STUDIO_PROGRESS_BY_STATUS,
  isActiveStudioStatus,
} from './constants'

describe('studio constants', () => {
  it('treats only in-flight statuses as active', () => {
    expect(ACTIVE_JOB_STATUSES).toEqual([
      'queued',
      'planning',
      'rendering',
      'uploading',
    ])
    expect(isActiveStudioStatus('queued')).toBe(true)
    expect(isActiveStudioStatus('completed')).toBe(false)
    expect(isActiveStudioStatus('failed')).toBe(false)
    expect(isActiveStudioStatus('canceled')).toBe(false)
  })

  it('uses stage-based progress values', () => {
    expect(STUDIO_PROGRESS_BY_STATUS).toMatchObject({
      queued: 5,
      planning: 20,
      rendering: 60,
      uploading: 90,
      completed: 100,
    })
  })
})
```

```typescript
import { describe, expect, it } from 'vitest'
import { validateRenderPlan } from './renderPlan'

const job = {
  templateId: 'yt-simple-ai-product',
  templateVersion: '1.0.0',
  propsSchemaVersion: '1',
} as const

const template = {
  templateId: 'yt-simple-ai-product',
  templateVersion: '1.0.0',
  propsSchemaVersion: '1',
  allowedAssetIds: ['template:yt-simple-ai-product:hero-bg'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline'],
    properties: {
      headline: { type: 'string', minLength: 1, maxLength: 120 },
    },
  },
} as const

describe('validateRenderPlan', () => {
  it('accepts a strict Remotion render plan locked to the selected template', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'yt-simple-ai-product',
        templateVersion: '1.0.0',
        propsSchemaVersion: '1',
        runtime: 'remotion',
        output: {
          aspectRatio: '16:9',
          width: 1280,
          height: 720,
          fps: 30,
          durationSeconds: 15,
          format: 'mp4',
        },
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch faster',
            subtitle: 'AI workflow for product teams',
            body: 'Turn scattered notes into polished product demos.',
            visualHint: 'Dashboard panels slide into view',
          },
        ],
        props: { headline: 'Launch faster' },
        assetIds: ['template:yt-simple-ai-product:hero-bg'],
      },
      job,
      template,
    )

    expect(result.ok).toBe(true)
  })

  it('rejects template switching and unknown props', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'different-template',
        templateVersion: '1.0.0',
        propsSchemaVersion: '1',
        runtime: 'remotion',
        output: {
          aspectRatio: '16:9',
          width: 1280,
          height: 720,
          fps: 30,
          durationSeconds: 15,
          format: 'mp4',
        },
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [],
        props: { headline: 'Launch faster', shellCommand: 'rm -rf .' },
        assetIds: [],
      },
      job,
      template,
    )

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('TEMPLATE_VERSION_MISMATCH')
  })

  it('rejects props that are not allowed by the template schema', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'yt-simple-ai-product',
        templateVersion: '1.0.0',
        propsSchemaVersion: '1',
        runtime: 'remotion',
        output: {
          aspectRatio: '16:9',
          width: 1280,
          height: 720,
          fps: 30,
          durationSeconds: 15,
          format: 'mp4',
        },
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch faster',
            subtitle: 'AI workflow for product teams',
            body: 'Turn scattered notes into polished product demos.',
            visualHint: 'Dashboard panels slide into view',
          },
        ],
        props: { headline: 'Launch faster', shellCommand: 'rm -rf .' },
        assetIds: [],
      },
      job,
      template,
    )

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('PROPS_VALIDATION_FAILED')
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm run test -- convex/lib/studio/constants.test.ts convex/lib/studio/renderPlan.test.ts`

Expected: fail because `convex/lib/studio/constants.ts` and `convex/lib/studio/renderPlan.ts` do not exist.

- [ ] **Step 3: Implement constants and render plan validation**

Create `convex/lib/studio/constants.ts` with the shared union values and helpers from the Shared Interfaces section. Create `convex/lib/studio/renderPlan.ts` with Zod validation:

```typescript
import { z } from 'zod'
import type { StudioErrorCode } from './constants'

const outputSchema = z
  .object({
    aspectRatio: z.literal('16:9'),
    width: z.literal(1280),
    height: z.literal(720),
    fps: z.literal(30),
    durationSeconds: z.number().int().min(10).max(30),
    format: z.literal('mp4'),
  })
  .strict()

const sceneSchema = z
  .object({
    id: z.string().min(1).max(64),
    durationSeconds: z.number().int().min(1).max(30),
    headline: z.string().max(120),
    subtitle: z.string().max(180),
    body: z.string().max(500),
    visualHint: z.string().max(240),
  })
  .strict()

const renderPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    templateId: z.string().min(1),
    templateVersion: z.string().min(1),
    propsSchemaVersion: z.string().min(1),
    runtime: z.literal('remotion'),
    output: outputSchema,
    intentSummary: z.string().min(1).max(500),
    style: z
      .object({
        tone: z.string().min(1).max(64),
        primaryColor: z.string().min(1).max(32),
        backgroundStyle: z.string().min(1).max(160),
      })
      .strict(),
    scenes: z.array(sceneSchema).min(1).max(8),
    props: z.record(z.string(), z.unknown()),
    assetIds: z.array(z.string()).max(20),
  })
  .strict()

export type StudioRenderPlan = z.infer<typeof renderPlanSchema>

function validatePropsSchema(
  props: Record<string, unknown>,
  schema: unknown,
): boolean {
  if (!schema || typeof schema !== 'object') return false
  const objectSchema = schema as {
    additionalProperties?: boolean
    required?: string[]
    properties?: Record<
      string,
      { type?: string; minLength?: number; maxLength?: number }
    >
  }
  const properties = objectSchema.properties ?? {}
  const required = objectSchema.required ?? []

  if (
    objectSchema.additionalProperties === false &&
    Object.keys(props).some((key) => !(key in properties))
  ) {
    return false
  }

  if (required.some((key) => !(key in props))) {
    return false
  }

  for (const [key, rule] of Object.entries(properties)) {
    const value = props[key]
    if (value === undefined) continue
    if (rule.type === 'string') {
      if (typeof value !== 'string') return false
      if (rule.minLength !== undefined && value.length < rule.minLength) return false
      if (rule.maxLength !== undefined && value.length > rule.maxLength) return false
    }
  }

  return true
}

export function validateRenderPlan(
  input: unknown,
  job: {
    templateId: string
    templateVersion: string
    propsSchemaVersion: string
  },
  template: {
    allowedAssetIds: string[]
    propsSchema: unknown
  },
): { ok: true; value: z.infer<typeof renderPlanSchema> } | { ok: false; errors: StudioErrorCode[] } {
  const parsed = renderPlanSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: ['PLAN_VALIDATION_FAILED'] }
  }

  const plan = parsed.data
  if (
    plan.templateId !== job.templateId ||
    plan.templateVersion !== job.templateVersion ||
    plan.propsSchemaVersion !== job.propsSchemaVersion
  ) {
    return { ok: false, errors: ['TEMPLATE_VERSION_MISMATCH'] }
  }

  const hasInvalidAsset = plan.assetIds.some(
    (assetId) =>
      !assetId.startsWith('catalog:') &&
      !assetId.startsWith(`template:${job.templateId}:`) &&
      !template.allowedAssetIds.includes(assetId),
  )
  if (hasInvalidAsset) {
    return { ok: false, errors: ['PROPS_VALIDATION_FAILED'] }
  }

  if (!validatePropsSchema(plan.props, template.propsSchema)) {
    return { ok: false, errors: ['PROPS_VALIDATION_FAILED'] }
  }

  return { ok: true, value: plan }
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run: `npm run test -- convex/lib/studio/constants.test.ts convex/lib/studio/renderPlan.test.ts`

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/studio/constants.ts convex/lib/studio/renderPlan.ts convex/lib/studio/*.test.ts
git commit -m "feat: add studio domain validation"
```

### Task 2: Convex Schema For Studio State

**Files:**
- Modify: `convex/schema.ts`
- Test: `convex/studio-schema.test.ts`

**Interfaces:**
- Consumes: Task 1 constants.
- Produces: Convex tables `studioTemplates`, `generationJobs`, `generationJobEvents`, `generationArtifacts`, `usageLedger`, `modelRuns`, `renderRuns`.

- [ ] **Step 1: Add schema contract tests**

Create `convex/studio-schema.test.ts` with tests that insert one row into each Studio table using `convex-test`. Assert that:

- `studioTemplates` accepts `licenseStatus: 'approved'`.
- `generationJobs` accepts `status: 'queued'` and stores `idempotencyKey`.
- `usageLedger` accepts `idempotencyKey: 'consume:test-job'`.
- `generationArtifacts` stores `storageKey` without a persisted signed URL.

- [ ] **Step 2: Run schema tests and confirm failure**

Run: `npm run test -- convex/studio-schema.test.ts`

Expected: fail because tables do not exist.

- [ ] **Step 3: Extend Convex schema**

Modify `convex/schema.ts` to add tables with indexes:

```typescript
const studioRuntime = v.union(v.literal('remotion'), v.literal('hyperframes'))
const studioJobStatus = v.union(
  v.literal('queued'),
  v.literal('planning'),
  v.literal('rendering'),
  v.literal('uploading'),
  v.literal('completed'),
  v.literal('failed'),
  v.literal('canceled'),
)
const studioTemplateStatus = v.union(v.literal('active'), v.literal('inactive'))
const studioLicenseStatus = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('blocked'),
)
```

Add:

- `studioTemplates.index('by_status_priority', ['status', 'priority'])`
- `generationJobs.index('by_user_created', ['userId', 'createdAt'])`
- `generationJobs.index('by_user_idempotency', ['userId', 'idempotencyKey'])`
- `generationJobs.index('by_status_lock', ['status', 'lockExpiresAt'])`
- `generationJobs.index('by_user_status', ['userId', 'status'])`
- `generationArtifacts.index('by_user_job', ['userId', 'jobId'])`
- `usageLedger.index('by_idempotency', ['idempotencyKey'])`
- `usageLedger.index('by_user_created', ['userId', 'createdAt'])`
- `generationJobEvents.index('by_job_created', ['jobId', 'createdAt'])`
- `modelRuns.index('by_job_created', ['jobId', 'createdAt'])`
- `renderRuns.index('by_job_created', ['jobId', 'createdAt'])`

- [ ] **Step 4: Run schema tests and typecheck**

Run: `npm run test -- convex/studio-schema.test.ts`

Expected: pass.

Run: `npm run ci:types-build`

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/studio-schema.test.ts
git commit -m "feat: add studio convex schema"
```

### Task 3: Studio Template Whitelist Seed And Queries

**Files:**
- Create: `convex/lib/studio/templates.ts`
- Modify: `convex/studio.ts`
- Create: `scripts/seed-studio-templates.ts`
- Test: `convex/lib/studio/templates.test.ts`
- Test: `convex/studio.test.ts`

**Interfaces:**
- Consumes: `studioTemplates` table.
- Produces: `api.studio.listStudioTemplates`, `api.studio.getDefaultStudioTemplate`, seed script for `yt-simple-ai-product`.

- [ ] **Step 1: Write template helper tests**

Test cases:

- Default template ignores `inactive`.
- Default template ignores `licenseStatus !== 'approved'`.
- Default template selects the lowest numeric `priority` active approved template.
- `yt-simple-ai-product` seed payload has `runtime: 'remotion'`, `supportedAspectRatios: ['16:9']`, `supportedResolutions: [{ width: 1280, height: 720 }]`, and `fps: 30`.

- [ ] **Step 2: Implement template helpers**

In `convex/lib/studio/templates.ts`, export:

```typescript
export type StudioTemplateSeed = {
  templateId: string
  templateVersion: string
  runtime: 'remotion'
  status: 'active' | 'inactive'
  priority: number
  supportedAspectRatios: string[]
  supportedResolutions: Array<{ width: number; height: number }>
  fps: number
  propsSchema: Record<string, unknown>
  propsSchemaVersion: string
  agentPrompt: string
  tags: string[]
  previewStorageKey?: string
  licenseStatus: 'pending' | 'approved' | 'blocked'
}

export const p0StudioTemplateSeed: StudioTemplateSeed = {
  templateId: 'yt-simple-ai-product',
  templateVersion: '1.0.0',
  runtime: 'remotion',
  status: 'active',
  priority: 10,
  supportedAspectRatios: ['16:9'],
  supportedResolutions: [{ width: 1280, height: 720 }],
  fps: 30,
  propsSchemaVersion: '1',
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'subtitle', 'body'],
    properties: {
      headline: { type: 'string', minLength: 1, maxLength: 120 },
      subtitle: { type: 'string', minLength: 1, maxLength: 180 },
      body: { type: 'string', minLength: 1, maxLength: 500 },
    },
  },
  agentPrompt:
    'Create a concise 16:9 product explainer using a clean SaaS launch style.',
  tags: ['product-demo', 'hero', 'launch'],
  previewStorageKey: undefined,
  licenseStatus: 'approved',
}
```

- [ ] **Step 3: Add Convex queries**

In `convex/studio.ts`, add:

- `listStudioTemplates`: returns active approved templates ordered by priority.
- `getDefaultStudioTemplate`: returns first active approved template by priority.

- [ ] **Step 4: Add seed script**

Create `scripts/seed-studio-templates.ts` to call a Convex mutation `upsertStudioTemplate` with `p0StudioTemplateSeed`.

- [ ] **Step 5: Run tests**

Run: `npm run test -- convex/lib/studio/templates.test.ts convex/studio.test.ts`

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add convex/lib/studio/templates.ts convex/studio.ts convex/lib/studio/templates.test.ts convex/studio.test.ts scripts/seed-studio-templates.ts
git commit -m "feat: add studio template whitelist"
```

### Task 4: Credit Ledger And Generation Job API

**Files:**
- Create: `convex/lib/studio/ledger.ts`
- Create: `convex/lib/studio/jobs.ts`
- Modify: `convex/studio.ts`
- Test: `convex/lib/studio/ledger.test.ts`
- Test: `convex/lib/studio/jobs.test.ts`
- Test: `convex/studio.test.ts`

**Interfaces:**
- Consumes: `studioTemplates`, constants, schema.
- Produces: `ensureInitialGrant`, `createGenerationJob`, `getMyStudioHistory`, `getGenerationJob`, `cancelGenerationJob`, `refundGenerationJob`.

- [ ] **Step 1: Write ledger tests**

Required assertions:

- `initialGrantKey(userId)` returns `initial-grant-v1:${userId}`.
- `consumeKey(jobId)` returns `consume:${jobId}`.
- `refundKey(jobId)` returns `refund:${jobId}`.
- `ensureInitialGrant` is idempotent.
- A job can be refunded once.

- [ ] **Step 2: Write job API tests**

Required assertions:

- Repeating `createGenerationJob` with same `(userId, idempotencyKey)` returns the same job.
- Repeating it does not return `ACTIVE_JOB_LIMIT`.
- First created job is `queued`.
- Creation inserts `consume:{jobId}` in same mutation.
- Active job limit blocks a second distinct idempotency key.
- `queued` cancel writes `canceledAt`, `canceledBy`, `cancelReason`, and creates `refund:{jobId}`.
- `planning` cancel refunds only when `modelStartedAt` is absent.

- [ ] **Step 3: Implement pure helpers**

`convex/lib/studio/ledger.ts`:

```typescript
export function initialGrantKey(userId: string) {
  return `initial-grant-v1:${userId}`
}

export function consumeKey(jobId: string) {
  return `consume:${jobId}`
}

export function refundKey(jobId: string) {
  return `refund:${jobId}`
}
```

`convex/lib/studio/jobs.ts`:

```typescript
import { ACTIVE_JOB_STATUSES, STUDIO_PROGRESS_BY_STATUS } from './constants'

export function defaultProgressForStatus(status: keyof typeof STUDIO_PROGRESS_BY_STATUS) {
  return STUDIO_PROGRESS_BY_STATUS[status]
}

export function isActiveStatus(status: string) {
  return ACTIVE_JOB_STATUSES.includes(status as never)
}

export function canRefundCancellation(args: {
  status: string
  modelStartedAt?: number
}) {
  if (args.status === 'queued') return true
  if (args.status === 'planning' && !args.modelStartedAt) return true
  return false
}
```

- [ ] **Step 4: Implement Convex mutations and queries**

In `convex/studio.ts`:

- `ensureInitialGrant` internal helper.
- `createGenerationJob` mutation.
- `getGenerationJob` query.
- `getMyStudioHistory` query limited to 10 by `createdAt desc`.
- `cancelGenerationJob` mutation.

`createGenerationJob` must perform operations in this order:

1. Resolve authenticated user id.
2. Query existing job by `(userId, idempotencyKey)` and return it if found.
3. Call `ensureInitialGrant`.
4. Validate prompt length and basic blocked keywords.
5. Validate template exists, active, approved, and Remotion runtime.
6. Check no active job exists.
7. Insert `generationJobs` with `status: 'queued'`.
8. Insert `usageLedger` with `idempotencyKey: consume:${jobId}`.
9. Insert `generationJobEvents` for `job_created` and `credits_consumed`.
10. Return created job summary.

- [ ] **Step 5: Run tests**

Run: `npm run test -- convex/lib/studio/ledger.test.ts convex/lib/studio/jobs.test.ts convex/studio.test.ts`

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add convex/lib/studio/ledger.ts convex/lib/studio/jobs.ts convex/studio.ts convex/lib/studio/*.test.ts convex/studio.test.ts
git commit -m "feat: add studio job ledger api"
```

### Task 5: Planner Stub And Worker State Machine

**Files:**
- Create: `scripts/studio-planner.ts`
- Create: `scripts/studio-worker.ts`
- Modify: `convex/studio.ts`
- Test: `convex/studio-worker.test.ts`
- Test: `scripts/studio-planner.test.ts`

**Interfaces:**
- Consumes: `validateRenderPlan`, `generationJobs`, `modelRuns`, `renderRuns`.
- Produces: `createStubRenderPlan(prompt, template)`, worker actions `claimNextGenerationJob`, `markModelStarted`, `completePlanning`, `failGenerationJob`.

- [ ] **Step 1: Write planner stub test**

Assert that `createStubRenderPlan('Launch an AI analytics dashboard', p0StudioTemplateSeed)` returns:

- `templateId: 'yt-simple-ai-product'`
- `runtime: 'remotion'`
- `output.width: 1280`
- `output.height: 720`
- `output.fps: 30`
- `output.durationSeconds` between 10 and 30
- strict props matching the P0 schema

- [ ] **Step 2: Implement planner stub**

Create `scripts/studio-planner.ts`:

```typescript
import type { StudioTemplateSeed } from '../convex/lib/studio/templates'
import type { StudioRenderPlan } from '../convex/lib/studio/renderPlan'

export function createStubRenderPlan(
  prompt: string,
  template: StudioTemplateSeed,
): StudioRenderPlan {
  const headline = prompt.trim().slice(0, 90) || 'Launch your product faster'
  return {
    schemaVersion: 1,
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    propsSchemaVersion: template.propsSchemaVersion,
    runtime: 'remotion',
    output: {
      aspectRatio: '16:9',
      width: 1280,
      height: 720,
      fps: 30,
      durationSeconds: 15,
      format: 'mp4',
    },
    intentSummary: headline,
    style: {
      tone: 'modern',
      primaryColor: '#0F766E',
      backgroundStyle: 'clean product gradient',
    },
    scenes: [
      {
        id: 'scene-1',
        durationSeconds: 15,
        headline,
        subtitle: 'A concise product demo generated from your prompt',
        body: 'Show the problem, the product promise, and the call to action.',
        visualHint: 'Product cards and dashboard panels animate in sequence',
      },
    ],
    props: {
      headline,
      subtitle: 'A concise product demo generated from your prompt',
      body: 'Show the problem, the product promise, and the call to action.',
    },
    assetIds: [],
  }
}
```

- [ ] **Step 3: Add worker-facing Convex operations**

In `convex/studio.ts`, add worker mutations:

- `claimNextGenerationJob({ workerId, lockTtlMs })`
- `markModelStarted({ jobId, workerId })`
- `completePlanning({ jobId, workerId, renderPlan, modelRun })`
- `startRendering({ jobId, workerId, renderRun })`
- `startUploading({ jobId, workerId })`
- `completeGenerationJob({ jobId, workerId, artifact, renderRun })`
- `failGenerationJob({ jobId, workerId, errorCode, errorMessage })`

Each mutation must conditionally match current `status` and `workerId`.

- [ ] **Step 4: Implement worker CLI skeleton**

Create `scripts/studio-worker.ts` with:

- Load env.
- Poll one job.
- Run planner stub.
- Call renderer in fake artifact mode in Task 6.
- Complete or fail job.

- [ ] **Step 5: Run tests**

Run: `npm run test -- scripts/studio-planner.test.ts convex/studio-worker.test.ts`

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/studio-planner.ts scripts/studio-worker.ts scripts/studio-planner.test.ts convex/studio-worker.test.ts convex/studio.ts
git commit -m "feat: add studio planner worker state machine"
```

### Task 6: Renderer Adapter, Artifact Metadata, And Signing

**Files:**
- Create: `scripts/studio-renderer.ts`
- Modify: `convex/studio.ts`
- Test: `scripts/studio-renderer.test.ts`
- Test: `convex/studio-artifacts.test.ts`

**Interfaces:**
- Consumes: render plan from Task 5.
- Produces: `renderStudioArtifact(plan)`, `getGenerationArtifactAccess(jobId)`.

- [ ] **Step 1: Write renderer tests**

Tests must cover:

- Fake renderer returns `storageKey`, `fileSizeBytes`, `mimeType: 'video/mp4'`, `width: 1280`, `height: 720`, `fps: 30`.
- Thumbnail failure returns `thumbnailStorageKey: undefined` and does not fail MP4 artifact.
- Artifact read query requires owner and returns a short-lived URL object.

- [ ] **Step 2: Implement fake renderer first**

Create `scripts/studio-renderer.ts`:

```typescript
import type { StudioRenderPlan } from '../convex/lib/studio/renderPlan'

export type RenderedStudioArtifact = {
  storageKey: string
  thumbnailStorageKey?: string
  fileSizeBytes: number
  mimeType: 'video/mp4'
  width: 1280
  height: 720
  fps: 30
  durationSeconds: number
  aspectRatio: '16:9'
  runtime: 'remotion'
}

export async function renderStudioArtifact(
  jobId: string,
  plan: StudioRenderPlan,
): Promise<RenderedStudioArtifact> {
  return {
    storageKey: `studio/${jobId}/artifact.mp4`,
    thumbnailStorageKey: undefined,
    fileSizeBytes: 1024,
    mimeType: 'video/mp4',
    width: plan.output.width,
    height: plan.output.height,
    fps: plan.output.fps,
    durationSeconds: plan.output.durationSeconds,
    aspectRatio: plan.output.aspectRatio,
    runtime: plan.runtime,
  }
}
```

- [ ] **Step 3: Add artifact access query**

In `convex/studio.ts`, add `getGenerationArtifactAccess({ jobId })`.

It must:

- Require authenticated owner.
- Read `generationArtifacts` by `userId + jobId`.
- Return signed URL fields generated by a helper.
- Return template preview or default thumbnail URL when `thumbnailStorageKey` is absent.

- [ ] **Step 4: Add real renderer handoff comment**

In `scripts/studio-renderer.ts`, keep fake renderer behind `STUDIO_RENDER_MODE=fake`. Add an explicit branch for `STUDIO_RENDER_MODE=remotion` that throws `RENDER_FAILED` until the Remotion asset repo and renderer command are wired.

- [ ] **Step 5: Run tests**

Run: `npm run test -- scripts/studio-renderer.test.ts convex/studio-artifacts.test.ts`

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/studio-renderer.ts scripts/studio-renderer.test.ts convex/studio-artifacts.test.ts convex/studio.ts
git commit -m "feat: add studio artifact renderer adapter"
```

### Task 7: Studio Route And UI

**Files:**
- Create: `src/routes/studio.tsx`
- Create: `src/components/studio/StudioPage.tsx`
- Create: `src/components/studio/PromptComposer.tsx`
- Create: `src/components/studio/TemplatePicker.tsx`
- Create: `src/components/studio/GenerationStatus.tsx`
- Create: `src/components/studio/GenerationResult.tsx`
- Create: `src/components/studio/GenerationHistory.tsx`
- Create: `src/components/studio/StudioPage.test.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/routes/-routes.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `api.studio.listStudioTemplates`, `api.studio.createGenerationJob`, `api.studio.getMyStudioHistory`, `api.studio.getGenerationJob`, `api.studio.getGenerationArtifactAccess`.
- Produces: `/studio` route.

- [ ] **Step 1: Write UI tests**

Tests must cover:

- `/studio` route is registered.
- Template list renders active templates.
- Clicking a template injects `agentPrompt`.
- Create button sends an `idempotencyKey`.
- History renders at most 10 jobs.
- Completed job shows video and download link.
- Planning cancellation confirmation warns that credits may not return after model start.

- [ ] **Step 2: Add route and nav**

Create `src/routes/studio.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import StudioPage from '#/components/studio/StudioPage'

export const Route = createFileRoute('/studio')({
  head: () => ({
    meta: [
      { title: 'AI Studio | RemotionHub' },
      {
        name: 'description',
        content: 'Generate 16:9 Remotion product demo videos from prompts.',
      },
    ],
  }),
  component: StudioPage,
})
```

Add `nav.studio` to `src/lib/i18n.ts` and link it in `Header.tsx`.

- [ ] **Step 3: Implement StudioPage layout**

Desktop:

- Left column: history, prompt, selected template, template list.
- Right column: status, result, generation parameter summary.

Mobile:

- Prompt first.
- Result second.
- Template list horizontal.
- History in compact section.

- [ ] **Step 4: Wire Convex hooks**

Use Convex React hooks:

- `useQuery(api.studio.listStudioTemplates)`
- `useQuery(api.studio.getMyStudioHistory)`
- `useMutation(api.studio.createGenerationJob)`
- Poll selected job through `useQuery(api.studio.getGenerationJob, { jobId })`.

Generate `idempotencyKey` with `crypto.randomUUID()` per create attempt and reuse it if the same click is retried after network failure.

- [ ] **Step 5: Run component tests**

Run: `npm run test -- src/components/studio/StudioPage.test.tsx src/routes/-routes.test.tsx`

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/studio.tsx src/components/studio src/components/Header.tsx src/lib/i18n.ts src/routes/-routes.test.tsx src/styles.css
git commit -m "feat: add ai studio workspace ui"
```

### Task 8: P0 End-To-End Smoke And MVP Expansion Path

**Files:**
- Create: `e2e/studio-smoke.spec.ts`
- Modify: `README.md`
- Modify: `AGENTS.md` only if command map changes.
- Modify: `package.json` only if adding scripts is necessary.
- Test: `e2e/studio-smoke.spec.ts`

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces: repeatable P0 verification.

- [ ] **Step 1: Add Playwright smoke test**

Create `e2e/studio-smoke.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

test('studio creates a generation job and shows a result', async ({ page }) => {
  await page.goto('/studio')
  await page.getByRole('textbox', { name: /prompt/i }).fill(
    'Create a 15 second product demo for an AI analytics dashboard.',
  )
  await page.getByRole('button', { name: /generate/i }).click()
  await expect(page.getByText(/queued|planning|rendering|uploading|completed/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /download/i })).toBeVisible({
    timeout: 60_000,
  })
})
```

- [ ] **Step 2: Document local P0 flow**

Update `README.md` with:

````markdown
## AI Studio P0

Seed the first Studio template:

```bash
npx tsx scripts/seed-studio-templates.ts
```

Run the worker in fake render mode:

```bash
STUDIO_RENDER_MODE=fake npx tsx scripts/studio-worker.ts
```

Open `/studio`, choose the product demo template, enter a prompt, and create a generation job.
````

- [ ] **Step 3: Run focused verification**

Run: `npm run test -- convex/studio.test.ts src/components/studio/StudioPage.test.tsx`

Expected: pass.

Run: `npm run ci:types-build`

Expected: pass.

Run after local Convex and app are available: `npm run test:e2e -- e2e/studio-smoke.spec.ts`

Expected: pass with fake render mode.

- [ ] **Step 4: Commit**

```bash
git add e2e/studio-smoke.spec.ts README.md package.json AGENTS.md
git commit -m "test: add ai studio p0 smoke coverage"
```

## Self-Review Checklist

- Spec coverage: Tasks 1-8 cover templates, jobs, ledger, state transitions, render plan validation, worker, artifacts, signed URL access, UI, history, and P0 smoke.
- Placeholder scan: no task should contain unresolved implementation slots.
- Type consistency: names used across tasks are `studioTemplates`, `generationJobs`, `usageLedger`, `generationArtifacts`, `modelRuns`, `renderRuns`, `StudioRenderPlan`, `createGenerationJob`, and `getGenerationArtifactAccess`.
- Risk front-loading: real renderer work starts before UI; fake renderer is a P0 bridge and is explicitly controlled by `STUDIO_RENDER_MODE=fake`.
- Final gate: before PR handoff for implementation, run `make check` after dependencies and local services are ready.
