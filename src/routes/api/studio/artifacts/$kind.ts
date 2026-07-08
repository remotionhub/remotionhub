import { createFileRoute } from '@tanstack/react-router'
import {
  DEFAULT_STUDIO_THUMBNAIL_URL,
  type StudioArtifactUrlKind,
  verifyStudioSignedArtifactUrl,
} from '../../../../../convex/lib/studio/artifacts'
import { readStudioLocalArtifact } from '../../../../../lib/studio/artifact-store'

const DEFAULT_THUMBNAIL_SVG = decodeURIComponent(
  DEFAULT_STUDIO_THUMBNAIL_URL.split(',')[1] ?? '',
)
const PRIVATE_NO_STORE_CACHE_CONTROL = 'private, no-store'

function isStudioArtifactKind(value: string): value is StudioArtifactUrlKind {
  return (
    value === 'playback' ||
    value === 'download' ||
    value === 'thumbnail' ||
    value === 'preview'
  )
}

function getStudioArtifactSigningSecret() {
  const secret = process.env.STUDIO_ARTIFACT_SIGNING_SECRET?.trim()
  if (!secret) {
    throw new Error('STUDIO_ARTIFACT_SIGNING_SECRET is required.')
  }
  return secret
}

function getFileExtension(storageKey: string) {
  const filename = storageKey.split('/').filter(Boolean).at(-1) ?? ''
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : ''
}

function getContentType(kind: StudioArtifactUrlKind, storageKey: string) {
  const extension = getFileExtension(storageKey)

  if (kind === 'playback' || kind === 'download') {
    return 'video/mp4'
  }

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }
  if (extension === '.png') {
    return 'image/png'
  }
  if (extension === '.webp') {
    return 'image/webp'
  }
  if (extension === '.svg') {
    return 'image/svg+xml'
  }
  if (extension === '.mp4') {
    return 'video/mp4'
  }

  return 'application/octet-stream'
}

function getContentDisposition(kind: StudioArtifactUrlKind, storageKey: string) {
  const filename =
    (storageKey.split('/').filter(Boolean).at(-1) || 'artifact').replace(
      /[^A-Za-z0-9._-]/g,
      '_',
    )
  const dispositionType = kind === 'download' ? 'attachment' : 'inline'
  return `${dispositionType}; filename="${filename}"`
}

function createDefaultThumbnailResponse() {
  return new Response(DEFAULT_THUMBNAIL_SVG, {
    headers: {
      'cache-control': PRIVATE_NO_STORE_CACHE_CONTROL,
      'content-type': 'image/svg+xml',
      'content-disposition': 'inline; filename="thumbnail.svg"',
      'content-length': String(new TextEncoder().encode(DEFAULT_THUMBNAIL_SVG).byteLength),
    },
  })
}

export const Route = createFileRoute('/api/studio/artifacts/$kind')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const kind = params.kind
        if (!isStudioArtifactKind(kind)) {
          return new Response('Not found', { status: 404 })
        }

        const url = new URL(request.url)
        const storageKey = url.searchParams.get('key')
        const expires = url.searchParams.get('expires')
        const signature = url.searchParams.get('sig')

        if (!storageKey || !expires || !signature) {
          return new Response('Missing signature parameters.', { status: 400 })
        }

        const expiresAt = Number(expires)
        if (!Number.isFinite(expiresAt)) {
          return new Response('Invalid expires parameter.', { status: 400 })
        }

        if (Date.now() > expiresAt) {
          return new Response('Signed artifact URL expired.', { status: 410 })
        }

        const isValid = await verifyStudioSignedArtifactUrl({
          storageKey,
          kind,
          expiresAt,
          signature,
          secret: getStudioArtifactSigningSecret(),
        })

        if (!isValid) {
          return new Response('Invalid signed artifact URL.', { status: 403 })
        }

        const artifactResult = await readStudioLocalArtifact(storageKey)
        if (artifactResult.status === 'unsupported') {
          return new Response(artifactResult.reason, { status: 501 })
        }

        if (artifactResult.status === 'missing') {
          if (kind === 'thumbnail' || kind === 'preview') {
            return createDefaultThumbnailResponse()
          }

          return new Response('Artifact not found.', { status: 404 })
        }

        const body = Uint8Array.from(artifactResult.bytes)

        return new Response(body, {
          headers: {
            'cache-control': PRIVATE_NO_STORE_CACHE_CONTROL,
            'content-type': getContentType(kind, storageKey),
            'content-disposition': getContentDisposition(kind, storageKey),
            'content-length': String(artifactResult.bytes.byteLength),
          },
        })
      },
    },
  },
})
