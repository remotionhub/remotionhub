import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Player } from '@remotion/player'
import { createClientOnlyFn } from '@tanstack/react-start'
import type { StudioComposition } from '../../../shared/studio'

const loadStudioCompiler = createClientOnlyFn(
  () => import('../../lib/studio/compiler'),
)

type StudioCandidate = {
  code: string
  deliveryId: string
  fingerprint: string
  composition: StudioComposition
}

export type CandidateResult = {
  status: 'accepted' | 'rejected'
  deliveryId: string
  fingerprint: string
  error?: string
}

export type RevisionRuntimeError = {
  revisionId: string
  error: string
}

export type StudioPreviewProps = {
  revisionId: string | null
  revisionCode: string | null
  revisionComposition: StudioComposition
  candidate: StudioCandidate | null
  onCandidateResult(result: CandidateResult): void
  onRevisionRuntimeError(result: RevisionRuntimeError): void
}

type PreviewEntry = {
  key: string
  component: ComponentType<Record<string, never>>
  composition: StudioComposition
  source:
    | { kind: 'candidate'; deliveryId: string; fingerprint: string }
    | { kind: 'revision'; revisionId: string | null }
  previous: PreviewEntry | null
}

type PreviewErrorBoundaryProps = {
  children: ReactNode
  onError(error: unknown): void
}

function getCommittedFallback(entry: PreviewEntry | null) {
  let fallback = entry
  while (fallback?.source.kind === 'candidate') {
    fallback = fallback.previous
  }
  return fallback
}

class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function PreviewCommitProbe({
  entryKey,
  onCommit,
}: {
  entryKey: string
  onCommit(entryKey: string): void
}) {
  useEffect(() => onCommit(entryKey), [entryKey, onCommit])
  return null
}

function PlayerErrorBridge({ error }: { error: Error }): never {
  // Remotion Player catches composition errors internally. Rethrow from its
  // fallback so the preview boundary can restore the correct previous entry.
  throw error
}

function normalizePreviewError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const firstLine = message.split(/\r?\n/, 1)[0] ?? 'Studio preview failed'
  return firstLine
    .replace(/^studio-candidate\.tsx:\s*/, '')
    .slice(0, 300)
}

export default function StudioPreview({
  revisionId,
  revisionCode,
  revisionComposition,
  candidate,
  onCandidateResult,
  onRevisionRuntimeError,
}: StudioPreviewProps) {
  const [active, setActive] = useState<PreviewEntry | null>(null)
  const [lastGoodKey, setLastGoodKey] = useState<string | null>(null)
  const [status, setStatus] = useState('Loading preview')
  const activeRef = useRef<PreviewEntry | null>(null)
  const lastGoodRef = useRef<PreviewEntry | null>(null)
  const candidateRef = useRef(candidate)
  const revisionCompositionRef = useRef(revisionComposition)
  const onCandidateResultRef = useRef(onCandidateResult)
  const onRevisionRuntimeErrorRef = useRef(onRevisionRuntimeError)
  const processedCandidateDeliveryRef = useRef<string | null>(null)
  const candidateResultsRef = useRef(new Map<string, CandidateResult['status']>())
  const failedRevisionIdsRef = useRef(new Set<string>())
  const entrySequenceRef = useRef(0)

  candidateRef.current = candidate
  revisionCompositionRef.current = revisionComposition
  onCandidateResultRef.current = onCandidateResult
  onRevisionRuntimeErrorRef.current = onRevisionRuntimeError

  const showEntry = useCallback((entry: PreviewEntry | null) => {
    activeRef.current = entry
    setActive(entry)
  }, [])

  const notifyCandidate = useCallback((result: CandidateResult) => {
    // Candidate results are terminal; after acceptance, recovery is revision-owned.
    const { deliveryId } = result
    if (candidateResultsRef.current.has(deliveryId)) return
    candidateResultsRef.current.set(deliveryId, result.status)
    onCandidateResultRef.current(result)
  }, [])

  const notifyRevisionFailure = useCallback(
    (failedRevisionId: string, error: string) => {
      if (failedRevisionIdsRef.current.has(failedRevisionId)) return
      failedRevisionIdsRef.current.add(failedRevisionId)
      onRevisionRuntimeErrorRef.current({ revisionId: failedRevisionId, error })
    },
    [],
  )

  const handleCommit = useCallback(
    (entryKey: string) => {
      const entry = activeRef.current
      if (!entry || entry.key !== entryKey) return

      lastGoodRef.current = entry
      setLastGoodKey(entry.key)
      setStatus('')
      if (entry.source.kind === 'candidate') {
        notifyCandidate({
          status: 'accepted',
          deliveryId: entry.source.deliveryId,
          fingerprint: entry.source.fingerprint,
        })
      }
    },
    [notifyCandidate],
  )

  const handleRuntimeError = useCallback(
    (error: unknown) => {
      const failedEntry = activeRef.current
      if (!failedEntry) return

      const normalizedError = normalizePreviewError(error)
      if (lastGoodRef.current?.key === failedEntry.key) {
        lastGoodRef.current = failedEntry.previous
        setLastGoodKey(failedEntry.previous?.key ?? null)
      }
      showEntry(failedEntry.previous)
      setStatus(`Preview error: ${normalizedError}`)

      if (failedEntry.source.kind === 'candidate') {
        notifyCandidate({
          status: 'rejected',
          deliveryId: failedEntry.source.deliveryId,
          fingerprint: failedEntry.source.fingerprint,
          error: normalizedError,
        })
      } else if (failedEntry.source.revisionId) {
        notifyRevisionFailure(failedEntry.source.revisionId, normalizedError)
      }
    },
    [notifyCandidate, notifyRevisionFailure, showEntry],
  )

  useEffect(() => {
    if (!revisionCode) {
      lastGoodRef.current = null
      setLastGoodKey(null)
      showEntry(null)
      setStatus('No preview source')
      return
    }

    const currentLastGood = lastGoodRef.current
    const previous = getCommittedFallback(currentLastGood)
    if (currentLastGood?.source.kind === 'candidate') {
      lastGoodRef.current = previous
      setLastGoodKey(previous?.key ?? null)
    }
    let cancelled = false
    void loadStudioCompiler()
      .then(({ compileStudioComponent }) => {
        if (cancelled) return
        const component = compileStudioComponent(revisionCode)
        if (cancelled) return
        entrySequenceRef.current += 1
        showEntry({
          key: `revision-${entrySequenceRef.current}`,
          component,
          composition: revisionCompositionRef.current,
          source: { kind: 'revision', revisionId },
          previous,
        })
        setStatus('Loading preview')
      })
      .catch((error) => {
        if (cancelled) return
        const normalizedError = normalizePreviewError(error)
        showEntry(previous)
        setStatus(`Preview error: ${normalizedError}`)
        if (revisionId) notifyRevisionFailure(revisionId, normalizedError)
      })
    return () => {
      cancelled = true
    }
  }, [notifyRevisionFailure, revisionCode, revisionId, showEntry])

  const candidateDeliveryId = candidate?.deliveryId ?? null
  useEffect(() => {
    if (!candidateDeliveryId) return
    if (
      candidateResultsRef.current.has(candidateDeliveryId) ||
      (revisionCode !== null && !lastGoodKey) ||
      processedCandidateDeliveryRef.current === candidateDeliveryId
    ) {
      return
    }

    const currentCandidate = candidateRef.current
    const previous = lastGoodRef.current
    if (
      !currentCandidate ||
      currentCandidate.deliveryId !== candidateDeliveryId
    ) {
      return
    }

    processedCandidateDeliveryRef.current = candidateDeliveryId
    let cancelled = false
    void loadStudioCompiler()
      .then(({ compileStudioComponent }) => {
        if (cancelled) return
        const component = compileStudioComponent(currentCandidate.code)
        if (cancelled) return
        entrySequenceRef.current += 1
        showEntry({
          key: `candidate-${entrySequenceRef.current}`,
          component,
          composition: currentCandidate.composition,
          source: {
            kind: 'candidate',
            deliveryId: candidateDeliveryId,
            fingerprint: currentCandidate.fingerprint,
          },
          previous,
        })
        setStatus('Loading candidate preview')
      })
      .catch((error) => {
        if (cancelled) return
        const normalizedError = normalizePreviewError(error)
        setStatus(`Preview error: ${normalizedError}`)
        notifyCandidate({
          status: 'rejected',
          deliveryId: candidateDeliveryId,
          fingerprint: currentCandidate.fingerprint,
          error: normalizedError,
        })
      })
    return () => {
      cancelled = true
      if (
        !candidateResultsRef.current.has(candidateDeliveryId) &&
        processedCandidateDeliveryRef.current === candidateDeliveryId
      ) {
        processedCandidateDeliveryRef.current = null
      }
    }
  }, [
    candidateDeliveryId,
    lastGoodKey,
    notifyCandidate,
    revisionCode,
    showEntry,
  ])

  return (
    <section aria-label="Studio preview">
      {status ? <p role="status">{status}</p> : null}
      <div aria-label="Video preview">
        {active ? (
          <PreviewErrorBoundary
            key={active.key}
            onError={handleRuntimeError}
          >
            <Player
              component={active.component}
              durationInFrames={active.composition.durationInFrames}
              fps={30}
              compositionWidth={active.composition.width}
              compositionHeight={active.composition.height}
              errorFallback={({ error }) => (
                <PlayerErrorBridge error={error} />
              )}
              controls
              loop
            />
            <PreviewCommitProbe
              entryKey={active.key}
              onCommit={handleCommit}
            />
          </PreviewErrorBoundary>
        ) : null}
      </div>
    </section>
  )
}
