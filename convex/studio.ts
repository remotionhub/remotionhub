import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { requireStudioProjectOwner, requireUser } from './lib/access'
import {
  normalizeStudioComposition,
  serializeStudioCandidate,
} from '../shared/studio'
import {
  applyExactEdits,
  buildStudioContext,
  detectSkillsWithFallback,
  normalizeGenerationError,
  selectNewSkills,
  STUDIO_SKILL_PROMPTS,
  validatePromptWithFallback,
} from './lib/studioGeneration'
import { createStudioModel } from './lib/studioModel'

const promptMaxLength = 4_000
const idempotencyKeyMinLength = 8
const idempotencyKeyMaxLength = 200
const normalizedErrorMaxLength = 2_000

const studioGenerationSystemPrompt = [
  'Generate a deterministic Remotion React composition.',
  'Return exactly one exported component named MyAnimation and the structured Composition requested by the schema.',
  'Imports may only use remotion, @remotion/shapes, @remotion/transitions, @remotion/transitions/fade, @remotion/transitions/slide, @remotion/transitions/wipe, @remotion/three, @remotion/lottie, @react-three/fiber, and three.',
  'Do not use network, storage, DOM measurement or mutation APIs, dynamic import, eval, Function constructors, timers, requestAnimationFrame, or unprovided assets.',
  'All animation must be deterministic and derived from the current frame.',
].join(' ')

const studioValidationSystemPrompt =
  'Decide whether the request asks to create or update motion graphics. Deny only when it has no motion-generation intent.'

const studioSkillSystemPrompt =
  'Select only the supported motion skills needed to satisfy this request.'

const studioCompositionValidator = v.object({
  aspectRatio: v.union(
    v.literal('16:9'),
    v.literal('9:16'),
    v.literal('1:1'),
  ),
  width: v.number(),
  height: v.number(),
  fps: v.number(),
  durationInFrames: v.number(),
})

const correctionContextValidator = v.object({
  code: v.string(),
  composition: studioCompositionValidator,
  normalizedError: v.string(),
})

function validatePromptAndIdempotencyKey(
  prompt: string,
  idempotencyKey: string,
) {
  if (prompt.length < 1 || prompt.length > promptMaxLength) {
    throw new Error('Studio prompt must be 1..4000 characters')
  }
  if (
    idempotencyKey.length < idempotencyKeyMinLength ||
    idempotencyKey.length > idempotencyKeyMaxLength
  ) {
    throw new Error('Studio idempotency key must be 8..200 characters')
  }
}

function sanitizeNormalizedError(normalizedError: string) {
  return normalizedError.slice(0, normalizedErrorMaxLength)
}

function queuedRunResult(
  projectId: Id<'studioProjects'>,
  runId: Id<'studioGenerationRuns'>,
) {
  return { projectId, runId, status: 'queued' as const }
}

async function getOwnerRunByIdempotency(
  ctx: Parameters<typeof requireUser>[0],
  ownerId: Id<'users'>,
  idempotencyKey: string,
) {
  return await ctx.db
    .query('studioGenerationRuns')
    .withIndex('by_owner_idempotency', (q) =>
      q.eq('ownerId', ownerId).eq('idempotencyKey', idempotencyKey),
    )
    .unique()
}

function assertCurrentCandidate(input: {
  project: Doc<'studioProjects'>
  run: Doc<'studioGenerationRuns'> | null
  ownerId: Id<'users'>
  runId: Id<'studioGenerationRuns'>
  candidateFingerprint: string
}) {
  const { project, run, ownerId, runId, candidateFingerprint } = input
  if (
    project.currentRunId !== runId ||
    !run ||
    run.projectId !== project._id ||
    run.ownerId !== ownerId ||
    run.status !== 'compiling' ||
    run.candidateFingerprint !== candidateFingerprint
  ) {
    throw new Error('Studio candidate changed')
  }
  const { candidateCode, candidateComposition, candidateSummary } = run
  if (!candidateCode || !candidateComposition || !candidateSummary) {
    throw new Error('Studio candidate changed')
  }
  return {
    ...run,
    candidateCode,
    candidateComposition,
    candidateFingerprint,
    candidateSummary,
  }
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export const startPromptProject = mutation({
  args: { prompt: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const existing = await getOwnerRunByIdempotency(
      ctx,
      userId,
      args.idempotencyKey,
    )
    if (existing) return queuedRunResult(existing.projectId, existing._id)

    validatePromptAndIdempotencyKey(args.prompt, args.idempotencyKey)
    const now = Date.now()
    const projectId = await ctx.db.insert('studioProjects', {
      ownerId: userId,
      title: args.prompt.trim().slice(0, 80) || 'Untitled animation',
      status: 'active',
      source: { kind: 'prompt' },
      composition: normalizeStudioComposition({}),
      createdAt: now,
      updatedAt: now,
    })
    const promptMessageId = await ctx.db.insert('studioMessages', {
      projectId,
      role: 'user',
      kind: 'prompt',
      content: args.prompt,
      createdAt: now,
    })
    const runId = await ctx.db.insert('studioGenerationRuns', {
      projectId,
      ownerId: userId,
      status: 'queued',
      promptMessageId,
      modelAlias: 'studio-default',
      detectedSkills: [],
      correctionAttempt: 0,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(projectId, { currentRunId: runId })
    await ctx.db.patch(promptMessageId, { generationRunId: runId })
    await ctx.scheduler.runAfter(0, internal.studio.runGeneration, { runId })
    return queuedRunResult(projectId, runId)
  },
})

export const startFollowUp = mutation({
  args: {
    projectId: v.id('studioProjects'),
    prompt: v.string(),
    idempotencyKey: v.string(),
    expectedCurrentRevisionId: v.id('studioRevisions'),
  },
  handler: async (ctx, args) => {
    const { project, userId } = await requireStudioProjectOwner(
      ctx,
      args.projectId,
    )
    const existing = await getOwnerRunByIdempotency(
      ctx,
      userId,
      args.idempotencyKey,
    )
    if (existing) {
      if (existing.projectId !== args.projectId) {
        throw new Error('Studio idempotency key conflict')
      }
      return queuedRunResult(existing.projectId, existing._id)
    }

    validatePromptAndIdempotencyKey(args.prompt, args.idempotencyKey)
    if (project.currentRevisionId !== args.expectedCurrentRevisionId) {
      throw new Error('Studio project changed')
    }
    if (project.currentRunId) throw new Error('Studio generation in progress')

    const now = Date.now()
    const promptMessageId = await ctx.db.insert('studioMessages', {
      projectId: args.projectId,
      role: 'user',
      kind: 'prompt',
      content: args.prompt,
      createdAt: now,
    })
    const runId = await ctx.db.insert('studioGenerationRuns', {
      projectId: args.projectId,
      ownerId: userId,
      status: 'queued',
      inputRevisionId: args.expectedCurrentRevisionId,
      promptMessageId,
      modelAlias: 'studio-default',
      detectedSkills: [],
      correctionAttempt: 0,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(args.projectId, { currentRunId: runId, updatedAt: now })
    await ctx.db.patch(promptMessageId, { generationRunId: runId })
    await ctx.scheduler.runAfter(0, internal.studio.runGeneration, { runId })
    return queuedRunResult(args.projectId, runId)
  },
})

export const acceptCandidate = mutation({
  args: {
    projectId: v.id('studioProjects'),
    runId: v.id('studioGenerationRuns'),
    candidateFingerprint: v.string(),
  },
  handler: async (ctx, args) => {
    const { project, userId } = await requireStudioProjectOwner(
      ctx,
      args.projectId,
    )
    const run = assertCurrentCandidate({
      project,
      run: await ctx.db.get(args.runId),
      ownerId: userId,
      runId: args.runId,
      candidateFingerprint: args.candidateFingerprint,
    })
    const latest = await ctx.db
      .query('studioRevisions')
      .withIndex('by_project_sequence', (q) =>
        q.eq('projectId', args.projectId),
      )
      .order('desc')
      .first()
    const now = Date.now()
    const origin =
      run.correctionAttempt > 0
        ? ('correction' as const)
        : run.inputRevisionId
          ? ('follow-up' as const)
          : ('prompt' as const)
    const revisionId = await ctx.db.insert('studioRevisions', {
      projectId: args.projectId,
      sequence: (latest?.sequence ?? 0) + 1,
      parentRevisionId: run.inputRevisionId ?? project.currentRevisionId,
      previousRunnableRevisionId: project.lastRunnableRevisionId,
      origin,
      code: run.candidateCode,
      codeHash: run.candidateFingerprint,
      composition: run.candidateComposition,
      promptMessageId: run.promptMessageId,
      assistantSummary: run.candidateSummary,
      createdAt: now,
    })
    await ctx.db.insert('studioMessages', {
      projectId: args.projectId,
      role: 'assistant',
      kind: 'response',
      content: run.candidateSummary,
      generationRunId: run._id,
      revisionId,
      createdAt: now,
    })
    await ctx.db.patch(run._id, {
      status: 'succeeded',
      candidateCode: undefined,
      candidateComposition: undefined,
      candidateFingerprint: undefined,
      candidateSummary: undefined,
      errorCode: undefined,
      updatedAt: now,
    })
    await ctx.db.patch(project._id, {
      currentRevisionId: revisionId,
      lastRunnableRevisionId: revisionId,
      currentRunId: undefined,
      composition: run.candidateComposition,
      updatedAt: now,
    })
    return (await ctx.db.get(revisionId))!
  },
})

export const rejectCandidate = mutation({
  args: {
    projectId: v.id('studioProjects'),
    runId: v.id('studioGenerationRuns'),
    candidateFingerprint: v.string(),
    normalizedError: v.string(),
  },
  handler: async (ctx, args) => {
    const { project, userId } = await requireStudioProjectOwner(
      ctx,
      args.projectId,
    )
    const run = assertCurrentCandidate({
      project,
      run: await ctx.db.get(args.runId),
      ownerId: userId,
      runId: args.runId,
      candidateFingerprint: args.candidateFingerprint,
    })
    const now = Date.now()
    const clearedCandidate = {
      candidateCode: undefined,
      candidateComposition: undefined,
      candidateFingerprint: undefined,
      candidateSummary: undefined,
    }
    if (run.correctionAttempt >= 3) {
      await ctx.db.patch(run._id, {
        ...clearedCandidate,
        status: 'failed',
        errorCode: 'CORRECTION_LIMIT',
        updatedAt: now,
      })
      await ctx.db.patch(project._id, {
        currentRunId: undefined,
        updatedAt: now,
      })
      return { projectId: project._id, runId: run._id, status: 'failed' as const }
    }

    const correctionContext = {
      code: run.candidateCode.slice(0, 100_000),
      composition: run.candidateComposition,
      normalizedError: sanitizeNormalizedError(args.normalizedError),
    }
    await ctx.db.patch(run._id, {
      ...clearedCandidate,
      status: 'queued',
      correctionAttempt: run.correctionAttempt + 1,
      errorCode: undefined,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.studio.runGeneration, {
      runId: run._id,
      correctionContext,
    })
    return queuedRunResult(project._id, run._id)
  },
})

export const reportRuntimeFailure = mutation({
  args: {
    projectId: v.id('studioProjects'),
    revisionId: v.id('studioRevisions'),
    normalizedError: v.string(),
  },
  handler: async (ctx, args) => {
    const { project, userId } = await requireStudioProjectOwner(
      ctx,
      args.projectId,
    )
    const idempotencyKey = `runtime-failure:${args.revisionId}`
    const existing = await getOwnerRunByIdempotency(
      ctx,
      userId,
      idempotencyKey,
    )
    if (existing) {
      if (existing.projectId !== args.projectId) {
        throw new Error('Studio idempotency key conflict')
      }
      return queuedRunResult(existing.projectId, existing._id)
    }
    if (project.currentRevisionId !== args.revisionId) {
      throw new Error('Studio project changed')
    }
    if (project.currentRunId) throw new Error('Studio generation in progress')

    const revision = await ctx.db.get(args.revisionId)
    if (!revision || revision.projectId !== args.projectId) {
      throw new Error('Studio revision unavailable')
    }
    const normalizedError = sanitizeNormalizedError(args.normalizedError)
    const now = Date.now()
    const promptMessageId = await ctx.db.insert('studioMessages', {
      projectId: args.projectId,
      role: 'system',
      kind: 'error',
      content: normalizedError,
      createdAt: now,
    })
    const runId = await ctx.db.insert('studioGenerationRuns', {
      projectId: args.projectId,
      ownerId: userId,
      status: 'queued',
      inputRevisionId: revision._id,
      promptMessageId,
      modelAlias: 'studio-default',
      detectedSkills: [],
      correctionAttempt: 1,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(promptMessageId, { generationRunId: runId })
    await ctx.db.patch(project._id, {
      currentRevisionId: revision.previousRunnableRevisionId,
      lastRunnableRevisionId: revision.previousRunnableRevisionId,
      currentRunId: runId,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.studio.runGeneration, {
      runId,
      correctionContext: {
        code: revision.code.slice(0, 100_000),
        composition: revision.composition,
        normalizedError,
      },
    })
    return queuedRunResult(project._id, runId)
  },
})

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
      .withIndex('by_project_sequence', (q) =>
        q.eq('projectId', args.projectId),
      )
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

export const loadGenerationContext = internalQuery({
  args: { runId: v.id('studioGenerationRuns') },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (!run || run.status !== 'queued') return null
    const project = await ctx.db.get(run.projectId)
    const promptMessage = await ctx.db.get(run.promptMessageId)
    if (
      !project ||
      project.ownerId !== run.ownerId ||
      project.currentRunId !== run._id ||
      !promptMessage ||
      promptMessage.projectId !== project._id
    ) {
      return null
    }

    const revision = run.inputRevisionId
      ? await ctx.db.get(run.inputRevisionId)
      : null
    if (revision && revision.projectId !== project._id) return null

    const [messages, recentRuns] = await Promise.all([
      ctx.db
        .query('studioMessages')
        .withIndex('by_project_created', (q) =>
          q.eq('projectId', project._id),
        )
        .order('desc')
        .take(12)
        .then((items) => items.reverse()),
      ctx.db
        .query('studioGenerationRuns')
        .withIndex('by_project_updated', (q) =>
          q.eq('projectId', project._id),
        )
        .order('desc')
        .take(20),
    ])

    return { run, project, promptMessage, revision, messages, recentRuns }
  },
})

export const advanceGenerationRun = internalMutation({
  args: {
    runId: v.id('studioGenerationRuns'),
    expectedStatus: v.union(
      v.literal('queued'),
      v.literal('validating'),
      v.literal('selecting-skills'),
    ),
    status: v.union(
      v.literal('validating'),
      v.literal('selecting-skills'),
      v.literal('generating'),
    ),
    detectedSkills: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run || run.status !== args.expectedStatus) return false
    const project = await ctx.db.get(run.projectId)
    if (!project || project.currentRunId !== run._id) return false
    await ctx.db.patch(run._id, {
      status: args.status,
      detectedSkills: args.detectedSkills ?? run.detectedSkills,
      updatedAt: Date.now(),
    })
    return true
  },
})

export const saveGenerationCandidate = internalMutation({
  args: {
    runId: v.id('studioGenerationRuns'),
    candidateCode: v.string(),
    candidateComposition: studioCompositionValidator,
    candidateFingerprint: v.string(),
    candidateSummary: v.string(),
    tokenUsage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
    }),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run || run.status !== 'generating') return false
    const project = await ctx.db.get(run.projectId)
    if (!project || project.currentRunId !== run._id) return false
    await ctx.db.patch(run._id, {
      status: 'compiling',
      candidateCode: args.candidateCode,
      candidateComposition: args.candidateComposition,
      candidateFingerprint: args.candidateFingerprint,
      candidateSummary: args.candidateSummary,
      tokenUsage: args.tokenUsage,
      durationMs: args.durationMs,
      errorCode: undefined,
      updatedAt: Date.now(),
    })
    return true
  },
})

export const failGenerationRun = internalMutation({
  args: {
    runId: v.id('studioGenerationRuns'),
    errorCode: v.string(),
    tokenUsage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
    }),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (
      !run ||
      run.status === 'succeeded' ||
      run.status === 'failed' ||
      run.status === 'cancelled'
    ) {
      return false
    }
    const project = await ctx.db.get(run.projectId)
    await ctx.db.patch(run._id, {
      status: 'failed',
      candidateCode: undefined,
      candidateComposition: undefined,
      candidateFingerprint: undefined,
      candidateSummary: undefined,
      errorCode: args.errorCode,
      tokenUsage: args.tokenUsage,
      durationMs: args.durationMs,
      updatedAt: Date.now(),
    })
    if (project?.currentRunId === run._id) {
      await ctx.db.patch(project._id, {
        currentRunId: undefined,
        updatedAt: Date.now(),
      })
    }
    return true
  },
})

export const runGeneration = internalAction({
  args: {
    runId: v.id('studioGenerationRuns'),
    correctionContext: v.optional(correctionContextValidator),
  },
  handler: async (ctx, args): Promise<void> => {
    const startedAt = Date.now()
    const snapshot = await ctx.runQuery(
      internal.studio.loadGenerationContext,
      { runId: args.runId },
    )
    if (!snapshot) return

    const tokenUsage = {
      inputTokens: snapshot.run.tokenUsage?.inputTokens ?? 0,
      outputTokens: snapshot.run.tokenUsage?.outputTokens ?? 0,
    }
    const previousDurationMs = snapshot.run.durationMs ?? 0
    const addUsage = (usage: {
      inputTokens: number
      outputTokens: number
    }) => {
      tokenUsage.inputTokens += usage.inputTokens
      tokenUsage.outputTokens += usage.outputTokens
    }
    const durationMs = () => previousDurationMs + (Date.now() - startedAt)
    const logPhase = (phase: string, errorCode?: string) => {
      console.info('Studio generation', {
        runId: args.runId,
        phase,
        modelAlias: snapshot.run.modelAlias,
        elapsedMs: durationMs(),
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        ...(errorCode ? { errorCode } : {}),
      })
    }
    const fail = async (errorCode: string) => {
      await ctx.runMutation(internal.studio.failGenerationRun, {
        runId: args.runId,
        errorCode,
        tokenUsage,
        durationMs: durationMs(),
      })
      logPhase('failed', errorCode)
    }

    try {
      const validating = await ctx.runMutation(
        internal.studio.advanceGenerationRun,
        {
          runId: args.runId,
          expectedStatus: 'queued',
          status: 'validating',
        },
      )
      if (!validating) return

      const model = createStudioModel({
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        STUDIO_OPENAI_MODEL: process.env.STUDIO_OPENAI_MODEL,
        STUDIO_MODEL_MODE: process.env.STUDIO_MODEL_MODE,
      })
      const validation = await validatePromptWithFallback(async () => {
        const call = await model.validatePrompt({
          prompt: snapshot.promptMessage.content,
          system: studioValidationSystemPrompt,
        })
        addUsage(call.usage)
        return call.data
      })
      if (!validation.allow) {
        await fail('INVALID_PROMPT')
        return
      }

      const selectingSkills = await ctx.runMutation(
        internal.studio.advanceGenerationRun,
        {
          runId: args.runId,
          expectedStatus: 'validating',
          status: 'selecting-skills',
        },
      )
      if (!selectingSkills) return
      const detectedSkills = await detectSkillsWithFallback(async () => {
        const call = await model.detectSkills({
          prompt: snapshot.promptMessage.content,
          system: studioSkillSystemPrompt,
        })
        addUsage(call.usage)
        return call.data
      })
      const usedSkills = Array.from(
        new Set(
          snapshot.recentRuns.flatMap((run) =>
            run._id === snapshot.run._id ? [] : run.detectedSkills,
          ),
        ),
      )
      const selectedSkills = selectNewSkills(detectedSkills, usedSkills)

      const generating = await ctx.runMutation(
        internal.studio.advanceGenerationRun,
        {
          runId: args.runId,
          expectedStatus: 'selecting-skills',
          status: 'generating',
          detectedSkills,
        },
      )
      if (!generating) return

      const skillInstructions = selectedSkills
        .map((skill) => STUDIO_SKILL_PROMPTS[skill])
        .join('\n\n')
      const system = [studioGenerationSystemPrompt, skillInstructions]
        .filter(Boolean)
        .join('\n\n')
      const context = buildStudioContext({
        code: snapshot.revision?.code ?? '',
        messages: snapshot.messages,
      })

      let generated: {
        code: string
        summary: string
        composition: {
          aspectRatio?: '16:9' | '9:16' | '1:1'
          durationInFrames?: number
        }
      }
      if (snapshot.run.correctionAttempt > 0) {
        if (!args.correctionContext) {
          throw new Error('Correction context is unavailable')
        }
        const call = await model.correct({
          system,
          prompt: JSON.stringify({
            task: snapshot.promptMessage.content,
            code: args.correctionContext.code,
            composition: args.correctionContext.composition,
            normalizedError: args.correctionContext.normalizedError,
            recentMessages: context.messages,
          }),
        })
        addUsage(call.usage)
        generated = call.data
      } else if (snapshot.run.inputRevisionId) {
        if (!snapshot.revision) throw new Error('Input revision is unavailable')
        const call = await model.generateFollowUp({
          system,
          prompt: JSON.stringify({
            task: snapshot.promptMessage.content,
            ...context,
            composition: snapshot.revision.composition,
          }),
        })
        addUsage(call.usage)
        if (call.data.kind === 'edits') {
          generated = {
            code: applyExactEdits(snapshot.revision.code, call.data.edits),
            summary: call.data.summary,
            composition: call.data.composition ?? {
              aspectRatio: snapshot.revision.composition.aspectRatio,
              durationInFrames:
                snapshot.revision.composition.durationInFrames,
            },
          }
        } else {
          generated = call.data
        }
      } else {
        const call = await model.generateInitial({
          system,
          prompt: JSON.stringify({
            task: snapshot.promptMessage.content,
            composition: snapshot.project.composition,
            recentMessages: context.messages,
          }),
        })
        addUsage(call.usage)
        generated = call.data
      }

      const candidateComposition = normalizeStudioComposition(
        generated.composition,
      )
      const candidateFingerprint = await sha256Hex(
        serializeStudioCandidate(generated.code, candidateComposition),
      )
      const saved = await ctx.runMutation(
        internal.studio.saveGenerationCandidate,
        {
          runId: args.runId,
          candidateCode: generated.code,
          candidateComposition,
          candidateFingerprint,
          candidateSummary: generated.summary,
          tokenUsage,
          durationMs: durationMs(),
        },
      )
      if (saved) logPhase('compiling')
    } catch (error) {
      await fail(normalizeGenerationError(error))
    }
  },
})
