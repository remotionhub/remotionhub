import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('StudioPreview module boundary', () => {
  it('loads the compiler behind a TanStack client-only boundary', () => {
    const source = readFileSync(
      new URL('./StudioPreview.tsx', import.meta.url),
      'utf8',
    )

    expect(source).not.toMatch(
      /import\s+\{\s*compileStudioComponent\s*\}\s+from\s+['"]\.\.\/\.\.\/lib\/studio\/compiler['"]/,
    )
    expect(source).toContain('createClientOnlyFn')
  })
})
