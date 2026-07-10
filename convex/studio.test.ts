import { getAuthUserId } from '@convex-dev/auth/server'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'
import { sha256Hex } from './studio'

const studioModelHarness = vi.hoisted(() => ({ mode: 'actual' }))

vi.mock('./lib/studioModel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/studioModel')>()
  return {
    ...actual,
    createStudioModel(env: Record<string, string | undefined>) {
      if (studioModelHarness.mode === 'actual') {
        return actual.createStudioModel(env)
      }
      const base = actual.createStudioModel({ STUDIO_MODEL_MODE: 'stub' })
      if (studioModelHarness.mode === 'deny') {
        return {
          ...base,
          async validatePrompt() {
            return {
              data: { allow: false, reason: 'not-motion' },
              usage: { inputTokens: 2, outputTokens: 1 },
            }
          },
        }
      }
      if (studioModelHarness.mode === 'detector-failure') {
        return {
          ...base,
          async validatePrompt() {
            return {
              data: { allow: true, reason: 'motion' },
              usage: { inputTokens: 2, outputTokens: 1 },
            }
          },
          async detectSkills() {
            throw new Error('detector unavailable')
          },
          async generateInitial(input: { prompt: string; system: string }) {
            const generated = await base.generateInitial(input)
            return {
              ...generated,
              usage: { inputTokens: 5, outputTokens: 3 },
            }
          },
        }
      }
      return {
        ...base,
        async generateFollowUp() {
          return {
            data: {
              kind: 'edits' as const,
              edits: [
                {
                  oldString: 'Second',
                  newString: 'MyAnimation',
                  description: 'Rename the exported component',
                },
              ],
              summary: 'Applied an exact source edit',
            },
            usage: { inputTokens: 4, outputTokens: 2 },
          }
        },
      }
    },
  }
})

vi.mock('@convex-dev/auth/server', async () => {
  const actual = await vi.importActual<typeof import('@convex-dev/auth/server')>(
    '@convex-dev/auth/server',
  )
  return {
    ...actual,
    getAuthUserId: vi.fn(),
  }
})

const modules = import.meta.glob('./**/*.*s')
const composition = {
  aspectRatio: '16:9' as const,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
}

function useIdentityAuthMock() {
  vi.mocked(getAuthUserId).mockImplementation(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    return (identity?.subject as Id<'users'> | undefined) ?? null
  })
}

async function seedStudio() {
  const t = convexTest(schema, modules)
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert('users', {
      name: 'Owner',
      role: 'user',
      createdAt: 1,
      updatedAt: 1,
    })
    const otherUserId = await ctx.db.insert('users', {
      name: 'Other User',
      role: 'user',
      createdAt: 1,
      updatedAt: 1,
    })
    const projectId = await ctx.db.insert('studioProjects', {
      ownerId,
      title: 'Launch animation',
      status: 'active',
      source: { kind: 'prompt' },
      composition,
      createdAt: 10,
      updatedAt: 20,
    })
    const firstRevisionId = await ctx.db.insert('studioRevisions', {
      projectId,
      sequence: 1,
      origin: 'prompt',
      code: 'export const First = () => null',
      codeHash: 'first-hash',
      composition,
      assistantSummary: 'Created the first revision',
      createdAt: 11,
    })
    const secondRevisionId = await ctx.db.insert('studioRevisions', {
      projectId,
      sequence: 2,
      parentRevisionId: firstRevisionId,
      previousRunnableRevisionId: firstRevisionId,
      origin: 'follow-up',
      code: 'export const Second = () => null',
      codeHash: 'second-hash',
      composition,
      assistantSummary: 'Created the second revision',
      createdAt: 12,
    })
    await ctx.db.patch(projectId, {
      currentRevisionId: secondRevisionId,
      lastRunnableRevisionId: secondRevisionId,
    })
    await ctx.db.insert('studioMessages', {
      projectId,
      role: 'user',
      kind: 'prompt',
      content: 'Create a launch animation',
      createdAt: 13,
    })
    await ctx.db.insert('studioMessages', {
      projectId,
      role: 'assistant',
      kind: 'response',
      content: 'Created the animation',
      revisionId: secondRevisionId,
      createdAt: 14,
    })

    const missingProjectId = await ctx.db.insert('studioProjects', {
      ownerId,
      title: 'Deleted project',
      status: 'active',
      source: { kind: 'prompt' },
      composition,
      createdAt: 1,
      updatedAt: 1,
    })
    await ctx.db.delete(missingProjectId)

    return {
      ownerId,
      otherUserId,
      projectId,
      missingProjectId,
      firstRevisionId,
      secondRevisionId,
    }
  })

  return { t, ...fixture }
}

async function seedCompilingRun(input?: { correctionAttempt?: number }) {
  const fixture = await seedStudio()
  const candidateCode = 'export const MyAnimation = () => null'
  const candidateFingerprint = 'candidate-fingerprint'
  const runId = await fixture.t.run(async (ctx) => {
    const promptMessageId = await ctx.db.insert('studioMessages', {
      projectId: fixture.projectId,
      role: 'user',
      kind: 'prompt',
      content: 'Make the title cyan',
      createdAt: 30,
    })
    const runId = await ctx.db.insert('studioGenerationRuns', {
      projectId: fixture.projectId,
      ownerId: fixture.ownerId,
      status: 'compiling',
      inputRevisionId: fixture.secondRevisionId,
      promptMessageId,
      modelAlias: 'studio-default',
      detectedSkills: ['Typography'],
      correctionAttempt: input?.correctionAttempt ?? 0,
      candidateCode,
      candidateComposition: composition,
      candidateFingerprint,
      candidateSummary: 'Updated the title color',
      idempotencyKey: 'candidate-run-key',
      createdAt: 30,
      updatedAt: 30,
    })
    await ctx.db.patch(promptMessageId, { generationRunId: runId })
    await ctx.db.patch(fixture.projectId, { currentRunId: runId })
    return runId
  })
  return { ...fixture, runId, candidateCode, candidateFingerprint }
}

describe('studio ownership and revision history', () => {
  beforeEach(() => {
    useIdentityAuthMock()
  })

  it('lists only projects owned by the authenticated user', async () => {
    const { t, ownerId, otherUserId, projectId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })
    const other = t.withIdentity({ subject: otherUserId })

    const projects = await owner.query(api.studio.listRecentProjects, {
      limit: 10,
    })
    const otherProjects = await other.query(api.studio.listRecentProjects, {
      limit: 10,
    })

    expect(projects.map((project) => project._id)).toEqual([projectId])
    expect(otherProjects).toEqual([])
  })

  it('rejects project reads when unauthenticated', async () => {
    const { t, projectId } = await seedStudio()

    await expect(
      t.query(api.studio.getProject, { projectId }),
    ).rejects.toThrow('Unauthorized')
  })

  it('returns the same unavailable error for missing and foreign projects', async () => {
    const { t, otherUserId, projectId, missingProjectId } = await seedStudio()
    const other = t.withIdentity({ subject: otherUserId })

    await expect(
      other.query(api.studio.getProject, { projectId }),
    ).rejects.toThrow('Studio project unavailable')
    await expect(
      other.query(api.studio.getProject, { projectId: missingProjectId }),
    ).rejects.toThrow('Studio project unavailable')
  })

  it('returns the current project revision', async () => {
    const { t, ownerId, projectId, secondRevisionId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    const result = await owner.query(api.studio.getProject, { projectId })

    expect(result.project._id).toBe(projectId)
    expect(result.revision?._id).toBe(secondRevisionId)
    expect(result.run).toBeNull()
  })

  it('returns messages chronologically and revisions newest first', async () => {
    const { t, ownerId, projectId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    const messages = await owner.query(api.studio.listMessages, {
      projectId,
      limit: 1000,
    })
    const revisions = await owner.query(api.studio.listRevisions, {
      projectId,
      limit: 1000,
    })

    expect(messages.map((message) => message.createdAt)).toEqual([13, 14])
    expect(revisions.map((revision) => revision.sequence)).toEqual([2, 1])
  })

  it('protects message and revision history with project ownership', async () => {
    const { t, otherUserId, projectId } = await seedStudio()
    const other = t.withIdentity({ subject: otherUserId })

    await expect(
      other.query(api.studio.listMessages, { projectId, limit: 10 }),
    ).rejects.toThrow('Studio project unavailable')
    await expect(
      other.query(api.studio.listRevisions, { projectId, limit: 10 }),
    ).rejects.toThrow('Studio project unavailable')
  })

  it('rolls back by appending a revision instead of deleting history', async () => {
    const {
      t,
      ownerId,
      projectId,
      firstRevisionId,
      secondRevisionId,
    } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    const result = await owner.mutation(api.studio.rollbackRevision, {
      projectId,
      revisionId: firstRevisionId,
      expectedCurrentRevisionId: secondRevisionId,
    })

    expect(result?.sequence).toBe(3)
    expect(result?.origin).toBe('rollback')
    expect(result?.parentRevisionId).toBe(secondRevisionId)
    expect(result?.previousRunnableRevisionId).toBe(secondRevisionId)
    expect(result?.code).toBe('export const First = () => null')

    const history = await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId)
      const revisions = await ctx.db
        .query('studioRevisions')
        .withIndex('by_project_sequence', (q) => q.eq('projectId', projectId))
        .collect()
      return { project, revisions }
    })
    expect(history.revisions.map((revision) => revision.sequence)).toEqual([
      1, 2, 3,
    ])
    expect(history.project?.currentRevisionId).toBe(result?._id)
    expect(history.project?.lastRunnableRevisionId).toBe(result?._id)
  })

  it('rejects a rollback based on a stale current revision', async () => {
    const {
      t,
      ownerId,
      projectId,
      firstRevisionId,
      secondRevisionId,
    } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    await expect(
      owner.mutation(api.studio.rollbackRevision, {
        projectId,
        revisionId: firstRevisionId,
        expectedCurrentRevisionId: firstRevisionId,
      }),
    ).rejects.toThrow('Studio project changed')

    const revisions = await owner.query(api.studio.listRevisions, {
      projectId,
      limit: 10,
    })
    expect(revisions.map((revision) => revision._id)).toEqual([
      secondRevisionId,
      firstRevisionId,
    ])
  })

  it('rejects rollback of a revision owned by another project', async () => {
    const { t, ownerId, projectId, secondRevisionId } = await seedStudio()
    const foreignRevisionId = await t.run(async (ctx) => {
      const foreignProjectId = await ctx.db.insert('studioProjects', {
        ownerId,
        title: 'Another project',
        status: 'active',
        source: { kind: 'prompt' },
        composition,
        createdAt: 30,
        updatedAt: 30,
      })
      return await ctx.db.insert('studioRevisions', {
        projectId: foreignProjectId,
        sequence: 1,
        origin: 'prompt',
        code: 'export const Foreign = () => null',
        codeHash: 'foreign-hash',
        composition,
        assistantSummary: 'Created a foreign revision',
        createdAt: 31,
      })
    })
    const owner = t.withIdentity({ subject: ownerId })

    await expect(
      owner.mutation(api.studio.rollbackRevision, {
        projectId,
        revisionId: foreignRevisionId,
        expectedCurrentRevisionId: secondRevisionId,
      }),
    ).rejects.toThrow('Studio revision unavailable')
  })
})

describe('studio generation runs', () => {
  beforeEach(() => {
    useIdentityAuthMock()
    studioModelHarness.mode = 'actual'
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.STUDIO_OPENAI_MODEL
    delete process.env.STUDIO_MODEL_MODE
    vi.useRealTimers()
  })

  it('computes lower-case SHA-256 fingerprints', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('runs the deterministic stub through compiling without a revision', async () => {
    vi.useFakeTimers()
    process.env.STUDIO_MODEL_MODE = 'stub'
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert('users', { name: 'Owner', createdAt: 1, updatedAt: 1 }),
    )
    const owner = t.withIdentity({ subject: ownerId })
    const result = await owner.mutation(api.studio.startPromptProject, {
      prompt: 'Animate a cyan title entering with spring motion',
      idempotencyKey: 'stub-run-1',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const snapshot = await owner.query(api.studio.getProject, {
      projectId: result.projectId,
    })
    const revisions = await owner.query(api.studio.listRevisions, {
      projectId: result.projectId,
      limit: 10,
    })
    expect(snapshot.run).toMatchObject({
      status: 'compiling',
      candidateSummary: 'Created a cyan title reveal',
      detectedSkills: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    })
    expect(snapshot.run?.candidateCode).toContain(
      'export const MyAnimation',
    )
    expect(snapshot.run?.candidateComposition).toEqual(composition)
    expect(snapshot.run?.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(revisions).toEqual([])
  })

  it('generates a complete replacement for a follow-up', async () => {
    vi.useFakeTimers()
    process.env.STUDIO_MODEL_MODE = 'stub'
    const { t, ownerId, projectId, secondRevisionId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })
    const result = await owner.mutation(api.studio.startFollowUp, {
      projectId,
      prompt: 'Make the title cyan',
      idempotencyKey: 'follow-up-stub',
      expectedCurrentRevisionId: secondRevisionId,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const snapshot = await owner.query(api.studio.getProject, { projectId })
    const revisions = await owner.query(api.studio.listRevisions, {
      projectId,
      limit: 10,
    })
    expect(snapshot.run).toMatchObject({
      _id: result.runId,
      status: 'compiling',
      inputRevisionId: secondRevisionId,
      candidateSummary: 'Updated the title motion',
    })
    expect(revisions).toHaveLength(2)
  })

  it('corrects a rejected candidate within the same run', async () => {
    vi.useFakeTimers()
    process.env.STUDIO_MODEL_MODE = 'stub'
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert('users', { name: 'Owner', createdAt: 1, updatedAt: 1 }),
    )
    const owner = t.withIdentity({ subject: ownerId })
    const started = await owner.mutation(api.studio.startPromptProject, {
      prompt: 'Animate a cyan title',
      idempotencyKey: 'correct-stub',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const firstCandidate = await owner.query(api.studio.getProject, {
      projectId: started.projectId,
    })

    await owner.mutation(api.studio.rejectCandidate, {
      projectId: started.projectId,
      runId: started.runId,
      candidateFingerprint: firstCandidate.run?.candidateFingerprint ?? '',
      normalizedError: 'Unexpected token at line 3',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const corrected = await owner.query(api.studio.getProject, {
      projectId: started.projectId,
    })
    expect(corrected.run).toMatchObject({
      _id: started.runId,
      status: 'compiling',
      correctionAttempt: 1,
      candidateSummary: 'Created a cyan title reveal',
    })
  })

  it('fails with a stable code when the backend model is not configured', async () => {
    vi.useFakeTimers()
    process.env.OPENAI_API_KEY = ''
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert('users', { name: 'Owner', createdAt: 1, updatedAt: 1 }),
    )
    const owner = t.withIdentity({ subject: ownerId })
    const started = await owner.mutation(api.studio.startPromptProject, {
      prompt: 'Animate a cyan title',
      idempotencyKey: 'missing-key',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const snapshot = await owner.query(api.studio.getProject, {
      projectId: started.projectId,
    })
    const run = await t.run(async (ctx) => ctx.db.get(started.runId))
    expect(run).toMatchObject({ status: 'failed', errorCode: 'MODEL_FAILED' })
    expect(snapshot.project.currentRunId).toBeUndefined()
    expect(snapshot.project.currentRevisionId).toBeUndefined()
  })

  it('ends an explicitly denied prompt without deleting its project or message', async () => {
    vi.useFakeTimers()
    studioModelHarness.mode = 'deny'
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert('users', { name: 'Owner', createdAt: 1, updatedAt: 1 }),
    )
    const owner = t.withIdentity({ subject: ownerId })
    const started = await owner.mutation(api.studio.startPromptProject, {
      prompt: 'Write a backend migration plan',
      idempotencyKey: 'invalid-prompt',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const snapshot = await owner.query(api.studio.getProject, {
      projectId: started.projectId,
    })
    const messages = await owner.query(api.studio.listMessages, {
      projectId: started.projectId,
      limit: 10,
    })
    const run = await t.run(async (ctx) => ctx.db.get(started.runId))
    expect(run).toMatchObject({
      status: 'failed',
      errorCode: 'INVALID_PROMPT',
      tokenUsage: { inputTokens: 2, outputTokens: 1 },
    })
    expect(snapshot.project.currentRunId).toBeUndefined()
    expect(messages.map((message) => message.content)).toEqual([
      'Write a backend migration plan',
    ])
  })

  it('degrades detector failure to no skills and preserves per-call usage', async () => {
    vi.useFakeTimers()
    studioModelHarness.mode = 'detector-failure'
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert('users', { name: 'Owner', createdAt: 1, updatedAt: 1 }),
    )
    const owner = t.withIdentity({ subject: ownerId })
    const started = await owner.mutation(api.studio.startPromptProject, {
      prompt: 'Animate a cyan title',
      idempotencyKey: 'detector-fail',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const snapshot = await owner.query(api.studio.getProject, {
      projectId: started.projectId,
    })
    expect(snapshot.run).toMatchObject({
      status: 'compiling',
      detectedSkills: [],
      tokenUsage: { inputTokens: 7, outputTokens: 4 },
    })
  })

  it('applies unique exact edits and retains composition when omitted', async () => {
    vi.useFakeTimers()
    studioModelHarness.mode = 'edits'
    const { t, ownerId, projectId, secondRevisionId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })
    await owner.mutation(api.studio.startFollowUp, {
      projectId,
      prompt: 'Rename the exported component',
      idempotencyKey: 'exact-edit',
      expectedCurrentRevisionId: secondRevisionId,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const snapshot = await owner.query(api.studio.getProject, { projectId })
    expect(snapshot.run).toMatchObject({
      status: 'compiling',
      candidateCode: 'export const MyAnimation = () => null',
      candidateComposition: composition,
      candidateSummary: 'Applied an exact source edit',
    })
  })

  it('creates the project, prompt message, and run atomically', async () => {
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert('users', {
        name: 'Owner',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      }),
    )
    const owner = t.withIdentity({ subject: ownerId })

    const result = await owner.mutation(api.studio.startPromptProject, {
      prompt: 'Animate a cyan title entering with spring motion',
      idempotencyKey: 'prompt-1',
    })

    expect(result).toMatchObject({ status: 'queued' })
    const snapshot = await owner.query(api.studio.getProject, {
      projectId: result.projectId,
    })
    const messages = await owner.query(api.studio.listMessages, {
      projectId: result.projectId,
      limit: 10,
    })
    expect(snapshot.project.currentRunId).toBe(result.runId)
    expect(snapshot.project.ownerId).toBe(ownerId)
    expect(snapshot.run?.promptMessageId).toBe(messages[0]?._id)
    expect(messages[0]?.generationRunId).toBe(result.runId)
  })

  it('returns the existing run for the same owner idempotency key', async () => {
    const t = convexTest(schema, modules)
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert('users', { name: 'Owner', createdAt: 1, updatedAt: 1 }),
    )
    const owner = t.withIdentity({ subject: ownerId })
    const input = {
      prompt: 'Animate a cyan title',
      idempotencyKey: 'same-key',
    }

    const first = await owner.mutation(api.studio.startPromptProject, input)
    const second = await owner.mutation(api.studio.startPromptProject, input)

    expect(second).toEqual(first)
    const projects = await owner.query(api.studio.listRecentProjects, {
      limit: 10,
    })
    expect(projects).toHaveLength(1)
  })

  it('allows only one active run per project', async () => {
    const { t, ownerId, projectId, secondRevisionId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })
    await owner.mutation(api.studio.startFollowUp, {
      projectId,
      prompt: 'Make the title cyan',
      idempotencyKey: 'follow-up-1',
      expectedCurrentRevisionId: secondRevisionId,
    })

    await expect(
      owner.mutation(api.studio.startFollowUp, {
        projectId,
        prompt: 'Add spring motion',
        idempotencyKey: 'follow-up-2',
        expectedCurrentRevisionId: secondRevisionId,
      }),
    ).rejects.toThrow('Studio generation in progress')
  })

  it('rejects a follow-up based on a stale revision', async () => {
    const { t, ownerId, projectId, firstRevisionId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    await expect(
      owner.mutation(api.studio.startFollowUp, {
        projectId,
        prompt: 'Make the title cyan',
        idempotencyKey: 'stale-follow-up',
        expectedCurrentRevisionId: firstRevisionId,
      }),
    ).rejects.toThrow('Studio project changed')
  })

  it('accepts only the current candidate fingerprint', async () => {
    const { t, ownerId, projectId, runId } = await seedCompilingRun()
    const owner = t.withIdentity({ subject: ownerId })

    await expect(
      owner.mutation(api.studio.acceptCandidate, {
        projectId,
        runId,
        candidateFingerprint: 'stale',
      }),
    ).rejects.toThrow('Studio candidate changed')
  })

  it('accepts a candidate as the next immutable revision', async () => {
    const {
      t,
      ownerId,
      projectId,
      runId,
      candidateFingerprint,
      secondRevisionId,
    } = await seedCompilingRun()
    const owner = t.withIdentity({ subject: ownerId })

    const result = await owner.mutation(api.studio.acceptCandidate, {
      projectId,
      runId,
      candidateFingerprint,
    })
    const snapshot = await owner.query(api.studio.getProject, { projectId })
    const messages = await owner.query(api.studio.listMessages, {
      projectId,
      limit: 10,
    })

    expect(result.origin).toBe('follow-up')
    expect(result.parentRevisionId).toBe(secondRevisionId)
    expect(result.previousRunnableRevisionId).toBe(secondRevisionId)
    expect(snapshot.project.currentRevisionId).toBe(result._id)
    expect(snapshot.project.lastRunnableRevisionId).toBe(result._id)
    expect(snapshot.project.currentRunId).toBeUndefined()
    expect(messages.at(-1)?.content).toBe('Updated the title color')
  })

  it('preserves the last runnable revision after rejection', async () => {
    const {
      t,
      ownerId,
      projectId,
      runId,
      candidateFingerprint,
      secondRevisionId,
    } = await seedCompilingRun()
    const owner = t.withIdentity({ subject: ownerId })

    await owner.mutation(api.studio.rejectCandidate, {
      projectId,
      runId,
      candidateFingerprint,
      normalizedError: 'Unexpected token at line 3',
    })
    const snapshot = await owner.query(api.studio.getProject, { projectId })

    expect(snapshot.project.currentRevisionId).toBe(secondRevisionId)
    expect(snapshot.project.lastRunnableRevisionId).toBe(secondRevisionId)
    expect(snapshot.run).toMatchObject({
      status: 'queued',
      correctionAttempt: 1,
    })
    expect(snapshot.run?.candidateCode).toBeUndefined()
    expect(snapshot.run?.candidateSummary).toBeUndefined()
  })

  it('marks the run failed after three correction attempts are rejected', async () => {
    const {
      t,
      ownerId,
      projectId,
      runId,
      candidateFingerprint,
      secondRevisionId,
    } = await seedCompilingRun()
    const owner = t.withIdentity({ subject: ownerId })

    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) {
        await t.run(async (ctx) => {
          await ctx.db.patch(runId, {
            status: 'compiling',
            candidateCode: `export const MyAnimation = () => ${attempt}`,
            candidateComposition: composition,
            candidateFingerprint,
            candidateSummary: `Correction ${attempt}`,
          })
        })
      }
      await owner.mutation(api.studio.rejectCandidate, {
        projectId,
        runId,
        candidateFingerprint,
        normalizedError: `Compile failure ${attempt}`,
      })
    }

    const snapshot = await owner.query(api.studio.getProject, { projectId })
    const run = await t.run(async (ctx) => ctx.db.get(runId))
    expect(run).toMatchObject({
      status: 'failed',
      correctionAttempt: 3,
      errorCode: 'CORRECTION_LIMIT',
    })
    expect(snapshot.project.currentRunId).toBeUndefined()
    expect(snapshot.project.currentRevisionId).toBe(secondRevisionId)
  })

  it('restores the previous runnable revision after a committed runtime error', async () => {
    const {
      t,
      ownerId,
      projectId,
      firstRevisionId,
      secondRevisionId,
    } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    const result = await owner.mutation(api.studio.reportRuntimeFailure, {
      projectId,
      revisionId: secondRevisionId,
      normalizedError: 'Runtime error at frame 90',
    })
    const repeated = await owner.mutation(api.studio.reportRuntimeFailure, {
      projectId,
      revisionId: secondRevisionId,
      normalizedError: 'Runtime error at frame 90',
    })
    const snapshot = await owner.query(api.studio.getProject, { projectId })

    expect(repeated).toEqual(result)
    expect(snapshot.project.currentRevisionId).toBe(firstRevisionId)
    expect(snapshot.project.lastRunnableRevisionId).toBe(firstRevisionId)
    expect(snapshot.project.currentRunId).toBe(result.runId)
    expect(snapshot.run).toMatchObject({
      status: 'queued',
      correctionAttempt: 1,
      inputRevisionId: secondRevisionId,
    })
  })

  it('rejects cross-user and stale runtime failure reports', async () => {
    const {
      t,
      ownerId,
      otherUserId,
      projectId,
      firstRevisionId,
      secondRevisionId,
    } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })
    const other = t.withIdentity({ subject: otherUserId })

    await expect(
      other.mutation(api.studio.reportRuntimeFailure, {
        projectId,
        revisionId: secondRevisionId,
        normalizedError: 'Runtime failure',
      }),
    ).rejects.toThrow('Studio project unavailable')
    await expect(
      owner.mutation(api.studio.reportRuntimeFailure, {
        projectId,
        revisionId: firstRevisionId,
        normalizedError: 'Stale runtime failure',
      }),
    ).rejects.toThrow('Studio project changed')
  })

  it('keeps composition when an initial revision has no fallback', async () => {
    const { t, ownerId, projectId, firstRevisionId } = await seedStudio()
    await t.run(async (ctx) => {
      await ctx.db.patch(projectId, {
        currentRevisionId: firstRevisionId,
        lastRunnableRevisionId: firstRevisionId,
      })
    })
    const owner = t.withIdentity({ subject: ownerId })

    await owner.mutation(api.studio.reportRuntimeFailure, {
      projectId,
      revisionId: firstRevisionId,
      normalizedError: 'Initial runtime failure',
    })
    const snapshot = await owner.query(api.studio.getProject, { projectId })

    expect(snapshot.project.currentRevisionId).toBeUndefined()
    expect(snapshot.project.lastRunnableRevisionId).toBeUndefined()
    expect(snapshot.project.composition).toEqual(composition)
  })

  it('creates a correction revision against the restored runnable pointer', async () => {
    const {
      t,
      ownerId,
      projectId,
      firstRevisionId,
      secondRevisionId,
    } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })
    const reported = await owner.mutation(api.studio.reportRuntimeFailure, {
      projectId,
      revisionId: secondRevisionId,
      normalizedError: 'Runtime error at frame 90',
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(reported.runId, {
        status: 'compiling',
        candidateCode: 'export const MyAnimation = () => null',
        candidateComposition: composition,
        candidateFingerprint: 'runtime-correction',
        candidateSummary: 'Corrected the runtime failure',
      })
    })

    const revision = await owner.mutation(api.studio.acceptCandidate, {
      projectId,
      runId: reported.runId,
      candidateFingerprint: 'runtime-correction',
    })

    expect(revision.origin).toBe('correction')
    expect(revision.parentRevisionId).toBe(secondRevisionId)
    expect(revision.previousRunnableRevisionId).toBe(firstRevisionId)
  })
})
