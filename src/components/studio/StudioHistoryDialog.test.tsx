// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { I18nProvider } from '../I18nProvider'
import StudioHistoryDialog from './StudioHistoryDialog'

const mocks = vi.hoisted(() => ({ rollbackRevision: vi.fn() }))

vi.mock('convex/react', () => ({
  useMutation: () => mocks.rollbackRevision,
}))

const projectId = 'studioProjects:1' as Id<'studioProjects'>
const currentRevisionId = 'studioRevisions:2' as Id<'studioRevisions'>
const revisions = [
  {
    _id: currentRevisionId,
    sequence: 2,
    origin: 'follow-up' as const,
    assistantSummary: 'Updated the title color',
    createdAt: 2,
  },
  {
    _id: 'studioRevisions:1' as Id<'studioRevisions'>,
    sequence: 1,
    origin: 'prompt' as const,
    assistantSummary: 'Created the first animation',
    createdAt: 1,
  },
]

function renderDialog(onClose = vi.fn()) {
  render(
    <I18nProvider>
      <StudioHistoryDialog
        currentRevisionId={currentRevisionId}
        onClose={onClose}
        open
        projectId={projectId}
        revisions={revisions}
      />
    </I18nProvider>,
  )
  return { onClose }
}

describe('StudioHistoryDialog', () => {
  beforeEach(() => {
    mocks.rollbackRevision.mockReset().mockResolvedValue({})
  })

  afterEach(cleanup)

  it('confirms a guarded restore and leaves history append-only', async () => {
    const { onClose } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /恢复此版本|restore this version/i }))
    expect(mocks.rollbackRevision).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /确认恢复|confirm restore/i }))

    await waitFor(() => {
      expect(mocks.rollbackRevision).toHaveBeenCalledWith({
        projectId,
        revisionId: revisions[1]._id,
        expectedCurrentRevisionId: currentRevisionId,
      })
      expect(onClose).toHaveBeenCalledTimes(1)
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('keeps the dialog open when the current revision guard is stale', async () => {
    mocks.rollbackRevision.mockRejectedValue(new Error('Studio project changed'))
    const { onClose } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /恢复此版本|restore this version/i }))
    fireEvent.click(screen.getByRole('button', { name: /确认恢复|confirm restore/i }))

    expect(
      await screen.findByText(/项目已更新|project changed/i),
    ).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
