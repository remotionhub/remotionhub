import { createFileRoute } from '@tanstack/react-router'
import { useI18n } from '#/components/I18nProvider'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About RemotionHub' },
      {
        name: 'description',
        content:
          'RemotionHub is a catalog for versioned Remotion and HyperFrames components.',
      },
    ],
  }),
  component: About,
})

function About() {
  const { t } = useI18n()

  return (
    <main className="page-wrap px-4 py-12">
      <section className="rounded-lg border bg-card p-6 text-card-foreground sm:p-8">
        <p className="island-kicker mb-2">{t('about.eyebrow')}</p>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('about.title')}
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-muted-foreground">
          {t('about.description')}
        </p>
      </section>
    </main>
  )
}
