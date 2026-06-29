import { describe, expect, it } from 'vitest'
import {
  buildVersionFingerprint,
  catalogComponentSchema,
  chooseLatestVersion,
  componentSlugPattern,
  publisherHandlePattern,
} from './catalog'

const baseVersion = {
  version: '1.0.0',
  changelog: 'Initial release.',
  preview: {
    thumbnailUrl: 'https://example.com/thumb.jpg',
    previewVideoUrl: 'https://example.com/preview.mp4',
    demoUrl: 'https://example.com/demo',
  },
  metadata: {
    runtime: 'remotion',
    entryPoint: 'src/Scene.tsx',
    aspectRatios: ['16:9'],
    durationFrames: 180,
    fps: 30,
  },
  artifact: {
    kind: 'github-source',
    githubSource: {
      repo: 'remotionhub/remotionhub-assets',
      ref: 'v1.0.0',
      commit: 'abc123',
      path: 'components/scene',
    },
    license: 'MIT',
    usageMarkdown: 'Copy the component into your Remotion project.',
    agentPrompt: 'Add this Remotion component to my project.',
  },
}

describe('catalog validation', () => {
  it('accepts a valid Remotion component declaration', () => {
    const parsed = catalogComponentSchema.parse({
      publisher: 'terence',
      runtime: 'remotion',
      slug: 'card-avatar',
      displayName: 'Card Avatar',
      summary: 'Animated avatar lower-third card for Remotion videos.',
      categories: ['card'],
      tags: ['personal', 'minimal'],
      status: 'published',
      versions: [baseVersion],
    })

    expect(parsed.slug).toBe('card-avatar')
  })

  it('accepts only the canonical RemotionHub asset repository for migrated source', () => {
    const parsed = catalogComponentSchema.parse({
      publisher: 'terence',
      runtime: 'remotion',
      slug: 'card-avatar',
      displayName: 'Card Avatar',
      summary: 'Animated avatar lower-third card for Remotion videos.',
      categories: ['card', 'lower-third'],
      tags: ['personal', 'minimal'],
      status: 'published',
      versions: [
        {
          ...baseVersion,
          artifact: {
            ...baseVersion.artifact,
            githubSource: {
              repo: 'remotionhub/remotionhub-assets',
              ref: 'main',
              commit: 'abc123def456',
              path: 'remotion/card-avatar',
            },
          },
        },
      ],
    })

    expect(parsed.versions[0]?.artifact.githubSource?.repo).toBe(
      'remotionhub/remotionhub-assets',
    )
    expect(() =>
      catalogComponentSchema.parse({
        publisher: 'terence',
        runtime: 'remotion',
        slug: 'card-avatar',
        displayName: 'Card Avatar',
        summary: 'Animated avatar lower-third card for Remotion videos.',
        categories: ['card', 'lower-third'],
        tags: ['personal', 'minimal'],
        status: 'published',
        versions: [
          {
            ...baseVersion,
            artifact: {
              ...baseVersion.artifact,
              githubSource: {
                repo: 'tangwz/remotionhub-assets',
                ref: 'main',
                commit: 'abc123def456',
                path: 'remotion/card-avatar',
              },
            },
          },
        ],
      }),
    ).toThrow()
  })

  it('accepts optional entryPoint and kind none artifacts', () => {
    const parsed = catalogComponentSchema.parse({
      publisher: 'terence',
      runtime: 'remotion',
      slug: 'prompt-only',
      displayName: 'Prompt Only',
      summary: 'A component with no github source.',
      categories: ['card'],
      versions: [
        {
          ...baseVersion,
          metadata: {
            ...baseVersion.metadata,
            entryPoint: undefined,
          },
          artifact: {
            kind: 'none',
            license: 'MIT',
            usageMarkdown: 'Use directly.',
            agentPrompt: 'Helpful prompt.',
          },
        },
      ],
    })

    expect(parsed.versions[0]?.metadata.entryPoint).toBeUndefined()
    expect(parsed.versions[0]?.artifact.kind).toBe('none')
    expect(parsed.versions[0]?.artifact.githubSource).toBeUndefined()
  })

  it('rejects kind github-source if githubSource is missing', () => {
    expect(() =>
      catalogComponentSchema.parse({
        publisher: 'terence',
        runtime: 'remotion',
        slug: 'prompt-only',
        displayName: 'Prompt Only',
        summary: 'A component with missing githubSource.',
        categories: ['card'],
        versions: [
          {
            ...baseVersion,
            artifact: {
              kind: 'github-source',
              license: 'MIT',
              usageMarkdown: 'Use directly.',
              agentPrompt: 'Helpful prompt.',
            },
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects unsafe publisher handles and slugs', () => {
    expect(publisherHandlePattern.test('terence')).toBe(true)
    expect(publisherHandlePattern.test('Terence')).toBe(false)
    expect(componentSlugPattern.test('intro-pack')).toBe(true)
    expect(componentSlugPattern.test('intro pack')).toBe(false)
  })

  it('rejects http preview URLs outside local fixtures', () => {
    expect(() =>
      catalogComponentSchema.parse({
        publisher: 'terence',
        runtime: 'remotion',
        slug: 'bad-preview',
        displayName: 'Bad Preview',
        summary: 'Invalid preview URL.',
        categories: ['title'],
        tags: ['minimal'],
        status: 'published',
        versions: [
          {
            ...baseVersion,
            preview: {
              ...baseVersion.preview,
              thumbnailUrl: 'http://example.com/thumb.jpg',
            },
          },
        ],
      }),
    ).toThrow()
  })

  it('chooses stable latest over higher prerelease versions', () => {
    const latest = chooseLatestVersion([
      { version: '1.2.0', createdAt: 1 },
      { version: '2.0.0-alpha.1', createdAt: 2 },
    ])

    expect(latest).toEqual({ version: '1.2.0', latestIsPrerelease: false })
  })

  it('uses highest prerelease only when no stable version exists', () => {
    const latest = chooseLatestVersion([
      { version: '2.0.0-alpha.1', createdAt: 1 },
      { version: '2.0.0-beta.1', createdAt: 2 },
    ])

    expect(latest).toEqual({ version: '2.0.0-beta.1', latestIsPrerelease: true })
  })

  it('sorts semver in memory instead of lexically', () => {
    const latest = chooseLatestVersion([
      { version: '1.2.0', createdAt: 1 },
      { version: '1.10.0', createdAt: 2 },
    ])

    expect(latest).toEqual({ version: '1.10.0', latestIsPrerelease: false })
  })

  it('produces stable fingerprints for immutable version content', () => {
    const left = buildVersionFingerprint(baseVersion)
    const right = buildVersionFingerprint({
      ...baseVersion,
      artifact: { ...baseVersion.artifact },
    })

    expect(left).toBe(right)
  })
})
