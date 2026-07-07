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
})
