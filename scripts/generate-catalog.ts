import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const assetRepo = '/Users/tangwz/workspace/git/remotionhub-assets'
const targetDir = 'catalog/components'

async function getAssetCommit() {
  return execFileSync('git', ['-C', assetRepo, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
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
  return 'other'
}

async function readMarkdownTitle(slug: string): Promise<string> {
  const mdPath = `/tmp/remotionlab/案例/${slug}.md`
  const content = await fs.readFile(mdPath, 'utf8')
  const match = content.match(/^title:\s+"?([^"\n]+)"?$/m)
  if (!match?.[1]) {
    throw new Error(`Title not found in ${slug}.md`)
  }
  return match[1]
}

async function generate(slug: string, commit: string) {
  const manifestPath = path.join(assetRepo, 'remotion', slug, 'remotionhub.asset.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  const titleZh = await readMarkdownTitle(slug)
  const category = getCategory(slug)
  
  const catalog = {
    publisher: 'remotionlab',
    runtime: 'remotion',
    slug,
    displayName: toDisplayName(slug),
    displayNameZh: titleZh,
    summary: `${toDisplayName(slug)} component for Remotion.`,
    summaryZh: `适用于 Remotion 的${titleZh}组件。`,
    categories: [category],
    tags: ['remotion', category, ...slug.split('-').slice(1)],
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
        tags: [category, ...slug.split('-').slice(1)],
        artifact: {
          kind: 'github-source',
          githubSource: {
            repo: 'remotionhub/remotionhub-assets',
            ref: 'main',
            commit,
            path: `remotion/${slug}`,
          },
          license: manifest.license,
          usageMarkdown: `Copy \`remotion/${slug}/src/${toPascalCase(slug)}.tsx\` into your Remotion project, import \`${toPascalCase(slug)}\` and \`${toPascalCase(slug).charAt(0).toLowerCase() + toPascalCase(slug).slice(1)}DefaultProps\`, then register the composition.`,
          agentPrompt: `Add the ${toDisplayName(slug)} Remotion asset from remotionhub/remotionhub-assets at remotion/${slug} to my project. Preserve the exported ${toPascalCase(slug)}Props API and register the ${toPascalCase(slug)} composition with the default props.`,
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
  const slugs = process.argv.slice(2)
  if (slugs.length === 0) {
    console.error('Please specify slugs to generate.')
    process.exit(1)
  }
  
  for (const slug of slugs) {
    await generate(slug, commit)
  }
}

main().catch(console.error)
