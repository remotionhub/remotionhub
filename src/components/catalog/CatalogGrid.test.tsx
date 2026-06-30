// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { usePaginatedQuery } from 'convex/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/components/I18nProvider'
import { LOCALE_STORAGE_KEY } from '#/lib/i18n'
import CatalogGrid from './CatalogGrid'

const loadMore = vi.fn()
let facetsState:
  | { categories: Record<string, number>; tags: Record<string, number> }
  | undefined
let queryState: {
  results: CatalogItem[]
  status: 'LoadingFirstPage' | 'LoadingMore' | 'CanLoadMore' | 'Exhausted'
  loadMore: typeof loadMore
}

type CatalogItem = {
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
}

vi.mock('convex/react', () => ({
  usePaginatedQuery: vi.fn(() => queryState),
  useQuery: vi.fn(() => facetsState),
}))

vi.mock('./CatalogCard', () => ({
  default: ({ item }: { item: { displayName: string } }) => (
    <div>{item.displayName}</div>
  ),
}))

function item(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    componentId: 'component-1',
    runtime: 'remotion',
    ownerHandle: 'terence',
    slug: 'card-avatar',
    displayName: 'Card Avatar',
    summary: 'Reusable avatar animations.',
    tags: ['personal'],
    categories: ['card'],
    latestVersionSummary: {
      version: '1.0.0',
      preview: { thumbnailUrl: 'https://example.com/thumb.jpg' },
      metadata: { aspectRatios: ['16:9'] },
    },
    ...overrides,
  }
}

function installLocalStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return values.size
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage,
  })
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  readonly disconnect = vi.fn()
  readonly observe = vi.fn()
  readonly unobserve = vi.fn()

  constructor(readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this)
  }

  emit(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as never,
    )
  }
}

function renderGrid(runtime?: 'remotion' | 'hyperframes') {
  return render(
    <I18nProvider>
      <CatalogGrid runtime={runtime} />
    </I18nProvider>,
  )
}

describe('CatalogGrid', () => {
  beforeEach(() => {
    installLocalStorage()
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    facetsState = { categories: { card: 1 }, tags: { personal: 1 } }
    queryState = { results: [item()], status: 'Exhausted', loadMore }
    MockIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    loadMore.mockReset()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('passes runtime and no category when facets are unavailable', () => {
    facetsState = undefined

    renderGrid('remotion')

    expect(screen.queryByText('Tags')).toBeNull()
    expect(vi.mocked(usePaginatedQuery).mock.calls.at(-1)?.[1]).toEqual({
      runtime: 'remotion',
      categories: undefined,
    })
  })

  it('combines intro and outro facet counts and maps selection to both categories', () => {
    facetsState = {
      categories: { intro: 2, outro: 3, card: 1 },
      tags: {},
    }

    renderGrid()
    fireEvent.click(screen.getByRole('button', { name: 'Intro/Outro (5)' }))

    expect(vi.mocked(usePaginatedQuery).mock.calls.at(-1)?.[1]).toEqual({
      runtime: undefined,
      categories: ['intro', 'outro'],
    })
  })

  it('renders six first-page skeletons', () => {
    queryState = { results: [], status: 'LoadingFirstPage', loadMore }

    const view = renderGrid()

    expect(
      view.container.querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(6)
  })

  it('renders loading-more feedback', () => {
    queryState = { results: [item()], status: 'LoadingMore', loadMore }

    renderGrid()

    expect(screen.getByText('Loading more...')).toBeTruthy()
  })

  it('loads only when the sentinel intersects and disconnects on cleanup', () => {
    queryState = { results: [item()], status: 'CanLoadMore', loadMore }

    const view = renderGrid()
    const observer = MockIntersectionObserver.instances[0]
    const sentinel = view.container.querySelector('div[aria-hidden="true"]')
    expect(observer).toBeDefined()
    expect(sentinel).toBeTruthy()
    expect(observer?.observe).toHaveBeenCalledOnce()
    expect(observer?.observe).toHaveBeenCalledWith(sentinel)

    observer?.emit(false)
    expect(loadMore).not.toHaveBeenCalled()

    observer?.emit(true)
    expect(loadMore).toHaveBeenCalledWith(12)

    view.unmount()
    expect(observer?.disconnect).toHaveBeenCalledOnce()
  })

  it('renders the end marker for a nonempty exhausted catalog', () => {
    renderGrid()

    expect(screen.getByText('End of catalog.')).toBeTruthy()
  })

  it('clears cached facets when the unfiltered catalog becomes empty', async () => {
    const view = renderGrid()

    expect(await screen.findByRole('button', { name: 'Card (1)' })).toBeTruthy()
    expect(screen.getByText('Tags')).toBeTruthy()
    expect(screen.getByText('Personal')).toBeTruthy()

    facetsState = { categories: {}, tags: {} }
    queryState = { results: [], status: 'Exhausted', loadMore }
    view.rerender(
      <I18nProvider>
        <CatalogGrid />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Card (1)' })).toBeNull()
    })
    expect(screen.queryByText('Tags')).toBeNull()
    expect(screen.queryByText('Personal')).toBeNull()
    expect(screen.getByText('No components found')).toBeTruthy()
  })
})
