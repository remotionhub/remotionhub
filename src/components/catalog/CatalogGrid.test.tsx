// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/components/I18nProvider'
import { LOCALE_STORAGE_KEY } from '#/lib/i18n'
import CatalogGrid from './CatalogGrid'

const loadMore = vi.fn()
let queryState: {
  results: Array<{
    componentId: string
    runtime: 'remotion' | 'hyperframes'
    ownerHandle: string
    slug: string
    displayName: string
    summary: string
    tags: string[]
    categories: string[]
    latestVersionSummary: {
      version: string
      preview: { thumbnailUrl?: string; previewVideoUrl?: string }
      metadata: { aspectRatios: string[] }
    }
  }>
  status:
    | 'LoadingFirstPage'
    | 'LoadingMore'
    | 'CanLoadMore'
    | 'Exhausted'
  loadMore: typeof loadMore
}

vi.mock('convex/react', () => ({
  usePaginatedQuery: vi.fn(() => queryState),
  useQuery: vi.fn(() => {
    const categories: Record<string, number> = {}
    const tags: Record<string, number> = {}
    for (const item of queryState.results) {
      for (const cat of item.categories) {
        categories[cat] = (categories[cat] ?? 0) + 1
      }
      for (const tag of item.tags) {
        tags[tag] = (tags[tag] ?? 0) + 1
      }
    }
    return { categories, tags }
  }),
}))

vi.mock('./CatalogCard', () => ({
  default: ({ item }: { item: { displayName: string } }) => (
    <div>{item.displayName}</div>
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

class MockIntersectionObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

describe('CatalogGrid', () => {
  beforeEach(() => {
    installLocalStorage()
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    queryState = {
      results: [
        {
          componentId: 'component-1',
          runtime: 'remotion',
          ownerHandle: 'terence',
          slug: 'kinetic-title-pack',
          displayName: 'Kinetic Title Pack',
          summary: 'Reusable title animations.',
          tags: ['intro'],
          categories: ['title'],
          latestVersionSummary: {
            version: '1.0.0',
            preview: { thumbnailUrl: 'https://example.com/thumb.jpg' },
            metadata: { aspectRatios: ['16:9'] },
          },
        },
      ],
      status: 'Exhausted',
      loadMore,
    }

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: MockIntersectionObserver,
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    loadMore.mockReset()
  })

  it('clears cached facets when the unfiltered catalog becomes empty', async () => {
    const view = render(
      <I18nProvider>
        <CatalogGrid />
      </I18nProvider>,
    )

    expect(await screen.findByRole('button', { name: 'title (1)' })).toBeTruthy()
    expect(screen.getByText('Tags')).toBeTruthy()
    expect(screen.getByText('intro')).toBeTruthy()

    queryState = {
      results: [],
      status: 'Exhausted',
      loadMore,
    }

    view.rerender(
      <I18nProvider>
        <CatalogGrid />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'title (1)' })).toBeNull()
    })
    expect(screen.queryByText('Tags')).toBeNull()
    expect(screen.queryByText('intro')).toBeNull()
    expect(screen.getByText('No components found')).toBeTruthy()
  })
})
