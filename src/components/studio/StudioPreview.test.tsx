// @vitest-environment jsdom

import type { ComponentType } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioComposition } from '../../../shared/studio'
import StudioPreview from './StudioPreview'

const compileStudioComponent = vi.hoisted(() => vi.fn())

vi.mock('../../lib/studio/compiler', () => ({ compileStudioComponent }))
vi.mock('@remotion/player', () => ({
  Player: ({
    component: Component,
    durationInFrames,
    compositionWidth,
    compositionHeight,
  }: {
    component: ComponentType
    durationInFrames: number
    compositionWidth: number
    compositionHeight: number
  }) => (
    <div
      data-testid="player"
      data-duration={durationInFrames}
      data-width={compositionWidth}
      data-height={compositionHeight}
    >
      <Component />
    </div>
  ),
}))

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
  compileFailure: 'export const MyAnimation = () => <',
  runtimeFailure: 'export const MyAnimation = () => { throw new Error() }',
}

function LastGood() {
  return <div>Last good</div>
}

function Candidate() {
  return <div>Candidate</div>
}

function RuntimeFailure(): never {
  throw new Error('Candidate runtime failure\nfull stack detail')
}

function createProps() {
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
          fingerprint: 'bad',
          composition,
        }}
      />,
    )

    expect(await screen.findByText('Last good')).toBeTruthy()
    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'rejected',
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
          fingerprint: 'runtime-bad',
          composition,
        }}
      />,
    )

    expect(await screen.findByText('Last good')).toBeTruthy()
    await waitFor(() =>
      expect(props.onCandidateResult).toHaveBeenCalledWith({
        status: 'rejected',
        fingerprint: 'runtime-bad',
        error: 'Candidate runtime failure',
      }),
    )
    expect(props.onCandidateResult).toHaveBeenCalledTimes(1)
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
})
