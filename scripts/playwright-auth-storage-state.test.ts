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

  it('accepts structurally valid material without guessing session validity', () => {
    expect(readAuthStorageState(expiredCookieState)).toBeDefined()
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
      ),
    ).toBeDefined()
  })
})
