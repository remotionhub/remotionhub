import { SendIcon } from 'lucide-react'
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Doc } from '../../../convex/_generated/dataModel'
import type { TranslationKey } from '../../lib/i18n'
import { useI18n } from '../I18nProvider'

const runPhaseKey = {
  queued: 'studio.status.validating',
  validating: 'studio.status.validating',
  'selecting-skills': 'studio.status.selectingSkills',
  generating: 'studio.status.generating',
  compiling: 'studio.status.compiling',
  succeeded: 'studio.status.ready',
  failed: 'studio.status.failed',
  cancelled: 'studio.status.failed',
} as const satisfies Record<Doc<'studioGenerationRuns'>['status'], TranslationKey>

export type StudioChatMessage = Pick<
  Doc<'studioMessages'>,
  'role' | 'kind' | 'content' | 'createdAt'
> & { _id: string }

export type StudioChatRun = Pick<
  Doc<'studioGenerationRuns'>,
  'status' | 'errorCode'
>

export type StudioChatPanelProps = {
  messages: StudioChatMessage[]
  run: StudioChatRun | null
  disabled: boolean
  onSubmit(prompt: string): Promise<unknown> | unknown
  onRetry?(): Promise<unknown> | unknown
}

export default function StudioChatPanel({
  messages,
  run,
  disabled,
  onSubmit,
  onRetry,
}: StudioChatPanelProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFailed, setSubmitFailed] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const isDisabled = disabled || isSubmitting

  const submit = async (prompt: string) => {
    const normalized = prompt.trim()
    if (!normalized || isDisabled) return

    setSubmitFailed(false)
    setIsSubmitting(true)
    try {
      await onSubmit(normalized)
      if (draftRef.current.trim() === normalized) setDraft('')
    } catch {
      setSubmitFailed(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submit(draft)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }
    event.preventDefault()
    void submit(draft)
  }

  const retry = async () => {
    if (!onRetry || isSubmitting) return
    setSubmitFailed(false)
    setIsSubmitting(true)
    try {
      await onRetry()
    } catch {
      setSubmitFailed(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const runError =
    run?.status === 'failed'
      ? run.errorCode === 'INVALID_PROMPT'
        ? t('studio.error.invalidPrompt')
        : t('studio.error.modelUnavailable')
      : null

  return (
    <section aria-label={t('studio.chat.label')} className="studio-chat-panel">
      <div className="studio-chat-scroll">
        <h1 className="studio-pane-heading">{t('studio.chat.label')}</h1>
        <ol className="studio-message-list">
          {messages
            .filter((message) => message.role !== 'system')
            .map((message) => (
              <li
                className="studio-message"
                data-role={message.role}
                key={message._id}
              >
                <span className="studio-message-role">
                  {message.role === 'user' ? 'You' : 'Studio'}
                </span>
                <p>{message.content}</p>
              </li>
            ))}
        </ol>

        {run ? (
          <div className="studio-run-phase" role="status">
            <span aria-hidden="true" className="studio-run-dot" />
            <span>{t(runPhaseKey[run.status])}</span>
          </div>
        ) : null}

        {runError ? (
          <div className="studio-run-error" role="alert">
            <p>{runError}</p>
            {onRetry ? (
              <button
                className="studio-text-button"
                disabled={isSubmitting}
                onClick={() => void retry()}
                type="button"
              >
                {t('studio.retry')}
              </button>
            ) : null}
          </div>
        ) : null}

        {submitFailed ? (
          <p className="studio-inline-error" role="alert">
            {t('studio.error.modelUnavailable')}
          </p>
        ) : null}
      </div>

      <form className="studio-composer" onSubmit={handleSubmit}>
        <textarea
          aria-label={t('studio.chat.placeholder')}
          disabled={isDisabled}
          maxLength={4_000}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('studio.chat.placeholder')}
          rows={3}
          value={draft}
        />
        <button
          aria-label={t('studio.chat.send')}
          className="studio-send-button"
          disabled={isDisabled || !draft.trim()}
          type="submit"
        >
          <SendIcon aria-hidden="true" size={15} />
          {t('studio.chat.send')}
        </button>
      </form>
    </section>
  )
}
