// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_STORAGE_KEY } from '#/lib/i18n'
import Header from './Header'
import { I18nProvider } from './I18nProvider'

const authMocks = vi.hoisted(() => ({
  useAuthStatus: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    activeProps: _activeProps,
    ...props
  }: {
    to: string
    children: React.ReactNode
    activeProps?: unknown
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('#/lib/useAuthStatus', () => ({
  useAuthStatus: authMocks.useAuthStatus,
}))

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({
    signIn: authMocks.signIn,
    signOut: authMocks.signOut,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: authMocks.toastError,
  },
}))

function installLocalStorage() {
  const values = new Map<string, string>()
  const storage = {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  } satisfies Storage

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

function renderHeader() {
  render(
    <I18nProvider>
      <Header />
    </I18nProvider>,
  )
}

describe('Header', () => {
  beforeEach(() => {
    installLocalStorage()
    authMocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      me: null,
    })
    authMocks.signIn.mockReset()
    authMocks.signOut.mockReset()
    authMocks.toastError.mockReset()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders navigation and global controls by default', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    renderHeader()

    await screen.findByRole('link', { name: 'Catalog' })
    expect(screen.getByRole('link', { name: 'Catalog' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Remotion' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'HyperFrames' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /theme mode: light/i })).toBeTruthy()
  })

  it('switches to English and persists the selected locale', async () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'EN' }))

    await waitFor(() => {
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    })
    expect(screen.getByRole('link', { name: 'Catalog' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy()
  })

  it('starts GitHub sign-in with the current relative URL', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    window.history.pushState(null, '', '/remotion?tag=card#top')
    authMocks.signIn.mockResolvedValue({ signingIn: true })
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

    await waitFor(() => {
      expect(authMocks.signIn).toHaveBeenCalledWith('github', {
        redirectTo: '/remotion?tag=card#top',
      })
    })
  })

  it('reports sign-in failures without changing the auth state', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    window.history.pushState(null, '', '/remotion?tag=card#top')
    authMocks.signIn.mockRejectedValue(new Error('sign-in failed'))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

    await waitFor(() => {
      expect(authMocks.toastError).toHaveBeenCalledWith('Sign in failed. Please try again.')
    })
    expect(authMocks.signIn).toHaveBeenCalledWith('github', {
      redirectTo: '/remotion?tag=card#top',
    })
    expect(screen.getByRole('button', { name: 'Sign in with GitHub' })).toBeTruthy()
  })

  it('shows a stable auth loading skeleton', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      me: undefined,
    })

    renderHeader()

    const skeleton = screen.getByLabelText('Loading auth state')
    expect(skeleton).toBeTruthy()
    expect(skeleton.className).toContain('inline-block')
  })

  it('shows the signed-in user and signs out', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.useAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: {
        _id: 'users:1',
        handle: 'octocat',
        name: 'Octocat',
        image: 'https://example.com/avatar.png',
      },
    })
    authMocks.signOut.mockResolvedValue(undefined)

    renderHeader()

    expect(screen.getByRole('group', { name: 'Signed in as octocat' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(authMocks.signOut).toHaveBeenCalled()
    })
  })
})
