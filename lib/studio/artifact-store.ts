const DEFAULT_STUDIO_FAKE_ARTIFACT_DIR = `${process.cwd()}/.tmp/studio-artifacts`

export type StudioArtifactReadResult =
  | { status: 'ok'; bytes: Uint8Array }
  | { status: 'missing' }
  | { status: 'unsupported'; reason: string }

function getStudioArtifactRoot(env = process.env) {
  return env.STUDIO_FAKE_ARTIFACT_DIR?.trim() || DEFAULT_STUDIO_FAKE_ARTIFACT_DIR
}

function isStudioLocalArtifactStoreEnabled(env = process.env) {
  return env.NODE_ENV !== 'production'
}

function getStudioArtifactSegments(storageKey: string) {
  const segments = storageKey.split('/').filter(Boolean)

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`Invalid studio artifact key "${storageKey}".`)
  }

  return segments
}

function joinPath(parts: string[]) {
  return parts.join('/').replace(/\/{2,}/g, '/')
}

function getStudioArtifactPath(storageKey: string, env = process.env) {
  return joinPath([getStudioArtifactRoot(env), ...getStudioArtifactSegments(storageKey)])
}

export async function writeStudioLocalArtifact(args: {
  storageKey: string
  bytes: Uint8Array
}) {
  if (!isStudioLocalArtifactStoreEnabled()) {
    throw new Error('Local studio artifact storage is disabled in production.')
  }

  const [{ mkdir, writeFile }, path] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ])
  const artifactPath = getStudioArtifactPath(args.storageKey)
  await mkdir(path.dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, args.bytes)

  return artifactPath
}

export async function readStudioLocalArtifact(
  storageKey: string,
  env = process.env,
): Promise<StudioArtifactReadResult> {
  if (!isStudioLocalArtifactStoreEnabled(env)) {
    return {
      status: 'unsupported',
      reason: 'Studio artifact storage is not implemented for production runtime.',
    }
  }

  const { readFile } = await import('node:fs/promises')

  try {
    return {
      status: 'ok',
      bytes: await readFile(getStudioArtifactPath(storageKey, env)),
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return {
        status: 'missing',
      }
    }
    throw error
  }
}
