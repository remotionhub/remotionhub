import { useEffect, useMemo, useRef, useState } from 'react'
import { usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useI18n } from '#/components/I18nProvider'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Skeleton } from '#/components/ui/skeleton'
import type { Runtime } from '#/lib/catalog'
import { getLocalizedTag } from '#/lib/tags'
import CatalogCard from './CatalogCard'
import CatalogFilters from './CatalogFilters'

export default function CatalogGrid({ runtime }: { runtime?: Runtime }) {
  const { t, locale } = useI18n()
  const [category, setCategory] = useState<string | undefined>()
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const args = useMemo(
    () => ({
      runtime,
      categories: category
        ? category === 'intro-outro'
          ? ['intro', 'outro']
          : [category]
        : undefined,
    }),
    [category, runtime],
  )
  const { results, status, loadMore } = usePaginatedQuery(
    api.components.listCatalog,
    args,
    {
      initialNumItems: 12,
    },
  )
  const facets = useQuery(api.components.getCatalogFacets, { runtime })

  const categoryOptions = useMemo(() => {
    if (!facets) return []
    const rawCategories = Object.entries(facets.categories)
    const introEntry = rawCategories.find(([k]) => k === 'intro')
    const outroEntry = rawCategories.find(([k]) => k === 'outro')
    const combinedCount = (introEntry?.[1] ?? 0) + (outroEntry?.[1] ?? 0)

    const filtered = rawCategories.filter(([k]) => k !== 'intro' && k !== 'outro')
    const options = filtered.map(([value, count]) => ({
      value,
      label: value,
      count,
    }))

    if (combinedCount > 0) {
      options.push({
        value: 'intro-outro',
        label: 'intro-outro',
        count: combinedCount,
      })
    }

    return options.sort((a, b) => a.value.localeCompare(b.value))
  }, [facets])

  const tagOptions = useMemo(() => {
    if (!facets) return []
    return Object.entries(facets.tags)
      .map(([value, count]) => ({
        value,
        label: getLocalizedTag(value, locale as 'zh' | 'en'),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [facets, locale])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || status !== 'CanLoadMore') {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore(12)
      }
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, status])

  return (
    <section className="flex flex-col gap-6">
      <CatalogFilters
        categories={categoryOptions}
        tags={tagOptions}
        selectedCategory={category}
        onCategoryChange={setCategory}
      />
      <div className="catalog-divider" />
      {results.length === 0 && status === 'Exhausted' ? (
        <Alert>
          <AlertTitle>{t('catalog.emptyTitle')}</AlertTitle>
          <AlertDescription>{t('catalog.emptyDescription')}</AlertDescription>
        </Alert>
      ) : null}
      <div className="catalog-grid">
        {results.map((item) => (
          <CatalogCard key={item.componentId} item={item} />
        ))}
      </div>
      {status === 'LoadingFirstPage' ? (
        <div className="catalog-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="aspect-video rounded-lg" />
          ))}
        </div>
      ) : null}
      {status === 'LoadingMore' ? (
        <p className="text-sm text-muted-foreground">{t('catalog.loadingMore')}</p>
      ) : null}
      {status === 'CanLoadMore' ? (
        <div ref={sentinelRef} className="h-10" aria-hidden />
      ) : null}
      {status === 'Exhausted' && results.length > 0 ? (
        <p className="text-sm text-muted-foreground">{t('catalog.end')}</p>
      ) : null}
    </section>
  )
}
