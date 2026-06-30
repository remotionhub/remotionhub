import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildVersionFingerprint, catalogComponentSchema } from '../shared/catalog'
import {
  type ImportCatalogClient,
  type ImportCatalogDependencies,
  loadLocalEnv,
  parseArgs,
  readCatalogFiles,
  runImportCatalog,
  runImportCatalogCli,
  toImportPayload,
} from './import-catalog'

const temporaryDirectories: string[] = []

async function createTemporaryDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'import-catalog-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  )
})

function createCatalogComponent(overrides: Record<string, unknown> = {}) {
  return catalogComponentSchema.parse({
    publisher: 'remotionlab',
    runtime: 'remotion',
    slug: 'scene-card',
    displayName: 'Scene Card',
    displayNameZh: 'Scene Card Zh',
    summary: 'An animated scene card.',
    summaryZh: 'An animated scene card in Chinese.',
    categories: ['card'],
    tags: ['minimal'],
    status: 'published',
    versions: [
      {
        version: '1.0.0',
        changelog: 'Initial release.',
        preview: {
          thumbnailUrl: 'https://example.com/thumbnail.jpg',
        },
        metadata: {
          runtime: 'remotion',
          entryPoint: 'src/SceneCard.tsx',
          aspectRatios: ['16:9'],
          durationFrames: 120,
          fps: 30,
        },
        tags: ['minimal'],
        artifact: {
          kind: 'github-source',
          githubSource: {
            repo: 'remotionhub/remotionhub-assets',
            ref: 'main',
            commit: 'abc123',
            path: 'remotion/scene-card',
          },
          license: 'MIT',
          usageMarkdown: 'Copy the component into your project.',
          agentPrompt: 'Add the scene card to my project.',
        },
      },
    ],
    ...overrides,
  })
}

function createDependencies(
  overrides: Partial<ImportCatalogDependencies> = {},
) {
  const mutation = vi.fn<ImportCatalogClient['mutation']>(
    async () => ({
      createdVersions: 1,
      skippedVersions: 0,
    }),
  )
  const logs: string[] = []
  const dependencies: ImportCatalogDependencies = {
    env: {},
    loadEnv: vi.fn(async () => undefined),
    readFiles: vi.fn(async () => [
      {
        filePath: '/catalog/scene-card.json',
        json: createCatalogComponent(),
      },
    ]),
    createClient: vi.fn(() => ({ mutation })),
    log: (message) => logs.push(message),
    ...overrides,
  }

  return { dependencies, logs, mutation }
}

describe('parseArgs', () => {
  it('defaults to a dev dry-run', () => {
    expect(parseArgs([])).toEqual({
      apply: false,
      dryRun: true,
      localOnly: false,
      target: 'dev',
    })
  })

  it('parses a production apply', () => {
    expect(parseArgs(['--apply', '--target=production'])).toEqual({
      apply: true,
      dryRun: false,
      localOnly: false,
      target: 'production',
    })
  })

  it('keeps explicit dry-run and local-only safety flags with apply', () => {
    expect(parseArgs(['--apply', '--dry-run', '--local-only'])).toEqual({
      apply: true,
      dryRun: true,
      localOnly: true,
      target: 'dev',
    })
  })
})

describe('loadLocalEnv', () => {
  it('parses supported lines without overriding existing values', async () => {
    const directory = await createTemporaryDirectory()
    const envPath = path.join(directory, '.env.local')
    await fs.writeFile(
      envPath,
      [
        '',
        '# comment',
        'MALFORMED',
        'PLAIN=value',
        'SINGLE=\'single quoted\'',
        'DOUBLE="double quoted"',
        'PRESERVED=file value',
      ].join('\n'),
    )
    const env: NodeJS.ProcessEnv = { PRESERVED: 'existing value' }

    await loadLocalEnv(env, envPath)

    expect(env).toEqual({
      PRESERVED: 'existing value',
      PLAIN: 'value',
      SINGLE: 'single quoted',
      DOUBLE: 'double quoted',
    })
  })

  it('ignores a missing env file', async () => {
    const directory = await createTemporaryDirectory()
    await expect(
      loadLocalEnv({}, path.join(directory, 'missing.env')),
    ).resolves.toBeUndefined()
  })

  it('propagates file errors other than ENOENT', async () => {
    const directory = await createTemporaryDirectory()
    await expect(loadLocalEnv({}, directory)).rejects.toMatchObject({
      code: expect.not.stringMatching(/^ENOENT$/),
    })
  })
})

describe('readCatalogFiles', () => {
  it('reads only JSON files in lexical order', async () => {
    const directory = await createTemporaryDirectory()
    await Promise.all([
      fs.writeFile(path.join(directory, 'z-last.json'), '{"slug":"last"}'),
      fs.writeFile(path.join(directory, 'a-first.json'), '{"slug":"first"}'),
      fs.writeFile(path.join(directory, 'ignored.txt'), '{"slug":"ignored"}'),
    ])

    const files = await readCatalogFiles(directory)

    expect(files).toEqual([
      {
        filePath: path.join(directory, 'a-first.json'),
        json: { slug: 'first' },
      },
      {
        filePath: path.join(directory, 'z-last.json'),
        json: { slug: 'last' },
      },
    ])
  })
})

describe('toImportPayload', () => {
  it('maps publisher display names and version fingerprints', () => {
    const remotionLab = createCatalogComponent()
    const publisher = createCatalogComponent({ publisher: 'terence' })

    const remotionLabPayload = toImportPayload(
      remotionLab,
      '/catalog/remotionlab.json',
      'secret',
    )
    const publisherPayload = toImportPayload(
      publisher,
      '/catalog/terence.json',
      'secret',
    )

    expect(remotionLabPayload.publisherDisplayName).toBe('RemotionLab')
    expect(publisherPayload.publisherDisplayName).toBe('@terence')
    expect(remotionLabPayload.versions[0]?.fingerprint).toBe(
      buildVersionFingerprint(remotionLab.versions[0]),
    )
  })

  it('keeps githubSource absent for source-free artifacts', () => {
    const component = createCatalogComponent({
      versions: [
        {
          version: '1.0.0',
          changelog: 'Initial release.',
          preview: {},
          metadata: {
            runtime: 'remotion',
            aspectRatios: ['16:9'],
          },
          tags: [],
          artifact: {
            kind: 'none',
            license: 'MIT',
            usageMarkdown: 'Use the component directly.',
            agentPrompt: 'Create a scene card.',
          },
        },
      ],
    })

    const payload = toImportPayload(component, '/catalog/no-source.json', '')

    expect(payload.versions[0]?.artifact.githubSource).toBeUndefined()
  })

  it.each([
    ['abc123', true],
    ['0123456789abcdef0123456789abcdef01234567', true],
    ['zzzzzz', false],
    ['0123456789abcdef0123456789abcdef012345678', false],
  ])('marks github commit %s pinned as %s', (commit, pinned) => {
    const base = createCatalogComponent()
    const version = base.versions[0]
    if (!version?.artifact.githubSource) {
      throw new Error('Expected github source fixture.')
    }
    const component = createCatalogComponent({
      versions: [
        {
          ...version,
          artifact: {
            ...version.artifact,
            githubSource: { ...version.artifact.githubSource, commit },
          },
        },
      ],
    })

    const payload = toImportPayload(component, '/catalog/source.json', '')

    expect(payload.versions[0]?.artifact.githubSource).toMatchObject({
      commit,
      pinned,
    })
  })
})

describe('runImportCatalog', () => {
  it('runs without configuration as a dry-run and preserves validation logs', async () => {
    const { dependencies, logs } = createDependencies()

    await runImportCatalog([], dependencies)

    expect(dependencies.loadEnv).toHaveBeenCalledOnce()
    expect(dependencies.createClient).not.toHaveBeenCalled()
    expect(logs).toEqual([
      'Validated 1 catalog component(s).',
      '- remotion/remotionlab/scene-card: 1 version(s)',
      'Dry-run complete. No Convex writes performed.',
    ])
  })

  it('requires a Convex URL for writes', async () => {
    const { dependencies } = createDependencies({
      env: { CATALOG_IMPORT_SECRET: 'secret' },
    })

    await expect(
      runImportCatalog(['--apply'], dependencies),
    ).rejects.toThrow('CONVEX_URL or VITE_CONVEX_URL is required for --apply.')
    expect(dependencies.readFiles).not.toHaveBeenCalled()
  })

  it('requires an import secret for writes', async () => {
    const { dependencies } = createDependencies({
      env: { CONVEX_URL: 'https://example.convex.cloud' },
    })

    await expect(
      runImportCatalog(['--apply'], dependencies),
    ).rejects.toThrow('CATALOG_IMPORT_SECRET is required for --apply.')
    expect(dependencies.readFiles).not.toHaveBeenCalled()
  })

  it('requires a deploy key for production writes', async () => {
    const { dependencies } = createDependencies({
      env: {
        CONVEX_URL: 'https://example.convex.cloud',
        CATALOG_IMPORT_SECRET: 'secret',
      },
    })

    await expect(
      runImportCatalog(['--apply', '--target=production'], dependencies),
    ).rejects.toThrow('CONVEX_DEPLOY_KEY is required for production imports.')
    expect(dependencies.readFiles).not.toHaveBeenCalled()
  })

  it('reads write configuration after loadEnv mutates the dependency env', async () => {
    const env: NodeJS.ProcessEnv = {}
    const { dependencies, mutation } = createDependencies({
      env,
      loadEnv: vi.fn(async () => {
        env.CONVEX_URL = 'https://loaded.convex.cloud'
        env.CATALOG_IMPORT_SECRET = 'loaded-secret'
      }),
    })

    await runImportCatalog(['--apply'], dependencies)

    expect(dependencies.createClient).toHaveBeenCalledWith(
      'https://loaded.convex.cloud',
    )
    expect(mutation).toHaveBeenCalledOnce()
    expect(mutation.mock.calls[0]?.[1]).toMatchObject({
      importSecret: 'loaded-secret',
    })
  })

  it.each([
    ['explicit dry-run', ['--apply', '--dry-run']],
    ['local-only', ['--apply', '--local-only']],
  ])('does not create a client in %s mode', async (_name, argv) => {
    const { dependencies } = createDependencies()

    await runImportCatalog(argv, dependencies)

    expect(dependencies.createClient).not.toHaveBeenCalled()
  })

  it('imports every payload in file order and preserves result logs', async () => {
    const first = createCatalogComponent({ slug: 'a-first' })
    const second = createCatalogComponent({
      publisher: 'terence',
      slug: 'z-last',
    })
    const { dependencies, logs, mutation } = createDependencies({
      env: {
        CONVEX_URL: 'https://example.convex.cloud',
        CATALOG_IMPORT_SECRET: 'secret',
      },
      readFiles: vi.fn(async () => [
        { filePath: '/catalog/a-first.json', json: first },
        { filePath: '/catalog/z-last.json', json: second },
      ]),
    })

    await runImportCatalog(['--apply'], dependencies)

    expect(dependencies.createClient).toHaveBeenCalledOnce()
    expect(dependencies.createClient).toHaveBeenCalledWith(
      'https://example.convex.cloud',
    )
    expect(mutation).toHaveBeenCalledTimes(2)
    expect(mutation.mock.calls.map((call) => call[1])).toMatchObject([
      { catalogFile: '/catalog/a-first.json', slug: 'a-first' },
      { catalogFile: '/catalog/z-last.json', slug: 'z-last' },
    ])
    expect(logs).toContain(
      'Imported remotion/remotionlab/a-first: 1 created, 0 skipped',
    )
    expect(logs).toContain(
      'Imported remotion/terence/z-last: 1 created, 0 skipped',
    )
  })

  it('stops importing after the first mutation failure', async () => {
    const failure = new Error('first mutation failed')
    const { dependencies, mutation } = createDependencies({
      env: {
        CONVEX_URL: 'https://example.convex.cloud',
        CATALOG_IMPORT_SECRET: 'secret',
      },
      readFiles: vi.fn(async () => [
        {
          filePath: '/catalog/a-first.json',
          json: createCatalogComponent({ slug: 'a-first' }),
        },
        {
          filePath: '/catalog/z-last.json',
          json: createCatalogComponent({ slug: 'z-last' }),
        },
      ]),
    })
    mutation.mockRejectedValueOnce(failure)

    await expect(runImportCatalog(['--apply'], dependencies)).rejects.toBe(
      failure,
    )
    expect(mutation).toHaveBeenCalledOnce()
  })

  it('propagates catalog validation errors without success logs', async () => {
    const { dependencies, logs } = createDependencies({
      readFiles: vi.fn(async () => [
        { filePath: '/catalog/invalid.json', json: { slug: 'invalid' } },
      ]),
    })

    await expect(runImportCatalog([], dependencies)).rejects.toThrow()
    expect(logs).toEqual([])
  })
})

describe('runImportCatalogCli', () => {
  it('leaves process exit state unchanged after a successful import', async () => {
    const originalExitCode = process.exitCode
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    const { dependencies } = createDependencies()

    try {
      process.exitCode = undefined
      await runImportCatalogCli([], dependencies)

      expect(error).not.toHaveBeenCalled()
      expect(exit).not.toHaveBeenCalled()
      expect(process.exitCode).toBeUndefined()
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('reports failures through exitCode without calling process.exit', async () => {
    const originalExitCode = process.exitCode
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    const failure = new Error('catalog import failed')
    const { dependencies } = createDependencies({
      loadEnv: vi.fn(async () => {
        throw failure
      }),
    })

    try {
      process.exitCode = undefined
      await runImportCatalogCli([], dependencies)

      expect(error).toHaveBeenCalledWith(failure)
      expect(exit).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(1)
    } finally {
      process.exitCode = originalExitCode
    }
  })
})
