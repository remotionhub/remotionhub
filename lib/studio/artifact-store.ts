import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_STUDIO_FAKE_ARTIFACT_DIR = path.join(
  process.cwd(),
  '.tmp',
  'studio-artifacts',
)

function getStudioArtifactRoot(env = process.env) {
  return env.STUDIO_FAKE_ARTIFACT_DIR?.trim() || DEFAULT_STUDIO_FAKE_ARTIFACT_DIR
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

function getStudioArtifactPath(storageKey: string, env = process.env) {
  return path.join(getStudioArtifactRoot(env), ...getStudioArtifactSegments(storageKey))
}

export async function writeStudioLocalArtifact(args: {
  storageKey: string
  bytes: Uint8Array
}) {
  const artifactPath = getStudioArtifactPath(args.storageKey)
  await mkdir(path.dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, args.bytes)

  return artifactPath
}

export async function readStudioLocalArtifact(
  storageKey: string,
  env = process.env,
) {
  try {
    return await readFile(getStudioArtifactPath(storageKey, env))
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null
    }
    throw error
  }
}
