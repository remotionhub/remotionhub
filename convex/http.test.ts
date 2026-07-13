import { describe, expect, it } from 'vitest'

describe('convex http router', () => {
  it('loads the auth http router module', async () => {
    await expect(import('./http')).resolves.toMatchObject({
      default: expect.anything(),
    })
  })

  it('registers OAuth sign-in and callback routes for both providers', async () => {
    const { default: http } = await import('./http')

    for (const provider of ['github', 'wechat']) {
      expect(http.lookup(`/api/auth/signin/${provider}`, 'GET')?.slice(1)).toEqual(
        ['GET', '/api/auth/signin/*'],
      )
      expect(
        http.lookup(`/api/auth/callback/${provider}`, 'GET')?.slice(1),
      ).toEqual(['GET', '/api/auth/callback/*'])
      expect(
        http.lookup(`/api/auth/callback/${provider}`, 'POST')?.slice(1),
      ).toEqual(['POST', '/api/auth/callback/*'])
    }
  })
})
