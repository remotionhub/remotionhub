import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '#/components/I18nProvider'
import { Button } from '#/components/ui/button'

export default function CopyButton({
  value,
  label,
}: {
  value: string
  label?: string
}) {
  const { t } = useI18n()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        toast.success(t('toast.copied'))
      }}
    >
      <CopyIcon data-icon="inline-start" />
      {label ?? t('detail.copyPrompt')}
    </Button>
  )
}
