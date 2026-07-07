const MAX_HANDLE_LENGTH = 39
const MIN_HANDLE_LENGTH = 2

export function normalizeHandleCandidate(value: string | null | undefined) {
  if (!value) return null

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_HANDLE_LENGTH)
    .replace(/-+$/g, '')

  if (normalized.length < MIN_HANDLE_LENGTH) return null
  return normalized
}

export function fallbackHandleForUserId(userId: string) {
  const suffix = userId.replace(/^[^:]+:/, '').replace(/[^a-zA-Z0-9]/g, '')
  return `user-${suffix.slice(0, 8).toLowerCase()}`
}
