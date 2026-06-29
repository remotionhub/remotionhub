import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import {
  buildVersionFingerprint,
  catalogComponentSchema,
  type CatalogComponent,
} from '../shared/catalog'

type Args = {
  apply: boolean
  dryRun: boolean
  localOnly: boolean
  target: string
}

function parseArgs(argv: string[]): Args {
  const apply = argv.includes('--apply')

  return {
    apply,
    dryRun: argv.includes('--dry-run') || !apply,
    localOnly: argv.includes('--local-only'),
    target:
      argv
        .find((arg) => arg.startsWith('--target='))
        ?.slice('--target='.length) ?? 'dev',
  }
}

async function loadLocalEnv() {
  const envPath = path.resolve('.env.local')
  try {
    const raw = await fs.readFile(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      const separator = trimmed.indexOf('=')
      if (separator === -1) {
        continue
      }

      const key = trimmed.slice(0, separator)
      const value = trimmed.slice(separator + 1).replace(/^["']|["']$/g, '')
      process.env[key] ??= value
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

async function readCatalogFiles() {
  const dir = path.resolve('catalog/components')
  const names = (await fs.readdir(dir))
    .filter((name) => name.endsWith('.json'))
    .sort()

  return await Promise.all(
    names.map(async (name) => {
      const filePath = path.join(dir, name)
      const raw = await fs.readFile(filePath, 'utf8')
      return { filePath, json: JSON.parse(raw) as unknown }
    }),
  )
}

function toImportPayload(
  component: CatalogComponent,
  catalogFile: string,
  importSecret: string,
) {
  return {
    importSecret,
    publisher: component.publisher,
    publisherDisplayName: component.publisher === 'remotionlab' ? 'RemotionLab' : `@${component.publisher}`,
    runtime: component.runtime,
    slug: component.slug,
    displayName: component.displayName,
    displayNameZh: component.displayNameZh,
    summary: component.summary,
    summaryZh: component.summaryZh,
    categories: component.categories,
    tags: component.tags,
    status: component.status,
    catalogFile,
    versions: component.versions.map((version) => ({
      ...version,
      fingerprint: buildVersionFingerprint(version),
      artifact: {
        ...version.artifact,
        githubSource: version.artifact.githubSource
          ? {
              ...version.artifact.githubSource,
              pinned: /^[a-f0-9]{6,40}$/i.test(version.artifact.githubSource.commit),
            }
          : undefined,
      },
    })),
  }
}

async function main() {
  await loadLocalEnv()

  const args = parseArgs(process.argv.slice(2))
  const configuredConvexUrl =
    process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL
  const importSecret = process.env.CATALOG_IMPORT_SECRET
  const willWrite = args.apply && !args.dryRun && !args.localOnly

  if (willWrite && !configuredConvexUrl) {
    throw new Error('CONVEX_URL or VITE_CONVEX_URL is required for --apply.')
  }
  if (willWrite && !importSecret) {
    throw new Error('CATALOG_IMPORT_SECRET is required for --apply.')
  }
  if (
    willWrite &&
    args.target === 'production' &&
    !process.env.CONVEX_DEPLOY_KEY
  ) {
    throw new Error('CONVEX_DEPLOY_KEY is required for production imports.')
  }

  const files = await readCatalogFiles()
  const payloads = files.map(({ filePath, json }) => {
    const parsed = catalogComponentSchema.parse(json)
    return toImportPayload(parsed, filePath, importSecret ?? '')
  })

  console.log(`Validated ${payloads.length} catalog component(s).`)
  for (const payload of payloads) {
    console.log(
      `- ${payload.runtime}/${payload.publisher}/${payload.slug}: ` +
        `${payload.versions.length} version(s)`,
    )
  }

  if (args.dryRun || args.localOnly) {
    console.log('Dry-run complete. No Convex writes performed.')
    return
  }

  const convexUrl = configuredConvexUrl
  if (!convexUrl) {
    throw new Error('CONVEX_URL or VITE_CONVEX_URL is required.')
  }

  const client = new ConvexHttpClient(convexUrl)
  for (const payload of payloads) {
    const result = await client.mutation(
      api.components.importCatalogComponent,
      payload,
    )
    console.log(
      `Imported ${payload.runtime}/${payload.publisher}/${payload.slug}: ` +
        `${result.createdVersions} created, ${result.skippedVersions} skipped`,
    )
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
