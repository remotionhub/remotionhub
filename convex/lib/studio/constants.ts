export const STUDIO_JOB_STATUSES = [
  'queued',
  'planning',
  'rendering',
  'uploading',
  'completed',
  'failed',
  'canceled',
] as const

export type StudioJobStatus = (typeof STUDIO_JOB_STATUSES)[number]

export const ACTIVE_JOB_STATUSES = [
  'queued',
  'planning',
  'rendering',
  'uploading',
] as const satisfies readonly StudioJobStatus[]

export const STUDIO_ERROR_CODES = [
  'AUTH_REQUIRED',
  'INSUFFICIENT_CREDITS',
  'ACTIVE_JOB_LIMIT',
  'PROMPT_INCOMPLETE',
  'CONTENT_BLOCKED',
  'TEMPLATE_NOT_FOUND',
  'TEMPLATE_NOT_ALLOWED',
  'TEMPLATE_INACTIVE',
  'TEMPLATE_LICENSE_BLOCKED',
  'TEMPLATE_VERSION_MISMATCH',
  'PLAN_VALIDATION_FAILED',
  'PROPS_VALIDATION_FAILED',
  'MODEL_PROVIDER_ERROR',
  'RENDER_TIMEOUT',
  'RENDER_FAILED',
  'UPLOAD_FAILED',
  'JOB_CANCELED',
] as const

export type StudioErrorCode = (typeof STUDIO_ERROR_CODES)[number]

export const STUDIO_EVENT_TYPES = [
  'job_created',
  'credits_consumed',
  'planning_started',
  'model_started',
  'plan_validation_failed',
  'plan_repaired',
  'rendering_started',
  'uploading_started',
  'job_completed',
  'job_failed',
  'job_canceled',
  'credits_refunded',
] as const

export type StudioEventType = (typeof STUDIO_EVENT_TYPES)[number]

export const STUDIO_PROGRESS_BY_STATUS = {
  queued: 5,
  planning: 20,
  rendering: 60,
  uploading: 90,
  completed: 100,
} as const satisfies Partial<Record<StudioJobStatus, number>>

const ACTIVE_JOB_STATUS_SET = new Set<string>(ACTIVE_JOB_STATUSES)

export function isActiveStudioStatus(status: StudioJobStatus) {
  return ACTIVE_JOB_STATUS_SET.has(status)
}
