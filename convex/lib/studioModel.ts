import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import {
  followUpResponseSchema,
  generatedMotionSchema,
  promptValidationSchema,
  skillSelectionSchema,
} from './studioGeneration'

type StudioModelInput = {
  prompt: string
  system: string
}

type StudioModelResult<T> = {
  data: T
  usage: { inputTokens: number; outputTokens: number }
}

export type StudioModel = {
  validatePrompt(
    input: StudioModelInput,
  ): Promise<StudioModelResult<z.infer<typeof promptValidationSchema>>>
  detectSkills(
    input: StudioModelInput,
  ): Promise<StudioModelResult<z.infer<typeof skillSelectionSchema>>>
  generateInitial(
    input: StudioModelInput,
  ): Promise<StudioModelResult<z.infer<typeof generatedMotionSchema>>>
  generateFollowUp(
    input: StudioModelInput,
  ): Promise<StudioModelResult<z.infer<typeof followUpResponseSchema>>>
  correct(
    input: StudioModelInput,
  ): Promise<StudioModelResult<z.infer<typeof generatedMotionSchema>>>
}

const stubMotion = {
  code: [
    'export const MyAnimation = () => {',
    '  const frame = useCurrentFrame()',
    '  return <AbsoluteFill style={{backgroundColor: "#090b10", color: "#8de8e8", justifyContent: "center", alignItems: "center"}}><div style={{fontSize: 96, opacity: interpolate(frame, [0, 30], [0, 1], {extrapolateRight: "clamp"})}}>RemotionHub Studio</div></AbsoluteFill>',
    '}',
  ].join('\n'),
  summary: 'Created a cyan title reveal',
  composition: { aspectRatio: '16:9' as const, durationInFrames: 240 },
}

export function createStudioModel(
  env: Record<string, string | undefined>,
): StudioModel {
  if (env.STUDIO_MODEL_MODE === 'stub') {
    const result = <T>(data: T): StudioModelResult<T> => ({
      data,
      usage: { inputTokens: 0, outputTokens: 0 },
    })
    return {
      async validatePrompt() {
        return result({ allow: true, reason: 'stub' })
      },
      async detectSkills() {
        return result({ skills: [] })
      },
      async generateInitial() {
        return result(stubMotion)
      },
      async generateFollowUp() {
        return result({
          kind: 'replacement' as const,
          ...stubMotion,
          summary: 'Updated the title motion',
        })
      },
      async correct() {
        return result(stubMotion)
      },
    }
  }

  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const openai = createOpenAI({ apiKey })
  const modelName = env.STUDIO_OPENAI_MODEL ?? 'gpt-5.2'

  async function structured<T>(
    schema: z.ZodType<T>,
    input: StudioModelInput,
  ): Promise<StudioModelResult<T>> {
    const { object, usage } = await generateObject({
      model: openai(modelName),
      schema,
      system: input.system,
      prompt: input.prompt,
    })
    return {
      data: schema.parse(object),
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
    }
  }

  return {
    validatePrompt: (input) => structured(promptValidationSchema, input),
    detectSkills: (input) => structured(skillSelectionSchema, input),
    generateInitial: (input) => structured(generatedMotionSchema, input),
    generateFollowUp: (input) => structured(followUpResponseSchema, input),
    correct: (input) => structured(generatedMotionSchema, input),
  }
}
