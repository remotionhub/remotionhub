import fs, { type FileHandle } from 'node:fs/promises'
import { constants, type BigIntStats } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { componentSlugPattern } from '../shared/catalog'
import { type TagKey } from '../src/lib/tags'

export type GenerateOptions = {
  assetRepo: string
  sourceMdDir: string
  targetDir: string
  assetCommit?: string
  slugs: string[]
}

class GenerateUsageError extends Error {}

export function parseGenerateOptions(
  argv: string[],
  env: NodeJS.ProcessEnv,
): GenerateOptions {
  const get = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)

  return {
    assetRepo:
      get('asset-repo') ??
      env.REMOTIONHUB_ASSET_REPO ??
      '/Users/tangwz/workspace/git/remotionhub-assets',
    sourceMdDir:
      get('source-md-dir') ??
      env.REMOTIONLAB_SOURCE_MD_DIR ??
      '/tmp/remotionlab/案例',
    targetDir: get('target-dir') ?? 'catalog/components',
    assetCommit: get('asset-commit'),
    slugs: argv.filter((arg) => !arg.startsWith('--')),
  }
}

export function resolveAssetCommit(repo: string, ref = 'HEAD') {
  const status = execFileSync('git', ['-C', repo, 'status', '--porcelain'], {
    encoding: 'utf8',
  })
  if (status.trim()) {
    throw new Error(
      `Asset repo has uncommitted changes. Commit or discard them before generating catalog pins.\n${status}`,
    )
  }

  const commit = execFileSync(
    'git',
    [
      '-C',
      repo,
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${ref}^{commit}`,
    ],
    {
      encoding: 'utf8',
      stdio: 'pipe',
    },
  ).trim()

  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(`Asset commit ref did not resolve to a full SHA: ${ref}`)
  }

  return commit
}

function validateSlug(slug: string) {
  if (!componentSlugPattern.test(slug)) {
    throw new Error(`Invalid catalog slug: ${JSON.stringify(slug)}`)
  }
}

type FileIdentity = {
  dev: bigint
  ino: bigint
  size: bigint
  mtimeNs: bigint
  ctimeNs: bigint
}

type PathIdentity = {
  path: string
  identity: FileIdentity
}

function fileIdentity(stats: BigIntStats): FileIdentity {
  return {
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
  }
}

function directoryIdentity(stats: BigIntStats): FileIdentity {
  return {
    dev: stats.dev,
    ino: stats.ino,
    size: 0n,
    mtimeNs: 0n,
    ctimeNs: 0n,
  }
}

function identitiesMatch(left: FileIdentity, right: FileIdentity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  )
}

function pathIdentitiesMatch(left: PathIdentity[], right: PathIdentity[]) {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.path === right[index]?.path &&
        identitiesMatch(entry.identity, right[index].identity),
    )
  )
}

function isPathWithin(root: string, candidate: string) {
  const relativePath = path.relative(root, candidate)
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  )
}

async function inspectDirectoryPath(
  directoryPath: string,
  symbolicLinkError: () => Error,
  nonDirectoryError: () => Error,
) {
  const absolutePath = path.resolve(directoryPath)
  // Resolve trusted roots once (including system aliases such as /tmp), then
  // lstat every user-controlled descendant without following symlinks.
  const configuredRoots = [
    path.resolve(process.cwd()),
    path.resolve(os.tmpdir()),
    ...(process.platform === 'win32' ? [] : [path.resolve('/tmp')]),
  ]
    .filter((root) => isPathWithin(root, absolutePath))
    .sort((left, right) => right.length - left.length)
  const trustedRoot = configuredRoots[0] ?? path.parse(absolutePath).root
  const canonicalRoot = await fs.realpath(trustedRoot)
  const rootStats = await fs.lstat(canonicalRoot, { bigint: true })
  if (!rootStats.isDirectory()) {
    throw new Error(`Trusted path root is not a directory: ${canonicalRoot}`)
  }

  const pathIdentities: PathIdentity[] = [
    { path: canonicalRoot, identity: directoryIdentity(rootStats) },
  ]
  const relativePath = path.relative(trustedRoot, absolutePath)
  const segments = relativePath.split(path.sep).filter(Boolean)
  let currentPath = canonicalRoot

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment)
    const stats = await fs.lstat(currentPath, { bigint: true })
    if (stats.isSymbolicLink()) {
      throw symbolicLinkError()
    }
    if (!stats.isDirectory()) {
      throw nonDirectoryError()
    }
    pathIdentities.push({
      path: currentPath,
      identity: directoryIdentity(stats),
    })
  }

  return { canonicalPath: currentPath, pathIdentities }
}

function manifestChangedError(slug: string) {
  return new Error(
    `Asset worktree manifest changed during access for slug ${JSON.stringify(slug)}`,
  )
}

async function resolveWorktreeManifestPath(
  slug: string,
  options: GenerateOptions,
) {
  const assetRoot = await fs.realpath(options.assetRepo)
  const segments = ['remotion', slug, 'remotionhub.asset.json']
  let currentPath = assetRoot
  const pathIdentities: PathIdentity[] = []

  for (const [index, segment] of segments.entries()) {
    const candidatePath = path.resolve(currentPath, segment)
    const relativePath = path.relative(assetRoot, candidatePath)
    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error(
        `Asset worktree path escapes root for slug ${JSON.stringify(slug)}`,
      )
    }

    const stats = await fs.lstat(candidatePath, { bigint: true })
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Asset worktree path contains a symbolic link for slug ${JSON.stringify(slug)}`,
      )
    }

    const isManifest = index === segments.length - 1
    if (!isManifest && !stats.isDirectory()) {
      throw new Error(
        `Asset worktree path segment is not a directory for slug ${JSON.stringify(slug)}`,
      )
    }
    if (isManifest && !stats.isFile()) {
      throw new Error(
        `Asset worktree manifest is not a regular file for slug ${JSON.stringify(slug)}`,
      )
    }
    pathIdentities.push({ path: candidatePath, identity: fileIdentity(stats) })
    currentPath = candidatePath
  }

  const manifestIdentity = pathIdentities.at(-1)?.identity
  if (!manifestIdentity) {
    throw new Error(
      `Asset worktree manifest is not a regular file for slug ${JSON.stringify(slug)}`,
    )
  }

  return { manifestPath: currentPath, manifestIdentity, pathIdentities }
}

async function readManifestFromWorktree(
  slug: string,
  options: GenerateOptions,
) {
  const initial = await resolveWorktreeManifestPath(slug, options)
  let manifestFile: FileHandle
  try {
    manifestFile = await fs.open(
      initial.manifestPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    )
  } catch (error) {
    if (
      isErrnoException(error) &&
      (error.code === 'ELOOP' ||
        error.code === 'ENOENT' ||
        error.code === 'ENOTDIR')
    ) {
      throw manifestChangedError(slug)
    }
    throw error
  }

  try {
    const openedStats = await manifestFile.stat({ bigint: true })
    if (!openedStats.isFile()) {
      throw new Error(
        `Asset worktree manifest is not a regular file for slug ${JSON.stringify(slug)}`,
      )
    }

    const current = await resolveWorktreeManifestPath(slug, options)
    if (
      !pathIdentitiesMatch(initial.pathIdentities, current.pathIdentities) ||
      !identitiesMatch(fileIdentity(openedStats), initial.manifestIdentity) ||
      !identitiesMatch(fileIdentity(openedStats), current.manifestIdentity)
    ) {
      throw manifestChangedError(slug)
    }

    const raw = await manifestFile.readFile('utf8')
    const afterReadStats = await manifestFile.stat({ bigint: true })
    if (
      !identitiesMatch(fileIdentity(openedStats), fileIdentity(afterReadStats))
    ) {
      throw manifestChangedError(slug)
    }

    return JSON.parse(raw)
  } finally {
    await manifestFile.close()
  }
}

function readManifestFromCommit(
  commit: string,
  slug: string,
  options: GenerateOptions,
) {
  const manifestRelPath = `remotion/${slug}/remotionhub.asset.json`
  const raw = execFileSync(
    'git',
    ['-C', options.assetRepo, 'show', `${commit}:${manifestRelPath}`],
    { encoding: 'utf8' },
  )
  return JSON.parse(raw)
}

function toPascalCase(slug: string) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function toDisplayName(slug: string) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getCategory(slug: string): string {
  if (slug.startsWith('audio-')) return 'audio'
  if (slug.startsWith('logo-')) return 'logo'
  if (slug.startsWith('transition-')) return 'transition'
  if (slug.startsWith('intro-')) return 'intro'
  if (slug.startsWith('outro-')) return 'outro'
  if (slug.startsWith('dataviz-')) return 'dataviz'
  if (slug.startsWith('social-')) return 'social'
  if (slug.startsWith('yt-')) return 'animation'
  return 'other'
}

function mapSlugToTags(slug: string): TagKey[] {
  const tags: Set<TagKey> = new Set()
  const tokens = new Set(slug.split('-'))

  // retro
  if (
    tokens.has('vhs') ||
    tokens.has('retro') ||
    tokens.has('arcade') ||
    tokens.has('pixel')
  ) {
    tags.add('retro')
  }
  // business
  if (
    tokens.has('chart') ||
    tokens.has('dataviz') ||
    tokens.has('stats') ||
    tokens.has('gantt') ||
    tokens.has('candlestick') ||
    tokens.has('comparison') ||
    tokens.has('counter') ||
    tokens.has('report') ||
    tokens.has('dashboard') ||
    tokens.has('finance')
  ) {
    tags.add('business')
  }
  // social
  if (
    tokens.has('youtube') ||
    tokens.has('yt') ||
    tokens.has('social') ||
    tokens.has('facebook') ||
    tokens.has('tiktok') ||
    tokens.has('ig') ||
    tokens.has('twitter') ||
    tokens.has('reddit') ||
    tokens.has('linkedin') ||
    tokens.has('social-media')
  ) {
    tags.add('social')
  }
  // personal
  if (
    tokens.has('avatar') ||
    tokens.has('profile') ||
    tokens.has('testimonial')
  ) {
    tags.add('personal')
  }
  // creative
  if (
    tokens.has('glitch') ||
    tokens.has('neon') ||
    tokens.has('cinematic') ||
    tokens.has('blast') ||
    tokens.has('firework') ||
    tokens.has('3d') ||
    tokens.has('hologram') ||
    tokens.has('glow') ||
    tokens.has('pulse') ||
    tokens.has('morph') ||
    tokens.has('creative')
  ) {
    tags.add('creative')
  }
  // minimal
  if (
    tokens.has('minimal') ||
    tokens.has('fade') ||
    tokens.has('slide') ||
    tokens.has('wipe') ||
    tokens.has('simple') ||
    tokens.has('clean')
  ) {
    tags.add('minimal')
  }

  if (tags.size === 0) {
    tags.add('minimal')
  }

  return Array.from(tags)
}

async function readMarkdownTitle(
  slug: string,
  options: GenerateOptions,
): Promise<string> {
  const validateMarkdownPath = async () => {
    const sourceRootPath = path.resolve(options.sourceMdDir)
    const sourcePath = await inspectDirectoryPath(
      sourceRootPath,
      () =>
        new Error(
          `Source Markdown path contains a symbolic link for slug ${JSON.stringify(slug)}`,
        ),
      () =>
        new Error(
          `Source Markdown root is not a directory for slug ${JSON.stringify(slug)}`,
        ),
    )
    const sourceRoot = sourcePath.canonicalPath
    const mdPath = path.resolve(sourceRoot, `${slug}.md`)
    const relativePath = path.relative(sourceRoot, mdPath)
    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error(
        `Source Markdown path escapes root for slug ${JSON.stringify(slug)}`,
      )
    }

    const markdownStats = await fs.lstat(mdPath, { bigint: true })
    if (markdownStats.isSymbolicLink()) {
      throw new Error(
        `Source Markdown path contains a symbolic link for slug ${JSON.stringify(slug)}`,
      )
    }
    if (!markdownStats.isFile()) {
      throw new Error(
        `Source Markdown is not a regular file for slug ${JSON.stringify(slug)}`,
      )
    }

    return {
      mdPath,
      pathIdentities: [
        ...sourcePath.pathIdentities,
        { path: mdPath, identity: fileIdentity(markdownStats) },
      ],
    }
  }

  const sourceChangedError = () =>
    new Error(
      `Source Markdown changed during access for slug ${JSON.stringify(slug)}`,
    )
  const initial = await validateMarkdownPath()

  let markdownFile: FileHandle
  try {
    markdownFile = await fs.open(
      initial.mdPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    )
  } catch (error) {
    if (
      isErrnoException(error) &&
      (error.code === 'ELOOP' ||
        error.code === 'ENOENT' ||
        error.code === 'ENOTDIR')
    ) {
      throw sourceChangedError()
    }
    throw error
  }

  try {
    const openedStats = await markdownFile.stat({ bigint: true })
    if (!openedStats.isFile()) {
      throw new Error(
        `Source Markdown is not a regular file for slug ${JSON.stringify(slug)}`,
      )
    }

    const current = await validateMarkdownPath()
    const initialFileIdentity = initial.pathIdentities.at(-1)?.identity
    const currentFileIdentity = current.pathIdentities.at(-1)?.identity
    if (
      !initialFileIdentity ||
      !currentFileIdentity ||
      !pathIdentitiesMatch(initial.pathIdentities, current.pathIdentities) ||
      !identitiesMatch(fileIdentity(openedStats), initialFileIdentity) ||
      !identitiesMatch(fileIdentity(openedStats), currentFileIdentity)
    ) {
      throw sourceChangedError()
    }

    const content = await markdownFile.readFile('utf8')
    const afterReadStats = await markdownFile.stat({ bigint: true })
    if (
      !identitiesMatch(fileIdentity(openedStats), fileIdentity(afterReadStats))
    ) {
      throw sourceChangedError()
    }

    const match = content.match(/^title:\s+"?([^"\n]+)"?$/m)
    if (!match?.[1]) {
      throw new Error(`Title not found in ${slug}.md`)
    }
    return match[1]
  } finally {
    await markdownFile.close()
  }
}

function verifyAssetPath(
  commit: string,
  slug: string,
  options: GenerateOptions,
) {
  const relPath = `remotion/${slug}`
  try {
    execFileSync(
      'git',
      ['-C', options.assetRepo, 'cat-file', '-e', `${commit}:${relPath}`],
      { stdio: 'pipe' },
    )
  } catch {
    throw new Error(`Asset path not found at commit ${commit}: ${relPath}`)
  }
}

function hasRuntimeAssets(
  commit: string,
  slug: string,
  options: GenerateOptions,
): boolean {
  const relPath = `remotion/${slug}/src/runtime-assets.ts`
  try {
    execFileSync(
      'git',
      ['-C', options.assetRepo, 'cat-file', '-e', `${commit}:${relPath}`],
      { stdio: 'pipe' },
    )
    return true
  } catch {
    return false
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

async function validateOutputDirectories(outputPath: string, slug: string) {
  const targetDirPath = path.dirname(path.resolve(outputPath))
  const targetPath = await inspectDirectoryPath(
    targetDirPath,
    () =>
      new Error(
        `Output directory path contains a symbolic link for slug ${JSON.stringify(slug)}`,
      ),
    () =>
      new Error(
        `Output target is not a directory for slug ${JSON.stringify(slug)}`,
      ),
  )
  const canonicalTarget = targetPath.canonicalPath

  return {
    outputPath: path.join(canonicalTarget, path.basename(outputPath)),
    targetDirPath: canonicalTarget,
    pathIdentities: targetPath.pathIdentities,
  }
}

async function writeCatalogFile(
  outputPath: string,
  content: string,
  slug: string,
) {
  const initial = await validateOutputDirectories(outputPath, slug)
  try {
    const stats = await fs.lstat(initial.outputPath)
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Output path is a symbolic link for slug ${JSON.stringify(slug)}`,
      )
    }
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') {
      throw error
    }
  }

  const tempPath = path.join(
    initial.targetDirPath,
    `.generate-catalog-${process.pid}-${randomUUID()}.tmp`,
  )
  let published = false
  try {
    const outputFile = await fs.open(
      tempPath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o666,
    )

    try {
      let afterOpen
      try {
        afterOpen = await validateOutputDirectories(outputPath, slug)
      } catch {
        throw new Error(
          `Output directory changed during access for slug ${JSON.stringify(slug)}`,
        )
      }
      if (
        !pathIdentitiesMatch(initial.pathIdentities, afterOpen.pathIdentities)
      ) {
        throw new Error(
          `Output directory changed during access for slug ${JSON.stringify(slug)}`,
        )
      }

      await outputFile.writeFile(content, 'utf8')
      await outputFile.sync()
    } finally {
      await outputFile.close()
    }

    let beforePublish
    try {
      beforePublish = await validateOutputDirectories(outputPath, slug)
    } catch {
      throw new Error(
        `Output directory changed during access for slug ${JSON.stringify(slug)}`,
      )
    }
    if (
      !pathIdentitiesMatch(initial.pathIdentities, beforePublish.pathIdentities)
    ) {
      throw new Error(
        `Output directory changed during access for slug ${JSON.stringify(slug)}`,
      )
    }

    try {
      const finalStats = await fs.lstat(initial.outputPath)
      if (finalStats.isSymbolicLink()) {
        throw new Error(
          `Output path is a symbolic link for slug ${JSON.stringify(slug)}`,
        )
      }
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'ENOENT') {
        throw error
      }
    }

    // Node lacks openat/renameat. The grandparent directory is the trust
    // boundary for the final revalidation-to-rename window.
    await fs.rename(tempPath, initial.outputPath)
    published = true
  } finally {
    if (!published) {
      await fs.rm(tempPath, { force: true })
    }
  }
}

export async function generateCatalogEntry(
  slug: string,
  commit: string,
  options: GenerateOptions,
): Promise<void> {
  validateSlug(slug)
  verifyAssetPath(commit, slug, options)
  const manifest = options.assetCommit
    ? readManifestFromCommit(commit, slug, options)
    : await readManifestFromWorktree(slug, options)
  const titleZh =
    manifest.displayNameZh?.trim() || (await readMarkdownTitle(slug, options))
  const category = getCategory(slug)

  const componentFile = `\`remotion/${slug}/src/${toPascalCase(slug)}.tsx\``
  const runtimeFile = `\`remotion/${slug}/src/runtime-assets.ts\``
  const hasRuntime = hasRuntimeAssets(commit, slug, options)

  const catalog = {
    publisher: 'remotionlab',
    runtime: 'remotion',
    slug,
    displayName: toDisplayName(slug),
    displayNameZh: titleZh,
    summary: `${toDisplayName(slug)} component for Remotion.`,
    summaryZh:
      manifest.summaryZh?.trim() || `适用于 Remotion 的「${titleZh}」组件。`,
    categories: [category],
    tags: mapSlugToTags(slug),
    status: 'published',
    versions: [
      {
        version: '1.0.0',
        changelog: 'Initial migrated release.',
        preview: {
          thumbnailUrl: manifest.thumbnailUrl,
          previewVideoUrl: manifest.previewUrl,
          demoUrl: manifest.sourceUrl,
        },
        metadata: {
          runtime: 'remotion',
          entryPoint: manifest.entryPoint,
          aspectRatios: manifest.aspectRatios,
          durationFrames: manifest.durationFrames,
          fps: manifest.fps,
        },
        tags: mapSlugToTags(slug),
        artifact: {
          kind: 'github-source',
          githubSource: {
            repo: 'remotionhub/remotionhub-assets',
            ref: 'main',
            commit,
            path: `remotion/${slug}`,
          },
          license: manifest.license,
          usageMarkdown: hasRuntime
            ? `Copy ${componentFile} and ${runtimeFile} into your Remotion project, import \`${toPascalCase(slug)}\` and \`${toPascalCase(slug).charAt(0).toLowerCase() + toPascalCase(slug).slice(1)}DefaultProps\`, then register the composition.`
            : `Copy ${componentFile} into your Remotion project, import \`${toPascalCase(slug)}\` and \`${toPascalCase(slug).charAt(0).toLowerCase() + toPascalCase(slug).slice(1)}DefaultProps\`, then register the composition.`,
          agentPrompt: hasRuntime
            ? `Add the ${toDisplayName(slug)} Remotion asset from remotionhub/remotionhub-assets at remotion/${slug} to my project. Copy both the component file and runtime-assets.ts. Preserve the exported ${toPascalCase(slug)}Props API and register the ${toPascalCase(slug)} composition with the default props.`
            : `Add the ${toDisplayName(slug)} Remotion asset from remotionhub/remotionhub-assets at remotion/${slug} to my project. Preserve the exported ${toPascalCase(slug)}Props API and register the ${toPascalCase(slug)} composition with the default props.`,
        },
      },
    ],
  }

  const outputPath = path.join(options.targetDir, `${slug}.json`)
  await writeCatalogFile(
    outputPath,
    `${JSON.stringify(catalog, null, 2)}\n`,
    slug,
  )
  console.log(`Generated ${outputPath} at commit ${commit}`)
}

export async function runGenerateCatalog(
  argv: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const options = parseGenerateOptions(argv, env)
  if (options.slugs.length === 0) {
    throw new GenerateUsageError('Please specify slugs to generate.')
  }
  for (const slug of options.slugs) {
    validateSlug(slug)
  }
  const commit = resolveAssetCommit(
    options.assetRepo,
    options.assetCommit ?? 'HEAD',
  )

  for (const slug of options.slugs) {
    await generateCatalogEntry(slug, commit, options)
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runGenerateCatalog(process.argv.slice(2), process.env).catch(
    (error: unknown) => {
      if (error instanceof GenerateUsageError) {
        console.error(error.message)
      } else {
        console.error(error)
      }
      process.exitCode = 1
    },
  )
}
