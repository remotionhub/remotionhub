// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStatus } from './useAuthStatus'

const mocks = vi.hoisted(() => ({
  useConvexAuth: vi.fn(),
  useQuery: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: mocks.useConvexAuth,
  useQuery: mocks.useQuery,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: {
      me: 'users.me',
    },
  },
}))

function Probe() {
  return <pre>{JSON.stringify(useAuthStatus())}</pre>
}

describe('useAuthStatus', () => {
  afterEach(() => {
    cleanup()
    mocks.useConvexAuth.mockReset()
    mocks.useQuery.mockReset()
  })

  it('returns loading while Convex auth is loading', () => {
    mocks.useConvexAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    })
    mocks.useQuery.mockReturnValue(undefined)

    render(<Probe />)

    expect(screen.getByText('{"isAuthenticated":false,"isLoading":true}')).toBeTruthy()
    expect(mocks.useQuery).toHaveBeenCalledWith('users.me', 'skip')
  })

  it('returns signed out when auth is resolved without a session', () => {
    mocks.useConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    })

    render(<Probe />)

    expect(
      screen.getByText('{"isAuthenticated":false,"isLoading":false,"me":null}'),
    ).toBeTruthy()
    expect(mocks.useQuery).toHaveBeenCalledWith('users.me', 'skip')
  })

  it('returns loading while the current user query is unresolved', () => {
    mocks.useConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    })
    mocks.useQuery.mockReturnValue(undefined)

    render(<Probe />)

    expect(screen.getByText('{"isAuthenticated":true,"isLoading":true}')).toBeTruthy()
    expect(mocks.useQuery).toHaveBeenCalledWith('users.me', {})
  })

  it('returns the current user when authenticated', () => {
    const me = { _id: 'users:1', handle: 'wechat-user' }
    mocks.useConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    })
    mocks.useQuery.mockReturnValue(me)

    render(<Probe />)

    expect(
      screen.getByText(JSON.stringify({ isAuthenticated: true, isLoading: false, me })),
    ).toBeTruthy()
  })
})
