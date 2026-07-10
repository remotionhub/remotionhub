// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../I18nProvider'
import StudioProjectBar from './StudioProjectBar'

function renderBar(onSaveTitle = vi.fn().mockResolvedValue('New title')) {
  render(
    <I18nProvider>
      <StudioProjectBar
        composition={{
          aspectRatio: '16:9',
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 240,
        }}
        onOpenHistory={vi.fn()}
        onSaveTitle={onSaveTitle}
        sourceKind="prompt"
        title="Original title"
      />
    </I18nProvider>,
  )
  return { onSaveTitle }
}

describe('StudioProjectBar', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('debounces title saves by 600ms', async () => {
    const { onSaveTitle } = renderBar()
    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'New title' },
    })

    await act(async () => vi.advanceTimersByTime(599))
    expect(onSaveTitle).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(onSaveTitle).toHaveBeenCalledWith('New title')
  })

  it('flushes a pending title on blur', async () => {
    const { onSaveTitle } = renderBar()
    const input = screen.getByRole('textbox', { name: /title/i })
    fireEvent.change(input, { target: { value: 'Blurred title' } })
    fireEvent.blur(input)

    expect(onSaveTitle).toHaveBeenCalledWith('Blurred title')
  })

  it('ignores an outdated save resolution', async () => {
    let resolveFirst: ((value: string) => void) | undefined
    const onSaveTitle = vi.fn().mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve
        }),
    )
    renderBar(onSaveTitle)
    const input = screen.getByRole('textbox', { name: /title/i })

    fireEvent.change(input, { target: { value: 'First edit' } })
    await act(async () => vi.advanceTimersByTime(600))
    fireEvent.change(input, { target: { value: 'Latest edit' } })
    await act(async () => resolveFirst?.('First edit'))

    expect(screen.getByRole('status').textContent).toMatch(/正在保存|saving/i)
  })
})
