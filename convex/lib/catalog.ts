import semver from 'semver'
import type { Doc, Id } from '../_generated/dataModel'

export function isActiveStatus(status: Doc<'components'>['status']) {
  return status === 'published'
}

export function isPrereleaseVersion(version: string) {
  return semver.prerelease(version) !== null
}

export function chooseLatestVersionDoc(
  versions: Array<Pick<Doc<'componentVersions'>, '_id' | 'version' | 'createdAt'>>,
) {
  const stable = versions.filter(
    (version) => semver.prerelease(version.version) === null,
  )
  const candidates = stable.length > 0 ? stable : versions
  if (candidates.length === 0) {
    return null
  }

  const sorted = [...candidates].sort((left, right) =>
    semver.rcompare(left.version, right.version),
  )
  const latest = sorted[0]
  if (!latest) {
    return null
  }

  return {
    versionId: latest._id,
    version: latest.version,
    latestIsPrerelease: stable.length === 0,
  }
}

export function buildLatestVersionSummary(version: Doc<'componentVersions'>) {
  return {
    version: version.version,
    createdAt: version.createdAt,
    changelog: version.changelog,
    preview: version.preview,
    metadata: version.metadata,
  }
}

export function buildDigestDoc(args: {
  component: Doc<'components'>
  publisher: Doc<'publishers'>
  latestVersion: Doc<'componentVersions'>
}) {
  return {
    componentId: args.component._id as Id<'components'>,
    runtime: args.component.runtime,
    ownerHandle: args.publisher.handle,
    slug: args.component.slug,
    displayName: args.component.displayName,
    summary: args.component.summary,
    latestVersionSummary: buildLatestVersionSummary(args.latestVersion),
    latestIsPrerelease: args.component.latestIsPrerelease ?? false,
    tags: args.component.tags,
    categories: args.component.categories,
    preview: args.latestVersion.preview,
    status: args.component.status,
    isActive: args.component.isActive,
    updatedAt: args.component.updatedAt,
  }
}
