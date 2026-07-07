const DEFAULT_STUDIO_ARTIFACT_TTL_MS = 5 * 60 * 1000
const STUDIO_ARTIFACT_BASE_PATH = '/api/studio/artifacts'

export const DEFAULT_STUDIO_THUMBNAIL_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'%3E%3Crect width='1280' height='720' fill='%230f172a'/%3E%3Crect x='120' y='120' width='1040' height='480' rx='32' fill='%231e293b'/%3E%3Cpath d='M552 272l232 88-232 88V272z' fill='%23e2e8f0'/%3E%3C/svg%3E"

type StudioArtifactUrlKind = 'playback' | 'download' | 'thumbnail' | 'preview'

export type StudioSignedArtifactUrl = {
  url: string
  expiresAt: number
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function signStudioArtifactPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  )

  return bytesToBase64Url(new Uint8Array(signature))
}

export async function createStudioSignedArtifactUrl(args: {
  storageKey: string
  kind: StudioArtifactUrlKind
  secret: string
  now?: number
  ttlMs?: number
}): Promise<StudioSignedArtifactUrl> {
  const now = args.now ?? Date.now()
  const expiresAt = now + (args.ttlMs ?? DEFAULT_STUDIO_ARTIFACT_TTL_MS)
  const payload = JSON.stringify({
    storageKey: args.storageKey,
    kind: args.kind,
    expiresAt,
  })
  const signature = await signStudioArtifactPayload(payload, args.secret)
  const url = new URL(`${STUDIO_ARTIFACT_BASE_PATH}/${args.kind}`, 'https://remotionhub.invalid')

  url.searchParams.set('key', args.storageKey)
  url.searchParams.set('expires', String(expiresAt))
  url.searchParams.set('sig', signature)

  return {
    url: `${url.pathname}${url.search}`,
    expiresAt,
  }
}

