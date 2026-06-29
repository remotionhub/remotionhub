import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { type TagKey } from '../src/lib/tags'

const targetDir = 'catalog/components'

function getArgValue(name: string) {
  return process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
}

const assetRepo =
  getArgValue('asset-repo') ??
  process.env.REMOTIONHUB_ASSET_REPO ??
  '/Users/tangwz/workspace/git/remotionhub-assets'
const sourceMdDir =
  getArgValue('source-md-dir') ??
  process.env.REMOTIONLAB_SOURCE_MD_DIR ??
  '/tmp/remotionlab/案例'
const assetCommitFlag = getArgValue('asset-commit')

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
    ['-C', repo, 'rev-parse', '--verify', `${ref}^{commit}`],
    {
      encoding: 'utf8',
    },
  ).trim()

  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(`Asset commit ref did not resolve to a full SHA: ${ref}`)
  }

  return commit
}

async function getAssetCommit() {
  return resolveAssetCommit(assetRepo, assetCommitFlag ?? 'HEAD')
}

function readManifestFromWorktree(slug: string) {
  return fs
    .readFile(path.join(assetRepo, 'remotion', slug, 'remotionhub.asset.json'), {
      encoding: 'utf8',
    })
    .then((raw) => JSON.parse(raw))
}

function readManifestFromCommit(commit: string, slug: string) {
  const manifestRelPath = `remotion/${slug}/remotionhub.asset.json`
  const raw = execFileSync(
    'git',
    ['-C', assetRepo, 'show', `${commit}:${manifestRelPath}`],
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
  if (tokens.has('vhs') || tokens.has('retro') || tokens.has('arcade') || tokens.has('pixel')) {
    tags.add('retro')
  }
  // business
  if (
    tokens.has('chart') || tokens.has('dataviz') || tokens.has('stats') ||
    tokens.has('gantt') || tokens.has('candlestick') || tokens.has('comparison') ||
    tokens.has('counter') || tokens.has('report') || tokens.has('dashboard') || tokens.has('finance')
  ) {
    tags.add('business')
  }
  // social
  if (
    tokens.has('youtube') || tokens.has('yt') || tokens.has('social') ||
    tokens.has('facebook') || tokens.has('tiktok') || tokens.has('ig') ||
    tokens.has('twitter') || tokens.has('reddit') || tokens.has('linkedin') ||
    tokens.has('social-media')
  ) {
    tags.add('social')
  }
  // personal
  if (tokens.has('avatar') || tokens.has('profile') || tokens.has('testimonial')) {
    tags.add('personal')
  }
  // creative
  if (
    tokens.has('glitch') || tokens.has('neon') || tokens.has('cinematic') ||
    tokens.has('blast') || tokens.has('firework') || tokens.has('3d') ||
    tokens.has('hologram') || tokens.has('glow') || tokens.has('pulse') ||
    tokens.has('morph') || tokens.has('creative')
  ) {
    tags.add('creative')
  }
  // minimal
  if (
    tokens.has('minimal') || tokens.has('fade') || tokens.has('slide') ||
    tokens.has('wipe') || tokens.has('simple') || tokens.has('clean')
  ) {
    tags.add('minimal')
  }

  if (tags.size === 0) {
    tags.add('minimal')
  }

  return Array.from(tags)
}

async function readMarkdownTitle(slug: string): Promise<string> {
  const mdPath = path.join(sourceMdDir, `${slug}.md`)
  const content = await fs.readFile(mdPath, 'utf8')
  const match = content.match(/^title:\s+"?([^"\n]+)"?$/m)
  if (!match?.[1]) {
    throw new Error(`Title not found in ${slug}.md`)
  }
  return match[1]
}

function verifyAssetPath(commit: string, slug: string) {
  const relPath = `remotion/${slug}`
  try {
    execFileSync('git', ['-C', assetRepo, 'cat-file', '-e', `${commit}:${relPath}`])
  } catch {
    throw new Error(`Asset path not found at commit ${commit}: ${relPath}`)
  }
}

function hasRuntimeAssets(commit: string, slug: string): boolean {
  const relPath = `remotion/${slug}/src/runtime-assets.ts`
  try {
    execFileSync('git', ['-C', assetRepo, 'cat-file', '-e', `${commit}:${relPath}`], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function generate(slug: string, commit: string) {
  verifyAssetPath(commit, slug)
  const manifest = assetCommitFlag
    ? readManifestFromCommit(commit, slug)
    : await readManifestFromWorktree(slug)
  const titleZh =
    manifest.displayNameZh?.trim() || (await readMarkdownTitle(slug))
  const category = getCategory(slug)

  const componentFile = `\`remotion/${slug}/src/${toPascalCase(slug)}.tsx\``
  const runtimeFile = `\`remotion/${slug}/src/runtime-assets.ts\``
  const hasRuntime = hasRuntimeAssets(commit, slug)

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

  const outputPath = path.join(targetDir, `${slug}.json`)
  await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`Generated ${outputPath} at commit ${commit}`)
}

async function main() {
  const commit = await getAssetCommit()
  const slugs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  if (slugs.length === 0) {
    console.error('Please specify slugs to generate.')
    process.exit(1)
  }

  for (const slug of slugs) {
    await generate(slug, commit)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
