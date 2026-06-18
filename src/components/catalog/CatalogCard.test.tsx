// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/components/I18nProvider'
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
  slug: 'kinetic-title-pack',
  displayName: 'Kinetic Title Pack',
  summary: 'Image-led Remotion title animations.',
  tags: ['remotion', 'text', 'intro', 'motion'],
  categories: ['title'],
  latestVersionSummary: {
    version: '1.0.0',
    preview: { thumbnailUrl: 'https://example.com/thumb.jpg' },
    metadata: { aspectRatios: ['16:9'] },
  },
}

describe('CatalogCard', () => {
  it('renders an image-first card with compact badges', () => {
    render(
      <I18nProvider>
        <CatalogCard item={item} />
      </I18nProvider>,
    )

    const link = screen.getByRole('link', { name: /Kinetic Title Pack/ })
    expect(link.getAttribute('href')).toBe('/remotion/terence/kinetic-title-pack')
    expect(screen.getByRole('img', { name: /Kinetic Title Pack/ })).toBeTruthy()
    expect(screen.getByText('remotion')).toBeTruthy()
    expect(screen.getByText('text')).toBeTruthy()
    expect(screen.queryByText('motion')).toBeNull()
  })
})
