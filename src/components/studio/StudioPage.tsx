import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../../../convex/_generated/api'
import { useI18n } from '#/components/I18nProvider'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Skeleton } from '#/components/ui/skeleton'

const STUDIO_DEFAULT_ASPECT_RATIO = '16:9'
const STUDIO_DEFAULT_DURATION_SECONDS = 15
const STUDIO_CANCEL_REASON = 'Canceled from studio.'

type RetrySignature = {
  key: string
  signature: string
}

type StudioTemplate = {
  templateId: string
  templateVersion: string
  runtime: 'remotion'
  status: 'active' | 'inactive'
  priority: number
  supportedAspectRatios: string[]
  supportedResolutions: Array<{ width: number; height: number }>
  fps: number
  propsSchemaVersion: string
  propsSchema: Record<string, unknown>
  agentPrompt: string
  tags: string[]
  previewStorageKey?: string
  licenseStatus: 'pending' | 'approved' | 'blocked'
}

function templateIdentity(template: {
  templateId: string
  templateVersion: string
}) {
  return `${template.templateId}@${template.templateVersion}`
}

function formatTemplateName(templateId: string) {
  return templateId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatTimestamp(locale: string, value: number | null) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Unknown studio error.'
}

export default function StudioPage() {
  const { locale, t } = useI18n()
  const templates = useQuery(api.studio.listStudioTemplates, {})
  const history = useQuery(api.studio.getMyStudioHistory, {})
  const createGenerationJob = useMutation(api.studio.createGenerationJob)
  const cancelGenerationJob = useMutation(api.studio.cancelGenerationJob)
  const [prompt, setPrompt] = useState('')
  const [selectedTemplateIdentity, setSelectedTemplateIdentity] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<Id<'generationJobs'> | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [retrySignature, setRetrySignature] = useState<RetrySignature | null>(null)

  const studioTemplates = templates as StudioTemplate[] | undefined
  const recommendedTemplate = studioTemplates?.[0] ?? null
  const selectedTemplate = useMemo(
    () =>
      studioTemplates?.find(
        (template) => templateIdentity(template) === selectedTemplateIdentity,
      ) ?? null,
    [selectedTemplateIdentity, studioTemplates],
  )
  const visibleHistory = useMemo(() => (history ?? []).slice(0, 10), [history])
  const selectedHistoryJob =
    visibleHistory.find((job) => job.id === selectedJobId) ?? null
  const selectedJob = useQuery(
    api.studio.getGenerationJob,
    selectedJobId ? { jobId: selectedJobId } : 'skip',
  )
  const isSelectedJobPending = Boolean(
    selectedJobId && selectedJob === undefined && !selectedHistoryJob,
  )
  const currentJob = selectedJobId
    ? selectedJob ?? selectedHistoryJob ?? null
    : visibleHistory[0] ?? null
  const artifactAccess = useQuery(
    api.studio.getGenerationArtifactAccess,
    currentJob?.status === 'completed' && currentJob.artifactId
      ? { jobId: currentJob.id }
      : 'skip',
  )
  const selectedTemplateResolution = selectedTemplate?.supportedResolutions?.[0] ?? null
  const canGenerate = Boolean(selectedTemplate && prompt.trim() && !isSubmitting)
  const canCancel = currentJob?.status === 'queued' || currentJob?.status === 'planning'

  useEffect(() => {
    if (!selectedJobId && visibleHistory[0]) {
      setSelectedJobId(visibleHistory[0].id)
    }
  }, [selectedJobId, visibleHistory])

  function applyTemplate(template: StudioTemplate) {
    setSelectedTemplateIdentity(templateIdentity(template))
    setPrompt(template.agentPrompt)
    setSubmissionError(null)
  }

  async function handleCreateJob() {
    if (!selectedTemplate) {
      return
    }

    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      return
    }

    const aspectRatio =
      selectedTemplate.supportedAspectRatios[0] ?? STUDIO_DEFAULT_ASPECT_RATIO
    const signature = JSON.stringify({
      prompt: trimmedPrompt,
      templateId: selectedTemplate.templateId,
      templateVersion: selectedTemplate.templateVersion,
      aspectRatio,
      durationSeconds: STUDIO_DEFAULT_DURATION_SECONDS,
    })
    const idempotencyKey =
      retrySignature?.signature === signature
        ? retrySignature.key
        : crypto.randomUUID()

    setRetrySignature({ key: idempotencyKey, signature })
    setSubmissionError(null)
    setIsSubmitting(true)

    try {
      const createdJob = await createGenerationJob({
        idempotencyKey,
        prompt: trimmedPrompt,
        templateId: selectedTemplate.templateId,
        templateVersion: selectedTemplate.templateVersion,
        aspectRatio,
        durationSeconds: STUDIO_DEFAULT_DURATION_SECONDS,
        assetIds: [],
      })
      setRetrySignature(null)
      setSelectedJobId(createdJob.id)
    } catch (error) {
      setSubmissionError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancelJob() {
    if (!currentJob || !canCancel) {
      return
    }

    const confirmed = window.confirm(
      currentJob.status === 'planning'
        ? t('studio.cancelConfirmPlanning')
        : t('studio.cancelConfirmQueued'),
    )
    if (!confirmed) {
      return
    }

    setSubmissionError(null)
    setIsCanceling(true)

    try {
      const canceledJob = await cancelGenerationJob({
        jobId: currentJob.id,
        reason: STUDIO_CANCEL_REASON,
      })
      setSelectedJobId(canceledJob.id)
    } catch (error) {
      setSubmissionError(getErrorMessage(error))
    } finally {
      setIsCanceling(false)
    }
  }

  return (
    <main className="studio-page page-wrap">
      <section className="studio-hero">
        <p className="island-kicker">{t('studio.eyebrow')}</p>
        <div className="studio-hero-copy">
          <h1>{t('studio.title')}</h1>
          <p>{t('studio.description')}</p>
        </div>
      </section>

      <div className="studio-workbench">
        <section
          className="studio-panel studio-prompt-panel"
          data-studio-section="prompt"
        >
          <div className="studio-panel-header">
            <div>
              <p className="studio-panel-kicker">{t('studio.promptKicker')}</p>
              <h2>{t('studio.promptTitle')}</h2>
            </div>
            {selectedTemplate ? (
              <span className="studio-chip studio-chip-active">
                {t('studio.templateSelected', {
                  template: formatTemplateName(selectedTemplate.templateId),
                })}
              </span>
            ) : (
              <span className="studio-chip">{t('studio.templateGate')}</span>
            )}
          </div>

          <label className="studio-label" htmlFor="studio-prompt-input">
            {t('studio.promptLabel')}
          </label>
          <textarea
            id="studio-prompt-input"
            className="studio-textarea"
            rows={7}
            aria-label={t('studio.promptLabel')}
            placeholder={t('studio.promptPlaceholder')}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />

          <div className="studio-inline-summary">
            <div>
              <span>{t('studio.aspectLabel')}</span>
              <strong>
                {selectedTemplate?.supportedAspectRatios?.[0] ??
                  STUDIO_DEFAULT_ASPECT_RATIO}
              </strong>
            </div>
            <div>
              <span>{t('studio.durationLabel')}</span>
              <strong>{STUDIO_DEFAULT_DURATION_SECONDS}s</strong>
            </div>
            <div>
              <span>{t('studio.fpsLabel')}</span>
              <strong>{selectedTemplate?.fps ?? 30}</strong>
            </div>
          </div>

          {submissionError ? (
            <Alert variant="destructive">
              <AlertTitle>{t('studio.errorTitle')}</AlertTitle>
              <AlertDescription>{submissionError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="studio-actions">
            {recommendedTemplate && !selectedTemplate ? (
              <button
                type="button"
                className="studio-secondary-button"
                onClick={() => applyTemplate(recommendedTemplate)}
              >
                {t('studio.useRecommended')}
              </button>
            ) : null}

            <button
              type="button"
              className="studio-primary-button"
              disabled={!canGenerate}
              onClick={handleCreateJob}
            >
              {isSubmitting ? t('studio.generating') : t('studio.generate')}
            </button>
          </div>
        </section>

        <section
          className="studio-panel studio-result-panel"
          data-studio-section="result"
        >
          <div className="studio-panel-header">
            <div>
              <p className="studio-panel-kicker">{t('studio.resultKicker')}</p>
              <h2>{t('studio.resultTitle')}</h2>
            </div>
            {currentJob ? (
              <span className={`studio-status-pill studio-status-${currentJob.status}`}>
                {formatStatusLabel(currentJob.status)}
              </span>
            ) : isSelectedJobPending ? (
              <Skeleton
                className="studio-status-pill"
                data-testid="studio-selected-job-loading-pill"
              />
            ) : null}
          </div>

          {isSelectedJobPending ? (
            <div
              className="studio-result-stack"
              aria-busy="true"
              data-testid="studio-selected-job-loading"
            >
              <div className="studio-job-summary">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-20 rounded-2xl" />
                ))}
              </div>
              <div className="studio-empty-result">
                <h3>{t('studio.resultTitle')}</h3>
                <p>{t('studio.generating')}</p>
              </div>
            </div>
          ) : currentJob ? (
            <div className="studio-result-stack">
              <div className="studio-job-summary">
                <div>
                  <span>{t('studio.statusLabel')}</span>
                  <strong>{formatStatusLabel(currentJob.status)}</strong>
                </div>
                <div>
                  <span>{t('studio.progressLabel')}</span>
                  <strong>{currentJob.progress}%</strong>
                </div>
                <div>
                  <span>{t('studio.updatedLabel')}</span>
                  <strong>{formatTimestamp(locale, currentJob.updatedAt)}</strong>
                </div>
              </div>

              <div className="studio-result-copy">
                <p className="studio-result-prompt">{currentJob.prompt}</p>
                <dl className="studio-parameter-grid">
                  <div>
                    <dt>{t('studio.templateLabel')}</dt>
                    <dd>{formatTemplateName(currentJob.templateId)}</dd>
                  </div>
                  <div>
                    <dt>{t('studio.aspectLabel')}</dt>
                    <dd>{currentJob.aspectRatio}</dd>
                  </div>
                  <div>
                    <dt>{t('studio.durationLabel')}</dt>
                    <dd>{currentJob.durationSeconds}s</dd>
                  </div>
                  <div>
                    <dt>{t('studio.runtimeLabel')}</dt>
                    <dd>{currentJob.runtime}</dd>
                  </div>
                </dl>
              </div>

              {artifactAccess ? (
                <div className="studio-artifact-card">
                  <div className="studio-artifact-media">
                    <video
                      data-testid="studio-video"
                      className="studio-video"
                      controls
                      src={artifactAccess.playback.url}
                      poster={artifactAccess.thumbnail.url}
                    />
                  </div>
                  <div className="studio-artifact-actions">
                    <a
                      className="studio-secondary-button"
                      href={artifactAccess.playback.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('studio.preview')}
                    </a>
                    <a
                      className="studio-primary-link"
                      href={artifactAccess.download.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('studio.download')}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="studio-empty-result">
                  <h3>{t('studio.emptyResultTitle')}</h3>
                  <p>
                    {currentJob.status === 'completed'
                      ? t('studio.artifactPending')
                      : t('studio.emptyResultDescription')}
                  </p>
                </div>
              )}

              {canCancel ? (
                <button
                  type="button"
                  className="studio-text-button"
                  disabled={isCanceling}
                  onClick={handleCancelJob}
                >
                  {isCanceling ? t('studio.canceling') : t('studio.cancel')}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="studio-empty-result">
              <h3>{t('studio.emptyResultTitle')}</h3>
              <p>{t('studio.emptyResultDescription')}</p>
            </div>
          )}
        </section>

        <section
          className="studio-panel studio-templates-panel"
          data-studio-section="templates"
        >
          <div className="studio-panel-header">
            <div>
              <p className="studio-panel-kicker">{t('studio.templatesKicker')}</p>
              <h2>{t('studio.templatesTitle')}</h2>
            </div>
          </div>

          {studioTemplates === undefined ? (
            <div className="studio-template-track">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton
                  key={index}
                  className="studio-template-skeleton"
                />
              ))}
            </div>
          ) : studioTemplates.length === 0 ? (
            <Alert>
              <AlertTitle>{t('studio.templatesEmptyTitle')}</AlertTitle>
              <AlertDescription>
                {t('studio.templatesEmptyDescription')}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="studio-template-track">
              {studioTemplates.map((template, index) => {
                const isActive =
                  selectedTemplateIdentity === templateIdentity(template)

                return (
                  <button
                    key={templateIdentity(template)}
                    type="button"
                    className="studio-template-card"
                    data-active={isActive}
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="studio-template-card-top">
                      <div>
                        <h3>{formatTemplateName(template.templateId)}</h3>
                        <p>{template.agentPrompt}</p>
                      </div>
                      {index === 0 ? (
                        <span className="studio-chip studio-chip-accent">
                          {t('studio.recommended')}
                        </span>
                      ) : null}
                    </div>
                    <div className="studio-template-card-meta">
                      <span>{template.supportedAspectRatios.join(', ')}</span>
                      <span>
                        {template.supportedResolutions[0]?.width}×
                        {template.supportedResolutions[0]?.height}
                      </span>
                      <span>{template.fps} fps</span>
                    </div>
                    <div className="studio-template-card-tags">
                      {template.tags.map((tag: string) => (
                        <span key={tag} className="studio-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section
          className="studio-panel studio-history-panel"
          data-studio-section="history"
        >
          <div className="studio-panel-header">
            <div>
              <p className="studio-panel-kicker">{t('studio.historyKicker')}</p>
              <h2>{t('studio.historyTitle')}</h2>
            </div>
          </div>

          {visibleHistory.length === 0 ? (
            <p className="studio-history-empty">{t('studio.historyEmpty')}</p>
          ) : (
            <ul className="studio-history-list">
              {visibleHistory.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    className="studio-history-item"
                    data-active={job.id === currentJob?.id}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <div className="studio-history-item-top">
                      <strong>{formatStatusLabel(job.status)}</strong>
                      <span>{formatTimestamp(locale, job.updatedAt)}</span>
                    </div>
                    <p>{job.prompt}</p>
                    <div className="studio-history-item-meta">
                      <span>{job.aspectRatio}</span>
                      <span>{job.durationSeconds}s</span>
                      <span>{formatTemplateName(job.templateId)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedTemplateResolution ? (
            <div className="studio-resolution-note">
              {selectedTemplateResolution.width}×{selectedTemplateResolution.height}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
