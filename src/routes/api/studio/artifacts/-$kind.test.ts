// @vitest-environment node

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createStudioSignedArtifactUrl,
  DEFAULT_STUDIO_THUMBNAIL_URL,
} from '../../../../../convex/lib/studio/artifacts'

type RouteOptions = {
  server?: {
    handlers: {
      GET: (context: {
        request: Request
        params: { kind: string }
        context: unknown
        pathname: string
        next: () => Promise<Response>
      }) => Promise<Response>
    }
  }
}

const mocks = vi.hoisted(() => ({
  routes: new Map<string, RouteOptions>(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: (routePath: string) => (options: RouteOptions) => {
      mocks.routes.set(routePath, options)
      return { options }
    },
  }
})

import './$kind'

const ORIGINAL_SIGNING_SECRET = process.env.STUDIO_ARTIFACT_SIGNING_SECRET
const ORIGINAL_FAKE_ARTIFACT_DIR = process.env.STUDIO_FAKE_ARTIFACT_DIR
const ORIGINAL_NODE_ENV = process.env.NODE_ENV

function getHandler() {
  const options = mocks.routes.get('/api/studio/artifacts/$kind')
  const handler = options?.server?.handlers.GET
  if (!handler) {
    throw new Error('Missing artifact GET handler.')
  }
  return handler
}

async function writeArtifact(rootDir: string, storageKey: string, bytes: Uint8Array) {
  const artifactPath = path.join(rootDir, ...storageKey.split('/'))
  await mkdir(path.dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, bytes)
}

async function sendSignedRequest(args: {
  kind: 'playback' | 'download' | 'thumbnail' | 'preview'
  storageKey: string
  secret: string
  rewritePath?: string
  rewriteKey?: string
  now?: number
  ttlMs?: number
}) {
  const signed = await createStudioSignedArtifactUrl({
    storageKey: args.storageKey,
    kind: args.kind,
    secret: args.secret,
    now: args.now,
    ttlMs: args.ttlMs,
  })
  const url = new URL(`http://localhost${signed.url}`)

  if (args.rewritePath) {
    url.pathname = args.rewritePath
  }
  if (args.rewriteKey) {
    url.searchParams.set('key', args.rewriteKey)
  }

  return getHandler()({
    request: new Request(url),
    params: {
      kind: url.pathname.split('/').at(-1) ?? '',
    },
    context: undefined,
    pathname: url.pathname,
    next: async () => new Response('next should not be called', { status: 500 }),
  })
}

describe('studio artifact route', () => {
  let artifactDir: string
  const signingSecret = 'studio-artifact-signing-secret'

  beforeEach(async () => {
    artifactDir = await mkdtemp(path.join(os.tmpdir(), 'studio-artifacts-route-'))
    process.env.STUDIO_ARTIFACT_SIGNING_SECRET = signingSecret
    process.env.STUDIO_FAKE_ARTIFACT_DIR = artifactDir
  })

  afterEach(() => {
    if (ORIGINAL_SIGNING_SECRET === undefined) {
      delete process.env.STUDIO_ARTIFACT_SIGNING_SECRET
    } else {
      process.env.STUDIO_ARTIFACT_SIGNING_SECRET = ORIGINAL_SIGNING_SECRET
    }

    if (ORIGINAL_FAKE_ARTIFACT_DIR === undefined) {
      delete process.env.STUDIO_FAKE_ARTIFACT_DIR
    } else {
      process.env.STUDIO_FAKE_ARTIFACT_DIR = ORIGINAL_FAKE_ARTIFACT_DIR
    }

    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV
    }

    return rm(artifactDir, { recursive: true, force: true })
  })

  it('streams playback bytes when the signature is valid', async () => {
    const bytes = Uint8Array.from([0, 1, 2, 3, 4])
    await writeArtifact(artifactDir, 'studio/job-1/artifact.mp4', bytes)

    const response = await sendSignedRequest({
      kind: 'playback',
      storageKey: 'studio/job-1/artifact.mp4',
      secret: signingSecret,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-type')).toBe('video/mp4')
    expect(response.headers.get('content-disposition')).toContain('inline')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })

  it('returns attachment headers for signed downloads', async () => {
    await writeArtifact(
      artifactDir,
      'studio/job-1/artifact.mp4',
      Uint8Array.from([7, 8, 9]),
    )

    const response = await sendSignedRequest({
      kind: 'download',
      storageKey: 'studio/job-1/artifact.mp4',
      secret: signingSecret,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('video/mp4')
    expect(response.headers.get('content-disposition')).toContain('attachment')
    expect(response.headers.get('content-disposition')).toContain('artifact.mp4')
  })

  it('sanitizes filenames in content-disposition headers', async () => {
    await writeArtifact(
      artifactDir,
      'studio/job-1/artifact\";bad=.mp4',
      Uint8Array.from([7, 8, 9]),
    )

    const response = await sendSignedRequest({
      kind: 'download',
      storageKey: 'studio/job-1/artifact\";bad=.mp4',
      secret: signingSecret,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="artifact__bad_.mp4"',
    )
  })

  it('rejects expired signatures', async () => {
    const response = await sendSignedRequest({
      kind: 'playback',
      storageKey: 'studio/job-1/artifact.mp4',
      secret: signingSecret,
      now: Date.now() - 10_000,
      ttlMs: 100,
    })

    expect(response.status).toBe(410)
  })

  it('rejects tampered storage keys', async () => {
    const response = await sendSignedRequest({
      kind: 'playback',
      storageKey: 'studio/job-1/artifact.mp4',
      secret: signingSecret,
      rewriteKey: 'studio/job-1/other.mp4',
    })

    expect(response.status).toBe(403)
  })

  it('rejects tampered kinds', async () => {
    const response = await sendSignedRequest({
      kind: 'playback',
      storageKey: 'studio/job-1/artifact.mp4',
      secret: signingSecret,
      rewritePath: '/api/studio/artifacts/download',
    })

    expect(response.status).toBe(403)
  })

  it('fails safely in production when only local artifact storage is configured', async () => {
    process.env.NODE_ENV = 'production'

    const response = await sendSignedRequest({
      kind: 'playback',
      storageKey: 'studio/job-1/artifact.mp4',
      secret: signingSecret,
    })

    expect(response.status).toBe(501)
  })

  it.each(['thumbnail', 'preview'] as const)(
    'falls back to the default thumbnail when %s bytes are missing',
    async (kind) => {
      const response = await sendSignedRequest({
        kind,
        storageKey: `studio/job-1/${kind}.jpg`,
        secret: signingSecret,
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('content-type')).toBe('image/svg+xml')
      expect(await response.text()).toBe(decodeURIComponent(DEFAULT_STUDIO_THUMBNAIL_URL.split(',')[1] ?? ''))
    },
  )
})
