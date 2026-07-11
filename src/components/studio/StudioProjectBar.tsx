import { HistoryIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Doc } from '../../../convex/_generated/dataModel'
import type { StudioComposition } from '../../../shared/studio'
import { useI18n } from '../I18nProvider'

export type StudioProjectBarProps = {
  title: string
  sourceKind: Doc<'studioProjects'>['source']['kind']
  composition: StudioComposition
  onSaveTitle(title: string): Promise<string>
  onOpenHistory(): void
}

export default function StudioProjectBar({
  title,
  sourceKind,
  composition,
  onSaveTitle,
  onOpenHistory,
}: StudioProjectBarProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(title)
  const [savedValue, setSavedValue] = useState(title.trim())
  const savedValueRef = useRef(title.trim())
  const latestInputRef = useRef(title)
  const previousTitleRef = useRef(title)
  const saveTitleRef = useRef(onSaveTitle)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveInFlightRef = useRef<string | null>(null)
  const queuedTitleRef = useRef<string | null>(null)
  saveTitleRef.current = onSaveTitle

  useEffect(() => {
    if (latestInputRef.current === previousTitleRef.current) {
      latestInputRef.current = title
      setDraft(title)
      savedValueRef.current = title.trim()
      setSavedValue(title.trim())
    }
    previousTitleRef.current = title
  }, [title])

  const drainSaveQueue = async () => {
    if (saveInFlightRef.current !== null) return

    while (queuedTitleRef.current !== null) {
      const nextTitle = queuedTitleRef.current
      queuedTitleRef.current = null
      saveInFlightRef.current = nextTitle
      try {
        const saved = await saveTitleRef.current(nextTitle)
        if (latestInputRef.current.trim() === saved) {
          savedValueRef.current = saved
          setSavedValue(saved)
        }
      } catch {
        // Keep the unsaved state visible so the next edit or blur can retry.
      } finally {
        saveInFlightRef.current = null
      }
    }
  }

  const save = (value: string) => {
    const normalized = value.trim()
    if (
      !normalized ||
      normalized.length > 120 ||
      (normalized === savedValueRef.current &&
        saveInFlightRef.current === null)
    ) {
      return
    }
    queuedTitleRef.current =
      normalized === saveInFlightRef.current ? null : normalized
    void drainSaveQueue()
  }

  useEffect(() => {
    const normalized = draft.trim()
    if (!normalized || normalized.length > 120 || normalized === savedValue) {
      return
    }
    timerRef.current = setTimeout(() => void save(draft), 600)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [draft, savedValue])

  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    void save(latestInputRef.current)
  }

  const durationSeconds = composition.durationInFrames / composition.fps
  const durationLabel = Number.isInteger(durationSeconds)
    ? String(durationSeconds)
    : durationSeconds.toFixed(1)
  const isSaved = draft.trim() === savedValue

  return (
    <header className="studio-project-bar">
      <div className="studio-project-title-group">
        <input
          aria-label="Project title"
          className="studio-project-title"
          maxLength={120}
          onBlur={handleBlur}
          onChange={(event) => {
            latestInputRef.current = event.target.value
            setDraft(event.target.value)
          }}
          value={draft}
        />
        <span className="studio-save-state" role="status">
          {t(isSaved ? 'studio.project.saved' : 'studio.project.saving')}
        </span>
      </div>

      <div className="studio-project-metadata">
        <span>
          {t(
            sourceKind === 'catalog-remix'
              ? 'studio.project.sourceRemix'
              : 'studio.project.sourcePrompt',
          )}
        </span>
        <span aria-label="Composition">
          {composition.aspectRatio} · {durationLabel}s · {composition.fps}fps
        </span>
      </div>

      <button
        className="studio-history-button"
        onClick={onOpenHistory}
        type="button"
      >
        <HistoryIcon aria-hidden="true" size={15} />
        {t('studio.history.label')}
      </button>
    </header>
  )
}
