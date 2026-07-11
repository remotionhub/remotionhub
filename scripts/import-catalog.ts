import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import * as Babel from '@babel/standalone'
import { ConvexHttpClient } from 'convex/browser'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { api } from '../convex/_generated/api'
import {
  buildCatalogVersionFingerprint,
  catalogComponentSchema,
  type CatalogComponent,
} from '../shared/catalog'
import {
  normalizeStudioComposition,
  serializeStudioCandidate,
  STUDIO_MAX_SOURCE_LENGTH,
  type StudioCompositionInput,
} from '../shared/studio'
import { validateAndStripStudioImports } from '../shared/studioSource'
import { sanitizeGeneratedSource } from '../src/lib/studio/sanitize'

export type Args = {
  apply: boolean
  dryRun: boolean
  localOnly: boolean
  target: string
}

export type ImportCatalogDependencies = {
  env: NodeJS.ProcessEnv
  loadEnv: () => Promise<void>
  readFiles: () => Promise<Array<{ filePath: string; json: unknown }>>
  createClient: (url: string) => ImportCatalogClient
  log: (message: string) => void
}

type ImportCatalogMutation = typeof api.components.importCatalogComponent

export interface ImportCatalogClient {
  mutation(
    mutation: ImportCatalogMutation,
    args: FunctionArgs<ImportCatalogMutation>,
  ): Promise<FunctionReturnType<ImportCatalogMutation>>
}

export function parseArgs(argv: string[]): Args {
  const apply = argv.includes('--apply')

  return {
    apply,
    dryRun: argv.includes('--dry-run') || !apply,
    localOnly: argv.includes('--local-only'),
    target:
      argv
        .find((arg) => arg.startsWith('--target='))
        ?.slice('--target='.length) ?? 'dev',
  }
}

export async function loadLocalEnv(
  env = process.env,
  envPath = path.resolve('.env.local'),
): Promise<void> {
  try {
    const raw = await fs.readFile(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      const separator = trimmed.indexOf('=')
      if (separator === -1) {
        continue
      }

      const key = trimmed.slice(0, separator)
      const value = trimmed.slice(separator + 1).replace(/^["']|["']$/g, '')
      env[key] ??= value
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

export async function readCatalogFiles(
  directory = path.resolve('catalog/components'),
): Promise<Array<{ filePath: string; json: unknown }>> {
  const names = (await fs.readdir(directory))
    .filter((name) => name.endsWith('.json'))
    .sort()

  return await Promise.all(
    names.map(async (name) => {
      const filePath = path.join(directory, name)
      const raw = await fs.readFile(filePath, 'utf8')
      return { filePath, json: JSON.parse(raw) as unknown }
    }),
  )
}

const MAX_STUDIO_BUNDLE_BYTES = 200_000

function isWithin(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export async function loadStudioBundle(
  sourcePath: string,
  repoRoot: string,
  allowedDependencies: readonly string[],
  compositionInput: StudioCompositionInput,
) {
  const realRepoRoot = await fs.realpath(repoRoot)
  const studioRoot = path.join(realRepoRoot, 'catalog/studio')
  const realStudioRoot = await fs.realpath(studioRoot)
  const lexicalPath = path.resolve(realRepoRoot, sourcePath)
  if (!isWithin(studioRoot, lexicalPath)) throw new Error('Unsafe Studio Bundle path.')
  const stat = await fs.lstat(lexicalPath)
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Studio Bundle must be a regular file.')
  if (stat.size > MAX_STUDIO_BUNDLE_BYTES) throw new Error('Studio Bundle is too large.')
  const realPath = await fs.realpath(lexicalPath)
  if (!isWithin(realStudioRoot, realPath)) throw new Error('Unsafe Studio Bundle real path.')
  const code = sanitizeGeneratedSource(await fs.readFile(realPath, 'utf8'))
  if (code.length > STUDIO_MAX_SOURCE_LENGTH) {
    throw new Error('Studio source is too large')
  }
  const stripped = validateAndStripStudioImports(code, allowedDependencies)
  const transformed = Babel.transform(stripped, {
    filename: sourcePath,
    presets: ['typescript', 'react'],
    plugins: ['transform-modules-commonjs'],
    sourceType: 'module',
  })
  if (!transformed.code) throw new Error('Studio Bundle could not be transformed.')
  const composition = normalizeStudioComposition(compositionInput)
  const contentHash = crypto.createHash('sha256')
    .update(serializeStudioCandidate(code, composition)).digest('hex')
  return { code, composition, contentHash }
}

export async function toImportPayload(
  component: CatalogComponent,
  catalogFile: string,
  importSecret: string,
) {
  const versions = await Promise.all(component.versions.map(async (version) => {
    let studioBundle
    if (version.studioBundle) {
      const source = version.artifact.githubSource
      if (component.runtime !== 'remotion' || version.metadata.runtime !== 'remotion' ||
        version.artifact.kind !== 'github-source' || !source || !version.metadata.entryPoint ||
        !/^[a-f0-9]{6,40}$/i.test(source.commit)) {
        throw new Error('Studio Bundle requires a pinned Remotion source.')
      }
      const hydrated = await loadStudioBundle(version.studioBundle.sourcePath, process.cwd(),
        version.studioBundle.allowedDependencies, version.studioBundle.composition)
      studioBundle = {
        entryPoint: version.metadata.entryPoint,
        sourcePath: version.studioBundle.sourcePath,
        code: hydrated.code,
        allowedDependencies: version.studioBundle.allowedDependencies,
        composition: hydrated.composition,
        commit: source.commit,
        contentHash: hydrated.contentHash,
        status: 'validated' as const,
      }
    }
    return {
      ...version,
      fingerprint: buildCatalogVersionFingerprint(version),
      artifact: {
        ...version.artifact,
        githubSource: version.artifact.githubSource ? {
          ...version.artifact.githubSource,
          pinned: /^[a-f0-9]{6,40}$/i.test(version.artifact.githubSource.commit),
        } : undefined,
      },
      studioBundle,
    }
  }))
  return {
    importSecret,
    publisher: component.publisher,
    publisherDisplayName:
      component.publisher === 'remotionlab'
        ? 'RemotionLab'
        : `@${component.publisher}`,
    runtime: component.runtime,
    slug: component.slug,
    displayName: component.displayName,
    displayNameZh: component.displayNameZh,
    summary: component.summary,
    summaryZh: component.summaryZh,
    categories: component.categories,
    tags: component.tags,
    status: component.status,
    catalogFile,
    versions,
  }
}

export async function runImportCatalog(
  argv: string[],
  dependencies: ImportCatalogDependencies,
): Promise<void> {
  await dependencies.loadEnv()

  const args = parseArgs(argv)
  const configuredConvexUrl =
    dependencies.env.CONVEX_URL ?? dependencies.env.VITE_CONVEX_URL
  const importSecret = dependencies.env.CATALOG_IMPORT_SECRET
  const willWrite = args.apply && !args.dryRun && !args.localOnly

  if (willWrite && !configuredConvexUrl) {
    throw new Error('CONVEX_URL or VITE_CONVEX_URL is required for --apply.')
  }
  if (willWrite && !importSecret) {
    throw new Error('CATALOG_IMPORT_SECRET is required for --apply.')
  }
  if (
    willWrite &&
    args.target === 'production' &&
    !dependencies.env.CONVEX_DEPLOY_KEY
  ) {
    throw new Error('CONVEX_DEPLOY_KEY is required for production imports.')
  }

  const files = await dependencies.readFiles()
  const payloads = await Promise.all(files.map(async ({ filePath, json }) => {
    const parsed = catalogComponentSchema.parse(json)
    return await toImportPayload(parsed, filePath, importSecret ?? '')
  }))

  dependencies.log(`Validated ${payloads.length} catalog component(s).`)
  for (const payload of payloads) {
    dependencies.log(
      `- ${payload.runtime}/${payload.publisher}/${payload.slug}: ` +
        `${payload.versions.length} version(s)`,
    )
  }

  if (args.dryRun || args.localOnly) {
    dependencies.log('Dry-run complete. No Convex writes performed.')
    return
  }

  const convexUrl = configuredConvexUrl
  if (!convexUrl) {
    throw new Error('CONVEX_URL or VITE_CONVEX_URL is required.')
  }

  const client = dependencies.createClient(convexUrl)
  for (const payload of payloads) {
    const result = await client.mutation(
      api.components.importCatalogComponent,
      payload,
    )
    dependencies.log(
      `Imported ${payload.runtime}/${payload.publisher}/${payload.slug}: ` +
        `${result.createdVersions} created, ${result.skippedVersions} skipped`,
    )
  }
}

const defaultDependencies: ImportCatalogDependencies = {
  env: process.env,
  loadEnv: () => loadLocalEnv(),
  readFiles: () => readCatalogFiles(),
  createClient: (url) => new ConvexHttpClient(url),
  log: (message) => console.log(message),
}

export async function runImportCatalogCli(
  argv: string[],
  dependencies: ImportCatalogDependencies,
): Promise<void> {
  try {
    await runImportCatalog(argv, dependencies)
  } catch (error: unknown) {
    console.error(error)
    process.exitCode = 1
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void runImportCatalogCli(process.argv.slice(2), defaultDependencies)
}
