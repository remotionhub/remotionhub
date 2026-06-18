import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.*s')

const component = {
  publisher: 'terence',
  publisherDisplayName: 'Terence',
  runtime: 'remotion' as const,
  slug: 'kinetic-title-pack',
  displayName: 'Kinetic Title Pack',
  summary: 'Reusable Remotion title animations.',
  categories: ['title'],
  tags: ['remotion', 'text'],
  status: 'published' as const,
  catalogFile: 'catalog/components/kinetic-title-pack.json',
  versions: [
    {
      version: '1.0.0',
      changelog: 'Initial release.',
      preview: {
        thumbnailUrl: 'https://example.com/thumb.jpg',
        previewVideoUrl: 'https://example.com/preview.mp4',
        demoUrl: 'https://example.com/demo',
      },
      metadata: {
        runtime: 'remotion' as const,
        entryPoint: 'src/Scene.tsx',
        aspectRatios: ['16:9'],
        durationFrames: 180,
        fps: 30,
      },
      tags: ['text'],
      fingerprint: 'fingerprint-100',
      artifact: {
        kind: 'github-source' as const,
        githubSource: {
          repo: 'tangwz/remotionhub-assets',
          ref: 'v1.0.0',
          commit: 'abc123',
          path: 'components/scene',
          pinned: true,
        },
        license: 'MIT',
        usageMarkdown: 'Copy the component folder into your project.',
        agentPrompt: 'Add the Kinetic Title Pack.',
      },
    },
  ],
}

describe('components catalog mutations and queries', () => {
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
    expect(page.page[0]?.slug).toBe('kinetic-title-pack')
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
      slug: 'kinetic-title-pack',
    })

    expect(detail?.selectedVersion.version).toBe('1.0.0')
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
      slug: 'kinetic-title-pack',
    })

    expect(page.page).toHaveLength(0)
    expect(detail?.component.slug).toBe('kinetic-title-pack')
  })
})
