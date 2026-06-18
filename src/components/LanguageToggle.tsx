import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { resolveLocale } from '#/lib/i18n'
import { useI18n } from './I18nProvider'

export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()

  return (
    <ToggleGroup
      aria-label={t('language.label')}
      value={[locale]}
      onValueChange={(value) => {
        if (value[0]) {
          setLocale(resolveLocale(value[0]))
        }
      }}
      size="sm"
      spacing={0}
      className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] p-0.5 shadow-[0_8px_22px_rgba(30,90,72,0.08)]"
    >
      <ToggleGroupItem className="rounded-full px-2.5" value="zh">
        {t('language.zh')}
      </ToggleGroupItem>
      <ToggleGroupItem
        className="relative rounded-full px-2.5 before:absolute before:left-[-0.125rem] before:top-1/2 before:-translate-y-1/2 before:text-xs before:text-[var(--sea-ink-soft)] before:content-['/']"
        value="en"
      >
        {t('language.en')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
