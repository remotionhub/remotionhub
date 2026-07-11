// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { I18nProvider } from '../I18nProvider'
import StudioWorkspace from './StudioWorkspace'
import type StudioPreview from './StudioPreview'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  useQuery: vi.fn(),
  acceptCandidate: vi.fn(),
  rejectCandidate: vi.fn(),
  reportRuntimeFailure: vi.fn(),
  retryFailedGeneration: vi.fn(),
  startFollowUp: vi.fn(),
  updateProjectTitle: vi.fn(),
  rollbackRevision: vi.fn(),
  previewProps: null as ComponentProps<typeof StudioPreview> | null,
}))

vi.mock('#/lib/useAuthStatus', () => ({ useAuthStatus: mocks.auth }))
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    studio: {
      getProject: 'getProject',
      listMessages: 'listMessages',
      listRevisions: 'listRevisions',
      acceptCandidate: 'acceptCandidate',
      rejectCandidate: 'rejectCandidate',
      reportRuntimeFailure: 'reportRuntimeFailure',
      retryFailedGeneration: 'retryFailedGeneration',
      startFollowUp: 'startFollowUp',
      updateProjectTitle: 'updateProjectTitle',
      rollbackRevision: 'rollbackRevision',
    },
  },
}))
vi.mock('convex/react', () => ({
  useQuery: mocks.useQuery,
  useMutation: (reference: string) =>
    ({
      acceptCandidate: mocks.acceptCandidate,
      rejectCandidate: mocks.rejectCandidate,
      reportRuntimeFailure: mocks.reportRuntimeFailure,
      retryFailedGeneration: mocks.retryFailedGeneration,
      startFollowUp: mocks.startFollowUp,
      updateProjectTitle: mocks.updateProjectTitle,
      rollbackRevision: mocks.rollbackRevision,
    })[reference],
}))
vi.mock('./StudioPreview', () => ({
  default: (props: ComponentProps<typeof StudioPreview>) => {
    mocks.previewProps = props
    return <div data-testid="studio-preview" />
  },
}))

const projectId = 'studioProjects:1' as Id<'studioProjects'>
const revisionId = 'studioRevisions:1' as Id<'studioRevisions'>
const runId = 'studioGenerationRuns:1' as Id<'studioGenerationRuns'>
const composition = {
  aspectRatio: '16:9' as const,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
}
const revision = {
  _id: revisionId,
  projectId,
  sequence: 1,
  origin: 'prompt' as const,
  code: 'export const MyAnimation = () => <div>Committed</div>',
  codeHash: 'revision-fingerprint',
  composition,
  assistantSummary: 'Created the animation',
  createdAt: 1,
}
const baseSnapshot = {
  project: {
    _id: projectId,
    ownerId: 'users:1',
    title: 'Product launch',
    status: 'active' as const,
    source: { kind: 'prompt' as const },
    currentRevisionId: revisionId,
    composition,
    createdAt: 1,
    updatedAt: 1,
  },
  revision,
  run: null,
}
const messages = [
  {
    _id: 'studioMessages:1',
    projectId,
    role: 'user' as const,
    kind: 'prompt' as const,
    content: 'Create a product launch',
    createdAt: 1,
  },
]

let snapshot: typeof baseSnapshot | Record<string, unknown> | null | undefined
let queryError: Error | null

function installMatchMedia(desktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: desktop,
      media: '(min-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function renderWorkspace() {
  return render(
    <I18nProvider>
      <StudioWorkspace projectId={projectId} />
    </I18nProvider>,
  )
}

describe('StudioWorkspace', () => {
  beforeEach(() => {
    installMatchMedia(true)
    snapshot = baseSnapshot
    queryError = null
    mocks.previewProps = null
    mocks.auth.mockReset().mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1' },
    })
    mocks.useQuery.mockReset().mockImplementation((reference: string) => {
      if (queryError) throw queryError
      if (reference === 'getProject') return snapshot
      if (reference === 'listMessages') return messages
      if (reference === 'listRevisions') return [revision]
      return undefined
    })
    for (const mutation of [
      mocks.acceptCandidate,
      mocks.rejectCandidate,
      mocks.reportRuntimeFailure,
      mocks.retryFailedGeneration,
      mocks.startFollowUp,
      mocks.updateProjectTitle,
      mocks.rollbackRevision,
    ]) {
      mutation.mockReset().mockResolvedValue({})
    }
  })

  afterEach(cleanup)

  it.each(['missing', 'unauthenticated', 'foreign'])(
    'renders the same unavailable state for a %s project',
    (scenario) => {
      if (scenario === 'missing') snapshot = null
      if (scenario === 'unauthenticated') {
        mocks.auth.mockReturnValue({
          isAuthenticated: false,
          isLoading: false,
          me: null,
        })
      }
      if (scenario === 'foreign') queryError = new Error('Studio project unavailable')

      renderWorkspace()

      expect(
        screen.getByRole('heading', { name: /Studio 暂不可用|Studio is unavailable/i }),
      ).toBeTruthy()
      if (scenario === 'unauthenticated') {
        expect(mocks.useQuery.mock.calls.every((call) => call[1] === 'skip')).toBe(true)
      }
    },
  )

  it('passes a Run candidate only to StudioPreview', () => {
    const candidateCode = 'export const SecretCandidate = () => <div />'
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        candidateCode,
        candidateComposition: composition,
        candidateFingerprint: 'candidate-1',
      },
    }

    renderWorkspace()

    expect(mocks.previewProps?.candidate).toEqual({
      code: candidateCode,
      composition,
      deliveryId: '["studioGenerationRuns:1",null,"candidate-1"]',
      fingerprint: 'candidate-1',
    })
    expect(screen.queryByText(candidateCode)).toBeNull()
    expect(screen.queryByRole('textbox', { name: /code/i })).toBeNull()
  })

  it('accepts each candidate fingerprint exactly once across re-renders', async () => {
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        candidateCode: 'candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-1',
      },
    }
    const view = renderWorkspace()
    const result = {
      status: 'accepted' as const,
      deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
      fingerprint: 'candidate-1',
    }

    await act(async () => {
      mocks.previewProps?.onCandidateResult(result)
      mocks.previewProps?.onCandidateResult(result)
    })
    view.rerender(
      <I18nProvider>
        <StudioWorkspace projectId={projectId} />
      </I18nProvider>,
    )
    await act(async () => mocks.previewProps?.onCandidateResult(result))

    expect(mocks.acceptCandidate).toHaveBeenCalledTimes(1)
    expect(mocks.acceptCandidate).toHaveBeenCalledWith({
      projectId,
      runId,
      candidateFingerprint: 'candidate-1',
    })
  })

  it('allows exactly one handshake when the server exposes a new fingerprint', async () => {
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        candidateCode: 'first candidate',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-1',
      },
    }
    const view = renderWorkspace()
    await act(async () =>
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
        fingerprint: 'candidate-1',
      }),
    )

    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        candidateCode: 'second candidate',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-2',
      },
    }
    view.rerender(
      <I18nProvider>
        <StudioWorkspace projectId={projectId} />
      </I18nProvider>,
    )
    await act(async () => {
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
        fingerprint: 'candidate-2',
      })
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
        fingerprint: 'candidate-2',
      })
    })

    expect(mocks.acceptCandidate).toHaveBeenCalledTimes(2)
    expect(mocks.acceptCandidate).toHaveBeenLastCalledWith({
      projectId,
      runId,
      candidateFingerprint: 'candidate-2',
    })
  })

  it('accepts the same fingerprint for distinct Run deliveries', async () => {
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        correctionAttempt: 0,
        candidateCode: 'same candidate',
        candidateComposition: composition,
        candidateFingerprint: 'same-fingerprint',
      },
    }
    const view = renderWorkspace()
    const firstDeliveryId = mocks.previewProps?.candidate?.deliveryId
    await act(async () =>
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: firstDeliveryId ?? '',
        fingerprint: 'same-fingerprint',
      }),
    )

    const nextRunId = 'studioGenerationRuns:2' as Id<'studioGenerationRuns'>
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: nextRunId,
        status: 'compiling',
        correctionAttempt: 0,
        candidateCode: 'same candidate',
        candidateComposition: composition,
        candidateFingerprint: 'same-fingerprint',
      },
    }
    view.rerender(
      <I18nProvider>
        <StudioWorkspace projectId={projectId} />
      </I18nProvider>,
    )
    const secondDeliveryId = mocks.previewProps?.candidate?.deliveryId
    await act(async () =>
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: secondDeliveryId ?? '',
        fingerprint: 'same-fingerprint',
      }),
    )

    expect(firstDeliveryId).not.toBe(secondDeliveryId)
    expect(mocks.acceptCandidate).toHaveBeenCalledTimes(2)
    expect(mocks.acceptCandidate).toHaveBeenLastCalledWith({
      projectId,
      runId: nextRunId,
      candidateFingerprint: 'same-fingerprint',
    })
  })

  it('accepts the same fingerprint after a Run advances correction attempt', async () => {
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        correctionAttempt: 0,
        candidateCode: 'same candidate',
        candidateComposition: composition,
        candidateFingerprint: 'same-fingerprint',
      },
    }
    const view = renderWorkspace()
    const firstDeliveryId = mocks.previewProps?.candidate?.deliveryId
    await act(async () =>
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: firstDeliveryId ?? '',
        fingerprint: 'same-fingerprint',
      }),
    )

    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        correctionAttempt: 1,
        candidateCode: 'same candidate',
        candidateComposition: composition,
        candidateFingerprint: 'same-fingerprint',
      },
    }
    view.rerender(
      <I18nProvider>
        <StudioWorkspace projectId={projectId} />
      </I18nProvider>,
    )
    const correctionDeliveryId = mocks.previewProps?.candidate?.deliveryId
    await act(async () =>
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: correctionDeliveryId ?? '',
        fingerprint: 'same-fingerprint',
      }),
    )

    expect(firstDeliveryId).not.toBe(correctionDeliveryId)
    expect(mocks.acceptCandidate).toHaveBeenCalledTimes(2)
  })

  it('rejects a fingerprint once with a normalized error', async () => {
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        candidateCode: 'candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-bad',
      },
    }
    renderWorkspace()

    await act(async () => {
      mocks.previewProps?.onCandidateResult({
        status: 'rejected',
        deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
        fingerprint: 'candidate-bad',
        error: 'Compile failed\nprivate stack',
      })
      mocks.previewProps?.onCandidateResult({
        status: 'rejected',
        deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
        fingerprint: 'candidate-bad',
        error: 'Compile failed\nprivate stack',
      })
    })

    expect(mocks.rejectCandidate).toHaveBeenCalledTimes(1)
    expect(mocks.rejectCandidate).toHaveBeenCalledWith({
      projectId,
      runId,
      candidateFingerprint: 'candidate-bad',
      normalizedError: 'Compile failed',
    })
  })

  it('keeps a failed candidate delivery available for an explicit retry', async () => {
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        candidateCode: 'candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-retry',
      },
    }
    mocks.acceptCandidate
      .mockRejectedValueOnce(new Error('Temporary network failure'))
      .mockResolvedValueOnce({})
    renderWorkspace()

    await act(async () =>
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
        fingerprint: 'candidate-retry',
      }),
    )

    const retry = await screen.findByRole('button', {
      name: /重试预览结果|retry preview result/i,
    })
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(retry)

    await waitFor(() => expect(mocks.acceptCandidate).toHaveBeenCalledTimes(2))
    expect(mocks.acceptCandidate.mock.calls[1]?.[0]).toEqual(
      mocks.acceptCandidate.mock.calls[0]?.[0],
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: /重试预览结果|retry preview result/i,
        }),
      ).toBeNull(),
    )
  })

  it.each([
    {
      name: 'the same Run reaches a terminal state and clears its candidate',
      nextRun: { _id: runId, status: 'succeeded' as const },
    },
    {
      name: 'the same Run advances out of its candidate status',
      nextRun: {
        _id: runId,
        status: 'generating' as const,
        candidateCode: 'candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-stale',
      },
    },
    {
      name: 'the same Run exposes a new fingerprint',
      nextRun: {
        _id: runId,
        status: 'compiling' as const,
        candidateCode: 'new candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-new',
      },
    },
    {
      name: 'a new Run exposes the same fingerprint',
      nextRun: {
        _id: 'studioGenerationRuns:2' as Id<'studioGenerationRuns'>,
        status: 'compiling' as const,
        candidateCode: 'candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-stale',
      },
    },
  ])(
    'drops a failed candidate delivery when another tab reports that $name',
    async ({ nextRun }) => {
      snapshot = {
        ...baseSnapshot,
        run: {
          _id: runId,
          status: 'compiling',
          candidateCode: 'candidate source',
          candidateComposition: composition,
          candidateFingerprint: 'candidate-stale',
        },
      }
      mocks.acceptCandidate.mockRejectedValue(new Error('Temporary network failure'))
      const view = renderWorkspace()

      await act(async () =>
        mocks.previewProps?.onCandidateResult({
          status: 'accepted',
          deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
          fingerprint: 'candidate-stale',
        }),
      )
      expect(
        await screen.findByRole('button', {
          name: /重试预览结果|retry preview result/i,
        }),
      ).toBeTruthy()

      snapshot = { ...baseSnapshot, run: nextRun }
      view.rerender(
        <I18nProvider>
          <StudioWorkspace projectId={projectId} />
        </I18nProvider>,
      )

      await waitFor(() =>
        expect(
          screen.queryByRole('button', {
            name: /重试预览结果|retry preview result/i,
          }),
        ).toBeNull(),
      )
      expect(mocks.acceptCandidate).toHaveBeenCalledTimes(1)
    },
  )

  it('keeps a failed candidate delivery while the authoritative snapshot reloads', async () => {
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        candidateCode: 'candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-reload',
      },
    }
    mocks.rejectCandidate.mockRejectedValue(new Error('Temporary network failure'))
    const view = renderWorkspace()

    await act(async () =>
      mocks.previewProps?.onCandidateResult({
        status: 'rejected',
        deliveryId: mocks.previewProps?.candidate?.deliveryId ?? '',
        fingerprint: 'candidate-reload',
        error: 'Compile failed',
      }),
    )
    expect(
      await screen.findByRole('button', {
        name: /重试预览结果|retry preview result/i,
      }),
    ).toBeTruthy()

    snapshot = undefined
    view.rerender(
      <I18nProvider>
        <StudioWorkspace projectId={projectId} />
      </I18nProvider>,
    )
    expect(screen.getByRole('status')).toBeTruthy()

    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        candidateCode: 'candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-reload',
      },
    }
    view.rerender(
      <I18nProvider>
        <StudioWorkspace projectId={projectId} />
      </I18nProvider>,
    )

    expect(
      await screen.findByRole('button', {
        name: /重试预览结果|retry preview result/i,
      }),
    ).toBeTruthy()
    expect(mocks.rejectCandidate).toHaveBeenCalledTimes(1)
  })

  it('reports a committed runtime failure once and advances to the fallback revision', async () => {
    const view = renderWorkspace()

    await act(async () => {
      mocks.previewProps?.onRevisionRuntimeError({
        revisionId,
        error: 'Committed runtime failed',
      })
      mocks.previewProps?.onRevisionRuntimeError({
        revisionId,
        error: 'Committed runtime failed',
      })
    })
    expect(mocks.reportRuntimeFailure).toHaveBeenCalledTimes(1)
    expect(mocks.rejectCandidate).not.toHaveBeenCalled()

    const fallbackId = 'studioRevisions:fallback' as Id<'studioRevisions'>
    snapshot = {
      ...baseSnapshot,
      project: { ...baseSnapshot.project, currentRevisionId: fallbackId },
      revision: {
        ...revision,
        _id: fallbackId,
        code: 'export const MyAnimation = () => <div>Fallback</div>',
      },
      run: { _id: runId, status: 'generating' },
    }
    view.rerender(
      <I18nProvider>
        <StudioWorkspace projectId={projectId} />
      </I18nProvider>,
    )

    expect(mocks.previewProps?.revisionId).toBe(fallbackId)
    expect(mocks.previewProps?.revisionCode).toContain('Fallback')
    expect(mocks.previewProps?.revisionCode).not.toContain('Committed')
  })

  it('keeps a failed revision runtime delivery available for an explicit retry', async () => {
    mocks.reportRuntimeFailure
      .mockRejectedValueOnce(new Error('Temporary network failure'))
      .mockResolvedValueOnce({})
    renderWorkspace()

    await act(async () =>
      mocks.previewProps?.onRevisionRuntimeError({
        revisionId,
        error: 'Committed runtime failed',
      }),
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: /重试预览结果|retry preview result/i,
      }),
    )

    await waitFor(() =>
      expect(mocks.reportRuntimeFailure).toHaveBeenCalledTimes(2),
    )
    expect(mocks.reportRuntimeFailure.mock.calls[1]?.[0]).toEqual(
      mocks.reportRuntimeFailure.mock.calls[0]?.[0],
    )
  })

  it.each([
    {
      name: 'the project falls back from the failed Revision',
      nextProjectRevisionId: 'studioRevisions:fallback' as Id<'studioRevisions'>,
      nextRun: { _id: runId, status: 'generating' as const },
    },
    {
      name: 'the server enters correction for the failed Revision',
      nextProjectRevisionId: revisionId,
      nextRun: {
        _id: runId,
        status: 'queued' as const,
        inputRevisionId: revisionId,
        correctionAttempt: 1,
      },
    },
  ])(
    'drops a failed runtime delivery when another tab reports that $name',
    async ({ nextProjectRevisionId, nextRun }) => {
      mocks.reportRuntimeFailure.mockRejectedValue(
        new Error('Temporary network failure'),
      )
      const view = renderWorkspace()

      await act(async () =>
        mocks.previewProps?.onRevisionRuntimeError({
          revisionId,
          error: 'Committed runtime failed',
        }),
      )
      expect(
        await screen.findByRole('button', {
          name: /重试预览结果|retry preview result/i,
        }),
      ).toBeTruthy()

      snapshot = {
        ...baseSnapshot,
        project: {
          ...baseSnapshot.project,
          currentRevisionId: nextProjectRevisionId,
        },
        run: nextRun,
      }
      view.rerender(
        <I18nProvider>
          <StudioWorkspace projectId={projectId} />
        </I18nProvider>,
      )

      await waitFor(() =>
        expect(
          screen.queryByRole('button', {
            name: /重试预览结果|retry preview result/i,
          }),
        ).toBeNull(),
      )
      expect(mocks.reportRuntimeFailure).toHaveBeenCalledTimes(1)
    },
  )

  it('keeps the last revision visible while the Run advances', () => {
    snapshot = {
      ...baseSnapshot,
      run: { _id: runId, status: 'generating' },
    }

    renderWorkspace()

    expect(mocks.previewProps?.revisionId).toBe(revisionId)
    expect(mocks.previewProps?.revisionCode).toBe(revision.code)
    expect(mocks.previewProps?.candidate).toBeNull()
  })

  it('retries the failed Run by identity even when no Revision exists', async () => {
    snapshot = {
      ...baseSnapshot,
      project: { ...baseSnapshot.project, currentRevisionId: undefined },
      revision: null,
      run: {
        _id: runId,
        status: 'failed',
        errorCode: 'MODEL_FAILED',
      },
    }
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /重试|retry/i }))

    await waitFor(() =>
      expect(mocks.retryFailedGeneration).toHaveBeenCalledWith({
        projectId,
        failedRunId: runId,
        idempotencyKey: expect.any(String),
      }),
    )
    expect(mocks.startFollowUp).not.toHaveBeenCalled()
  })

  it('retries a failed runtime repair by Run identity after Revision rollback', async () => {
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'failed',
        inputRevisionId: 'studioRevisions:broken',
        correctionAttempt: 1,
        errorCode: 'MODEL_FAILED',
      },
    }

    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /^重试$|^retry$/i }))

    await waitFor(() =>
      expect(mocks.retryFailedGeneration).toHaveBeenCalledWith({
        projectId,
        failedRunId: runId,
        idempotencyKey: expect.any(String),
      }),
    )
  })

  it('does not apply reduced-motion overrides to Preview descendants', () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')
    const reducedMotion = styles.match(
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/,
    )?.[1]

    expect(reducedMotion).toBeTruthy()
    expect(reducedMotion).not.toContain('.studio-workspace-shell *')
    expect(reducedMotion).not.toContain('.studio-preview-stage')
    expect(reducedMotion).not.toContain('.studio-preview-canvas')
    expect(reducedMotion).not.toContain('[aria-label="Video preview"]')
  })

  it('shows Chat and Preview together on desktop', () => {
    renderWorkspace()

    expect(screen.getByRole('region', { name: /对话|chat/i })).toBeTruthy()
    expect(screen.getByRole('region', { name: /预览|preview/i })).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('keeps one Preview mounted behind semantic mutually exclusive mobile tabs', async () => {
    installMatchMedia(false)
    renderWorkspace()

    const chatTab = screen.getByRole('tab', { name: /对话|chat/i })
    const previewTab = screen.getByRole('tab', { name: /预览|preview/i })
    expect(chatTab.getAttribute('aria-selected')).toBe('true')
    expect(previewTab.getAttribute('aria-selected')).toBe('false')
    expect(screen.getAllByTestId('studio-preview')).toHaveLength(1)
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)

    fireEvent.click(previewTab)

    await waitFor(() => {
      expect(chatTab.getAttribute('aria-selected')).toBe('false')
      expect(previewTab.getAttribute('aria-selected')).toBe('true')
      expect(screen.getAllByTestId('studio-preview')).toHaveLength(1)
      expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    })
  })

  it('delivers a mobile candidate while Chat remains selected', async () => {
    installMatchMedia(false)
    snapshot = {
      ...baseSnapshot,
      run: {
        _id: runId,
        status: 'compiling',
        correctionAttempt: 1,
        candidateCode: 'candidate source',
        candidateComposition: composition,
        candidateFingerprint: 'candidate-mobile',
      },
    }
    renderWorkspace()

    expect(
      screen.getByRole('tab', { name: /对话|chat/i }).getAttribute('aria-selected'),
    ).toBe('true')
    expect(screen.getByTestId('studio-preview')).toBeTruthy()
    await act(async () =>
      mocks.previewProps?.onCandidateResult({
        status: 'accepted',
        deliveryId: mocks.previewProps.candidate?.deliveryId ?? '',
        fingerprint: 'candidate-mobile',
      }),
    )

    expect(mocks.acceptCandidate).toHaveBeenCalledWith({
      projectId,
      runId,
      candidateFingerprint: 'candidate-mobile',
    })
  })
})
