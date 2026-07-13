import { describe, expect, it } from 'vitest'
import { readAuthStorageState } from './playwright-auth-storage-state'

const expiredCookieState = JSON.stringify({
  cookies: [
    {
      name: 'session',
      value: 'expired',
      domain: '127.0.0.1',
      path: '/',
      expires: 1,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ],
  origins: [],
})

const currentCookieState = JSON.stringify({
  cookies: [
    {
      name: 'session',
      value: 'current',
      domain: '127.0.0.1',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ],
  origins: [],
})

describe('readAuthStorageState', () => {
  it('rejects malformed JSON', () => {
    expect(readAuthStorageState('{')).toBeUndefined()
  })

  it('rejects a storage state without authentication material', () => {
    expect(
      readAuthStorageState(JSON.stringify({ cookies: [], origins: [] })),
    ).toBeUndefined()
    expect(
      readAuthStorageState(
        JSON.stringify({
          cookies: [],
          origins: [
            { origin: 'http://127.0.0.1:4173', localStorage: [] },
          ],
        }),
      ),
    ).toBeUndefined()
  })

  it('rejects expired authentication cookies', () => {
    expect(
      readAuthStorageState(expiredCookieState, 'http://127.0.0.1:4173'),
    ).toBeUndefined()
  })

  it('rejects authentication material for a different target host', () => {
    expect(
      readAuthStorageState(currentCookieState, 'http://localhost:4173'),
    ).toBeUndefined()
  })

  it('accepts current authentication material for the target deployment', () => {
    expect(
      readAuthStorageState(currentCookieState, 'http://127.0.0.1:4173'),
    ).toBeDefined()
    expect(
      readAuthStorageState(
        JSON.stringify({
          cookies: [],
          origins: [
            {
              origin: 'http://127.0.0.1:4173',
              localStorage: [{ name: 'session', value: 'opaque' }],
            },
          ],
        }),
        'http://127.0.0.1:4173',
      ),
    ).toBeDefined()
  })
})
