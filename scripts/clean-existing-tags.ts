import fs from 'node:fs/promises'
import path from 'node:path'
import { type TagKey } from '../src/lib/tags'

const dir = 'catalog/components'

function mapSlugToTags(slug: string): TagKey[] {
  const tags: Set<TagKey> = new Set()
  const tokens = new Set(slug.split('-'))

  // retro
  if (tokens.has('vhs') || tokens.has('retro') || tokens.has('arcade') || tokens.has('pixel')) {
    tags.add('retro')
  }
  // business
  if (
    tokens.has('chart') || tokens.has('dataviz') || tokens.has('stats') ||
    tokens.has('gantt') || tokens.has('candlestick') || tokens.has('comparison') ||
    tokens.has('counter') || tokens.has('report') || tokens.has('dashboard') || tokens.has('finance')
  ) {
    tags.add('business')
  }
  // social
  if (
    tokens.has('youtube') || tokens.has('yt') || tokens.has('social') ||
    tokens.has('facebook') || tokens.has('tiktok') || tokens.has('ig') ||
    tokens.has('twitter') || tokens.has('reddit') || tokens.has('linkedin') ||
    tokens.has('social-media')
  ) {
    tags.add('social')
  }
  // personal
  if (tokens.has('avatar') || tokens.has('profile') || tokens.has('testimonial')) {
    tags.add('personal')
  }
  // creative
  if (
    tokens.has('glitch') || tokens.has('neon') || tokens.has('cinematic') ||
    tokens.has('blast') || tokens.has('firework') || tokens.has('3d') ||
    tokens.has('hologram') || tokens.has('glow') || tokens.has('pulse') ||
    tokens.has('morph') || tokens.has('creative')
  ) {
    tags.add('creative')
  }
  // minimal
  if (
    tokens.has('minimal') || tokens.has('fade') || tokens.has('slide') ||
    tokens.has('wipe') || tokens.has('simple') || tokens.has('clean')
  ) {
    tags.add('minimal')
  }

  // Fallback if no category matches
  if (tags.size === 0) {
    tags.add('minimal')
  }

  return Array.from(tags)
}

async function migrate() {
  const files = await fs.readdir(dir)
  let migratedCount = 0

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const filePath = path.join(dir, file)
    const content = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(content)

    const newTags = mapSlugToTags(data.slug)
    data.tags = newTags

    if (data.versions && Array.isArray(data.versions)) {
      for (const ver of data.versions) {
        ver.tags = newTags
      }
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
    migratedCount++
  }

  console.log(`Successfully migrated ${migratedCount} catalog components.`)
}

migrate().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
