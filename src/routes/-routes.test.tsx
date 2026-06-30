// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { act, createElement, type ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Detail = {
  component: { displayName: string; summary: string }
}

type RouteOptions = {
  component?: ComponentType
  shellComponent?: ComponentType<{ children: React.ReactNode }>
  head?: (context: { loaderData?: Detail }) => {
    meta: Array<Record<string, string>>
  }
  loader?: (context: {
    params: { owner: string; slug: string }
  }) => Promise<Detail>
}

const mocks = vi.hoisted(() => {
  const routes = new Map<string, RouteOptions>()
  const query = vi.fn()
  const notFoundError = new Error('Not found')
  const detail: Detail = {
    component: { displayName: 'Animated Title', summary: 'A title animation.' },
  }
  return { routes, query, notFoundError, detail }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: (path: string) => (options: RouteOptions) => {
      mocks.routes.set(path, options)
      return {
        options,
        useLoaderData: vi.fn(() => mocks.detail),
      }
    },
    createRootRoute: (options: RouteOptions) => {
      mocks.routes.set('__root__', options)
      return { options }
    },
    notFound: () => mocks.notFoundError,
    HeadContent: () => <div data-testid="head-content" />,
    Scripts: () => <div data-testid="scripts" />,
  }
})

vi.mock('../lib/convex', () => ({
  createConvexHttpClient: () => ({ query: mocks.query }),
}))
vi.mock('../../convex/_generated/api', () => ({
  api: { components: { getCatalogDetail: 'getCatalogDetail' } },
}))
vi.mock('../components/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'home.title': 'Motion template library',
        'remotion.title': 'Remotion components',
        'hyperframes.title': 'HyperFrames components',
      })[key] ?? key,
  }),
}))
vi.mock('../components/catalog/CatalogGrid', () => ({
  default: ({ runtime }: { runtime?: string }) => (
    <div data-testid="catalog-grid">{runtime ?? 'all'}</div>
  ),
}))
vi.mock('../components/catalog/CatalogPageShell', () => ({
  default: ({
    title,
    children,
  }: React.PropsWithChildren<{ title: string }>) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))
vi.mock('../components/catalog/DetailPage', () => ({
  default: ({ detail }: { detail: Detail }) => (
    <div data-testid="detail-page">{detail.component.displayName}</div>
  ),
}))
vi.mock('../components/AppProviders', () => ({
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))
vi.mock('../components/Header', () => ({
  default: () => <header>Header</header>,
}))
vi.mock('../components/Footer', () => ({
  default: () => <footer>Footer</footer>,
}))
vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))
vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))

import './__root'
import './index'
import './remotion/index'
import './remotion/$owner.$slug'
import './hyperframes/index'
import './hyperframes/$owner.$slug'

function route(path: string) {
  const options = mocks.routes.get(path)
  if (!options) throw new Error(`Missing captured route: ${path}`)
  return options
}

function metaValue(
  options: RouteOptions,
  name: 'title' | 'description',
  loaderData?: Detail,
) {
  const meta = options.head?.({ loaderData }).meta ?? []
  const entry =
    name === 'title'
      ? meta.find((item) => 'title' in item)
      : meta.find((item) => item.name === name)
  return name === 'title' ? entry?.title : entry?.content
}

describe('application routes', () => {
  beforeEach(() => {
    mocks.query.mockReset().mockResolvedValue(mocks.detail)
  })

  afterEach(cleanup)

  it('defines root and catalog metadata', () => {
    expect(metaValue(route('__root__'), 'title')).toBe('RemotionHub')
    expect(metaValue(route('__root__'), 'description')).toBe(
      'Browse Remotion and HyperFrames components with versioned source artifacts.',
    )
    expect(metaValue(route('/'), 'title')).toBe('RemotionHub')
    expect(metaValue(route('/'), 'description')).toBe(
      'Browse Remotion and HyperFrames assets with previews, source links, and agent prompts.',
    )
    expect(metaValue(route('/remotion/'), 'title')).toBe(
      'Remotion Components | RemotionHub',
    )
    expect(metaValue(route('/hyperframes/'), 'title')).toBe(
      'HyperFrames Components | RemotionHub',
    )
  })

  it.each([
    ['/', 'Motion template library', 'all'],
    ['/remotion/', 'Remotion components', 'remotion'],
    ['/hyperframes/', 'HyperFrames components', 'hyperframes'],
  ])('renders the %s catalog component', async (path, heading, runtime) => {
    const Component = route(path).component
    if (!Component) throw new Error(`Missing component for ${path}`)

    await act(async () => {
      render(createElement(Component))
    })

    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.getByTestId('catalog-grid').textContent).toBe(runtime)
  })

  it.each([
    ['/remotion/$owner/$slug', 'remotion'],
    ['/hyperframes/$owner/$slug', 'hyperframes'],
  ])('loads %s detail with runtime, owner, and slug', async (path, runtime) => {
    const loader = route(path).loader
    if (!loader) throw new Error(`Missing loader for ${path}`)

    await expect(
      loader({ params: { owner: 'terence', slug: 'animated-title' } }),
    ).resolves.toBe(mocks.detail)
    expect(mocks.query).toHaveBeenCalledWith('getCatalogDetail', {
      runtime,
      owner: 'terence',
      slug: 'animated-title',
    })
  })

  it.each(['/remotion/$owner/$slug', '/hyperframes/$owner/$slug'])(
    'throws notFound when %s detail is missing',
    async (path) => {
      mocks.query.mockResolvedValue(null)
      const loader = route(path).loader
      if (!loader) throw new Error(`Missing loader for ${path}`)

      await expect(
        loader({ params: { owner: 'missing', slug: 'missing' } }),
      ).rejects.toBe(mocks.notFoundError)
    },
  )

  it.each([
    [
      '/remotion/$owner/$slug',
      'Remotion Component | RemotionHub',
      'Browse Remotion components on RemotionHub.',
    ],
    [
      '/hyperframes/$owner/$slug',
      'HyperFrames Component | RemotionHub',
      'Browse HyperFrames components on RemotionHub.',
    ],
  ])(
    'builds detail metadata with and without loader data for %s',
    (path, fallbackTitle, fallbackDescription) => {
      const options = route(path)

      expect(metaValue(options, 'title', mocks.detail)).toBe(
        'Animated Title | RemotionHub',
      )
      expect(metaValue(options, 'description', mocks.detail)).toBe(
        'A title animation.',
      )
      expect(metaValue(options, 'title')).toBe(fallbackTitle)
      expect(metaValue(options, 'description')).toBe(fallbackDescription)
    },
  )

  it.each(['/remotion/$owner/$slug', '/hyperframes/$owner/$slug'])(
    'renders detail component for %s',
    async (path) => {
      const Component = route(path).component
      if (!Component) throw new Error(`Missing component for ${path}`)

      await act(async () => {
        render(createElement(Component))
      })

      expect((await screen.findByTestId('detail-page')).textContent).toBe(
        'Animated Title',
      )
    },
  )
})
