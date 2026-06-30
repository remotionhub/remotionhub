// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PreviewMedia from './PreviewMedia'

vi.mock('#/components/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string, values: { title: string }) =>
      key === 'preview.label'
        ? `${values.title} preview`
        : `${values.title} preview unavailable`,
  }),
}))

describe('PreviewMedia', () => {
  afterEach(cleanup)

  it('renders a lazy image with the translated accessible label', () => {
    render(
      <PreviewMedia
        preview={{ thumbnailUrl: 'https://example.com/thumb.jpg' }}
        title="Card Avatar"
      />,
    )

    const image = screen.getByRole('img', { name: 'Card Avatar preview' })
    expect(image.getAttribute('src')).toBe('https://example.com/thumb.jpg')
    expect(image.getAttribute('loading')).toBe('lazy')
  })

  it('renders video media and honors a custom aria label', () => {
    const view = render(
      <PreviewMedia
        preview={{
          thumbnailUrl: 'https://example.com/poster.jpg',
          previewVideoUrl: 'https://example.com/preview.mp4',
        }}
        title="Demo"
        video
        aria-label="Custom demo"
      />,
    )

    const video = screen.getByLabelText('Custom demo')
    expect(video.tagName).toBe('VIDEO')
    expect(video.getAttribute('poster')).toBe('https://example.com/poster.jpg')
    expect(view.container.querySelector('source')?.getAttribute('src')).toBe(
      'https://example.com/preview.mp4',
    )
  })

  it('renders a fallback when media is missing', () => {
    render(<PreviewMedia preview={{}} title="Demo" />)

    expect(screen.getByTestId('preview-fallback').textContent).toBe('D')
    expect(
      screen.getByRole('img', { name: 'Demo preview unavailable' }),
    ).toBeTruthy()
  })

  it('falls back after an image error', () => {
    render(
      <PreviewMedia
        preview={{ thumbnailUrl: 'https://example.com/broken.jpg' }}
        title="Broken"
      />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Broken preview' }))
    expect(screen.getByTestId('preview-fallback').textContent).toBe('B')
  })

  it('falls back after a video error', () => {
    render(
      <PreviewMedia
        preview={{ previewVideoUrl: 'https://example.com/broken.mp4' }}
        title="Video"
        video
      />,
    )

    fireEvent.error(screen.getByLabelText('Video preview'))
    expect(
      screen.getByRole('img', { name: 'Video preview unavailable' }),
    ).toBeTruthy()
  })

  it('uses an empty initial when the title is empty', () => {
    render(<PreviewMedia preview={{}} title="" />)

    expect(screen.getByTestId('preview-fallback').textContent).toBe('')
  })
})
