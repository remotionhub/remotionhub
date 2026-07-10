import { describe, expect, it } from 'vitest'
import {
  followUpResponseSchema,
  generatedMotionSchema,
} from './studioGeneration'
import { createStudioModel } from './studioModel'

describe('Studio model adapter', () => {
  it('returns a schema-valid deterministic stub', async () => {
    const model = createStudioModel({ STUDIO_MODEL_MODE: 'stub' })
    const result = generatedMotionSchema.parse(
      (await model.generateInitial({ prompt: 'test', system: 'test' })).data,
    )
    expect(result.summary).toBe('Created a cyan title reveal')
    expect(
      followUpResponseSchema.parse(
        (await model.generateFollowUp({ prompt: 'test', system: 'test' })).data,
      ).kind,
    ).toBe('replacement')
  })

  it('requires a backend key outside stub mode', () => {
    expect(() => createStudioModel({})).toThrow('OPENAI_API_KEY')
  })
})
