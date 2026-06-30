// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import CatalogPageShell from './CatalogPageShell'

describe('CatalogPageShell', () => {
  afterEach(cleanup)

  it('renders the supplied heading and children', () => {
    render(
      <CatalogPageShell title="Remotion components">
        <p>Catalog content</p>
      </CatalogPageShell>,
    )

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Remotion components',
    )
    expect(screen.getByText('Catalog content')).toBeTruthy()
  })
})
