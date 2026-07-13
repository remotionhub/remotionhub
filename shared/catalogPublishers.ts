export const CATALOG_PUBLISHER_HANDLES = [
  'crispynotfound',
  'dilumsanjaya',
  'edwinarbus',
  'gaucho-booleano',
  'ghumare64',
  'gogheng',
  'harisshah2345',
  'jnybgr',
  'pasrom',
  'remotion',
  'remotionlab',
  'samohovets',
  'shpigford',
  'terence',
  'tiw-ari-ayu',
  'wiedymi',
] as const

const catalogPublisherHandles = new Set<string>(CATALOG_PUBLISHER_HANDLES)

export function isCatalogPublisherHandle(handle: string) {
  return catalogPublisherHandles.has(handle)
}
