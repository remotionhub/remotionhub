// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserBootstrap } from './UserBootstrap'

const mocks = vi.hoisted(() => ({
  useAuthStatus: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useMutation: mocks.useMutation,
}))

vi.mock('#/lib/useAuthStatus', () => ({
  bootstrapUsersApi: {
    users: {
      ensure: 'users.ensure',
    },
  },
  useAuthStatus: mocks.useAuthStatus,
}))

describe('UserBootstrap', () => {
  const ensureUser = vi.fn()

  beforeEach(() => {
    ensureUser.mockReset()
    ensureUser.mockResolvedValue({ publisherId: 'publishers:1' })
    mocks.useMutation.mockReset()
    mocks.useMutation.mockReturnValue(ensureUser)
    mocks.useAuthStatus.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('triggers ensure once for an authenticated user', async () => {
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1' },
    })

    render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(1)
    })
    expect(ensureUser).toHaveBeenCalledWith({})
  })

  it('does not retrigger for the same user id across rerenders', async () => {
    let currentStatus = {
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1' },
    }
    mocks.useAuthStatus.mockImplementation(() => currentStatus)

    const view = render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(1)
    })

    currentStatus = {
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1' },
    }
    view.rerender(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(1)
    })
  })

  it('retriggers when the authenticated user id changes', async () => {
    let currentStatus = {
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1' },
    }
    mocks.useAuthStatus.mockImplementation(() => currentStatus)

    const view = render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(1)
    })

    currentStatus = {
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:2' },
    }
    view.rerender(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).toHaveBeenCalledTimes(2)
    })
  })

  it('does not trigger while signed out', async () => {
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      me: null,
    })

    render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).not.toHaveBeenCalled()
    })
  })

  it('does not trigger while auth state is loading', async () => {
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
      me: undefined,
    })

    render(<UserBootstrap />)

    await waitFor(() => {
      expect(ensureUser).not.toHaveBeenCalled()
    })
  })
})
