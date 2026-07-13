// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../I18nProvider'
import StudioChatPanel from './StudioChatPanel'

const messages = [
  {
    _id: 'message-user',
    role: 'user' as const,
    kind: 'prompt' as const,
    content: 'Make the title cyan',
    createdAt: 1,
  },
  {
    _id: 'message-assistant',
    role: 'assistant' as const,
    kind: 'response' as const,
    content: 'Updated the title color',
    createdAt: 2,
  },
]

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof StudioChatPanel>> = {},
) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onRetry = vi.fn().mockResolvedValue(undefined)
  render(
    <I18nProvider>
      <StudioChatPanel
        disabled={false}
        messages={messages}
        onSubmit={onSubmit}
        onRetry={onRetry}
        run={null}
        {...overrides}
      />
    </I18nProvider>,
  )
  return { onRetry, onSubmit }
}

afterEach(cleanup)

describe('StudioChatPanel', () => {
  it('shows the localized active generation phase', () => {
    renderPanel({ run: { status: 'selecting-skills' } })

    expect(
      screen.getByText(/正在选择动画能力|choosing animation skills/i),
    ).toBeTruthy()
  })

  it('disables in-flight submission', () => {
    renderPanel({ disabled: true, run: { status: 'generating' } })

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /发送|send/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('submits with Enter and keeps Shift+Enter for a newline', async () => {
    const { onSubmit } = renderPanel()
    const textbox = screen.getByRole('textbox')
    fireEvent.change(textbox, { target: { value: 'Add a softer entrance' } })

    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.keyDown(textbox, { key: 'Enter' })
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('Add a softer entrance'),
    )
  })

  it('retries a failed run without resubmitting browser prompt text', async () => {
    const { onRetry, onSubmit } = renderPanel({ run: { status: 'failed' } })

    fireEvent.click(screen.getByRole('button', { name: /重试|retry/i }))

    await waitFor(() =>
      expect(onRetry).toHaveBeenCalledTimes(1),
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
