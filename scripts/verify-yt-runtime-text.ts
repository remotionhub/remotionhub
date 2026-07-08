import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { compare, valid } from 'semver'

export type GithubSource = {
  repo: string
  ref: string
  commit: string
  path: string
  pinned?: boolean
}

type VerifyOptions = {
  catalogDir: string
  assetRepo: string
  assetCommit?: string
  throwOnMismatch: boolean
}

export type AuditEntry = {
  slug: string
  checked: boolean
  commit: string
  manifestRuntimeAssets: boolean
  runtimeFileExists: boolean
  usageMentionsRuntime: boolean
  promptMentionsRuntime: boolean
  mismatches: string[]
}

export type AuditReport = {
  total: number
  checked: number
  mismatches: number
  failures: string[]
  entries: AuditEntry[]
}

type CatalogFile = {
  slug?: string
  versions?: unknown[]
}

type SourceCandidate = {
  source: GithubSource
  usageMarkdown: string
  agentPrompt: string
  sourceIndex: number
  sourceVersion: string | undefined
}

const RUNTIME_TEXT_PATTERN = /runtime-assets\.ts/i

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseVerifyOptions(argv: string[]): VerifyOptions {
  const getArg = (name: string) =>
    argv
      .find((arg) => arg.startsWith(`--${name}=`))
      ?.slice(`--${name}=`.length)

  return {
    catalogDir: path.resolve(
      getArg('catalog-dir') ?? path.join(process.cwd(), 'catalog', 'components'),
    ),
    assetRepo:
      getArg('asset-repo') ??
      process.env.REMOTIONHUB_ASSET_REPO ??
      path.resolve(process.cwd(), '..', 'remotionhub-assets'),
    assetCommit: getArg('asset-commit'),
    throwOnMismatch: argv.includes('--throw-on-mismatch'),
  }
}

function detectRuntimeTextMentions(value: string): boolean {
  return RUNTIME_TEXT_PATTERN.test(value)
}

function parseGithubSource(value: unknown): GithubSource | undefined {
  if (!isObject(value)) {
    return undefined
  }

  const repo =
    typeof value.repo === 'string' && value.repo.trim() ? value.repo.trim() : undefined
  const ref =
    typeof value.ref === 'string' && value.ref.trim() ? value.ref.trim() : undefined
  const commit =
    typeof value.commit === 'string' && value.commit.trim()
      ? value.commit.trim()
      : undefined
  const sourcePath =
    typeof value.path === 'string' && value.path.trim() ? value.path.trim() : undefined

  if (!repo || !ref || !commit || !sourcePath) {
    return undefined
  }

  const pinned =
    typeof value.pinned === 'boolean' ? value.pinned : undefined

  return {
    repo,
    ref,
    commit,
    path: sourcePath,
    pinned,
  }
}

function parseCatalogVersion(value: unknown): string | undefined {
  return typeof value === 'string' && valid(value) ? value : undefined
}

function shouldKeepSourceCandidate(
  previous: SourceCandidate,
  candidate: SourceCandidate,
): SourceCandidate {
  if (!previous.sourceVersion && !candidate.sourceVersion) {
    return candidate.sourceIndex > previous.sourceIndex ? candidate : previous
  }

  if (!candidate.sourceVersion) {
    return previous
  }

  if (!previous.sourceVersion) {
    return candidate
  }

  const comparison = compare(candidate.sourceVersion, previous.sourceVersion)
  if (comparison > 0) {
    return candidate
  }

  if (comparison === 0 && candidate.sourceIndex > previous.sourceIndex) {
    return candidate
  }

  return previous
}

function resolveLatestGithubSourceCandidate(
  versions: unknown[],
): SourceCandidate | undefined {
  let latestSource: SourceCandidate | undefined

  for (let index = 0; index < versions.length; index += 1) {
    const version = versions[index]
    if (!isObject(version)) {
      continue
    }

    const artifact = version.artifact
    if (!isObject(artifact) || artifact.kind !== 'github-source') {
      continue
    }

    const source = parseGithubSource(artifact.githubSource)
    if (!source || source.repo !== 'remotionhub/remotionhub-assets') {
      continue
    }

    const candidate: SourceCandidate = {
      source,
      sourceIndex: index,
      sourceVersion: parseCatalogVersion((version as { version?: unknown }).version),
      usageMarkdown:
        typeof artifact.usageMarkdown === 'string' ? artifact.usageMarkdown : '',
      agentPrompt: typeof artifact.agentPrompt === 'string'
        ? artifact.agentPrompt
        : '',
    }

    if (!latestSource) {
      latestSource = candidate
      continue
    }

    latestSource = shouldKeepSourceCandidate(latestSource, candidate)
  }

  return latestSource
}

export function resolveLatestGithubSource(
  versions: unknown[],
  _slug: string,
): GithubSource | undefined {
  const latestSource = resolveLatestGithubSourceCandidate(versions)

  if (!latestSource) {
    return undefined
  }

  return latestSource.source
}

function verifyCommitPathExists(commit: string, assetRepo: string, relPath: string) {
  execFileSync(
    'git',
    ['-C', assetRepo, 'cat-file', '-e', `${commit}:${relPath}`],
    { stdio: 'pipe' },
  )
}

function readAssetManifest(
  assetRepo: string,
  commit: string,
  sourcePath: string,
): unknown {
  const raw = execFileSync(
    'git',
    ['-C', assetRepo, 'show', `${commit}:${sourcePath}/remotionhub.asset.json`],
    { encoding: 'utf8', stdio: 'pipe' },
  )

  return JSON.parse(raw) as unknown
}

export function inspectCatalogEntry(
  catalog: CatalogFile,
  options: VerifyOptions,
): AuditEntry {
  const slug = typeof catalog.slug === 'string' ? catalog.slug : '<missing-slug>'
  const versions = Array.isArray(catalog.versions) ? catalog.versions : []
  const latestSource = resolveLatestGithubSourceCandidate(versions)

  const entry: AuditEntry = {
    slug,
    checked: true,
    commit: '',
    manifestRuntimeAssets: false,
    runtimeFileExists: false,
    usageMentionsRuntime: false,
    promptMentionsRuntime: false,
    mismatches: [],
  }

  if (!latestSource) {
    entry.checked = false
    entry.mismatches.push('no remotionhub asset source pointer')
    return entry
  }

  const source = latestSource.source
  const commit = options.assetCommit ?? source.commit
  entry.commit = commit

  try {
    const manifest = readAssetManifest(options.assetRepo, commit, source.path)
    const manifestRuntimeAssets = isObject(manifest)
      ? manifest.runtimeAssets
      : undefined

    if (Array.isArray(manifestRuntimeAssets) && manifestRuntimeAssets.length > 0) {
      entry.manifestRuntimeAssets = true
    }
  } catch {
    entry.mismatches.push(`manifest read failed for ${source.path}`)
    return entry
  }

  try {
    verifyCommitPathExists(
      commit,
      options.assetRepo,
      `${source.path}/src/runtime-assets.ts`,
    )
    entry.runtimeFileExists = true
  } catch {
    entry.runtimeFileExists = false
  }

  entry.usageMentionsRuntime = detectRuntimeTextMentions(
    latestSource.usageMarkdown,
  )
  entry.promptMentionsRuntime = detectRuntimeTextMentions(
    latestSource.agentPrompt,
  )
  const expectedRuntimeMention =
    entry.manifestRuntimeAssets || entry.runtimeFileExists
  const observedRuntimeMention =
    entry.usageMentionsRuntime || entry.promptMentionsRuntime

  if (expectedRuntimeMention !== observedRuntimeMention) {
    entry.mismatches.push(
      expectedRuntimeMention
        ? 'runtime text missing for runtime-aware asset'
        : 'runtime text present without runtime assets',
    )
  }

  return entry
}

export async function runVerify(options: VerifyOptions): Promise<AuditReport> {
  const files = (await fs.readdir(options.catalogDir))
    .filter((file) => file.startsWith('yt-') && file.endsWith('.json'))
    .sort()

  const entries = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(options.catalogDir, file)
      const catalog = JSON.parse(
        await fs.readFile(filePath, 'utf8'),
      ) as CatalogFile
      return inspectCatalogEntry(catalog, options)
    }),
  )

  const mismatches = entries.filter((entry) => entry.mismatches.length > 0)
  const failures = mismatches.map((entry) =>
    `${entry.slug}: ${entry.mismatches.join('; ')}`,
  )

  return {
    total: files.length,
    checked: entries.length,
    mismatches: mismatches.length,
    failures,
    entries,
  }
}

function reportAudit(report: AuditReport) {
  console.log(`checked: ${report.checked}/${report.total}`)
  console.log(`runtimeTextMismatches: ${report.mismatches}`)
  for (const failure of report.failures) {
    console.log(`- ${failure}`)
  }
}

export async function runVerifyYtRuntimeText(argv: string[]): Promise<void> {
  const options = parseVerifyOptions(argv)
  const report = await runVerify(options)
  reportAudit(report)

  if (report.mismatches > 0 && options.throwOnMismatch) {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runVerifyYtRuntimeText(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
