import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { useI18n } from '#/components/I18nProvider'
import type { Runtime } from '#/lib/catalog'

export default function CatalogFilters({
  runtime,
  categories,
  selectedCategory,
  onCategoryChange,
}: {
  runtime?: Runtime
  categories: string[]
  selectedCategory?: string
  onCategoryChange: (category?: string) => void
}) {
  const { t } = useI18n()
  const runtimeLabel =
    runtime === 'remotion'
      ? t('filters.remotionCatalog')
      : t('filters.hyperframesCatalog')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{runtime ? runtimeLabel : t('filters.allRuntimes')}</span>
      </div>
      <ToggleGroup
        value={[selectedCategory ?? 'all']}
        onValueChange={(value) =>
          onCategoryChange(value[0] && value[0] !== 'all' ? value[0] : undefined)
        }
        className="flex flex-wrap justify-start gap-2"
      >
        <ToggleGroupItem value="all">{t('filters.all')}</ToggleGroupItem>
        {categories.map((category) => (
          <ToggleGroupItem key={category} value={category}>
            {category}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
