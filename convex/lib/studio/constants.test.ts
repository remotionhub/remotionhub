import { describe, expect, it } from 'vitest'
import {
  ACTIVE_JOB_STATUSES,
  STUDIO_ERROR_CODES,
  STUDIO_EVENT_TYPES,
  STUDIO_JOB_STATUSES,
  STUDIO_PROGRESS_BY_STATUS,
  isActiveStudioStatus,
} from './constants'

describe('studio constants', () => {
  it('defines the job lifecycle and active subset', () => {
    expect(STUDIO_JOB_STATUSES).toEqual([
      'queued',
      'planning',
      'rendering',
      'uploading',
      'completed',
      'failed',
      'canceled',
    ])
    expect(ACTIVE_JOB_STATUSES).toEqual([
      'queued',
      'planning',
      'rendering',
      'uploading',
    ])
    expect(isActiveStudioStatus('queued')).toBe(true)
    expect(isActiveStudioStatus('completed')).toBe(false)
    expect(isActiveStudioStatus('failed')).toBe(false)
    expect(isActiveStudioStatus('canceled')).toBe(false)
  })

  it('uses stage-based progress values', () => {
    expect(STUDIO_PROGRESS_BY_STATUS).toMatchObject({
      queued: 5,
      planning: 20,
      rendering: 60,
      uploading: 90,
      completed: 100,
    })
  })

  it('exports the studio error and event catalogs', () => {
    expect(STUDIO_ERROR_CODES).toEqual([
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
    ])
    expect(STUDIO_EVENT_TYPES).toEqual([
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
    ])
  })
})
