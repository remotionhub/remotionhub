// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Footer from './Footer'
import { I18nProvider } from './I18nProvider'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

function renderFooter() {
  render(
    <I18nProvider>
      <Footer />
    </I18nProvider>,
  )
}

describe('Footer', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the footer navigation and copyright', () => {
    renderFooter()
    expect(screen.getByText(/RemotionHub/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Remotion' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'HyperFrames' })).toBeTruthy()
  })

  it('points to the correct GitHub repository', () => {
    renderFooter()
    const githubLink = screen.getByRole('link', { name: 'GitHub' })
    expect(githubLink.getAttribute('href')).toBe('https://github.com/remotionhub/remotionhub')
  })
})
