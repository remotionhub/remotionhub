// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/components/I18nProvider'
import { LOCALE_STORAGE_KEY } from '#/lib/i18n'
import CatalogCard from './CatalogCard'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params: { owner: string; slug: string }
    children: React.ReactNode
  }) => (
    <a href={to.replace('$owner', params.owner).replace('$slug', params.slug)} {...props}>
      {children}
    </a>
  ),
}))

const item = {
  runtime: 'remotion' as const,
  ownerHandle: 'terence',
  slug: 'card-avatar',
  displayName: 'Card Avatar',
  summary: 'Animated avatar lower-third card for Remotion videos.',
  tags: ['personal', 'minimal'],
  categories: ['card'],
  latestVersionSummary: {
    version: '1.0.0',
    preview: { thumbnailUrl: 'https://example.com/thumb.jpg' },
    metadata: { aspectRatios: ['16:9'] },
  },
}

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

describe('CatalogCard', () => {
  beforeEach(() => {
    installLocalStorage()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('renders an image-first card with compact badges', () => {
    render(
      <I18nProvider>
        <CatalogCard item={item} />
      </I18nProvider>,
    )

    const link = screen.getByRole('link', { name: /Card Avatar/ })
    expect(link.getAttribute('href')).toBe('/remotion/terence/card-avatar')
    expect(screen.getByRole('img', { name: /Card Avatar/ })).toBeTruthy()
    expect(screen.queryByText('Animated avatar lower-third card for Remotion videos.')).toBeNull()
    expect(screen.getByText('remotion')).toBeTruthy()
    expect(screen.getByText('个人')).toBeTruthy()
    expect(screen.getByText('极简')).toBeTruthy()
  })

  it('renders localized display names for Chinese locale', () => {
    render(
      <I18nProvider>
        <CatalogCard item={{ ...item, displayNameZh: '头像卡片' }} />
      </I18nProvider>,
    )

    expect(screen.getByRole('link', { name: /头像卡片/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /头像卡片/ })).toBeTruthy()
    expect(screen.queryByText('Card Avatar')).toBeNull()
  })

  it('keeps English display names for English locale', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')

    render(
      <I18nProvider>
        <CatalogCard item={{ ...item, displayNameZh: '头像卡片' }} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Card Avatar/ })).toBeTruthy()
    })
    expect(screen.queryByText('头像卡片')).toBeNull()
  })
})
