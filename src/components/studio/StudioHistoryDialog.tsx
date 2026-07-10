import { Dialog } from '@base-ui/react/dialog'
import { useMutation } from 'convex/react'
import { XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { TranslationKey } from '../../lib/i18n'
import { useI18n } from '../I18nProvider'

const originKey = {
  prompt: 'studio.revision.originPrompt',
  'catalog-remix': 'studio.revision.originRemix',
  'follow-up': 'studio.revision.originFollowUp',
  correction: 'studio.revision.originCorrection',
  rollback: 'studio.revision.originRollback',
} as const satisfies Record<Doc<'studioRevisions'>['origin'], TranslationKey>

export type StudioHistoryRevision = Pick<
  Doc<'studioRevisions'>,
  'sequence' | 'origin' | 'assistantSummary' | 'createdAt'
> & { _id: Id<'studioRevisions'> }

export type StudioHistoryDialogProps = {
  open: boolean
  projectId: Id<'studioProjects'>
  currentRevisionId: Id<'studioRevisions'>
  revisions: StudioHistoryRevision[]
  onClose(): void
}

export default function StudioHistoryDialog({
  open,
  projectId,
  currentRevisionId,
  revisions,
  onClose,
}: StudioHistoryDialogProps) {
  const { locale, t } = useI18n()
  const rollbackRevision = useMutation(api.studio.rollbackRevision)
  const [selectedRevisionId, setSelectedRevisionId] =
    useState<Id<'studioRevisions'> | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<'stale' | 'failed' | null>(
    null,
  )
  const restoreCycle = useRef(0)

  useEffect(() => {
    restoreCycle.current += 1
    setSelectedRevisionId(null)
    setRestoreError(null)
    setIsRestoring(false)
  }, [open])

  const restore = async () => {
    if (!selectedRevisionId || isRestoring) return
    const cycle = ++restoreCycle.current
    setRestoreError(null)
    setIsRestoring(true)
    try {
      await rollbackRevision({
        projectId,
        revisionId: selectedRevisionId,
        expectedCurrentRevisionId: currentRevisionId,
      })
      if (restoreCycle.current !== cycle) return
      onClose()
    } catch (error) {
      if (restoreCycle.current !== cycle) return
      if (error instanceof Error && error.message.includes('Studio project changed')) {
        setRestoreError('stale')
      } else {
        setRestoreError('failed')
      }
    } finally {
      if (restoreCycle.current === cycle) setIsRestoring(false)
    }
  }

  return (
    <Dialog.Root
      modal
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="studio-dialog-backdrop" />
        <Dialog.Viewport className="studio-dialog-viewport">
          <Dialog.Popup
            aria-label={t('studio.history.label')}
            className="studio-history-dialog"
          >
            <header className="studio-history-header">
              <Dialog.Title>{t('studio.history.label')}</Dialog.Title>
              <Dialog.Close aria-label="Close" className="studio-dialog-close">
                <XIcon aria-hidden="true" size={17} />
              </Dialog.Close>
            </header>

            {restoreError ? (
              <p className="studio-history-error" role="alert">
                {t(
                  restoreError === 'stale'
                    ? 'studio.error.projectChanged'
                    : 'studio.error.restoreFailed',
                )}
              </p>
            ) : null}

            <ol className="studio-history-list">
              {revisions.map((revision) => {
                const selected = selectedRevisionId === revision._id
                const current = revision._id === currentRevisionId
                return (
                  <li className="studio-history-entry" key={revision._id}>
                    <div className="studio-history-entry-copy">
                      <div>
                        <strong>#{revision.sequence}</strong>
                        <span>{t(originKey[revision.origin])}</span>
                        <time dateTime={new Date(revision.createdAt).toISOString()}>
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(revision.createdAt)}
                        </time>
                      </div>
                      <p>{revision.assistantSummary}</p>
                    </div>
                    {current ? null : (
                      <button
                        className={
                          selected
                            ? 'studio-confirm-button'
                            : 'studio-text-button'
                        }
                        disabled={isRestoring}
                        onClick={() => {
                          if (selected) void restore()
                          else {
                            setRestoreError(null)
                            setSelectedRevisionId(revision._id)
                          }
                        }}
                        type="button"
                      >
                        {t(
                          selected
                            ? 'studio.history.confirm'
                            : 'studio.history.restore',
                        )}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
