import { XIcon } from 'lucide-react'
import { useMutation } from 'convex/react'
import { useState } from 'react'
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
  const [restoreError, setRestoreError] = useState(false)

  if (!open) return null

  const restore = async () => {
    if (!selectedRevisionId || isRestoring) return
    setRestoreError(false)
    setIsRestoring(true)
    try {
      await rollbackRevision({
        projectId,
        revisionId: selectedRevisionId,
        expectedCurrentRevisionId: currentRevisionId,
      })
      onClose()
    } catch (error) {
      if (error instanceof Error && error.message.includes('Studio project changed')) {
        setRestoreError(true)
      }
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="studio-dialog-backdrop">
      <section
        aria-label={t('studio.history.label')}
        aria-modal="true"
        className="studio-history-dialog"
        role="dialog"
      >
        <header className="studio-history-header">
          <h2>{t('studio.history.label')}</h2>
          <button
            aria-label="Close"
            className="studio-dialog-close"
            onClick={onClose}
            type="button"
          >
            <XIcon aria-hidden="true" size={17} />
          </button>
        </header>

        {restoreError ? (
          <p className="studio-history-error" role="alert">
            {t('studio.error.projectChanged')}
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
                    className={selected ? 'studio-confirm-button' : 'studio-text-button'}
                    disabled={isRestoring}
                    onClick={() => {
                      if (selected) void restore()
                      else setSelectedRevisionId(revision._id)
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
      </section>
    </div>
  )
}
