import { createFileRoute } from '@tanstack/react-router'
import CatalogGrid from '#/components/catalog/CatalogGrid'
import { useI18n } from '#/components/I18nProvider'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'RemotionHub' },
      {
        name: 'description',
        content:
          'Browse Remotion and HyperFrames assets with previews, source links, and agent prompts.',
      },
    ],
  }),
  component: Home,
})

function Home() {
  const { t } = useI18n()

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t('home.eyebrow')}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {t('home.title')}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {t('home.description')}
        </p>
      </header>
      <CatalogGrid />
    </main>
  )
}
