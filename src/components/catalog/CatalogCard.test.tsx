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
  slug: 'card-avatar',
  displayName: 'Card Avatar',
  summary: 'Animated avatar lower-third card for Remotion videos.',
  tags: ['remotion', 'avatar', 'profile', 'motion'],
  categories: ['card'],
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

    const link = screen.getByRole('link', { name: /Card Avatar/ })
    expect(link.getAttribute('href')).toBe('/remotion/terence/card-avatar')
    expect(screen.getByRole('img', { name: /Card Avatar/ })).toBeTruthy()
    expect(screen.queryByText('Animated avatar lower-third card for Remotion videos.')).toBeNull()
    expect(screen.getByText('remotion')).toBeTruthy()
    expect(screen.getByText('avatar')).toBeTruthy()
    expect(screen.queryByText('motion')).toBeNull()
  })
})
