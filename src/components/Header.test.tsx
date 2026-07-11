// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  return render(
    <I18nProvider>
      <Header />
    </I18nProvider>,
  )
}

function firePageShow(persisted: boolean) {
  const event = new Event('pageshow')
  Object.defineProperty(event, 'persisted', { value: persisted })
  fireEvent(window, event)
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

  it('opens one provider-neutral login dialog from the header', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    renderHeader()

    const trigger = screen.getByRole('button', { name: 'Log in' })
    expect(screen.queryByRole('button', { name: 'Sign in with GitHub' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Log in with WeChat' })).toBeNull()

    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Log in to RemotionHub' })
    expect(dialog).toBeTruthy()
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(screen.getByRole('button', { name: 'Sign in with GitHub' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log in with WeChat' })).toBeTruthy()
  })

  it.each([
    ['github', 'Sign in with GitHub'],
    ['wechat', 'Log in with WeChat'],
  ] as const)('starts %s sign-in from the dialog', async (provider, label) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    window.history.pushState(null, '', '/remotion?tag=card#top')
    authMocks.signIn.mockResolvedValue({ signingIn: true })
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: label }))

    await waitFor(() => {
      expect(authMocks.signIn).toHaveBeenCalledWith(provider, {
        redirectTo: '/remotion?tag=card#top',
      })
    })
  })

  it('disables both providers while OAuth is starting', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.signIn.mockReturnValue(new Promise(() => {}))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

    expect(
      screen.getByRole('button', { name: 'Sign in with GitHub' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('keeps provider mutual exclusion after closing and reopening during OAuth startup', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.signIn.mockReturnValue(new Promise(() => {}))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in with WeChat' }))

    expect(authMocks.signIn).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Sign in with GitHub' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('restores provider controls when returning from OAuth history', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.signIn.mockReturnValue(new Promise(() => {}))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
    firePageShow(true)

    expect(
      screen.getByRole('button', { name: 'Sign in with GitHub' }).hasAttribute('disabled'),
    ).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled'),
    ).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Log in with WeChat' }))
    expect(authMocks.signIn).toHaveBeenCalledTimes(2)
  })

  it('keeps provider controls pending during the initial page show', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.signIn.mockReturnValue(new Promise(() => {}))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
    firePageShow(false)
    fireEvent.click(screen.getByRole('button', { name: 'Log in with WeChat' }))

    expect(authMocks.signIn).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Sign in with GitHub' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('ignores a stale OAuth rejection after starting another provider', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    let rejectFirstSignIn: ((reason: Error) => void) | undefined
    authMocks.signIn
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirstSignIn = reject
          }),
      )
      .mockReturnValueOnce(new Promise(() => {}))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
    firePageShow(true)
    fireEvent.click(screen.getByRole('button', { name: 'Log in with WeChat' }))
    await act(async () => {
      rejectFirstSignIn?.(new Error('cancelled GitHub sign-in'))
    })

    expect(authMocks.toastError).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('ignores an OAuth rejection from an unmounted header instance', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    let rejectFirstSignIn: ((reason: Error) => void) | undefined
    authMocks.signIn
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirstSignIn = reject
          }),
      )
      .mockReturnValueOnce(new Promise(() => {}))

    const firstHeader = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
    firstHeader.unmount()

    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in with WeChat' }))
    await act(async () => {
      rejectFirstSignIn?.(new Error('cancelled GitHub sign-in'))
    })

    expect(authMocks.toastError).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('cycles focus within the login dialog', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    const closeButton = screen.getByRole('button', { name: 'Close' })
    const weChatButton = screen.getByRole('button', { name: 'Log in with WeChat' })

    closeButton.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(weChatButton)

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)
  })

  it('isolates the page while the login dialog is open and restores it on close', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    renderHeader()

    const appRoot = document.body.firstElementChild
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(appRoot?.hasAttribute('inert')).toBe(true)
    expect(appRoot?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(appRoot?.hasAttribute('inert')).toBe(false)
    expect(appRoot?.hasAttribute('aria-hidden')).toBe(false)
  })

  it('restores provider controls after OAuth startup fails', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.signIn.mockRejectedValue(new Error('sign-in failed'))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

    await waitFor(() => {
      expect(authMocks.toastError).toHaveBeenCalledWith('Sign in failed. Please try again.')
      expect(screen.getByRole('alert').textContent).toBe('Sign in failed. Please try again.')
    })
    expect(
      screen.getByRole('button', { name: 'Sign in with GitHub' }).hasAttribute('disabled'),
    ).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled'),
    ).toBe(false)
  })

  it('clears the sign-in failure before retrying', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.signIn.mockRejectedValueOnce(new Error('sign-in failed')).mockReturnValueOnce(new Promise(() => {}))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

    const error = await screen.findByRole('alert')
    expect(error.textContent).toBe('Sign in failed. Please try again.')

    fireEvent.click(screen.getByRole('button', { name: 'Log in with WeChat' }))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears the sign-in failure when reopening the dialog', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.signIn.mockRejectedValue(new Error('sign-in failed'))
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('closes on Escape and restores focus to the header trigger', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    renderHeader()

    const trigger = screen.getByRole('button', { name: 'Log in' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Log in to RemotionHub' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes with the close button and backdrop', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Log in to RemotionHub' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByTestId('auth-dialog-overlay'))
    expect(screen.queryByRole('dialog', { name: 'Log in to RemotionHub' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Log in' }))
  })

  it('keeps the login dialog open when a provider button is clicked', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.signIn.mockResolvedValue({ signingIn: true })
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    const dialog = screen.getByRole('dialog', { name: 'Log in to RemotionHub' })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

    expect(screen.getByRole('dialog', { name: 'Log in to RemotionHub' })).toBe(dialog)
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
