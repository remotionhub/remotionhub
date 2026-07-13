import type { Doc } from '../_generated/dataModel'

export function hasStudioRemixRuntime(
  componentRuntime: Doc<'components'>['runtime'],
  versionRuntime: Doc<'componentVersions'>['metadata']['runtime'],
) {
  return componentRuntime === 'remotion' && versionRuntime === 'remotion'
}

export function isStudioRemixAvailable<
  TBundle extends Pick<Doc<'studioBundles'>, 'status'>,
>(
  component: Pick<Doc<'components'>, 'isActive' | 'runtime' | 'status'>,
  version: Pick<Doc<'componentVersions'>, 'metadata'>,
  bundle: TBundle | null,
): bundle is TBundle {
  return (
    component.status === 'published' &&
    component.isActive &&
    hasStudioRemixRuntime(component.runtime, version.metadata.runtime) &&
    bundle?.status === 'validated'
  )
}
