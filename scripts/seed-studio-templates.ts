import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import {
  p0StudioTemplateSeed,
  type StudioTemplateSeed,
} from '../convex/lib/studio/templates'

type SeedClient = {
  mutation(
    mutation: unknown,
    args: StudioTemplateSeed,
  ): Promise<{ created: boolean }>
}

export async function loadLocalEnv(
  env = process.env,
  envPath = path.resolve('.env.local'),
): Promise<void> {
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
      env[key] ??= value
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

export async function runSeedStudioTemplates(
  env = process.env,
  clientFactory: (url: string) => SeedClient = (url) => new ConvexHttpClient(url),
): Promise<void> {
  await loadLocalEnv(env)

  const convexUrl = env.CONVEX_URL ?? env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('CONVEX_URL or VITE_CONVEX_URL is required.')
  }
  const importSecret = env.STUDIO_TEMPLATE_IMPORT_SECRET
  if (!importSecret) {
    throw new Error('STUDIO_TEMPLATE_IMPORT_SECRET is required.')
  }

  const studioApi = api as {
    studio: {
      upsertStudioTemplate: unknown
    }
  }
  const client = clientFactory(convexUrl)
  const result = await client.mutation(
    studioApi.studio.upsertStudioTemplate,
    {
      ...p0StudioTemplateSeed,
      importSecret,
    },
  )

  console.log(
    `Seeded ${p0StudioTemplateSeed.templateId} ${p0StudioTemplateSeed.templateVersion} (${result.created ? 'created' : 'updated'})`,
  )
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void runSeedStudioTemplates().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
