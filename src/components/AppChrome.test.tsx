// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppChrome from './AppChrome'

const routerMocks = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: routerMocks.pathname } }),
}))

vi.mock('./Header', () => ({
  default: () => <header>Header</header>,
}))

vi.mock('./Footer', () => ({
  default: () => <footer>Footer</footer>,
}))

function renderAppChrome(pathname: string) {
  routerMocks.pathname = pathname
  render(
    <AppChrome>
      <main>Content</main>
    </AppChrome>,
  )
}

describe('AppChrome', () => {
  afterEach(cleanup)

  it('keeps Header but removes Footer for the Studio namespace', () => {
    renderAppChrome('/studio/project-1')

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.queryByRole('contentinfo')).toBeNull()
  })

  it('keeps Footer outside Studio', () => {
    renderAppChrome('/remotion')

    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })
})
