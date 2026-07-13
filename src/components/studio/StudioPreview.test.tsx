// @vitest-environment jsdom

import type { ComponentType, ReactNode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioComposition } from '../../../shared/studio'
import StudioPreview, { type StudioPreviewProps } from './StudioPreview'

const compileStudioComponent = vi.hoisted(() => vi.fn())

vi.mock('../../lib/studio/compiler', () => ({ compileStudioComponent }))
vi.mock('@remotion/player', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  class InternalPlayerErrorBoundary extends React.Component<
    {
      children: ReactNode
      errorFallback?: (info: { error: Error }) => ReactNode
    },
    { error: Error | null }
  > {
    state = { error: null }

    static getDerivedStateFromError(error: Error) {
      return { error }
    }

    render() {
      if (this.state.error) {
        return this.props.errorFallback?.({ error: this.state.error }) ?? '⚠️'
      }
      return this.props.children
    }
  }

  return {
    Player: ({
      component: Component,
      durationInFrames,
      compositionWidth,
      compositionHeight,
      errorFallback,
    }: {
      component: ComponentType
      durationInFrames: number
      compositionWidth: number
      compositionHeight: number
      errorFallback?: (info: { error: Error }) => ReactNode
    }) => (
      <div
        data-testid="player"
        data-duration={durationInFrames}
        data-width={compositionWidth}
        data-height={compositionHeight}
      >
        <InternalPlayerErrorBoundary errorFallback={errorFallback}>
          <Component />
        </InternalPlayerErrorBoundary>
      </div>
    ),
  }
})

const composition: StudioComposition = {
  aspectRatio: '16:9',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
}

const sources = {
  good: 'export const MyAnimation = () => <div>Last good</div>',
  candidate: 'export const MyAnimation = () => <div>Candidate</div>',
  candidateTwo: 'export const MyAnimation = () => <div>Candidate two</div>',
  compileFailure: 'export const MyAnimation = () => <',
  runtimeFailure: 'export const MyAnimation = () => { throw new Error() }',
}

function LastGood() {
  return <div>Last good</div>
}

function Candidate() {
  return <div>Candidate</div>
}

function CandidateTwo() {
  return <div>Candidate two</div>
}

function RuntimeFailure(): never {
  throw new Error('Candidate runtime failure\nfull stack detail')
}

function createProps(): StudioPreviewProps {
  return {
    revisionId: 'revision-1',
    revisionCode: sources.good,
    revisionComposition: composition,
    candidate: null,
    onCandidateResult: vi.fn(),
    onRevisionRuntimeError: vi.fn(),
  }
}

describe('StudioPreview', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    compileStudioComponent.mockReset()
    compileStudioComponent.mockImplementation((source: string) => {
      if (source === sources.good) return LastGood
      if (source === sources.candidate) return Candidate
      if (source === sources.runtimeFailure) return RuntimeFailure
      throw new Error('studio-candidate.tsx: Unexpected token\nfull stack detail')
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('keeps the last runnable component when a candidate fails to compile', async () => {
    const props = createProps()
    const { rerender } = render(<StudioPreview {...props} />)
    expect(await screen.findByText('Last good')).toBeTruthy()

    rerender(
      <StudioPreview
        {...props}
        candidate={{
          code: sources.compileFailure,
          deliveryId: 'bad',
          fingerprint: 'bad',
          composition,
        }}
      />,
    )

    expect(await screen.findByText('Last good')).toBeTruthy()
    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'rejected',
        deliveryId: 'bad',
        fingerprint: 'bad',
        error: 'Unexpected token',
      }),
    )
  })

  it('replaces the Player only after a successful candidate commit', async () => {
    const props = createProps()
    const { rerender } = render(<StudioPreview {...props} />)
    expect(await screen.findByText('Last good')).toBeTruthy()

    rerender(
      <StudioPreview
        {...props}
        candidate={{
          code: sources.candidate,
          deliveryId: 'candidate-1',
          fingerprint: 'candidate-1',
          composition: { ...composition, width: 1080, height: 1080 },
        }}
      />,
    )

    expect(await screen.findByText('Candidate')).toBeTruthy()
    expect(screen.getByTestId('player').dataset.width).toBe('1080')
    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'accepted',
        deliveryId: 'candidate-1',
        fingerprint: 'candidate-1',
      }),
    )
  })

  it('restores the last runnable component after a candidate render fails', async () => {
    const props = createProps()
    const { rerender } = render(<StudioPreview {...props} />)
    expect(await screen.findByText('Last good')).toBeTruthy()

    rerender(
      <StudioPreview
        {...props}
        candidate={{
          code: sources.runtimeFailure,
          deliveryId: 'runtime-bad',
          fingerprint: 'runtime-bad',
          composition,
        }}
      />,
    )

    expect(await screen.findByText('Last good')).toBeTruthy()
    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'rejected',
        deliveryId: 'runtime-bad',
        fingerprint: 'runtime-bad',
        error: 'Candidate runtime failure',
      }),
    )
    expect(props.onCandidateResult).toHaveBeenCalledTimes(1)
    expect(props.onCandidateResult).not.toHaveBeenCalledWith({
      status: 'accepted',
      deliveryId: 'runtime-bad',
      fingerprint: 'runtime-bad',
    })
  })

  it('accepts the first candidate when no committed revision exists', async () => {
    const props = createProps()
    props.revisionId = null
    props.revisionCode = null
    props.candidate = {
      code: sources.candidate,
      deliveryId: 'first-candidate',
      fingerprint: 'first-candidate',
      composition,
    }

    render(<StudioPreview {...props} />)

    expect(await screen.findByText('Candidate')).toBeTruthy()
    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'accepted',
        deliveryId: 'first-candidate',
        fingerprint: 'first-candidate',
      }),
    )
  })

  it('rejects a failed first candidate without a fallback revision', async () => {
    const props = createProps()
    props.revisionId = null
    props.revisionCode = null
    props.candidate = {
      code: sources.compileFailure,
      deliveryId: 'first-bad',
      fingerprint: 'first-bad',
      composition,
    }

    render(<StudioPreview {...props} />)

    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'rejected',
        deliveryId: 'first-bad',
        fingerprint: 'first-bad',
        error: 'Unexpected token',
      }),
    )
    expect(screen.queryByTestId('player')).toBeNull()
  })

  it('preserves the candidate fallback when it becomes a committed revision', async () => {
    const props = createProps()
    let candidateCompiles = 0
    compileStudioComponent.mockImplementation((source: string) => {
      if (source === sources.good) return LastGood
      if (source === sources.candidate) {
        candidateCompiles += 1
        return candidateCompiles === 1 ? Candidate : RuntimeFailure
      }
      throw new Error('Unexpected source')
    })
    const { rerender } = render(<StudioPreview {...props} />)
    expect(await screen.findByText('Last good')).toBeTruthy()

    rerender(
      <StudioPreview
        {...props}
        candidate={{
          code: sources.candidate,
          deliveryId: 'promoted-candidate',
          fingerprint: 'promoted-candidate',
          composition,
        }}
      />,
    )
    expect(await screen.findByText('Candidate')).toBeTruthy()
    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'accepted',
        deliveryId: 'promoted-candidate',
        fingerprint: 'promoted-candidate',
      }),
    )

    rerender(
      <StudioPreview
        {...props}
        revisionId="revision-2"
        revisionCode={sources.candidate}
        candidate={null}
      />,
    )

    expect(await screen.findByText('Last good')).toBeTruthy()
    await waitFor(() =>
      expect(props.onRevisionRuntimeError).toHaveBeenCalledWith({
        revisionId: 'revision-2',
        error: 'Candidate runtime failure',
      }),
    )
  })

  it('unwraps every accepted candidate before committing a revision fallback', async () => {
    const props = createProps()
    let candidateTwoCompiles = 0
    compileStudioComponent.mockImplementation((source: string) => {
      if (source === sources.good) return LastGood
      if (source === sources.candidate) return Candidate
      if (source === sources.candidateTwo) {
        candidateTwoCompiles += 1
        return candidateTwoCompiles === 1 ? CandidateTwo : RuntimeFailure
      }
      throw new Error('Unexpected source')
    })
    const { rerender } = render(<StudioPreview {...props} />)
    expect(await screen.findByText('Last good')).toBeTruthy()

    rerender(
      <StudioPreview
        {...props}
        candidate={{
          code: sources.candidate,
          deliveryId: 'candidate-one',
          fingerprint: 'candidate-one',
          composition,
        }}
      />,
    )
    expect(await screen.findByText('Candidate')).toBeTruthy()

    rerender(
      <StudioPreview
        {...props}
        candidate={{
          code: sources.candidateTwo,
          deliveryId: 'candidate-two',
          fingerprint: 'candidate-two',
          composition,
        }}
      />,
    )
    expect(await screen.findByText('Candidate two')).toBeTruthy()

    rerender(
      <StudioPreview
        {...props}
        revisionId="revision-3"
        revisionCode={sources.candidateTwo}
        candidate={null}
      />,
    )

    expect(await screen.findByText('Last good')).toBeTruthy()
    expect(screen.queryByText('Candidate')).toBeNull()
  })

  it('reports a committed revision runtime failure once', async () => {
    const props = createProps()
    props.revisionId = 'revision-bad'
    props.revisionCode = sources.runtimeFailure
    const { rerender } = render(<StudioPreview {...props} />)

    await waitFor(() =>
      expect(props.onRevisionRuntimeError).toHaveBeenCalledWith({
        revisionId: 'revision-bad',
        error: 'Candidate runtime failure',
      }),
    )
    rerender(<StudioPreview {...props} />)
    expect(props.onRevisionRuntimeError).toHaveBeenCalledTimes(1)
  })

  it('compiles a candidate only when its fingerprint changes', async () => {
    const props = createProps()
    const candidate = {
      code: sources.candidate,
      deliveryId: 'stable-fingerprint',
      fingerprint: 'stable-fingerprint',
      composition,
    }
    const { rerender } = render(<StudioPreview {...props} />)
    expect(await screen.findByText('Last good')).toBeTruthy()

    rerender(<StudioPreview {...props} candidate={candidate} />)
    expect(await screen.findByText('Candidate')).toBeTruthy()
    rerender(
      <StudioPreview
        {...props}
        candidate={{ ...candidate, code: sources.compileFailure }}
      />,
    )

    await waitFor(() => expect(compileStudioComponent).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Candidate')).toBeTruthy()
  })

  it('does not recompile a terminal candidate after it disappears and returns', async () => {
    const props = createProps()
    const candidate = {
      code: sources.candidate,
      deliveryId: 'terminal-fingerprint',
      fingerprint: 'terminal-fingerprint',
      composition,
    }
    const { rerender } = render(<StudioPreview {...props} />)
    expect(await screen.findByText('Last good')).toBeTruthy()

    rerender(<StudioPreview {...props} candidate={candidate} />)
    expect(await screen.findByText('Candidate')).toBeTruthy()
    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'accepted',
        deliveryId: 'terminal-fingerprint',
        fingerprint: 'terminal-fingerprint',
      }),
    )

    rerender(<StudioPreview {...props} candidate={null} />)
    rerender(
      <StudioPreview
        {...props}
        candidate={{ ...candidate, code: sources.compileFailure }}
      />,
    )

    await waitFor(() => expect(compileStudioComponent).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Candidate')).toBeTruthy()
  })

  it('processes identical source fingerprints for distinct candidate deliveries', async () => {
    const props = createProps()
    const { rerender } = render(<StudioPreview {...props} />)
    expect(await screen.findByText('Last good')).toBeTruthy()

    rerender(
      <StudioPreview
        {...props}
        candidate={{
          code: sources.candidate,
          deliveryId: 'run-1:attempt-0',
          fingerprint: 'same-fingerprint',
          composition,
        }}
      />,
    )
    await waitFor(() => expect(props.onCandidateResult).toHaveBeenCalledTimes(1))

    rerender(
      <StudioPreview
        {...props}
        candidate={{
          code: sources.candidate,
          deliveryId: 'run-2:attempt-0',
          fingerprint: 'same-fingerprint',
          composition,
        }}
      />,
    )

    await waitFor(() => expect(props.onCandidateResult).toHaveBeenCalledTimes(2))
    expect(compileStudioComponent).toHaveBeenCalledTimes(3)
    expect(props.onCandidateResult).toHaveBeenLastCalledWith({
      status: 'accepted',
      deliveryId: 'run-2:attempt-0',
      fingerprint: 'same-fingerprint',
    })
  })
})
