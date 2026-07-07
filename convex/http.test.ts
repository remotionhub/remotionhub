import { describe, expect, it } from 'vitest'

describe('convex http router', () => {
  it('loads the auth http router module', async () => {
    await expect(import('./http')).resolves.toMatchObject({
      default: expect.anything(),
    })
  })
})
