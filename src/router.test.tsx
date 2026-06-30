import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createTanStackRouter, routeTree, router } = vi.hoisted(() => ({
  createTanStackRouter: vi.fn(),
  routeTree: { id: 'generated-route-tree' },
  router: { id: 'router' },
}))

vi.mock('@tanstack/react-router', () => ({
  createRouter: createTanStackRouter,
}))
vi.mock('./routeTree.gen', () => ({ routeTree }))

import { getRouter } from './router'

describe('getRouter', () => {
  beforeEach(() => {
    createTanStackRouter.mockReset().mockReturnValue(router)
  })

  it('creates and returns the configured TanStack router', () => {
    expect(getRouter()).toBe(router)
    expect(createTanStackRouter).toHaveBeenCalledWith({
      routeTree,
      scrollRestoration: true,
      defaultPreload: 'intent',
      defaultPreloadStaleTime: 0,
    })
  })
})
