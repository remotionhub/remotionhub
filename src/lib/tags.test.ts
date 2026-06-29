import { describe, it, expect } from 'vitest'
import { isValidTag, getLocalizedTag } from './tags'

describe('Tag Taxonomy', () => {
  it('identifies valid and invalid tags', () => {
    expect(isValidTag('minimal')).toBe(true)
    expect(isValidTag('retro')).toBe(true)
    expect(isValidTag('invalid-tag')).toBe(false)
    expect(isValidTag('constructor')).toBe(false)
    expect(isValidTag('toString')).toBe(false)
  })

  it('translates tags correctly based on locale', () => {
    expect(getLocalizedTag('minimal', 'zh')).toBe('极简')
    expect(getLocalizedTag('minimal', 'en')).toBe('Minimal')
    expect(getLocalizedTag('invalid-tag', 'zh')).toBe('invalid-tag')
  })
})
