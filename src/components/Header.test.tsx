// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_STORAGE_KEY } from '#/lib/i18n'
import Header from './Header'
import { I18nProvider } from './I18nProvider'

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

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
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
    installMatchMedia()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders Chinese navigation and language controls by default', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: '目录' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Remotion' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'HyperFrames' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: '打开 RemotionHub GitHub' }),
    ).toBeTruthy()
    expect(screen.getByRole('group', { name: '语言' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '中文' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy()
    expect(
      Array.from(screen.getByRole('group', { name: '语言' }).children).map(
        (child) => child.tagName,
      ),
    ).toEqual(['BUTTON', 'BUTTON'])
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
})
