import { describe, expect, it } from 'vitest'
import {
  canRefundCancellation,
  defaultProgressForStatus,
  isActiveStatus,
} from './jobs'

describe('studio job helpers', () => {
  it('returns default progress for known statuses', () => {
    expect(defaultProgressForStatus('queued')).toBe(5)
    expect(defaultProgressForStatus('planning')).toBe(20)
    expect(defaultProgressForStatus('rendering')).toBe(60)
    expect(defaultProgressForStatus('uploading')).toBe(90)
    expect(defaultProgressForStatus('completed')).toBe(100)
  })

  it('recognizes active statuses', () => {
    expect(isActiveStatus('queued')).toBe(true)
    expect(isActiveStatus('planning')).toBe(true)
    expect(isActiveStatus('rendering')).toBe(true)
    expect(isActiveStatus('uploading')).toBe(true)
    expect(isActiveStatus('completed')).toBe(false)
    expect(isActiveStatus('failed')).toBe(false)
    expect(isActiveStatus('canceled')).toBe(false)
  })

  it('allows refunds for queued jobs and planning jobs before model start only', () => {
    expect(canRefundCancellation({ status: 'queued' })).toBe(true)
    expect(canRefundCancellation({ status: 'planning' })).toBe(true)
    expect(
      canRefundCancellation({ status: 'planning', modelStartedAt: Date.now() }),
    ).toBe(false)
    expect(canRefundCancellation({ status: 'rendering' })).toBe(false)
  })
})
