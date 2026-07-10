import { z } from 'zod'
import { studioCompositionInputSchema } from '../../shared/studio'

export const STUDIO_SKILLS = [
  'Typography',
  'Charts',
  'Messaging',
  'Transitions',
  'Sequencing',
  'Spring Physics',
  'Social Media',
  '3D',
] as const

type StudioSkill = (typeof STUDIO_SKILLS)[number]

export const STUDIO_SKILL_PROMPTS = {
  Typography:
    'Create deterministic, frame-driven type animation with legible hierarchy and deliberate timing. Output constraint: return one self-contained React composition and avoid CSS keyframes, timers, DOM measurement, network access, and unprovided assets. Allowed APIs: AbsoluteFill, Sequence, interpolate, spring, Easing, useCurrentFrame, and useVideoConfig from remotion.',
  Charts:
    'Animate chart values from explicit input data, preserve readable labels, and use a stable scale with a visible zero baseline when applicable. Output constraint: return one self-contained React composition with deterministic geometry and no chart libraries, network access, or DOM measurement. Allowed APIs: AbsoluteFill, Sequence, interpolate, Easing, useCurrentFrame, and useVideoConfig from remotion, plus Circle, Ellipse, Pie, Polygon, Rect, and Star from @remotion/shapes.',
  Messaging:
    'Build a readable message flow with clear sender grouping, bounded bubble widths, and sequential reveals. Output constraint: return one self-contained React composition driven only by frames; do not use timers, scrolling APIs, network access, or unprovided assets. Allowed APIs: AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, and useVideoConfig from remotion.',
  Transitions:
    'Connect scenes with transitions that preserve continuity and do not obscure essential content. Output constraint: return one self-contained React composition, keep transition durations within adjacent scene lengths, and use no CSS transitions or external effects. Allowed APIs: TransitionSeries, linearTiming, and springTiming from @remotion/transitions; fade from @remotion/transitions/fade; slide from @remotion/transitions/slide; wipe from @remotion/transitions/wipe; and useVideoConfig from remotion.',
  Sequencing:
    'Organize the animation into explicit frame ranges with intentional overlap and no hidden wall-clock state. Output constraint: return one self-contained React composition whose total sequence timing fits the requested duration and whose children remain deterministic. Allowed APIs: AbsoluteFill, Sequence, Series, Freeze, Loop, useCurrentFrame, and useVideoConfig from remotion.',
  'Spring Physics':
    'Use spring motion for physically coherent entrances, emphasis, and settling while keeping overshoot appropriate to the visual role. Output constraint: return one self-contained React composition with frame-derived motion and no hand-rolled timer or requestAnimationFrame loop. Allowed APIs: spring, measureSpring, interpolate, Easing, useCurrentFrame, and useVideoConfig from remotion.',
  'Social Media':
    'Compose a safe-area-aware social clip with an immediate hook, large readable text, and pacing suited to the requested aspect ratio. Output constraint: return one self-contained React composition, keep critical content inside margins, and do not fetch media or fonts at runtime. Allowed APIs: AbsoluteFill, Sequence, Series, interpolate, spring, useCurrentFrame, and useVideoConfig from remotion.',
  '3D':
    'Use restrained 3D motion with a stable camera, bounded scene complexity, and lighting that keeps the subject readable. Output constraint: return one self-contained React composition with deterministic frame-driven transforms; do not load remote models, textures, shaders, or arbitrary Three.js extensions. Allowed APIs: ThreeCanvas from @remotion/three, useCurrentFrame and useVideoConfig from remotion, and core three primitives for geometry, material, light, group, mesh, and camera setup.',
} satisfies Record<StudioSkill, string>

const skillSchema = z.enum(STUDIO_SKILLS)
const exactEditSchema = z.object({
  oldString: z.string().min(1),
  newString: z.string(),
  description: z.string().min(1).max(200),
})

export const generatedMotionSchema = z.object({
  code: z.string().min(1).max(100_000),
  summary: z.string().min(1).max(500),
  composition: studioCompositionInputSchema,
})

export const followUpResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('edits'),
    edits: z.array(exactEditSchema).min(1).max(20),
    summary: z.string().min(1).max(500),
    composition: studioCompositionInputSchema.optional(),
  }),
  z.object({
    kind: z.literal('replacement'),
    code: z.string().min(1).max(100_000),
    summary: z.string().min(1).max(500),
    composition: studioCompositionInputSchema,
  }),
])

export const skillSelectionSchema = z.object({
  skills: z.array(skillSchema).max(STUDIO_SKILLS.length),
})

export const promptValidationSchema = z.object({
  allow: z.boolean(),
  reason: z.string().max(300),
})

export function applyExactEdits(
  source: string,
  edits: Array<z.infer<typeof exactEditSchema>>,
) {
  return edits.reduce((current, edit) => {
    const first = current.indexOf(edit.oldString)
    const second = current.indexOf(
      edit.oldString,
      first + edit.oldString.length,
    )
    if (first < 0 || second >= 0) {
      throw new Error('old_string must match exactly once')
    }
    return `${current.slice(0, first)}${edit.newString}${current.slice(
      first + edit.oldString.length,
    )}`
  }, source)
}

export function selectNewSkills(detected: string[], used: string[]) {
  const usedSet = new Set(used)
  return detected.filter(
    (skill): skill is StudioSkill =>
      skillSchema.safeParse(skill).success && !usedSet.has(skill),
  )
}

export function buildStudioContext(input: {
  code: string
  messages: Array<{ role: string; content: string }>
}) {
  return {
    code: input.code.slice(0, 100_000),
    messages: input.messages.slice(-12).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4_000),
    })),
  }
}

export function normalizeGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('old_string')) return 'EDIT_NOT_UNIQUE'
  if (message.includes('rate') || message.includes('429')) {
    return 'MODEL_RATE_LIMIT'
  }
  if (message.includes('timeout')) return 'MODEL_TIMEOUT'
  return 'MODEL_FAILED'
}

export async function validatePromptWithFallback(
  validate: () => Promise<z.infer<typeof promptValidationSchema>>,
) {
  try {
    return promptValidationSchema.parse(await validate())
  } catch {
    // Invalid model output is validator unavailability; only parsed denials block.
    return { allow: true, reason: 'validation-unavailable' }
  }
}

export async function detectSkillsWithFallback(
  detect: () => Promise<z.infer<typeof skillSelectionSchema>>,
) {
  try {
    return skillSelectionSchema.parse(await detect()).skills
  } catch {
    return []
  }
}
