import { useEffect, useMemo, useRef, useState } from 'react'
import { usePaginatedQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useI18n } from '#/components/I18nProvider'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Skeleton } from '#/components/ui/skeleton'
import type { Runtime } from '#/lib/catalog'
import CatalogCard from './CatalogCard'
import CatalogFilters from './CatalogFilters'

export default function CatalogGrid({ runtime }: { runtime?: Runtime }) {
  const { t } = useI18n()
  const [category, setCategory] = useState<string | undefined>()
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const args = useMemo(
    () => ({
      runtime,
      categories: category ? [category] : undefined,
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
  const categories = useMemo(
    () => Array.from(new Set(results.flatMap((item) => item.categories))).sort(),
    [results],
  )

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
        runtime={runtime}
        categories={categories}
        selectedCategory={category}
        onCategoryChange={setCategory}
      />
      {results.length === 0 && status === 'Exhausted' ? (
        <Alert>
          <AlertTitle>{t('catalog.emptyTitle')}</AlertTitle>
          <AlertDescription>{t('catalog.emptyDescription')}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((item) => (
          <CatalogCard key={item.componentId} item={item} />
        ))}
      </div>
      {status === 'LoadingFirstPage' ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
