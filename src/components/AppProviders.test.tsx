// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppProviders from './AppProviders'

const { client } = vi.hoisted(() => ({ client: { name: 'convex-client' } }))

vi.mock('#/lib/convex', () => ({ convexReactClient: client }))
vi.mock('convex/react', () => ({
  ConvexProvider: ({
    children,
    client: providerClient,
  }: React.PropsWithChildren<{ client: unknown }>) => (
    <div data-testid="convex-provider" data-client={providerClient === client}>
      {children}
    </div>
  ),
}))
vi.mock('./I18nProvider', () => ({
  I18nProvider: ({ children }: React.PropsWithChildren) => (
    <div data-testid="i18n-provider">{children}</div>
  ),
}))
vi.mock('#/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

describe('AppProviders', () => {
  afterEach(cleanup)

  it('nests application content and one toaster inside i18n and Convex providers', () => {
    render(
      <AppProviders>
        <div data-testid="content" />
      </AppProviders>,
    )

    const convexProvider = screen.getByTestId('convex-provider')
    const i18nProvider = screen.getByTestId('i18n-provider')
    expect(convexProvider.getAttribute('data-client')).toBe('true')
    expect(convexProvider.firstElementChild).toBe(i18nProvider)
    expect(i18nProvider.contains(screen.getByTestId('content'))).toBe(true)
    expect(i18nProvider.contains(screen.getByTestId('toaster'))).toBe(true)
    expect(screen.getAllByTestId('toaster')).toHaveLength(1)
  })
})
