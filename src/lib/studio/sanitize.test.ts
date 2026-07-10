import { describe, expect, it } from 'vitest'
import { sanitizeGeneratedSource } from './sanitize'

describe('sanitizeGeneratedSource', () => {
  it('removes one markdown fence without accepting prose', () => {
    expect(
      sanitizeGeneratedSource(
        '```tsx\nexport const MyAnimation = () => <div />\n```',
      ),
    ).toBe('export const MyAnimation = () => <div />')

    expect(() =>
      sanitizeGeneratedSource(
        'Here is the code:\nexport const MyAnimation = () => null',
      ),
    ).toThrow('Generated response must contain source only')
  })

  it.each(['ts', 'jsx', 'javascript', ''])(
    'unwraps a full-response %s fence',
    (language) => {
      expect(
        sanitizeGeneratedSource(
          `\r\n\`\`\`${language}\r\nexport function MyAnimation() { return null }\r\n\`\`\`\r\n`,
        ),
      ).toBe('export function MyAnimation() { return null }')
    },
  )

  it('rejects surrounding prose around an otherwise valid fence', () => {
    expect(() =>
      sanitizeGeneratedSource(
        'Generated source:\n```tsx\nexport const MyAnimation = () => null\n```',
      ),
    ).toThrow('Generated response must contain source only')
  })

  it('requires the named animation export', () => {
    expect(() =>
      sanitizeGeneratedSource('export const OtherAnimation = () => null'),
    ).toThrow('MyAnimation export is required')
  })
})
