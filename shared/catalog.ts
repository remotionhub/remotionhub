import crypto from 'node:crypto'
import semver from 'semver'
import { z } from 'zod'
import { isValidTag } from '../src/lib/tags'

export const tagSchema = z.string().min(1).refine(isValidTag, {
  message: 'Tag must be a valid core tag from the taxonomy.',
})


export const runtimeSchema = z.union([
  z.literal('remotion'),
  z.literal('hyperframes'),
])
export type CatalogRuntime = z.infer<typeof runtimeSchema>

export const componentStatusSchema = z.union([
  z.literal('draft'),
  z.literal('published'),
  z.literal('unlisted'),
  z.literal('removed'),
])
export type ComponentStatus = z.infer<typeof componentStatusSchema>

export const publisherHandlePattern =
  /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/
export const componentSlugPattern =
  /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/

const httpsUrlSchema = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith('https://') || value.startsWith('http://localhost'),
    {
      message: 'Preview URLs must use https:// unless they target localhost.',
    },
  )

export const previewSchema = z.object({
  thumbnailUrl: httpsUrlSchema.optional(),
  previewVideoUrl: httpsUrlSchema.optional(),
  demoUrl: httpsUrlSchema.optional(),
})

export const metadataSchema = z.object({
  runtime: runtimeSchema,
  entryPoint: z.string().min(1).optional(),
  aspectRatios: z.array(z.string().min(1)).min(1),
  durationFrames: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
})

export const artifactSchema = z
  .object({
    kind: z.union([z.literal('github-source'), z.literal('none')]),
    githubSource: z
      .object({
        repo: z
          .string()
          .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
          .refine((value) => value === 'remotionhub/remotionhub-assets', {
            message:
              'RemotionHub catalog source must use remotionhub/remotionhub-assets.',
          }),
        ref: z.string().min(1),
        commit: z.string().min(6),
        path: z.string().min(1),
        pinned: z.boolean().optional(),
      })
      .optional(),
    license: z.string().min(1),
    usageMarkdown: z.string().min(1),
    agentPrompt: z.string().min(1),
  })
  .refine(
    (data) => {
      if (data.kind === 'github-source') {
        return data.githubSource !== undefined
      }
      return true
    },
    {
      message: 'githubSource is required when kind is github-source',
      path: ['githubSource'],
    },
  )

export const catalogVersionSchema = z
  .object({
    version: z.string().refine((value) => semver.valid(value) !== null, {
      message: 'Version must be valid semver.',
    }),
    changelog: z.string().min(1),
    preview: previewSchema,
    metadata: metadataSchema,
    tags: z.array(tagSchema).default([]),
    artifact: artifactSchema,
  })
  .refine(
    (data) => {
      if (data.artifact.kind === 'github-source') {
        return data.metadata.entryPoint !== undefined
      }
      return true
    },
    {
      message: 'entryPoint is required when artifact.kind is github-source',
      path: ['metadata', 'entryPoint'],
    },
  )
export type CatalogVersion = z.infer<typeof catalogVersionSchema>

export const catalogComponentSchema = z
  .object({
    publisher: z.string().regex(publisherHandlePattern),
    runtime: runtimeSchema,
    slug: z.string().regex(componentSlugPattern),
    displayName: z.string().min(1),
    displayNameZh: z.string().min(1).optional(),
    summary: z.string().min(1),
    summaryZh: z.string().min(1).optional(),
    categories: z.array(z.string().min(1)).min(1),
    tags: z.array(tagSchema).default([]),
    status: componentStatusSchema.default('published'),
    versions: z.array(catalogVersionSchema).min(1),
  })
  .superRefine((component, ctx) => {
    for (const [index, version] of component.versions.entries()) {
      if (version.metadata.runtime !== component.runtime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Version metadata runtime must match component runtime.',
          path: ['versions', index, 'metadata', 'runtime'],
        })
      }
    }
  })
export type CatalogComponent = z.infer<typeof catalogComponentSchema>

export function isActiveStatus(status: ComponentStatus) {
  return status === 'published'
}

export function chooseLatestVersion(
  versions: Array<{ version: string; createdAt: number }>,
): { version: string; latestIsPrerelease: boolean } {
  const valid = versions.filter((item) => semver.valid(item.version))
  const stable = valid.filter((item) => semver.prerelease(item.version) === null)
  const candidates = stable.length > 0 ? stable : valid

  if (candidates.length === 0) {
    throw new Error('No valid semver versions available.')
  }

  const sorted = [...candidates].sort((left, right) =>
    semver.rcompare(left.version, right.version),
  )
  const latest = sorted[0]
  if (!latest) {
    throw new Error('No valid semver versions available.')
  }

  return {
    version: latest.version,
    latestIsPrerelease: stable.length === 0,
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

export function buildVersionFingerprint(version: unknown) {
  return crypto.createHash('sha256').update(stableStringify(version)).digest('hex')
}
