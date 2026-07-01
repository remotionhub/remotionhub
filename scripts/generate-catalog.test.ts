import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generateCatalogEntry,
  type GenerateOptions,
  parseGenerateOptions,
  resolveAssetCommit,
  runGenerateCatalog,
} from './generate-catalog'

const createdDirs: string[] = []

async function makeGitRepo() {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-catalog-'))
  createdDirs.push(repo)

  execFileSync('git', ['init', '--quiet'], { cwd: repo })
  await fs.writeFile(path.join(repo, 'README.md'), 'test\n', 'utf8')
  execFileSync('git', ['add', 'README.md'], { cwd: repo })
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Test User',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'initial commit',
    ],
    { cwd: repo },
  )

  return repo
}

type AssetFixture = {
  commit: string
  options: GenerateOptions
  outputDir: string
  repo: string
  sourceMdDir: string
}

async function writeAssetFiles(
  repo: string,
  sourceMdDir: string,
  slug: string,
  manifestOverrides: Record<string, unknown> = {},
  runtimeAssets = true,
) {
  const assetDir = path.join(repo, 'remotion', slug)
  const sourceDir = path.join(assetDir, 'src')
  const markdownPath = path.join(sourceMdDir, `${slug}.md`)
  await fs.mkdir(sourceDir, { recursive: true })
  await fs.mkdir(path.dirname(markdownPath), { recursive: true })

  const manifest = {
    displayNameZh: '已提交标题',
    summaryZh: '已提交摘要',
    thumbnailUrl: 'https://example.test/thumbnail.png',
    previewUrl: 'https://example.test/preview.mp4',
    sourceUrl: 'https://example.test/source',
    entryPoint: `src/${slug}.tsx`,
    aspectRatios: ['16:9'],
    durationFrames: 90,
    fps: 30,
    license: 'MIT',
    ...manifestOverrides,
  }
  await fs.writeFile(
    path.join(assetDir, 'remotionhub.asset.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
  await fs.writeFile(
    path.join(sourceDir, 'Component.tsx'),
    'export const Component = () => null\n',
    'utf8',
  )
  if (runtimeAssets) {
    await fs.writeFile(
      path.join(sourceDir, 'runtime-assets.ts'),
      'export const runtimeAssets = {}\n',
      'utf8',
    )
  }
  await fs.writeFile(
    markdownPath,
    '---\ntitle: "Markdown Title"\n---\n',
    'utf8',
  )
}

function commitAll(repo: string, message: string) {
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

async function makeAssetFixture(
  slug = 'logo-reveal',
  manifestOverrides: Record<string, unknown> = {},
  runtimeAssets = true,
): Promise<AssetFixture> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'generate-catalog-assets-'),
  )
  createdDirs.push(root)
  const repo = path.join(root, 'assets')
  const sourceMdDir = path.join(root, 'markdown')
  const outputDir = path.join(root, 'catalog')

  await fs.mkdir(repo, { recursive: true })
  await fs.mkdir(sourceMdDir, { recursive: true })
  await fs.mkdir(outputDir, { recursive: true })
  execFileSync('git', ['init', '--quiet'], { cwd: repo })
  await writeAssetFiles(
    repo,
    sourceMdDir,
    slug,
    manifestOverrides,
    runtimeAssets,
  )
  commitAll(repo, 'add asset')
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim()

  return {
    commit,
    options: {
      assetRepo: repo,
      sourceMdDir,
      targetDir: outputDir,
      slugs: [slug],
    },
    outputDir,
    repo,
    sourceMdDir,
  }
}

async function readGenerated(outputDir: string, slug: string) {
  return JSON.parse(
    await fs.readFile(path.join(outputDir, `${slug}.json`), 'utf8'),
  )
}

async function readTextIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return ''
    }
    throw error
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    createdDirs
      .splice(0, createdDirs.length)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  )
})

describe('parseGenerateOptions', () => {
  it('uses the existing default paths', () => {
    expect(parseGenerateOptions([], {})).toEqual({
      assetRepo: '/Users/tangwz/workspace/git/remotionhub-assets',
      sourceMdDir: '/tmp/remotionlab/案例',
      targetDir: 'catalog/components',
      assetCommit: undefined,
      slugs: [],
    })
  })

  it('uses environment paths and collects non-flag arguments as slugs', () => {
    expect(
      parseGenerateOptions(['logo-reveal', '--unknown=value', 'intro-card'], {
        REMOTIONHUB_ASSET_REPO: '/env/assets',
        REMOTIONLAB_SOURCE_MD_DIR: '/env/markdown',
      }),
    ).toEqual({
      assetRepo: '/env/assets',
      sourceMdDir: '/env/markdown',
      targetDir: 'catalog/components',
      assetCommit: undefined,
      slugs: ['logo-reveal', 'intro-card'],
    })
  })

  it('lets CLI flags override environment values', () => {
    expect(
      parseGenerateOptions(
        [
          '--asset-repo=/cli/assets',
          '--source-md-dir=/cli/markdown',
          '--target-dir=/cli/catalog',
          '--asset-commit=abc123',
          'logo-reveal',
        ],
        {
          REMOTIONHUB_ASSET_REPO: '/env/assets',
          REMOTIONLAB_SOURCE_MD_DIR: '/env/markdown',
        },
      ),
    ).toEqual({
      assetRepo: '/cli/assets',
      sourceMdDir: '/cli/markdown',
      targetDir: '/cli/catalog',
      assetCommit: 'abc123',
      slugs: ['logo-reveal'],
    })
  })
})

describe('command runner', () => {
  it('prints only the usage message when direct execution has no slugs', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        path.join(process.cwd(), 'scripts/generate-catalog.ts'),
        '--asset-repo=/does/not/matter',
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    )

    expect(result.status).not.toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('Please specify slugs to generate.\n')
  })

  it('resolves one clean commit and generates every requested slug', async () => {
    const fixture = await makeAssetFixture('logo-reveal')
    await writeAssetFiles(fixture.repo, fixture.sourceMdDir, 'intro-card')
    commitAll(fixture.repo, 'add second asset')
    const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fixture.repo,
      encoding: 'utf8',
    }).trim()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    let messages: unknown[] = []

    try {
      await runGenerateCatalog(
        [
          `--asset-repo=${fixture.repo}`,
          `--source-md-dir=${fixture.sourceMdDir}`,
          `--target-dir=${fixture.outputDir}`,
          'logo-reveal',
          'intro-card',
        ],
        {},
      )
      messages = log.mock.calls.map(([message]) => message)
    } finally {
      log.mockRestore()
    }

    const logo = await readGenerated(fixture.outputDir, 'logo-reveal')
    const intro = await readGenerated(fixture.outputDir, 'intro-card')
    expect(logo.versions[0].artifact.githubSource.commit).toBe(expectedCommit)
    expect(intro.versions[0].artifact.githubSource.commit).toBe(expectedCommit)
    expect(messages).toEqual([
      `Generated ${path.join(fixture.outputDir, 'logo-reveal.json')} at commit ${expectedCommit}`,
      `Generated ${path.join(fixture.outputDir, 'intro-card.json')} at commit ${expectedCommit}`,
    ])
  })
})

describe('generateCatalogEntry', () => {
  it('creates the temporary catalog file beside the output target', async () => {
    const fixture = await makeAssetFixture('logo-reveal')
    const targetDir = await fs.mkdtemp(
      path.join(await fs.realpath(os.tmpdir()), 'generate-catalog-target-'),
    )
    createdDirs.push(targetDir)
    const originalOpen = fs.open
    let tempPath = ''
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const [target] = args
      const openedPath = path.resolve(target.toString())
      if (path.basename(openedPath).startsWith('.generate-catalog-')) {
        tempPath = openedPath
      }
      return originalOpen(...args)
    })

    await generateCatalogEntry('logo-reveal', fixture.commit, {
      ...fixture.options,
      targetDir,
    })

    expect(path.dirname(tempPath)).toBe(await fs.realpath(targetDir))
    await expect(
      fs.readFile(path.join(targetDir, 'logo-reveal.json'), 'utf8'),
    ).resolves.toContain('"slug": "logo-reveal"')
  })

  it.skipIf(process.platform === 'win32')(
    'accepts the trusted /tmp system alias as an output root',
    async () => {
      const fixture = await makeAssetFixture('logo-reveal')
      const targetDir = await fs.mkdtemp('/tmp/generate-catalog-alias-')
      createdDirs.push(targetDir)

      await generateCatalogEntry('logo-reveal', fixture.commit, {
        ...fixture.options,
        targetDir,
      })

      await expect(
        fs.readFile(path.join(targetDir, 'logo-reveal.json'), 'utf8'),
      ).resolves.toContain('"slug": "logo-reveal"')
    },
  )

  it('rejects a Markdown title symlink without consuming outside content', async () => {
    const fixture = await makeAssetFixture('intro-card', {
      displayNameZh: '',
    })
    const markdownPath = path.join(fixture.sourceMdDir, 'intro-card.md')
    const outsideMarkdown = path.join(
      path.dirname(fixture.sourceMdDir),
      'outside-title.md',
    )
    await fs.writeFile(
      outsideMarkdown,
      '---\ntitle: "outside-markdown-marker"\n---\n',
      'utf8',
    )
    await fs.rm(markdownPath)
    await fs.symlink(outsideMarkdown, markdownPath)

    const error = await generateCatalogEntry(
      'intro-card',
      fixture.commit,
      fixture.options,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )
    const output = await readTextIfExists(
      path.join(fixture.outputDir, 'intro-card.json'),
    )

    expect.soft(error).toEqual(
      expect.objectContaining({
        message:
          'Source Markdown path contains a symbolic link for slug "intro-card"',
      }),
    )
    expect(output).not.toContain('outside-markdown-marker')
    expect(output).toBe('')
  })

  it('rejects a symlink in the source Markdown directory ancestors', async () => {
    const fixture = await makeAssetFixture('intro-card', {
      displayNameZh: '',
    })
    const sourceParent = path.dirname(fixture.sourceMdDir)
    const outsideRoot = path.join(sourceParent, 'outside-markdown-root')
    const outsideMarkdownDir = path.join(outsideRoot, 'markdown')
    const sourceLink = path.join(sourceParent, 'source-link')
    await fs.mkdir(outsideMarkdownDir, { recursive: true })
    await fs.writeFile(
      path.join(outsideMarkdownDir, 'intro-card.md'),
      '---\ntitle: "outside-ancestor-marker"\n---\n',
      'utf8',
    )
    await fs.symlink(outsideRoot, sourceLink)

    const error = await generateCatalogEntry(
      'intro-card',
      fixture.commit,
      {
        ...fixture.options,
        sourceMdDir: path.join(sourceLink, 'markdown'),
      },
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )
    const output = await readTextIfExists(
      path.join(fixture.outputDir, 'intro-card.json'),
    )

    expect.soft(error).toEqual(
      expect.objectContaining({
        message:
          'Source Markdown path contains a symbolic link for slug "intro-card"',
      }),
    )
    expect(output).not.toContain('outside-ancestor-marker')
    expect(output).toBe('')
  })

  it('rejects a target directory symlink without writing outside it', async () => {
    const fixture = await makeAssetFixture('logo-reveal')
    const outsideDir = path.join(
      path.dirname(fixture.outputDir),
      'outside-output',
    )
    const sentinelPath = path.join(outsideDir, 'sentinel.txt')
    await fs.mkdir(outsideDir)
    await fs.writeFile(sentinelPath, 'sentinel\n', 'utf8')
    await fs.rm(fixture.outputDir, { recursive: true })
    await fs.symlink(outsideDir, fixture.outputDir)

    const error = await generateCatalogEntry(
      'logo-reveal',
      fixture.commit,
      fixture.options,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )

    expect.soft(error).toEqual(
      expect.objectContaining({
        message:
          'Output directory path contains a symbolic link for slug "logo-reveal"',
      }),
    )
    expect(await fs.readFile(sentinelPath, 'utf8')).toBe('sentinel\n')
    expect(
      await readTextIfExists(path.join(outsideDir, 'logo-reveal.json')),
    ).toBe('')
  })

  it('rejects a symlink in nested target directory ancestors', async () => {
    const fixture = await makeAssetFixture('logo-reveal')
    const outputRoot = path.dirname(fixture.outputDir)
    const outsideRoot = path.join(outputRoot, 'outside-nested-output')
    const outsideTarget = path.join(outsideRoot, 'sub', 'components')
    const outputLink = path.join(outputRoot, 'output-link')
    await fs.mkdir(outsideTarget, { recursive: true })
    await fs.symlink(outsideRoot, outputLink)

    const error = await generateCatalogEntry(
      'logo-reveal',
      fixture.commit,
      {
        ...fixture.options,
        targetDir: path.join(outputLink, 'sub', 'components'),
      },
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )

    expect.soft(error).toEqual(
      expect.objectContaining({
        message:
          'Output directory path contains a symbolic link for slug "logo-reveal"',
      }),
    )
    expect(
      await readTextIfExists(path.join(outsideTarget, 'logo-reveal.json')),
    ).toBe('')
  })

  it('rejects Markdown atomically replaced after initial validation', async () => {
    const fixture = await makeAssetFixture('intro-card', {
      displayNameZh: '',
    })
    const markdownPath = path.join(fixture.sourceMdDir, 'intro-card.md')
    const replacementPath = path.join(
      fixture.sourceMdDir,
      '.replacement-title.md',
    )
    await fs.writeFile(
      replacementPath,
      '---\ntitle: "replaced-markdown-marker"\n---\n',
      'utf8',
    )
    const canonicalMarkdownPath = path.join(
      await fs.realpath(path.dirname(markdownPath)),
      path.basename(markdownPath),
    )
    const originalLstat = fs.lstat
    let replaced = false
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      const stats = await originalLstat(...args)
      const [target] = args
      if (
        !replaced &&
        path.resolve(target.toString()) === canonicalMarkdownPath
      ) {
        replaced = true
        await fs.rename(replacementPath, markdownPath)
      }
      return stats
    })
    vi.resetModules()
    const { generateCatalogEntry: generateRaceEntry } = await import(
      './generate-catalog'
    )

    const error = await generateRaceEntry(
      'intro-card',
      fixture.commit,
      fixture.options,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )
    const output = await readTextIfExists(
      path.join(fixture.outputDir, 'intro-card.json'),
    )

    expect(replaced).toBe(true)
    expect.soft(error).toEqual(
      expect.objectContaining({
        message: 'Source Markdown changed during access for slug "intro-card"',
      }),
    )
    expect(output).not.toContain('replaced-markdown-marker')
    expect(output).toBe('')
  })

  it('rejects a target directory replaced after initial validation', async () => {
    const fixture = await makeAssetFixture('logo-reveal')
    const outsideDir = path.join(
      path.dirname(fixture.outputDir),
      'outside-output-race',
    )
    const outsideOutput = path.join(outsideDir, 'logo-reveal.json')
    const backupDir = path.join(
      path.dirname(fixture.outputDir),
      'original-output',
    )
    const replacementLink = path.join(
      path.dirname(fixture.outputDir),
      '.replacement-output-link',
    )
    await fs.mkdir(outsideDir)
    await fs.writeFile(outsideOutput, 'outside-sentinel\n', 'utf8')
    await fs.symlink(outsideDir, replacementLink)
    const canonicalTargetDir = await fs.realpath(fixture.outputDir)
    const originalLstat = fs.lstat
    let replaced = false
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      const stats = await originalLstat(...args)
      const [target] = args
      if (!replaced && path.resolve(target.toString()) === canonicalTargetDir) {
        replaced = true
        await fs.rename(fixture.outputDir, backupDir)
        await fs.rename(replacementLink, fixture.outputDir)
      }
      return stats
    })
    vi.resetModules()
    const { generateCatalogEntry: generateRaceEntry } = await import(
      './generate-catalog'
    )

    const error = await generateRaceEntry(
      'logo-reveal',
      fixture.commit,
      fixture.options,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )

    expect(replaced).toBe(true)
    expect.soft(error).toEqual(
      expect.objectContaining({
        message:
          'Output directory changed during access for slug "logo-reveal"',
      }),
    )
    expect(await fs.readFile(outsideOutput, 'utf8')).toBe('outside-sentinel\n')
  })

  it.each([
    '../escape',
    'nested/escape',
  ])('rejects invalid slug %s before building filesystem paths', async (slug) => {
    const fixture = await makeAssetFixture()

    await expect(
      generateCatalogEntry(slug, fixture.commit, fixture.options),
    ).rejects.toThrow(`Invalid catalog slug: ${JSON.stringify(slug)}`)
    await expect(
      fs.access(path.join(fixture.outputDir, `${slug}.json`)),
    ).rejects.toThrow()
  })

  it('does not follow a target directory symlink for a nested slug', async () => {
    const fixture = await makeAssetFixture('nested/escape')
    const outsideDir = path.join(path.dirname(fixture.outputDir), 'outside')
    await fs.mkdir(outsideDir)
    await fs.symlink(outsideDir, path.join(fixture.outputDir, 'nested'))

    await expect(
      generateCatalogEntry('nested/escape', fixture.commit, fixture.options),
    ).rejects.toThrow('Invalid catalog slug: "nested/escape"')
    await expect(
      fs.access(path.join(outsideDir, 'escape.json')),
    ).rejects.toThrow()
  })

  it('rejects a committed asset directory symlink before reading outside JSON', async () => {
    const fixture = await makeAssetFixture('logo-linked')
    const outsideDir = path.join(
      path.dirname(fixture.outputDir),
      'outside-asset',
    )
    await fs.mkdir(outsideDir)
    await fs.writeFile(
      path.join(outsideDir, 'remotionhub.asset.json'),
      '{"displayNameZh":',
      'utf8',
    )
    const assetDir = path.join(fixture.repo, 'remotion', 'logo-linked')
    await fs.rm(assetDir, { recursive: true })
    await fs.symlink(outsideDir, assetDir)
    commitAll(fixture.repo, 'replace asset directory with symlink')
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fixture.repo,
      encoding: 'utf8',
    }).trim()

    await expect(
      generateCatalogEntry('logo-linked', commit, fixture.options),
    ).rejects.toThrow(
      'Asset worktree path contains a symbolic link for slug "logo-linked"',
    )
    await expect(
      fs.access(path.join(fixture.outputDir, 'logo-linked.json')),
    ).rejects.toThrow()
  })

  it('rejects a committed manifest symlink before reading outside JSON', async () => {
    const fixture = await makeAssetFixture('logo-linked')
    const outsideManifest = path.join(
      path.dirname(fixture.outputDir),
      'outside-manifest.json',
    )
    await fs.writeFile(outsideManifest, '{"displayNameZh":', 'utf8')
    const manifestPath = path.join(
      fixture.repo,
      'remotion',
      'logo-linked',
      'remotionhub.asset.json',
    )
    await fs.rm(manifestPath)
    await fs.symlink(outsideManifest, manifestPath)
    commitAll(fixture.repo, 'replace manifest with symlink')
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fixture.repo,
      encoding: 'utf8',
    }).trim()

    await expect(
      generateCatalogEntry('logo-linked', commit, fixture.options),
    ).rejects.toThrow(
      'Asset worktree path contains a symbolic link for slug "logo-linked"',
    )
    await expect(
      fs.access(path.join(fixture.outputDir, 'logo-linked.json')),
    ).rejects.toThrow()
  })

  it('rejects a manifest replaced with an outside symlink after validation', async () => {
    const fixture = await makeAssetFixture('logo-race')
    const manifestPath = path.join(
      fixture.repo,
      'remotion',
      'logo-race',
      'remotionhub.asset.json',
    )
    const outsideManifest = path.join(
      path.dirname(fixture.outputDir),
      'outside-race-manifest.json',
    )
    const outsideData = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    outsideData.displayNameZh = 'outside-secret'
    await fs.writeFile(
      outsideManifest,
      `${JSON.stringify(outsideData)}\n`,
      'utf8',
    )
    const canonicalManifestPath = path.join(
      await fs.realpath(path.dirname(manifestPath)),
      path.basename(manifestPath),
    )
    const originalLstat = fs.lstat
    let replaced = false
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      const stats = await originalLstat(...args)
      const [target] = args
      if (
        !replaced &&
        path.resolve(target.toString()) === canonicalManifestPath
      ) {
        replaced = true
        await fs.rm(manifestPath)
        await fs.symlink(outsideManifest, manifestPath)
      }
      return stats
    })
    vi.resetModules()
    const { generateCatalogEntry: generateRaceEntry } = await import(
      './generate-catalog'
    )

    const error = await generateRaceEntry(
      'logo-race',
      fixture.commit,
      fixture.options,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )

    expect(replaced).toBe(true)
    expect(error).toEqual(
      expect.objectContaining({
        message:
          'Asset worktree manifest changed during access for slug "logo-race"',
      }),
    )
    expect(String(error)).not.toContain('outside-secret')
    await expect(
      fs.access(path.join(fixture.outputDir, 'logo-race.json')),
    ).rejects.toThrow()
  })

  it('rejects an intermediate directory replaced after manifest validation', async () => {
    const fixture = await makeAssetFixture('logo-race')
    const assetDir = path.join(fixture.repo, 'remotion', 'logo-race')
    const manifestPath = path.join(assetDir, 'remotionhub.asset.json')
    const outsideDir = path.join(
      path.dirname(fixture.outputDir),
      'outside-race-asset',
    )
    await fs.mkdir(outsideDir)
    const outsideData = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    outsideData.displayNameZh = 'outside-secret'
    await fs.writeFile(
      path.join(outsideDir, 'remotionhub.asset.json'),
      `${JSON.stringify(outsideData)}\n`,
      'utf8',
    )
    const canonicalManifestPath = path.join(
      await fs.realpath(path.dirname(manifestPath)),
      path.basename(manifestPath),
    )
    const originalLstat = fs.lstat
    let replaced = false
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      const stats = await originalLstat(...args)
      const [target] = args
      if (
        !replaced &&
        path.resolve(target.toString()) === canonicalManifestPath
      ) {
        replaced = true
        await fs.rm(assetDir, { recursive: true })
        await fs.symlink(outsideDir, assetDir)
      }
      return stats
    })
    vi.resetModules()
    const { generateCatalogEntry: generateRaceEntry } = await import(
      './generate-catalog'
    )

    const error = await generateRaceEntry(
      'logo-race',
      fixture.commit,
      fixture.options,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )

    expect(replaced).toBe(true)
    expect(error).toEqual(
      expect.objectContaining({
        message:
          'Asset worktree path contains a symbolic link for slug "logo-race"',
      }),
    )
    expect(String(error)).not.toContain('outside-secret')
    await expect(
      fs.access(path.join(fixture.outputDir, 'logo-race.json')),
    ).rejects.toThrow()
  })

  it('rejects a regular manifest atomically replaced after validation', async () => {
    const fixture = await makeAssetFixture('logo-race')
    const manifestPath = path.join(
      fixture.repo,
      'remotion',
      'logo-race',
      'remotionhub.asset.json',
    )
    const replacementPath = path.join(
      path.dirname(manifestPath),
      '.replacement-manifest.json',
    )
    const replacementData = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    replacementData.displayNameZh = 'malicious-marker'
    await fs.writeFile(
      replacementPath,
      `${JSON.stringify(replacementData)}\n`,
      'utf8',
    )
    const canonicalManifestPath = path.join(
      await fs.realpath(path.dirname(manifestPath)),
      path.basename(manifestPath),
    )
    const originalLstat = fs.lstat
    let replaced = false
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      const stats = await originalLstat(...args)
      const [target] = args
      if (
        !replaced &&
        path.resolve(target.toString()) === canonicalManifestPath
      ) {
        replaced = true
        await fs.rename(replacementPath, manifestPath)
      }
      return stats
    })
    vi.resetModules()
    const { generateCatalogEntry: generateRaceEntry } = await import(
      './generate-catalog'
    )

    const error = await generateRaceEntry(
      'logo-race',
      fixture.commit,
      fixture.options,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )
    const outputPath = path.join(fixture.outputDir, 'logo-race.json')
    let output = ''
    try {
      output = await fs.readFile(outputPath, 'utf8')
    } catch (reason) {
      if (
        !(
          reason instanceof Error &&
          'code' in reason &&
          reason.code === 'ENOENT'
        )
      ) {
        throw reason
      }
    }

    expect(replaced).toBe(true)
    expect.soft(error).toEqual(
      expect.objectContaining({
        message:
          'Asset worktree manifest changed during access for slug "logo-race"',
      }),
    )
    expect(output).not.toContain('malicious-marker')
    expect(output).toBe('')
  })

  it('rejects a pre-existing output symlink without changing its target', async () => {
    const fixture = await makeAssetFixture('logo-reveal')
    const sentinelPath = path.join(
      path.dirname(fixture.outputDir),
      'outside-sentinel.txt',
    )
    await fs.writeFile(sentinelPath, 'sentinel\n', 'utf8')
    await fs.symlink(
      sentinelPath,
      path.join(fixture.outputDir, 'logo-reveal.json'),
    )

    const error = await generateCatalogEntry(
      'logo-reveal',
      fixture.commit,
      fixture.options,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    )

    expect.soft(error).toEqual(
      expect.objectContaining({
        message: 'Output path is a symbolic link for slug "logo-reveal"',
      }),
    )
    expect(await fs.readFile(sentinelPath, 'utf8')).toBe('sentinel\n')
  })

  it('uses the worktree manifest unless a commit is explicitly pinned', async () => {
    const fixture = await makeAssetFixture()
    const manifestPath = path.join(
      fixture.repo,
      'remotion/logo-reveal/remotionhub.asset.json',
    )
    const worktreeManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    worktreeManifest.displayNameZh = 'Worktree Title'
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify(worktreeManifest, null, 2)}\n`,
      'utf8',
    )

    await generateCatalogEntry('logo-reveal', fixture.commit, fixture.options)
    const worktreeCatalog = await readGenerated(
      fixture.outputDir,
      'logo-reveal',
    )
    expect(worktreeCatalog.displayNameZh).toBe('Worktree Title')

    await generateCatalogEntry('logo-reveal', fixture.commit, {
      ...fixture.options,
      assetCommit: fixture.commit,
    })
    const pinnedCatalog = await readGenerated(fixture.outputDir, 'logo-reveal')
    expect(pinnedCatalog).toMatchObject({
      publisher: 'remotionlab',
      runtime: 'remotion',
      slug: 'logo-reveal',
      displayNameZh: '已提交标题',
      summaryZh: '已提交摘要',
      status: 'published',
      versions: [
        {
          metadata: {
            runtime: 'remotion',
            aspectRatios: ['16:9'],
            durationFrames: 90,
            fps: 30,
          },
          artifact: {
            githubSource: {
              commit: fixture.commit,
              path: 'remotion/logo-reveal',
            },
          },
        },
      ],
    })
    const outputPath = path.join(fixture.outputDir, 'logo-reveal.json')
    expect(await fs.readFile(outputPath, 'utf8')).toMatch(/\n$/)
    expect((await fs.stat(outputPath)).mode & 0o777).toBe(0o644)
  })

  it('trims a manifest display name and preserves preview and source metadata', async () => {
    const fixture = await makeAssetFixture('logo-reveal', {
      displayNameZh: '  Trimmed Title  ',
    })

    await generateCatalogEntry('logo-reveal', fixture.commit, fixture.options)

    const catalog = await readGenerated(fixture.outputDir, 'logo-reveal')
    expect(catalog.displayNameZh).toBe('Trimmed Title')
    expect(catalog.versions[0]).toMatchObject({
      preview: {
        thumbnailUrl: 'https://example.test/thumbnail.png',
        previewVideoUrl: 'https://example.test/preview.mp4',
        demoUrl: 'https://example.test/source',
      },
      metadata: {
        entryPoint: 'src/logo-reveal.tsx',
      },
      artifact: {
        license: 'MIT',
      },
    })
  })

  it('falls back to the Markdown title and a localized summary', async () => {
    const fixture = await makeAssetFixture('intro-card', {
      displayNameZh: '   ',
      summaryZh: '   ',
    })

    await generateCatalogEntry('intro-card', fixture.commit, fixture.options)

    expect(await readGenerated(fixture.outputDir, 'intro-card')).toMatchObject({
      displayNameZh: 'Markdown Title',
      summaryZh: '适用于 Remotion 的「Markdown Title」组件。',
    })
  })

  it('rejects a missing Markdown title', async () => {
    const fixture = await makeAssetFixture('intro-card', {
      displayNameZh: '',
    })
    await fs.writeFile(
      path.join(fixture.sourceMdDir, 'intro-card.md'),
      'No frontmatter title here.\n',
      'utf8',
    )

    await expect(
      generateCatalogEntry('intro-card', fixture.commit, fixture.options),
    ).rejects.toThrow('Title not found in intro-card.md')
  })

  it('rejects an asset path that is absent from the pinned commit', async () => {
    const fixture = await makeAssetFixture()

    await expect(
      generateCatalogEntry('missing-asset', fixture.commit, fixture.options),
    ).rejects.toThrow(
      `Asset path not found at commit ${fixture.commit}: remotion/missing-asset`,
    )
  })

  it('mentions runtime-assets.ts only when it exists at the pinned commit', async () => {
    const withRuntime = await makeAssetFixture('logo-runtime', {}, true)
    await generateCatalogEntry(
      'logo-runtime',
      withRuntime.commit,
      withRuntime.options,
    )
    const runtimeArtifact = (
      await readGenerated(withRuntime.outputDir, 'logo-runtime')
    ).versions[0].artifact
    expect(runtimeArtifact.usageMarkdown).toContain('runtime-assets.ts')
    expect(runtimeArtifact.agentPrompt).toContain(
      'Copy both the component file and runtime-assets.ts.',
    )

    const withoutRuntime = await makeAssetFixture('logo-static', {}, false)
    await generateCatalogEntry(
      'logo-static',
      withoutRuntime.commit,
      withoutRuntime.options,
    )
    const staticArtifact = (
      await readGenerated(withoutRuntime.outputDir, 'logo-static')
    ).versions[0].artifact
    expect(staticArtifact.usageMarkdown).not.toContain('runtime-assets.ts')
    expect(staticArtifact.agentPrompt).not.toContain('runtime-assets.ts')
  })

  it.each([
    ['audio-arcade', 'audio', 'retro'],
    ['logo-avatar', 'logo', 'personal'],
    ['transition-glitch', 'transition', 'creative'],
    ['intro-simple', 'intro', 'minimal'],
    ['outro-clean', 'outro', 'minimal'],
    ['dataviz-report', 'dataviz', 'business'],
    ['social-facebook', 'social', 'social'],
    ['yt-pulse', 'animation', 'creative'],
    ['misc-unknown', 'other', 'minimal'],
  ])('maps %s to the %s category and the expected tag group', async (slug, category, tag) => {
    const fixture = await makeAssetFixture(slug)

    await generateCatalogEntry(slug, fixture.commit, fixture.options)

    const catalog = await readGenerated(fixture.outputDir, slug)
    expect(catalog.categories).toEqual([category])
    expect(catalog.tags).toContain(tag)
    expect(catalog.versions[0].tags).toEqual(catalog.tags)
    if (slug === 'misc-unknown') {
      expect(catalog.tags).toEqual(['minimal'])
    }
  })
})

describe('resolveAssetCommit', () => {
  it('resolves symbolic refs to immutable commit SHAs', async () => {
    const repo = await makeGitRepo()
    const expected = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()

    expect(resolveAssetCommit(repo, 'HEAD')).toBe(expected)
    expect(resolveAssetCommit(repo, 'HEAD')).toMatch(/^[0-9a-f]{40}$/)
  })

  it('rejects dirty asset repositories before resolving refs', async () => {
    const repo = await makeGitRepo()
    await fs.writeFile(path.join(repo, 'dirty.txt'), 'dirty\n', 'utf8')

    expect(() => resolveAssetCommit(repo, 'HEAD')).toThrow(
      /uncommitted changes/i,
    )
  })

  it('rejects refs that begin with an option marker', async () => {
    const repo = await makeGitRepo()
    let error: unknown

    try {
      resolveAssetCommit(repo, '--path-format=absolute')
    } catch (reason) {
      error = reason
    }

    expect(error).toMatchObject({
      status: 128,
      stderr: expect.stringContaining('Needed a single revision'),
    })
    expect((error as { stderr: string }).stderr).not.toContain(
      'unknown argument to --path-format',
    )
  })
})
