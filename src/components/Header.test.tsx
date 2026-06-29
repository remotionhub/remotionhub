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
    expect(screen.getByRole('link', { name: 'Go to RemotionHub GitHub' })).toBeTruthy()
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

  it('points to the correct GitHub repository', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    renderHeader()
    const githubLink = screen.getByRole('link', { name: 'Go to RemotionHub GitHub' })
    expect(githubLink.getAttribute('href')).toBe('https://github.com/remotionhub/remotionhub')
  })
})
