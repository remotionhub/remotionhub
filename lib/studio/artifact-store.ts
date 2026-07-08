export type StudioArtifactReadResult =
  | { status: 'ok'; bytes: Uint8Array }
  | { status: 'missing' }
  | { status: 'unsupported'; reason: string }

type StudioProcessEnv = Partial<Record<string, string | undefined>>

function getProcessEnv(): StudioProcessEnv | null {
  if (typeof globalThis !== 'object' || !('process' in globalThis)) {
    return null
  }

  const candidate = globalThis.process
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !('env' in candidate) ||
    typeof candidate.env !== 'object' ||
    candidate.env === null
  ) {
    return null
  }

  return candidate.env as StudioProcessEnv
}

function getCurrentWorkingDirectory() {
  if (typeof globalThis !== 'object' || !('process' in globalThis)) {
    return null
  }

  const candidate = globalThis.process
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !('cwd' in candidate) ||
    typeof candidate.cwd !== 'function'
  ) {
    return null
  }

  try {
    return candidate.cwd()
  } catch {
    return null
  }
}

function getDefaultStudioArtifactRoot() {
  const cwd = getCurrentWorkingDirectory()
  return cwd ? `${cwd}/.tmp/studio-artifacts` : null
}

function getStudioArtifactRoot(env: StudioProcessEnv | null) {
  const configuredRoot = env?.STUDIO_FAKE_ARTIFACT_DIR?.trim()
  if (configuredRoot) {
    return configuredRoot
  }

  return getDefaultStudioArtifactRoot()
}

function isStudioLocalArtifactStoreEnabled(env: StudioProcessEnv | null) {
  return env !== null && env.NODE_ENV !== 'production'
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

function getStudioArtifactPath(storageKey: string, env: StudioProcessEnv | null) {
  const root = getStudioArtifactRoot(env)
  if (!root) {
    throw new Error('Local studio artifact storage root is unavailable.')
  }

  return joinPath([root, ...getStudioArtifactSegments(storageKey)])
}

export async function writeStudioLocalArtifact(args: {
  storageKey: string
  bytes: Uint8Array
}) {
  const env = getProcessEnv()
  if (!isStudioLocalArtifactStoreEnabled(env)) {
    throw new Error('Local studio artifact storage is disabled in production.')
  }

  const [{ mkdir, writeFile }, path] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ])
  const artifactPath = getStudioArtifactPath(args.storageKey, env)
  await mkdir(path.dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, args.bytes)

  return artifactPath
}

export async function readStudioLocalArtifact(
  storageKey: string,
  env = getProcessEnv(),
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
