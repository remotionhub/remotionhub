export function sanitizeRelativeRedirect(value: string | null | undefined) {
  if (!value) return '/'
  const trimmed = value.trim()
  if (!trimmed) return '/'
  if (/[\\\u0000-\u001F\u007F]/.test(trimmed)) return '/'
  if (/%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i.test(trimmed)) return '/'
  if (!trimmed.startsWith('/')) return '/'
  if (trimmed.startsWith('//')) return '/'
  return trimmed
}

export function getCurrentRelativeUrl() {
  if (typeof window === 'undefined') return '/'
  return sanitizeRelativeRedirect(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
}
