import { describe, expect, it } from 'vitest'
import {
  applyExactEdits,
  buildStudioContext,
  detectSkillsWithFallback,
  followUpResponseSchema,
  generatedMotionSchema,
  normalizeGenerationError,
  selectNewSkills,
  STUDIO_SKILL_PROMPTS,
  STUDIO_SKILLS,
  validatePromptWithFallback,
} from './studioGeneration'

describe('Studio generation contract', () => {
  it('accepts complete source plus a supported composition', () => {
    const result = generatedMotionSchema.parse({
      code: 'export const MyAnimation = () => null',
      summary: 'Created a title animation',
      composition: { aspectRatio: '9:16', durationInFrames: 300 },
    })
    expect(result.composition.aspectRatio).toBe('9:16')
  })

  it('rejects unsupported ratios and duration bounds', () => {
    expect(() =>
      generatedMotionSchema.parse({
        code: 'export const MyAnimation = () => null',
        summary: 'Invalid',
        composition: { aspectRatio: '4:3', durationInFrames: 20 },
      }),
    ).toThrow()
  })

  it('accepts exact edits and complete replacement follow-ups', () => {
    expect(
      followUpResponseSchema.parse({
        kind: 'edits',
        edits: [
          {
            oldString: 'red',
            newString: 'blue',
            description: 'Update the accent color',
          },
        ],
        summary: 'Changed the accent color',
      }).kind,
    ).toBe('edits')
    expect(
      followUpResponseSchema.parse({
        kind: 'replacement',
        code: 'export const MyAnimation = () => null',
        summary: 'Rebuilt the animation',
        composition: { aspectRatio: '1:1', durationInFrames: 180 },
      }).kind,
    ).toBe('replacement')
  })

  it('applies exact edits only when old_string has one match', () => {
    expect(
      applyExactEdits('const color = "red"', [
        { oldString: '"red"', newString: '"blue"', description: 'Color' },
      ]),
    ).toBe('const color = "blue"')
    expect(() =>
      applyExactEdits('red red', [
        { oldString: 'red', newString: 'blue', description: 'Color' },
      ]),
    ).toThrow('exactly once')
    expect(() =>
      applyExactEdits('green', [
        { oldString: 'red', newString: 'blue', description: 'Color' },
      ]),
    ).toThrow('exactly once')
  })

  it('does not reinject skills already used in the conversation', () => {
    expect(
      selectNewSkills(['Typography', 'Charts', 'Unknown'], ['Typography']),
    ).toEqual(['Charts'])
  })

  it('provides one constrained prompt for every supported skill', () => {
    expect(Object.keys(STUDIO_SKILL_PROMPTS)).toEqual([...STUDIO_SKILLS])
    for (const prompt of Object.values(STUDIO_SKILL_PROMPTS)) {
      expect(prompt).toContain('Output constraint:')
      expect(prompt).toContain('Allowed APIs:')
    }
  })

  it('names transition presentation subpath imports', () => {
    const prompt = STUDIO_SKILL_PROMPTS.Transitions
    expect(prompt).toContain('fade from @remotion/transitions/fade')
    expect(prompt).toContain('slide from @remotion/transitions/slide')
    expect(prompt).toContain('wipe from @remotion/transitions/wipe')
  })

  it('bounds recent messages and source length', () => {
    const context = buildStudioContext({
      code: 'x'.repeat(120_000),
      messages: Array.from({ length: 30 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `${`message-${index}`}${'y'.repeat(5_000)}`,
      })),
    })
    expect(context.code.length).toBe(100_000)
    expect(context.messages).toHaveLength(12)
    expect(context.messages[0]?.content.startsWith('message-18')).toBe(true)
    expect(context.messages[0]?.content).toHaveLength(4_000)
  })

  it.each([
    [new Error('old_string must match exactly once'), 'EDIT_NOT_UNIQUE'],
    [new Error('rate limit'), 'MODEL_RATE_LIMIT'],
    [new Error('429 Too Many Requests'), 'MODEL_RATE_LIMIT'],
    [new Error('request timeout'), 'MODEL_TIMEOUT'],
    [new Error('provider unavailable'), 'MODEL_FAILED'],
    ['unknown failure', 'MODEL_FAILED'],
  ])('normalizes generation errors into stable codes', (error, code) => {
    expect(normalizeGenerationError(error)).toBe(code)
  })

  it('allows generation when prompt validation is unavailable', async () => {
    await expect(
      validatePromptWithFallback(async () => {
        throw new Error('timeout')
      }),
    ).resolves.toEqual({ allow: true, reason: 'validation-unavailable' })
  })

  it('uses no skills when skill detection is unavailable', async () => {
    await expect(
      detectSkillsWithFallback(async () => {
        throw new Error('timeout')
      }),
    ).resolves.toEqual([])
  })
})
