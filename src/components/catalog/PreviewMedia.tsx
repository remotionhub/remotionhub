import { useState } from 'react'
import { useI18n } from '#/components/I18nProvider'

type Preview = {
  thumbnailUrl?: string
  previewVideoUrl?: string
}

export default function PreviewMedia({
  preview,
  title,
  className,
  video = false,
  'aria-label': ariaLabel,
}: {
  preview: Preview
  title: string
  className?: string
  video?: boolean
  'aria-label'?: string
}) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const src = failed ? undefined : preview.thumbnailUrl
  const previewLabel = t('preview.label', { title })
  const unavailableLabel = t('preview.unavailable', { title })

  if (video && preview.previewVideoUrl && !failed) {
    return (
      <video
        className={className}
        controls
        aria-label={ariaLabel ?? previewLabel}
        poster={preview.thumbnailUrl}
        preload="metadata"
        onError={() => setFailed(true)}
      >
        <source src={preview.previewVideoUrl} />
      </video>
    )
  }

  if (!src) {
    return (
      <div
        className={className}
        role="img"
        aria-label={ariaLabel ?? unavailableLabel}
        data-testid="preview-fallback"
      >
        <span>{title.slice(0, 1).toUpperCase()}</span>
      </div>
    )
  }

  return (
    <img
      className={className}
      src={src}
      alt={ariaLabel ?? previewLabel}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
