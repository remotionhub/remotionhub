import fs from 'node:fs/promises'
import path from 'node:path'
import { type TagKey } from '../src/lib/tags'

const dir = 'catalog/components'

function mapSlugToTags(slug: string): TagKey[] {
  const tags: Set<TagKey> = new Set()

  if (/vhs|retro|arcade|pixel/.test(slug)) {
    tags.add('retro')
  }
  if (/chart|dataviz|stats|gantt|candlestick|comparison|counter|report|dashboard|finance/.test(slug)) {
    tags.add('business')
  }
  if (/youtube|yt|social|facebook|tiktok|ig|twitter|reddit|linkedin|social-media/.test(slug)) {
    tags.add('social')
  }
  if (/avatar|profile|testimonial/.test(slug)) {
    tags.add('personal')
  }
  if (/glitch|neon|cinematic|blast|firework|3d|hologram|glow|pulse|morph|creative/.test(slug)) {
    tags.add('creative')
  }
  if (/minimal|fade|slide|wipe|simple|clean/.test(slug)) {
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



    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
    migratedCount++
  }

  console.log(`Successfully migrated ${migratedCount} catalog components.`)
}

migrate().catch(console.error)
