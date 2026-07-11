import type { BrowserContextOptions } from '@playwright/test'

export type StorageState = Exclude<
  BrowserContextOptions['storageState'],
  string | undefined
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
): StorageState | undefined {
  if (!value) return undefined

  try {
    const parsed: unknown = JSON.parse(value)
    return isStorageState(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}
