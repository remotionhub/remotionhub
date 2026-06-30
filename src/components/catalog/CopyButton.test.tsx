// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { MouseEventHandler } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CopyButton from './CopyButton'

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  clickHandler: undefined as MouseEventHandler<HTMLButtonElement> | undefined,
}))

vi.mock('sonner', () => ({ toast: { success: mocks.success } }))
vi.mock('#/components/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string) =>
      key === 'detail.copyPrompt' ? 'Copy prompt' : 'Copied to clipboard',
  }),
}))
vi.mock('#/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: MouseEventHandler<HTMLButtonElement>
  }) => {
    mocks.clickHandler = onClick
    return <button type="button">{children}</button>
  },
}))

describe('CopyButton', () => {
  const writeText = vi.fn()
  const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'clipboard',
  )

  beforeEach(() => {
    mocks.clickHandler = undefined
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    cleanup()
    writeText.mockReset()
    mocks.success.mockReset()
    vi.restoreAllMocks()
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor)
    } else {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
    expect(Object.getOwnPropertyDescriptor(navigator, 'clipboard')).toEqual(
      originalClipboardDescriptor,
    )
  })

  it('uses the translated default label and accepts a custom label', () => {
    const view = render(<CopyButton value="prompt" />)
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeTruthy()

    view.rerender(<CopyButton value="prompt" label="Copy command" />)
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeTruthy()
  })

  it('writes the value and shows success only after the write resolves', async () => {
    let resolveWrite: (() => void) | undefined
    writeText.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveWrite = resolve
      }),
    )
    render(<CopyButton value="agent prompt" />)

    const pendingClick = mocks.clickHandler?.(
      {} as React.MouseEvent<HTMLButtonElement>,
    )
    expect(writeText).toHaveBeenCalledWith('agent prompt')
    expect(mocks.success).not.toHaveBeenCalled()

    resolveWrite?.()
    await pendingClick
    expect(mocks.success).toHaveBeenCalledWith('Copied to clipboard')
  })

  it('propagates clipboard failures without showing success', async () => {
    const error = new Error('Clipboard unavailable')
    writeText.mockRejectedValue(error)
    render(<CopyButton value="agent prompt" />)

    await expect(
      mocks.clickHandler?.({} as React.MouseEvent<HTMLButtonElement>),
    ).rejects.toBe(error)
    expect(mocks.success).not.toHaveBeenCalled()
  })
})
