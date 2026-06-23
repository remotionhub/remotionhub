// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_STORAGE_KEY } from '#/lib/i18n'
import { I18nProvider } from '#/components/I18nProvider'
import CatalogFilters from './CatalogFilters'

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

describe('CatalogFilters', () => {
  beforeEach(() => {
    installLocalStorage()
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('filters by category and exposes tags as read-only hints', async () => {
    const onCategoryChange = vi.fn()

    render(
      <I18nProvider>
        <CatalogFilters
          categories={[
            { value: 'transition', label: 'transition', count: 17 },
            { value: 'title', label: 'title', count: 8 },
          ]}
          tags={[
            { value: 'minimal', label: 'minimal' },
            { value: 'social', label: 'social' },
          ]}
          selectedCategory={undefined}
          onCategoryChange={onCategoryChange}
        />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Transition (17)' }))

    expect(onCategoryChange).toHaveBeenCalledWith('transition')
    expect(screen.getByText('Tags')).toBeTruthy()
    expect(screen.getByText('minimal').tagName).toBe('SPAN')
    expect(screen.queryByText('All tags')).toBeNull()
    expect(screen.queryByRole('button', { name: 'minimal' })).toBeNull()
  })

  it('clears the category filter when all is selected', async () => {
    const onCategoryChange = vi.fn()

    render(
      <I18nProvider>
        <CatalogFilters
          categories={[{ value: 'transition', label: 'transition', count: 17 }]}
          tags={[]}
          selectedCategory="transition"
          onCategoryChange={onCategoryChange}
        />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'All' }))

    expect(onCategoryChange).toHaveBeenCalledWith(undefined)
  })
})
