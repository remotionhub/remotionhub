import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.*s')
const importSecret = 'test-import-secret'

const component = {
  importSecret,
  publisher: 'terence',
  publisherDisplayName: 'Terence',
  runtime: 'remotion' as const,
  slug: 'card-avatar',
  displayName: 'Card Avatar',
  summary: 'Animated avatar lower-third card for Remotion videos.',
  categories: ['card'],
  tags: ['remotion', 'avatar', 'profile'],
  status: 'published' as const,
  catalogFile: 'catalog/components/card-avatar.json',
  versions: [
    {
      version: '1.0.2',
      changelog: 'Publish publicly readable OSS preview media.',
      preview: {
        thumbnailUrl: 'https://example.com/thumb.jpg',
        previewVideoUrl: 'https://example.com/preview.mp4',
        demoUrl: 'https://example.com/demo',
      },
      metadata: {
        runtime: 'remotion' as const,
        entryPoint: 'src/CardAvatar.tsx',
        aspectRatios: ['16:9'],
        durationFrames: 120,
        fps: 30,
      },
      tags: ['avatar', 'profile'],
      fingerprint: 'fingerprint-102',
      artifact: {
        kind: 'github-source' as const,
        githubSource: {
          repo: 'remotionhub/remotionhub-assets',
          ref: 'main',
          commit: '48f2401399f8e68ef2f8e04403d407102d0251a8',
          path: 'remotion/card-avatar',
          pinned: true,
        },
        license: 'MIT',
        usageMarkdown: 'Copy the component into your project.',
        agentPrompt: 'Add the Card Avatar.',
      },
    },
  ],
}

describe('components catalog mutations and queries', () => {
  beforeEach(() => {
    process.env.CATALOG_IMPORT_SECRET = importSecret
  })

  afterEach(() => {
    delete process.env.CATALOG_IMPORT_SECRET
  })

  it('rejects catalog imports without a matching server secret', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.components.importCatalogComponent, {
        ...component,
        importSecret: 'wrong-secret',
      }),
    ).rejects.toThrow(/Invalid catalog import secret/)
  })

  it('imports a published component and exposes it in listCatalog', async () => {
    const t = convexTest(schema, modules)

    const result = await t.mutation(
      api.components.importCatalogComponent,
      component,
    )
    expect(result.createdVersions).toBe(1)

    const page = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      paginationOpts: { numItems: 10, cursor: null },
    })

    expect(page.page).toHaveLength(1)
    expect(page.page[0]?.slug).toBe('card-avatar')
  })

  it('returns localized catalog fields from list and detail queries', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.components.importCatalogComponent, {
      ...component,
      displayNameZh: '头像卡片',
      summaryZh: '适用于 Remotion 视频的头像卡片。',
    })

    const page = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      paginationOpts: { numItems: 10, cursor: null },
    })
    const detail = await t.query(api.components.getCatalogDetail, {
      runtime: 'remotion',
      owner: 'terence',
      slug: 'card-avatar',
    })

    expect(page.page[0]?.displayNameZh).toBe('头像卡片')
    expect(page.page[0]?.summaryZh).toBe('适用于 Remotion 视频的头像卡片。')
    expect(detail?.component.displayNameZh).toBe('头像卡片')
    expect(detail?.component.summaryZh).toBe('适用于 Remotion 视频的头像卡片。')
  })

  it('is idempotent for identical version fingerprints', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.components.importCatalogComponent, component)
    const result = await t.mutation(
      api.components.importCatalogComponent,
      component,
    )

    expect(result.createdVersions).toBe(0)
    expect(result.skippedVersions).toBe(1)
  })

  it('rejects immutable version conflicts', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.components.importCatalogComponent, component)

    await expect(
      t.mutation(api.components.importCatalogComponent, {
        ...component,
        versions: [
          { ...component.versions[0], fingerprint: 'changed-fingerprint' },
        ],
      }),
    ).rejects.toThrow(/Immutable version conflict/)
  })

  it('keeps prerelease from replacing stable latest', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.components.importCatalogComponent, {
      ...component,
      versions: [
        component.versions[0],
        {
          ...component.versions[0],
          version: '2.0.0-alpha.1',
          fingerprint: 'fingerprint-200-alpha',
        },
      ],
    })

    const detail = await t.query(api.components.getCatalogDetail, {
      runtime: 'remotion',
      owner: 'terence',
      slug: 'card-avatar',
    })

    expect(detail?.selectedVersion.version).toBe('1.0.2')
    expect(detail?.component.latestIsPrerelease).toBe(false)
  })

  it('allows unlisted detail but hides it from listCatalog', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.components.importCatalogComponent, {
      ...component,
      status: 'unlisted',
    })

    const page = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      paginationOpts: { numItems: 10, cursor: null },
    })
    const detail = await t.query(api.components.getCatalogDetail, {
      runtime: 'remotion',
      owner: 'terence',
      slug: 'card-avatar',
    })

    expect(page.page).toHaveLength(0)
    expect(detail?.component.slug).toBe('card-avatar')
  })

  it('correctly filters sparsely matched items across multiple DB pagination pages', async () => {
    const t = convexTest(schema, modules)

    // Insert 5 components. Only the first and last have tag "special".
    // Others do not have the "special" tag.
    for (let i = 1; i <= 5; i++) {
      await t.mutation(api.components.importCatalogComponent, {
        ...component,
        slug: `comp-${i}`,
        displayName: `Component ${i}`,
        tags: i === 1 || i === 5 ? ['special', 'remotion'] : ['remotion'],
        versions: [
          {
            ...component.versions[0],
            fingerprint: `fingerprint-${i}`,
          },
        ],
      })
    }

    // Call listCatalog with a small page size (numItems: 1) and filter by special tag
    const firstPage = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      tags: ['special'],
      paginationOpts: { numItems: 1, cursor: null },
    })

    expect(firstPage.page).toHaveLength(1)
    expect(firstPage.page[0]?.slug).toBe('comp-5') // desc by updated, so last inserted comes first
    expect(firstPage.isDone).toBe(false)

    const secondPage = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      tags: ['special'],
      paginationOpts: { numItems: 1, cursor: firstPage.continueCursor },
    })

    expect(secondPage.page).toHaveLength(1)
    expect(secondPage.page[0]?.slug).toBe('comp-1')
  })

  it('caps filtered results to the requested page size when matches span batches', async () => {
    const t = convexTest(schema, modules)

    for (let i = 1; i <= 5; i++) {
      await t.mutation(api.components.importCatalogComponent, {
        ...component,
        slug: `cap-comp-${i}`,
        displayName: `Cap Component ${i}`,
        tags: [2, 3, 5].includes(i)
          ? ['special', 'remotion']
          : ['remotion'],
        versions: [
          {
            ...component.versions[0],
            fingerprint: `cap-fingerprint-${i}`,
          },
        ],
      })
    }

    const page = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      tags: ['special'],
      paginationOpts: { numItems: 2, cursor: null },
    })

    expect(page.page).toHaveLength(2)
    expect(page.page.map((item) => item.slug)).toEqual([
      'cap-comp-5',
      'cap-comp-3',
    ])
    expect(page.isDone).toBe(false)
  })

  it('correctly sorts active components by name', async () => {
    const t = convexTest(schema, modules)

    // Insert B, then A, then C
    const items = [
      { slug: 'b-comp', name: 'Beta Component' },
      { slug: 'a-comp', name: 'Alpha Component' },
      { slug: 'c-comp', name: 'Gamma Component' },
    ]

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      await t.mutation(api.components.importCatalogComponent, {
        ...component,
        slug: item.slug,
        displayName: item.name,
        versions: [
          {
            ...component.versions[0],
            fingerprint: `fingerprint-${item.slug}`,
          },
        ],
      })
    }

    const sortedPage = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      sort: 'name',
      paginationOpts: { numItems: 10, cursor: null },
    })

    const names = sortedPage.page.map((item) => item.displayName)
    // Should be sorted alphabetically (ascending): Alpha Component, Beta Component, Gamma Component, and the default one if present.
    // Let's filter only the components we inserted here to be safe and clean.
    const relevantNames = names.filter((name) =>
      ['Alpha Component', 'Beta Component', 'Gamma Component'].includes(name),
    )
    expect(relevantNames).toEqual([
      'Alpha Component',
      'Beta Component',
      'Gamma Component',
    ])
  })

  it('uses runtime-aware indexes for updated and name sorting', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.components.importCatalogComponent, {
      ...component,
      slug: 'runtime-remotion-beta',
      displayName: 'Runtime Beta',
      versions: [
        {
          ...component.versions[0],
          fingerprint: 'runtime-remotion-beta-fingerprint',
        },
      ],
    })
    await t.mutation(api.components.importCatalogComponent, {
      ...component,
      slug: 'runtime-remotion-alpha',
      displayName: 'Runtime Alpha',
      versions: [
        {
          ...component.versions[0],
          fingerprint: 'runtime-remotion-alpha-fingerprint',
        },
      ],
    })
    await t.mutation(api.components.importCatalogComponent, {
      ...component,
      runtime: 'hyperframes',
      slug: 'runtime-hyperframes-alpha',
      displayName: 'Runtime HyperFrames Alpha',
      versions: [
        {
          ...component.versions[0],
          metadata: {
            ...component.versions[0].metadata,
            runtime: 'hyperframes',
          },
          fingerprint: 'runtime-hyperframes-alpha-fingerprint',
        },
      ],
    })

    const updatedPage = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      paginationOpts: { numItems: 10, cursor: null },
    })
    const namePage = await t.query(api.components.listCatalog, {
      runtime: 'remotion',
      sort: 'name',
      paginationOpts: { numItems: 10, cursor: null },
    })

    expect(updatedPage.page.every((item) => item.runtime === 'remotion')).toBe(
      true,
    )
    expect(updatedPage.page.map((item) => item.slug)).not.toContain(
      'runtime-hyperframes-alpha',
    )
    expect(namePage.page.map((item) => item.displayName)).toEqual([
      'Runtime Alpha',
      'Runtime Beta',
    ])
  })
})
