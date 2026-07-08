import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import { STUDIO_ERROR_CODES, type StudioErrorCode } from '../convex/lib/studio/constants'
import { p0StudioTemplateSeed } from '../convex/lib/studio/templates'
import { loadLocalEnv } from './seed-studio-templates'
import { createStubRenderPlan } from './studio-planner'
import { renderStudioArtifact } from './studio-renderer'

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
  | { status: 'completed'; jobId: string }
  | { status: 'failed'; jobId: string }

function getStudioApi() {
  return api as {
    studio: {
      claimNextGenerationJob: unknown
      markModelStarted: unknown
      completePlanning: unknown
      startRendering: unknown
      heartbeatGenerationJob: unknown
      startUploading: unknown
      completeGenerationJob: unknown
      failGenerationJob: unknown
    }
  }
}

function getStudioWorkerFailureCode(message: string): StudioErrorCode {
  for (const code of STUDIO_ERROR_CODES) {
    if (message.includes(code)) {
      return code
    }
  }

  return 'MODEL_PROVIDER_ERROR'
}

function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout)
        resolve()
      },
      { once: true },
    )
  })
}

async function runWithRenderHeartbeat<T>({
  client,
  heartbeatIntervalMs,
  jobId,
  workerId,
  workerSecret,
  studioApi,
  task,
}: {
  client: WorkerClient
  heartbeatIntervalMs: number
  jobId: string
  workerId: string
  workerSecret: string
  studioApi: ReturnType<typeof getStudioApi>
  task: Promise<T>
}) {
  const heartbeat = setInterval(() => {
    void client
      .mutation(studioApi.studio.heartbeatGenerationJob, {
        jobId,
        workerId,
        workerSecret,
        expectedStatus: 'rendering',
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown heartbeat error.'
        console.warn(`Studio worker heartbeat failed for ${jobId}: ${message}`)
      })
  }, heartbeatIntervalMs)

  try {
    return await task
  } finally {
    clearInterval(heartbeat)
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

function createRenderRun(job: ClaimedGenerationJob) {
  return {
    runtime: 'remotion' as const,
    templateId: job.templateId,
    templateVersion: job.templateVersion,
    rendererVersion: 'task-6-fake-renderer',
    remotionVersion: 'unwired',
    workerVersion: 'task-6-worker',
    startedAt: Date.now(),
    renderInputSnapshotRef: `studio/jobs/${job.id}/render-input.json`,
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
  const heartbeatIntervalMs = Math.max(
    1_000,
    Number(env.STUDIO_WORKER_HEARTBEAT_INTERVAL_MS ?? Math.floor(lockTtlMs / 3)),
  )
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

    if (env.STUDIO_WORKER_MODE === 'planner-only') {
      console.log(`Planned studio job ${claimedJob.id}.`)
      return { status: 'planned', jobId: claimedJob.id }
    }

    const renderRun = createRenderRun(claimedJob)

    await client.mutation(studioApi.studio.startRendering, {
      jobId: claimedJob.id,
      workerId,
      workerSecret,
      renderRun,
    })

    const artifact = await runWithRenderHeartbeat({
      client,
      heartbeatIntervalMs,
      jobId: claimedJob.id,
      workerId,
      workerSecret,
      studioApi,
      task: renderStudioArtifact(claimedJob.id, renderPlan),
    })

    await client.mutation(studioApi.studio.startUploading, {
      jobId: claimedJob.id,
      workerId,
      workerSecret,
    })

    const completedAt = Date.now()

    await client.mutation(studioApi.studio.completeGenerationJob, {
      jobId: claimedJob.id,
      workerId,
      workerSecret,
      artifact,
      renderRun: {
        completedAt,
        durationMs: Math.max(0, completedAt - renderRun.startedAt),
        exitCode: 0,
        outputStorageKey: artifact.storageKey,
      },
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown studio worker error.'
    const errorCode = getStudioWorkerFailureCode(errorMessage)

    await client.mutation(studioApi.studio.failGenerationJob, {
      jobId: claimedJob.id,
      workerId,
      workerSecret,
      errorCode,
      errorMessage: errorMessage.slice(0, 500),
    })

    console.error(`Failed studio job ${claimedJob.id}: ${errorMessage}`)
    return { status: 'failed', jobId: claimedJob.id }
  }

  console.log(`Completed studio job ${claimedJob.id}.`)
  return { status: 'completed', jobId: claimedJob.id }
}

export async function runStudioWorker(
  env = process.env,
  clientFactory: (url: string) => WorkerClient = (url) => new ConvexHttpClient(url),
  options: { signal?: AbortSignal } = {},
) {
  if (env.STUDIO_WORKER_RUN_ONCE === '1') {
    return runStudioWorkerOnce(env, clientFactory)
  }

  const pollIntervalMs = Math.max(
    250,
    Number(env.STUDIO_WORKER_POLL_INTERVAL_MS ?? 2_000),
  )
  let lastResult: RunWorkerResult = { status: 'idle' }

  while (!options.signal?.aborted) {
    lastResult = await runStudioWorkerOnce(env, clientFactory)
    await sleep(pollIntervalMs, options.signal)
  }

  return lastResult
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void runStudioWorker().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
