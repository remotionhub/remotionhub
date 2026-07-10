import { useMutation, useQuery } from 'convex/react'
import {
  Component,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { StudioComposition } from '../../../shared/studio'
import { useAuthStatus } from '../../lib/useAuthStatus'
import { useI18n } from '../I18nProvider'
import StudioChatPanel from './StudioChatPanel'
import StudioHistoryDialog from './StudioHistoryDialog'
import StudioPreview, {
  type CandidateResult,
  type RevisionRuntimeError,
} from './StudioPreview'
import StudioProjectBar from './StudioProjectBar'

const DESKTOP_QUERY = '(min-width: 900px)'

function subscribeToDesktopQuery(onStoreChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const media = window.matchMedia(DESKTOP_QUERY)
  media.addEventListener('change', onStoreChange)
  return () => media.removeEventListener('change', onStoreChange)
}

function getDesktopSnapshot() {
  return typeof window === 'undefined' || !window.matchMedia
    ? true
    : window.matchMedia(DESKTOP_QUERY).matches
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    getDesktopSnapshot,
    () => true,
  )
}

function normalizeWorkspaceError(error: string | undefined) {
  return (error ?? 'Preview failed').split(/\r?\n/, 1)[0].slice(0, 300)
}

function toStudioComposition(
  composition: Doc<'studioProjects'>['composition'],
): StudioComposition {
  return { ...composition, fps: 30 }
}

function StudioUnavailable() {
  const { t } = useI18n()
  return (
    <main className="studio-unavailable">
      <div>
        <h1>{t('studio.unavailable.title')}</h1>
        <p>{t('studio.unavailable.description')}</p>
      </div>
    </main>
  )
}

class WorkspaceQueryBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <StudioUnavailable /> : this.props.children
  }
}

function StudioLoading() {
  const { t } = useI18n()
  return (
    <main className="studio-unavailable">
      <p role="status">{t('auth.loading')}</p>
    </main>
  )
}

function MobileTabs({
  selected,
  onSelect,
}: {
  selected: 'chat' | 'preview'
  onSelect(tab: 'chat' | 'preview'): void
}) {
  const { t } = useI18n()
  const chatRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLButtonElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = selected === 'chat' ? 'preview' : 'chat'
    onSelect(next)
    ;(next === 'chat' ? chatRef : previewRef).current?.focus()
  }

  return (
    <div aria-label="Studio workspace" className="studio-mobile-tabs" role="tablist">
      <button
        aria-controls="studio-mobile-chat-panel"
        aria-selected={selected === 'chat'}
        id="studio-mobile-chat-tab"
        onClick={() => onSelect('chat')}
        onKeyDown={handleKeyDown}
        ref={chatRef}
        role="tab"
        tabIndex={selected === 'chat' ? 0 : -1}
        type="button"
      >
        {t('studio.tabs.chat')}
      </button>
      <button
        aria-controls="studio-mobile-preview-panel"
        aria-selected={selected === 'preview'}
        id="studio-mobile-preview-tab"
        onClick={() => onSelect('preview')}
        onKeyDown={handleKeyDown}
        ref={previewRef}
        role="tab"
        tabIndex={selected === 'preview' ? 0 : -1}
        type="button"
      >
        {t('studio.tabs.preview')}
      </button>
    </div>
  )
}

function StudioWorkspaceData({
  projectId,
  isAuthenticated,
  isAuthLoading,
}: {
  projectId: Id<'studioProjects'>
  isAuthenticated: boolean
  isAuthLoading: boolean
}) {
  const { t } = useI18n()
  const isDesktop = useIsDesktop()
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat')
  const [historyOpen, setHistoryOpen] = useState(false)
  const snapshot = useQuery(
    api.studio.getProject,
    isAuthenticated ? { projectId } : 'skip',
  )
  const messages = useQuery(
    api.studio.listMessages,
    isAuthenticated ? { projectId, limit: 100 } : 'skip',
  )
  const revisions = useQuery(
    api.studio.listRevisions,
    isAuthenticated ? { projectId, limit: 100 } : 'skip',
  )
  const updateProjectTitle = useMutation(api.studio.updateProjectTitle)
  const startFollowUp = useMutation(api.studio.startFollowUp)
  const acceptCandidate = useMutation(api.studio.acceptCandidate)
  const rejectCandidate = useMutation(api.studio.rejectCandidate)
  const reportRuntimeFailure = useMutation(api.studio.reportRuntimeFailure)
  const processedCandidateFingerprints = useRef(new Set<string>())
  const latestCandidateFingerprint = useRef<string | null>(null)
  const reportedRuntimeFailures = useRef(new Set<string>())

  const candidateFingerprint = snapshot?.run?.candidateFingerprint ?? null
  useEffect(() => {
    if (
      !candidateFingerprint ||
      latestCandidateFingerprint.current === candidateFingerprint
    ) {
      return
    }
    if (latestCandidateFingerprint.current !== null) {
      const alreadyProcessedCurrent =
        processedCandidateFingerprints.current.has(candidateFingerprint)
      processedCandidateFingerprints.current.clear()
      if (alreadyProcessedCurrent) {
        processedCandidateFingerprints.current.add(candidateFingerprint)
      }
    }
    latestCandidateFingerprint.current = candidateFingerprint
  }, [candidateFingerprint])

  if (!isAuthenticated) return <StudioUnavailable />
  if (isAuthLoading || snapshot === undefined) return <StudioLoading />
  if (snapshot === null) return <StudioUnavailable />

  const { project, revision, run } = snapshot
  const runIsActive =
    run !== null &&
    run.status !== 'failed' &&
    run.status !== 'cancelled' &&
    run.status !== 'succeeded'
  const projectComposition = toStudioComposition(project.composition)
  const revisionComposition = revision
    ? toStudioComposition(revision.composition)
    : projectComposition
  const candidate =
    run?.candidateCode &&
    run.candidateComposition &&
    run.candidateFingerprint
      ? {
          code: run.candidateCode,
          composition: toStudioComposition(run.candidateComposition),
          fingerprint: run.candidateFingerprint,
        }
      : null

  const handleCandidateResult = async (result: CandidateResult) => {
    if (
      !run ||
      run.candidateFingerprint !== result.fingerprint ||
      processedCandidateFingerprints.current.has(result.fingerprint)
    ) {
      return
    }
    processedCandidateFingerprints.current.add(result.fingerprint)
    try {
      if (result.status === 'accepted') {
        await acceptCandidate({
          projectId,
          runId: run._id,
          candidateFingerprint: result.fingerprint,
        })
      } else {
        await rejectCandidate({
          projectId,
          runId: run._id,
          candidateFingerprint: result.fingerprint,
          normalizedError: normalizeWorkspaceError(result.error),
        })
      }
    } catch {
      processedCandidateFingerprints.current.delete(result.fingerprint)
    }
  }

  const handleRevisionRuntimeError = async (result: RevisionRuntimeError) => {
    if (reportedRuntimeFailures.current.has(result.revisionId)) return
    reportedRuntimeFailures.current.add(result.revisionId)
    try {
      await reportRuntimeFailure({
        projectId,
        revisionId: result.revisionId as Id<'studioRevisions'>,
        normalizedError: normalizeWorkspaceError(result.error),
      })
    } catch {
      reportedRuntimeFailures.current.delete(result.revisionId)
    }
  }

  const submitFollowUp = async (prompt: string) => {
    if (!revision || runIsActive) return
    await startFollowUp({
      projectId,
      prompt,
      expectedCurrentRevisionId: revision._id,
      idempotencyKey: crypto.randomUUID(),
    })
  }

  const chatPanel = (
    <StudioChatPanel
      disabled={!revision || runIsActive}
      messages={messages ?? []}
      onSubmit={submitFollowUp}
      run={run}
    />
  )
  const previewPanel = (
    <section aria-label={t('studio.preview.label')} className="studio-preview-stage">
      <div
        className="studio-preview-canvas"
        data-aspect-ratio={(candidate?.composition ?? revisionComposition).aspectRatio}
      >
        <StudioPreview
          candidate={candidate}
          onCandidateResult={handleCandidateResult}
          onRevisionRuntimeError={handleRevisionRuntimeError}
          revisionCode={revision?.code ?? null}
          revisionComposition={revisionComposition}
          revisionId={revision?._id ?? null}
        />
      </div>
    </section>
  )

  return (
    <main className="studio-workspace-shell">
      <StudioProjectBar
        composition={projectComposition}
        onOpenHistory={() => setHistoryOpen(true)}
        onSaveTitle={(title) => updateProjectTitle({ projectId, title })}
        sourceKind={project.source.kind}
        title={project.title}
      />

      {isDesktop ? (
        <div className="studio-workspace-grid">
          {chatPanel}
          {previewPanel}
        </div>
      ) : (
        <div className="studio-mobile-workspace">
          <MobileTabs selected={mobileTab} onSelect={setMobileTab} />
          {mobileTab === 'chat' ? (
            <div
              aria-labelledby="studio-mobile-chat-tab"
              id="studio-mobile-chat-panel"
              role="tabpanel"
            >
              {chatPanel}
            </div>
          ) : (
            <div
              aria-labelledby="studio-mobile-preview-tab"
              id="studio-mobile-preview-panel"
              role="tabpanel"
            >
              {previewPanel}
            </div>
          )}
        </div>
      )}

      {historyOpen && revision ? (
        <StudioHistoryDialog
          currentRevisionId={revision._id}
          onClose={() => setHistoryOpen(false)}
          open
          projectId={projectId}
          revisions={revisions ?? []}
        />
      ) : null}
    </main>
  )
}

export default function StudioWorkspace({
  projectId,
}: {
  projectId: Id<'studioProjects'>
}) {
  const { isAuthenticated, isLoading } = useAuthStatus()
  return (
    <WorkspaceQueryBoundary key={projectId}>
      <StudioWorkspaceData
        isAuthenticated={isAuthenticated}
        isAuthLoading={isLoading}
        projectId={projectId}
      />
    </WorkspaceQueryBoundary>
  )
}
