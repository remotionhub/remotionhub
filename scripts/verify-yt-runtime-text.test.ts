import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  parseVerifyOptions,
  resolveLatestGithubSource,
  runVerify,
} from './verify-yt-runtime-text'

type VerificationAsset = {
  commit: string
  repo: string
}

const temporaryDirectories: string[] = []

async function createTemporaryDirectory() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'verify-yt-runtime-text-'),
  )
  temporaryDirectories.push(directory)
  return directory
}

async function createGitRepo() {
  const directory = await createTemporaryDirectory()
  execFileSync('git', ['init', '--quiet'], { cwd: directory })
  await fs.writeFile(path.join(directory, 'README.md'), 'runtime repo\n', 'utf8')
  execFileSync('git', ['add', 'README.md'], { cwd: directory })
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Test User',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--quiet',
      '-m',
      'initial commit',
    ],
    { cwd: directory },
  )

  return directory
}

function commitRepo(repo: string, message: string) {
  execFileSync('git', ['add', '.'], { cwd: repo })
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Test User',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--quiet',
      '-m',
      message,
    ],
    { cwd: repo },
  )
}

function latestCommit(repo: string) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim()
}

async function createAssetFixture(
  slug: string,
  includeRuntimeText: boolean,
  runtimeAssets = true,
): Promise<VerificationAsset> {
  const repo = await createGitRepo()
  const assetRoot = path.join(repo, 'remotion', slug)
  const sourceRoot = path.join(assetRoot, 'src')
  await fs.mkdir(sourceRoot, { recursive: true })

  await fs.writeFile(
    path.join(assetRoot, 'remotionhub.asset.json'),
    `${JSON.stringify(
      {
        runtime: 'remotion',
        durationFrames: 120,
        fps: 30,
        aspectRatios: ['16:9'],
        ...(includeRuntimeText
          ? {
              runtimeAssets: [
                {
                  sourcePath: 'audio/a.wav',
                  url: 'https://example.com/audio.wav',
                  sha256: 'a'.repeat(64),
                  byteSize: 12,
                  contentType: 'audio/wav',
                },
              ],
            }
          : {
              runtimeAssets: [],
            }),
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  await fs.writeFile(
    path.join(sourceRoot, 'Component.tsx'),
    'export const Component = () => null\n',
    'utf8',
  )

  if (runtimeAssets) {
    await fs.writeFile(
      path.join(sourceRoot, 'runtime-assets.ts'),
      'export const runtimeAssets = {}\n',
      'utf8',
    )
  }

  commitRepo(repo, `add ${slug}`)
  return { repo, commit: latestCommit(repo) }
}

async function writeCatalogEntry(
  catalogDir: string,
  data: {
    slug: string
    commit: string
    usageMarkdown: string
    agentPrompt: string
  },
) {
  const catalog = {
    publisher: 'remotionlab',
    runtime: 'remotion',
    slug: data.slug,
    displayName: 'YT Entry',
    displayNameZh: 'YT Entry',
    summary: 'Demo text.',
    summaryZh: 'Demo entry.',
    categories: ['animation'],
    tags: ['social'],
    status: 'published',
    versions: [
      {
        version: '1.0.0',
        changelog: 'Initial',
        preview: {
          thumbnailUrl: 'https://example.com/thumb.png',
        },
        metadata: {
          runtime: 'remotion',
          entryPoint: 'src/Component.tsx',
          aspectRatios: ['16:9'],
          durationFrames: 120,
          fps: 30,
        },
        tags: ['social'],
        artifact: {
          kind: 'github-source',
          githubSource: {
            repo: 'remotionhub/remotionhub-assets',
            ref: 'main',
            commit: data.commit,
            path: `remotion/${data.slug}`,
          },
          license: 'MIT',
          usageMarkdown: data.usageMarkdown,
          agentPrompt: data.agentPrompt,
        },
      },
    ],
  }

  await fs.writeFile(
    path.join(catalogDir, `${data.slug}.json`),
    `${JSON.stringify(catalog, null, 2)}\n`,
    'utf8',
  )
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('resolveLatestGithubSource', () => {
  it('selects the latest valid remotionhub source entry', () => {
    expect(
      resolveLatestGithubSource(
        [
          { artifact: { kind: 'github-source', githubSource: { repo: 'x', ref: 'main', commit: '111111', path: 'remotion/old' } } },
          {
            artifact: {
              kind: 'github-source',
              githubSource: {
                repo: 'remotionhub/remotionhub-assets',
                ref: 'main',
                commit: '222222',
                path: 'remotion/new',
              },
            },
          },
        ],
        'sample',
      ),
    ).toMatchObject({
      repo: 'remotionhub/remotionhub-assets',
      commit: '222222',
      path: 'remotion/new',
    })
  })
})

describe('parseVerifyOptions', () => {
  it('uses defaults and can parse optional overrides', () => {
    const defaultOptions = parseVerifyOptions([])
    expect(defaultOptions.catalogDir).toBe(path.resolve('catalog', 'components'))
    expect(defaultOptions.assetRepo).toBe(
      process.env.REMOTIONHUB_ASSET_REPO ??
        path.resolve(process.cwd(), '..', 'remotionhub-assets'),
    )
    expect(defaultOptions.throwOnMismatch).toBe(false)

    const explicit = parseVerifyOptions([
      '--catalog-dir=/tmp/catalog',
      '--asset-repo=/tmp/assets',
      '--asset-commit=abc123',
      '--throw-on-mismatch',
    ])
    expect(explicit).toEqual({
      catalogDir: '/tmp/catalog',
      assetRepo: '/tmp/assets',
      assetCommit: 'abc123',
      throwOnMismatch: true,
    })
  })
})

describe('runVerify', () => {
  it('passes when catalog and runtime file consistency matches for no runtime assets', async () => {
    const catalogDir = await createTemporaryDirectory()
    const asset = await createAssetFixture('yt-no-runtime', false, false)

    await writeCatalogEntry(catalogDir, {
      slug: 'yt-no-runtime',
      commit: asset.commit,
      usageMarkdown: 'Copy the component into your Remotion project.',
      agentPrompt: 'Add the Yt No Runtime Remotion asset from remotionhub/remotionhub-assets at remotion/yt-no-runtime to my project.',
    })

    const report = await runVerify({
      catalogDir,
      assetRepo: asset.repo,
      throwOnMismatch: true,
    })

    expect(report.mismatches).toBe(0)
    expect(report.entries[0]?.manifestRuntimeAssets).toBe(false)
    expect(report.entries[0]?.runtimeFileExists).toBe(false)
    expect(report.entries[0]?.usageMentionsRuntime).toBe(false)
    expect(report.entries[0]?.promptMentionsRuntime).toBe(false)
  })

  it('reports mismatch when runtime assets exist but catalog text does not mention runtime file', async () => {
    const catalogDir = await createTemporaryDirectory()
    const asset = await createAssetFixture('yt-with-runtime', true, true)

    await writeCatalogEntry(catalogDir, {
      slug: 'yt-with-runtime',
      commit: asset.commit,
      usageMarkdown: 'Copy the component into your Remotion project.',
      agentPrompt:
        'Add the Yt With Runtime asset and register the composition with the default props.',
    })

    const report = await runVerify({
      catalogDir,
      assetRepo: asset.repo,
      throwOnMismatch: true,
    })

    expect(report.mismatches).toBe(1)
    expect(report.entries[0]?.mismatches.join(';')).toContain(
      'runtime text missing for runtime-aware asset',
    )
  })

  it('reports mismatch when text mentions runtime-assets.ts but commit does not include runtime assets', async () => {
    const catalogDir = await createTemporaryDirectory()
    const asset = await createAssetFixture('yt-no-runtime-mention', false, false)

    await writeCatalogEntry(catalogDir, {
      slug: 'yt-no-runtime-mention',
      commit: asset.commit,
      usageMarkdown:
        'Copy component and runtime-assets.ts into your Remotion project.',
      agentPrompt:
        'Add the Yt No Runtime Mention asset from remotionhub/remotionhub-assets at remotion/yt-no-runtime-mention and copy runtime-assets.ts.',
    })

    const report = await runVerify({
      catalogDir,
      assetRepo: asset.repo,
      throwOnMismatch: true,
    })

    expect(report.mismatches).toBe(1)
    expect(report.entries[0]?.mismatches.join(';')).toContain(
      'runtime text present without runtime assets',
    )
  })

  it('reports invalid source pointer as a mismatch', async () => {
    const catalogDir = await createTemporaryDirectory()
    const repo = await createGitRepo()
    const commit = latestCommit(repo)

    await writeCatalogEntry(catalogDir, {
      slug: 'yt-invalid-source',
      commit,
      usageMarkdown: 'Copy the component into your Remotion project.',
      agentPrompt:
        'Add the asset and preserve the exported props API, register the composition.',
    })

    const malformed = path.join(catalogDir, 'yt-invalid-source.json')
    const raw = await fs.readFile(malformed, 'utf8')
    const catalog = JSON.parse(raw) as { versions: Array<{ artifact: { githubSource: Record<string, string> } }> }
    catalog.versions[0]!.artifact.githubSource = {
      repo: 'other/repo',
      ref: 'main',
      commit,
      path: 'remotion/yt-invalid-source',
    }
    await fs.writeFile(malformed, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

    const report = await runVerify({
      catalogDir,
      assetRepo: repo,
      throwOnMismatch: true,
    })

    expect(report.mismatches).toBe(1)
    expect(report.entries[0]?.mismatches.join(';')).toContain(
      'no remotionhub asset source pointer',
    )
  })
})
