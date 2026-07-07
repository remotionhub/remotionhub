import { describe, expect, it } from 'vitest'
import { consumeKey, initialGrantKey, refundKey } from './ledger'

describe('studio ledger helpers', () => {
  it('builds stable idempotency keys', () => {
    expect(initialGrantKey('user-123')).toBe('initial-grant-v1:user-123')
    expect(consumeKey('job-123')).toBe('consume:job-123')
    expect(refundKey('job-123')).toBe('refund:job-123')
  })
})
