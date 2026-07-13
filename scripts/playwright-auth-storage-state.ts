import type { BrowserContextOptions } from '@playwright/test'

export type StorageState = Exclude<
  BrowserContextOptions['storageState'],
  string | undefined
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cookieMatchesHost(domain: string, hostname: string) {
  const normalizedDomain = domain.replace(/^\./, '')
  return (
    hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)
  )
}

function hasTargetAuthenticationMaterial(
  state: StorageState,
  targetUrl: string,
) {
  const target = new URL(targetUrl)
  const now = Date.now() / 1000
  const hasCurrentCookie = state.cookies.some(
    (cookie) =>
      cookieMatchesHost(cookie.domain, target.hostname) &&
      (cookie.expires === -1 || cookie.expires > now),
  )
  const hasTargetStorage = state.origins.some(
    (origin) =>
      origin.origin === target.origin && origin.localStorage.length > 0,
  )
  return hasCurrentCookie || hasTargetStorage
}

function isStorageState(value: unknown): value is StorageState {
  if (!isRecord(value) || !Array.isArray(value.cookies) || !Array.isArray(value.origins)) {
    return false
  }

  const cookiesAreValid = value.cookies.every(
    (cookie) =>
      isRecord(cookie) &&
      typeof cookie.name === 'string' &&
      typeof cookie.value === 'string' &&
      typeof cookie.domain === 'string' &&
      typeof cookie.path === 'string' &&
      typeof cookie.expires === 'number' &&
      typeof cookie.httpOnly === 'boolean' &&
      typeof cookie.secure === 'boolean' &&
      ['Strict', 'Lax', 'None'].includes(String(cookie.sameSite)),
  )
  const originsAreValid = value.origins.every(
    (origin) =>
      isRecord(origin) &&
      typeof origin.origin === 'string' &&
      Array.isArray(origin.localStorage) &&
      origin.localStorage.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.name === 'string' &&
          typeof entry.value === 'string',
      ),
  )
  const hasAuthMaterial =
    value.cookies.length > 0 ||
    value.origins.some(
      (origin) =>
        isRecord(origin) &&
        Array.isArray(origin.localStorage) &&
        origin.localStorage.length > 0,
    )

  return cookiesAreValid && originsAreValid && hasAuthMaterial
}

export function readAuthStorageState(
  value = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE_JSON,
  targetUrl?: string,
): StorageState | undefined {
  if (!value) return undefined

  try {
    const parsed: unknown = JSON.parse(value)
    if (!isStorageState(parsed)) return undefined
    if (targetUrl && !hasTargetAuthenticationMaterial(parsed, targetUrl)) {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}
