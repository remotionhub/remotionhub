import { useI18n } from '#/components/I18nProvider'

export type CatalogFilterOption = {
  value: string
  label: string
  count?: number
}

export default function CatalogFilters({
  categories,
  tags,
  selectedCategory,
  onCategoryChange,
}: {
  categories: CatalogFilterOption[]
  tags: CatalogFilterOption[]
  selectedCategory?: string
  onCategoryChange: (category?: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="catalog-filters" aria-label={t('filters.categories')}>
      <div className="catalog-filter-row" aria-label={t('filters.categories')}>
        <button
          type="button"
          className="filter-chip"
          data-active={!selectedCategory}
          onClick={() => onCategoryChange(undefined)}
        >
          {t('filters.all')}
        </button>
        {categories.map((category) => (
          <button
            key={category.value}
            type="button"
            className="filter-chip"
            data-active={selectedCategory === category.value}
            onClick={() => onCategoryChange(category.value)}
          >
            {formatOptionLabel(category)}
          </button>
        ))}
      </div>

      {tags.length > 0 ? (
        <div className="catalog-tag-row" aria-label={t('filters.tags')}>
          <p className="catalog-tag-row-label">{t('filters.tags')}</p>
          <div className="catalog-tag-list">
            {tags.map((tag) => (
              <span key={tag.value} className="tag-chip">
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatOptionLabel(option: CatalogFilterOption) {
  return typeof option.count === 'number'
    ? `${option.label} (${option.count})`
    : option.label
}
