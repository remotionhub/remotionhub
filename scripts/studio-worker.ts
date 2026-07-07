import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import { p0StudioTemplateSeed } from '../convex/lib/studio/templates'
import { loadLocalEnv } from './seed-studio-templates'
import { createStubRenderPlan } from './studio-planner'

type WorkerClient = {
  mutation<TArgs, TResult>(mutation: unknown, args: TArgs): Promise<TResult>
}

type ClaimedGenerationJob = {
  id: string
  prompt: string
  templateId: string
  templateVersion: string
}

type RunWorkerResult =
  | { status: 'idle' }
  | { status: 'planned'; jobId: string }
  | { status: 'failed'; jobId: string }

function getStudioApi() {
  return api as {
    studio: {
      claimNextGenerationJob: unknown
      markModelStarted: unknown
      completePlanning: unknown
      failGenerationJob: unknown
    }
  }
}

function getPlannerTemplate(job: ClaimedGenerationJob) {
  if (
    job.templateId === p0StudioTemplateSeed.templateId &&
    job.templateVersion === p0StudioTemplateSeed.templateVersion
  ) {
    return p0StudioTemplateSeed
  }

  throw new Error(
    `Unsupported studio template ${job.templateId}@${job.templateVersion}.`,
  )
}

function createStubModelRun(job: ClaimedGenerationJob, prompt: string) {
  return {
    provider: 'stub',
    model: 'stub-planner',
    attemptIndex: 0,
    runType: 'plan' as const,
    inputDigest: `prompt:${job.id}`,
    outputDigest: `plan:${job.id}`,
    inputSnapshotRef: `studio/jobs/${job.id}/planner-input.json`,
    outputSnapshotRef: `studio/jobs/${job.id}/planner-output.json`,
    promptVersion: 'stub-v1',
    schemaVersion: '1',
    tokenUsage: {
      inputTokens: prompt.length,
      outputTokens: 0,
      totalTokens: prompt.length,
    },
    estimatedCost: 0,
    latencyMs: 0,
  }
}

export async function runStudioWorkerOnce(
  env = process.env,
  clientFactory: (url: string) => WorkerClient = (url) => new ConvexHttpClient(url),
): Promise<RunWorkerResult> {
  await loadLocalEnv(env)

  const convexUrl = env.CONVEX_URL ?? env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('CONVEX_URL or VITE_CONVEX_URL is required.')
  }

  const workerId = env.STUDIO_WORKER_ID ?? 'studio-worker-local'
  const workerSecret = env.STUDIO_WORKER_SECRET
  if (!workerSecret) {
    throw new Error('STUDIO_WORKER_SECRET is required.')
  }
  const lockTtlMs = Number(env.STUDIO_WORKER_LOCK_TTL_MS ?? 30_000)
  const studioApi = getStudioApi()
  const client = clientFactory(convexUrl)

  const claimedJob = await client.mutation<
    { workerId: string; workerSecret: string; lockTtlMs: number },
    ClaimedGenerationJob | null
  >(studioApi.studio.claimNextGenerationJob, {
    workerId,
    workerSecret,
    lockTtlMs,
  })

  if (!claimedJob) {
    console.log('No queued studio jobs.')
    return { status: 'idle' }
  }

  try {
    await client.mutation(studioApi.studio.markModelStarted, {
      jobId: claimedJob.id,
      workerId,
      workerSecret,
    })

    const renderPlan = createStubRenderPlan(
      claimedJob.prompt,
      getPlannerTemplate(claimedJob),
    )

    await client.mutation(studioApi.studio.completePlanning, {
      jobId: claimedJob.id,
      workerId,
      workerSecret,
      renderPlan,
      modelRun: createStubModelRun(claimedJob, claimedJob.prompt),
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown studio worker error.'

    await client.mutation(studioApi.studio.failGenerationJob, {
      jobId: claimedJob.id,
      workerId,
      workerSecret,
      errorCode: 'MODEL_PROVIDER_ERROR',
      errorMessage: errorMessage.slice(0, 500),
    })

    console.error(`Failed studio job ${claimedJob.id}: ${errorMessage}`)
    return { status: 'failed', jobId: claimedJob.id }
  }

  if (env.STUDIO_WORKER_MODE === 'planner-only') {
    console.log(
      `Planned studio job ${claimedJob.id}. Renderer integration remains for Task 6.`,
    )
    return { status: 'planned', jobId: claimedJob.id }
  }

  const errorCode = 'RENDER_NOT_IMPLEMENTED'
  const errorMessage =
    'Renderer integration is not implemented in Task 5. Retry after Task 6 ships.'

  await client.mutation(studioApi.studio.failGenerationJob, {
    jobId: claimedJob.id,
    workerId,
    workerSecret,
    errorCode,
    errorMessage,
  })

  console.error(`Failed studio job ${claimedJob.id}: ${errorCode} ${errorMessage}`)
  return { status: 'failed', jobId: claimedJob.id }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void runStudioWorkerOnce().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
