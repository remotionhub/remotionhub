import { describe, expect, it } from 'vitest'

describe('tooling baseline', () => {
  it('runs vitest in the TanStack Start workspace', () => {
    expect(import.meta.env.MODE).toBe('test')
  })
})
