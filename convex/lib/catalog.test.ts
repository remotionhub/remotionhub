import { describe, expect, it } from 'vitest'
import type { Doc, Id } from '../_generated/dataModel'
import {
  buildDigestDoc,
  buildLatestVersionSummary,
  chooseLatestVersionDoc,
  isActiveStatus,
  isPrereleaseVersion,
} from './catalog'

const componentId = 'component-id' as Id<'components'>
const publisherId = 'publisher-id' as Id<'publishers'>
const versionId = 'version-id' as Id<'componentVersions'>

function version(
  value: string,
  id = versionId,
): Pick<Doc<'componentVersions'>, '_id' | 'version' | 'createdAt'> {
  return { _id: id, version: value, createdAt: 100 }
}

const latestVersion = {
  _id: versionId,
  _creationTime: 100,
  componentId,
  version: '2.0.0',
  changelog: 'Stable release',
  preview: { thumbnailUrl: 'https://example.com/preview.jpg' },
  metadata: {
    runtime: 'remotion',
    entryPoint: 'src/index.tsx',
    aspectRatios: ['16:9'],
    durationFrames: 90,
    fps: 30,
  },
  sourceProvenance: {
    catalogFile: 'catalog/component.json',
    importedAt: 90,
    fingerprint: 'fingerprint',
  },
  tags: ['animation'],
  isPrerelease: false,
  fingerprint: 'fingerprint',
  createdAt: 100,
  updatedAt: 100,
} satisfies Doc<'componentVersions'>

describe('catalog domain helpers', () => {
  it('only considers published components active', () => {
    expect(isActiveStatus('published')).toBe(true)
    expect(isActiveStatus('draft')).toBe(false)
    expect(isActiveStatus('unlisted')).toBe(false)
    expect(isActiveStatus('removed')).toBe(false)
  })

  it('distinguishes stable versions from prereleases', () => {
    expect(isPrereleaseVersion('1.2.3')).toBe(false)
    expect(isPrereleaseVersion('1.2.3-beta.1')).toBe(true)
  })

  it('returns null when no versions are available', () => {
    expect(chooseLatestVersionDoc([])).toBeNull()
  })

  it('prefers the highest stable semver over newer prereleases', () => {
    const stableId = 'stable-id' as Id<'componentVersions'>

    expect(
      chooseLatestVersionDoc([
        version('2.0.0-beta.1'),
        version('1.4.0', stableId),
        version('1.3.9'),
      ]),
    ).toEqual({
      versionId: stableId,
      version: '1.4.0',
      latestIsPrerelease: false,
    })
  })

  it('uses the highest prerelease when no stable version exists', () => {
    const newestId = 'newest-id' as Id<'componentVersions'>

    expect(
      chooseLatestVersionDoc([
        version('2.0.0-alpha.1'),
        version('2.0.0-beta.2', newestId),
      ]),
    ).toEqual({
      versionId: newestId,
      version: '2.0.0-beta.2',
      latestIsPrerelease: true,
    })
  })

  it('builds the public latest-version summary', () => {
    expect(buildLatestVersionSummary(latestVersion)).toEqual({
      version: '2.0.0',
      createdAt: 100,
      changelog: 'Stable release',
      preview: latestVersion.preview,
      metadata: latestVersion.metadata,
    })
  })

  it('builds a search digest and defaults missing prerelease state to false', () => {
    const component = {
      _id: componentId,
      _creationTime: 80,
      runtime: 'remotion',
      publisherId,
      slug: 'animated-title',
      displayName: 'Animated Title',
      summary: 'An animated title.',
      categories: ['intro'],
      tags: ['animation'],
      status: 'published',
      isActive: true,
      stats: { views: 0, downloads: 0, stars: 0 },
      createdAt: 80,
      updatedAt: 100,
    } satisfies Doc<'components'>
    const publisher = {
      _id: publisherId,
      _creationTime: 70,
      handle: 'terence',
      displayName: 'Terence',
      createdAt: 70,
      updatedAt: 70,
    } satisfies Doc<'publishers'>

    expect(buildDigestDoc({ component, publisher, latestVersion })).toEqual({
      componentId,
      runtime: 'remotion',
      ownerHandle: 'terence',
      slug: 'animated-title',
      displayName: 'Animated Title',
      displayNameZh: undefined,
      summary: 'An animated title.',
      summaryZh: undefined,
      latestVersionSummary: buildLatestVersionSummary(latestVersion),
      latestIsPrerelease: false,
      tags: ['animation'],
      categories: ['intro'],
      preview: latestVersion.preview,
      status: 'published',
      isActive: true,
      updatedAt: 100,
    })
  })
})
