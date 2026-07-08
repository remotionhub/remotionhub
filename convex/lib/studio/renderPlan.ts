import { z } from 'zod'
import type { StudioErrorCode } from './constants'

const outputSchema = z
  .object({
    aspectRatio: z.literal('16:9'),
    width: z.literal(1280),
    height: z.literal(720),
    fps: z.literal(30),
    durationSeconds: z.number().int().min(10).max(30),
    format: z.literal('mp4'),
  })
  .strict()

const sceneSchema = z
  .object({
    id: z.string().min(1).max(64),
    durationSeconds: z.number().int().min(1).max(30),
    headline: z.string().max(120),
    subtitle: z.string().max(180),
    body: z.string().max(500),
    visualHint: z.string().max(240),
  })
  .strict()

const renderPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    templateId: z.string().min(1),
    templateVersion: z.string().min(1),
    propsSchemaVersion: z.string().min(1),
    runtime: z.literal('remotion'),
    output: outputSchema,
    intentSummary: z.string().min(1).max(500),
    style: z
      .object({
        tone: z.string().min(1).max(64),
        primaryColor: z.string().min(1).max(32),
        backgroundStyle: z.string().min(1).max(160),
      })
      .strict(),
    scenes: z.array(sceneSchema).min(1).max(8),
    props: z.record(z.string(), z.unknown()),
    assetIds: z.array(z.string().min(1)).max(20),
  })
  .strict()

export type StudioRenderPlan = z.infer<typeof renderPlanSchema>

type TemplatePropsSchema = {
  type?: string
  additionalProperties?: boolean
  required?: string[]
  properties?: Record<
    string,
    { type?: string; minLength?: number; maxLength?: number }
  >
}

function validatePropsSchema(
  props: Record<string, unknown>,
  schema: unknown,
): boolean {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return false
  }

  const objectSchema = schema as TemplatePropsSchema
  if (objectSchema.type !== 'object' || objectSchema.additionalProperties !== false) {
    return false
  }

  const properties = objectSchema.properties ?? {}
  const required = objectSchema.required ?? []

  for (const key of Object.keys(props)) {
    if (!(key in properties)) {
      return false
    }
  }

  for (const key of required) {
    if (!(key in props)) {
      return false
    }
  }

  for (const [key, rule] of Object.entries(properties)) {
    if (rule.type !== 'string') {
      return false
    }

    const value = props[key]
    if (value === undefined) {
      continue
    }

    if (typeof value !== 'string') {
      return false
    }
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return false
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return false
    }
  }

  return true
}

function hasAllowedAssetId(
  assetId: string,
  allowedAssetIds: readonly string[],
) {
  return allowedAssetIds.includes(assetId)
}

export function validateRenderPlan(
  input: unknown,
  job: {
    templateId: string
    templateVersion: string
    propsSchemaVersion: string
  },
  template: {
    allowedAssetIds: readonly string[]
    propsSchema: unknown
  },
): { ok: true; value: StudioRenderPlan } | { ok: false; errors: StudioErrorCode[] } {
  const parsed = renderPlanSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: ['PLAN_VALIDATION_FAILED'] }
  }

  const plan = parsed.data
  if (
    plan.templateId !== job.templateId ||
    plan.templateVersion !== job.templateVersion ||
    plan.propsSchemaVersion !== job.propsSchemaVersion
  ) {
    return { ok: false, errors: ['TEMPLATE_VERSION_MISMATCH'] }
  }

  if (
    plan.assetIds.some(
      (assetId) => !hasAllowedAssetId(assetId, template.allowedAssetIds),
    )
  ) {
    return { ok: false, errors: ['PROPS_VALIDATION_FAILED'] }
  }

  if (!validatePropsSchema(plan.props, template.propsSchema)) {
    return { ok: false, errors: ['PROPS_VALIDATION_FAILED'] }
  }

  const totalSceneDurationSeconds = plan.scenes.reduce(
    (total, scene) => total + scene.durationSeconds,
    0,
  )
  if (totalSceneDurationSeconds !== plan.output.durationSeconds) {
    return { ok: false, errors: ['PLAN_VALIDATION_FAILED'] }
  }

  return { ok: true, value: plan }
}
