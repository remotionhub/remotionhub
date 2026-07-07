// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserBootstrap } from './UserBootstrap'

const mocks = vi.hoisted(() => ({
  useAuthStatus: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useMutation: mocks.useMutation,
}))

vi.mock('#/lib/useAuthStatus', () => ({
  useAuthStatus: mocks.useAuthStatus,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: {
      ensure: 'users.ensure',
    },
  },
}))

describe('UserBootstrap', () => {
  afterEach(() => {
    cleanup()
    mocks.useAuthStatus.mockReset()
    mocks.useMutation.mockReset()
  })

  it('does not call ensure while auth is loading', async () => {
    const ensureUser = vi.fn().mockResolvedValue(undefined)
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      me: undefined,
    })
    mocks.useMutation.mockReturnValue(ensureUser)

    render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).not.toHaveBeenCalled()
    })
  })

  it('does not call ensure when signed out', async () => {
    const ensureUser = vi.fn().mockResolvedValue(undefined)
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      me: null,
    })
    mocks.useMutation.mockReturnValue(ensureUser)

    render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).not.toHaveBeenCalled()
    })
  })

  it('calls ensure when authenticated with me === null', async () => {
    const ensureUser = vi.fn().mockResolvedValue(undefined)
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: null,
    })
    mocks.useMutation.mockReturnValue(ensureUser)

    render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledWith({})
    })
  })

  it('calls ensure when authenticated with a user object', async () => {
    const ensureUser = vi.fn().mockResolvedValue(undefined)
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1', handle: 'wechat-user' },
    })
    mocks.useMutation.mockReturnValue(ensureUser)

    render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledWith({})
    })
  })

  it('bootstraps again after signing out and signing in as another user', async () => {
    const ensureUser = vi.fn().mockResolvedValue(undefined)
    const authState: {
      isAuthenticated: boolean
      isLoading: boolean
      me: { _id: string; handle: string } | null
    } = {
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1', handle: 'wechat-user-1' },
    }
    mocks.useAuthStatus.mockImplementation(() => authState)
    mocks.useMutation.mockReturnValue(ensureUser)

    const view = render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(1)
    })

    view.rerender(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(1)
    })

    authState.isAuthenticated = false
    authState.me = null
    view.rerender(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(1)
    })

    authState.isAuthenticated = true
    authState.me = { _id: 'users:2', handle: 'wechat-user-2' }
    view.rerender(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(2)
      expect(ensureUser).toHaveBeenNthCalledWith(2, {})
    })
  })
})
