export function sanitizeRelativeRedirect(value: string | null | undefined) {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export function getCurrentRelativeUrl() {
  if (typeof window === 'undefined') return '/'
  return sanitizeRelativeRedirect(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
}
