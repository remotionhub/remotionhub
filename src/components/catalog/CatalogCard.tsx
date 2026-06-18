import { Link } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import type { Runtime } from '#/lib/catalog'
import PreviewMedia from './PreviewMedia'

export type CatalogCardItem = {
  runtime: Runtime
  ownerHandle: string
  slug: string
  displayName: string
  summary: string
  tags: string[]
  categories: string[]
  latestVersionSummary: {
    version: string
    preview: { thumbnailUrl?: string; previewVideoUrl?: string }
    metadata: { aspectRatios: string[] }
  }
}

export default function CatalogCard({ item }: { item: CatalogCardItem }) {
  const visibleBadges = Array.from(new Set([item.runtime, ...item.tags])).slice(
    0,
    3,
  )
  const to =
    item.runtime === 'remotion'
      ? '/remotion/$owner/$slug'
      : '/hyperframes/$owner/$slug'

  return (
    <Link
      to={to}
      params={{ owner: item.ownerHandle, slug: item.slug }}
      className="group block no-underline"
    >
      <Card className="h-full overflow-hidden rounded-lg border-[var(--line)] bg-[var(--card)] transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="aspect-video overflow-hidden bg-muted">
          <PreviewMedia
            preview={item.latestVersionSummary.preview}
            title={item.displayName}
            className="flex size-full items-center justify-center object-cover text-2xl font-semibold text-muted-foreground transition group-hover:scale-[1.02]"
          />
        </div>
        <CardHeader className="gap-1 px-4 pb-2 pt-4">
          <CardTitle className="truncate text-base">{item.displayName}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {item.summary}
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 px-4 pb-4 pt-0">
          {visibleBadges.map((badge) => (
            <Badge key={badge} variant="secondary">
              {badge}
            </Badge>
          ))}
        </CardFooter>
      </Card>
    </Link>
  )
}
