import { Link } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge } from '#/components/ui/badge'
import { buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { useI18n } from '#/components/I18nProvider'
import { runtimeLabelKey } from '#/lib/catalog'
import { getLocalizedTag } from '#/lib/tags'
import CopyButton from './CopyButton'
import PreviewMedia from './PreviewMedia'

export type CatalogDetail = {
  publisher: { handle: string; displayName: string }
  component: {
    runtime: 'remotion' | 'hyperframes'
    slug: string
    displayName: string
    displayNameZh?: string
    summary: string
    summaryZh?: string
    tags: string[]
    categories: string[]
    latestIsPrerelease?: boolean
  }
  selectedVersion: {
    version: string
    changelog: string
    preview: { thumbnailUrl?: string; previewVideoUrl?: string }
    metadata: {
      runtime: 'remotion' | 'hyperframes'
      entryPoint: string
      aspectRatios: string[]
      durationFrames?: number
      fps?: number
    }
    createdAt: number
  }
  versions: Array<{ version: string }>
  artifact: {
    githubSource: {
      repo: string
      ref: string
      commit: string
      path: string
      pinned: boolean
    }
    license: string
    usageMarkdown: string
    agentPrompt: string
  }
}

export default function DetailPage({ detail }: { detail: CatalogDetail }) {
  const { locale, t } = useI18n()
  const displayName = locale === 'zh' ? (detail.component.displayNameZh ?? detail.component.displayName) : detail.component.displayName
  const summary = locale === 'zh' ? (detail.component.summaryZh ?? detail.component.summary) : detail.component.summary
  const sourceTreeRef =
    detail.artifact.githubSource.commit || detail.artifact.githubSource.ref
  const sourceUrl = `https://github.com/${detail.artifact.githubSource.repo}/tree/${sourceTreeRef}/${detail.artifact.githubSource.path}`
  const backTo =
    detail.component.runtime === 'remotion' ? '/remotion' : '/hyperframes'
  const backLabel =
    detail.component.runtime === 'remotion'
      ? t('detail.backRemotion')
      : t('detail.backHyperframes')
  const visibleTags = detail.component.tags.filter(
    (tag) => tag !== detail.component.runtime,
  )

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <Link to={backTo} className="text-sm text-muted-foreground">
        {backLabel}
      </Link>

      <div className="aspect-video overflow-hidden rounded-lg bg-muted">
        <PreviewMedia
          video
          preview={detail.selectedVersion.preview}
          title={displayName}
          className="flex size-full items-center justify-center object-cover text-3xl font-semibold text-muted-foreground"
        />
      </div>

      <header className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t('detail.versionBy', {
            version: detail.selectedVersion.version,
            publisher: detail.publisher.displayName,
          })}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {displayName}
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          {summary}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge>{t(runtimeLabelKey(detail.component.runtime))}</Badge>
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {getLocalizedTag(tag, locale as 'zh' | 'en')}
            </Badge>
          ))}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('detail.entry')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {detail.selectedVersion.metadata.entryPoint}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('detail.aspect')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {detail.selectedVersion.metadata.aspectRatios.join(', ')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('detail.timing')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t('detail.timingValue', {
              frames: detail.selectedVersion.metadata.durationFrames ?? '-',
              fps: detail.selectedVersion.metadata.fps ?? '-',
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('detail.license')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {detail.artifact.license}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('detail.source')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {detail.artifact.githubSource.repo}
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="prompt">
        <TabsList>
          <TabsTrigger value="prompt">{t('detail.agentPrompt')}</TabsTrigger>
          <TabsTrigger value="source">{t('detail.githubSource')}</TabsTrigger>
          <TabsTrigger value="usage">{t('detail.usage')}</TabsTrigger>
        </TabsList>
        <TabsContent value="prompt" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <CopyButton value={detail.artifact.agentPrompt} />
          </div>
          <Textarea value={detail.artifact.agentPrompt} readOnly rows={8} />
        </TabsContent>
        <TabsContent value="source">
          <Card>
            <CardHeader>
              <CardTitle>{detail.artifact.githubSource.repo}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>
                {t('detail.ref')}: {detail.artifact.githubSource.ref}
              </p>
              <p>
                {t('detail.commit')}: {detail.artifact.githubSource.commit}
              </p>
              <p>
                {t('detail.path')}: {detail.artifact.githubSource.path}
              </p>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ className: 'w-fit' })}
              >
                {t('detail.openSource')}
              </a>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="usage" className="prose max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {detail.artifact.usageMarkdown}
          </ReactMarkdown>
        </TabsContent>
      </Tabs>
    </main>
  )
}
