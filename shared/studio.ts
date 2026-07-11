import { z } from 'zod'

export const STUDIO_FPS = 30
export const STUDIO_DEFAULT_DURATION_IN_FRAMES = 240
export const STUDIO_MIN_DURATION_IN_FRAMES = 30
export const STUDIO_MAX_DURATION_IN_FRAMES = 900
export const STUDIO_MAX_SOURCE_LENGTH = 100_000

export const studioAspectRatioSchema = z.enum(['16:9', '9:16', '1:1'])
export type StudioAspectRatio = z.infer<typeof studioAspectRatioSchema>

export const studioCompositionInputSchema = z.object({
  aspectRatio: studioAspectRatioSchema.default('16:9'),
  durationInFrames: z
    .number()
    .int()
    .min(STUDIO_MIN_DURATION_IN_FRAMES)
    .max(STUDIO_MAX_DURATION_IN_FRAMES)
    .default(STUDIO_DEFAULT_DURATION_IN_FRAMES),
})

export type StudioCompositionInput = z.input<
  typeof studioCompositionInputSchema
>
export type StudioComposition = {
  aspectRatio: StudioAspectRatio
  width: number
  height: number
  fps: typeof STUDIO_FPS
  durationInFrames: number
}

const dimensions: Record<StudioAspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
}

export function normalizeStudioComposition(
  input: StudioCompositionInput,
): StudioComposition {
  const parsed = studioCompositionInputSchema.parse(input)
  return {
    aspectRatio: parsed.aspectRatio,
    ...dimensions[parsed.aspectRatio],
    fps: STUDIO_FPS,
    durationInFrames: parsed.durationInFrames,
  }
}

export function serializeStudioCandidate(
  code: string,
  composition: StudioComposition,
) {
  return JSON.stringify({
    code,
    composition: {
      aspectRatio: composition.aspectRatio,
      durationInFrames: composition.durationInFrames,
      fps: composition.fps,
      height: composition.height,
      width: composition.width,
    },
  })
}
