import { describe, expect, it } from 'vitest'
import { normalizeWeChatProviderAccountId } from './auth'

describe('normalizeWeChatProviderAccountId', () => {
  it('prefers unionid when present', () => {
    expect(
      normalizeWeChatProviderAccountId({
        openid: 'openid-123',
        unionid: 'unionid-456',
      }),
    ).toBe('unionid-456')
  })

  it('uses a namespaced openid fallback when explicitly allowed', () => {
    expect(
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123' },
        { allowOpenIdFallback: true, appId: 'wxabc123' },
      ),
    ).toBe('wechat:web:wxabc123:openid-123')
  })

  it('rejects missing stable identifiers', () => {
    expect(() => normalizeWeChatProviderAccountId({})).toThrow(
      /missing a stable WeChat account id/,
    )
  })

  it('rejects openid fallback without an app id namespace', () => {
    expect(() =>
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123' },
        { allowOpenIdFallback: true },
      ),
    ).toThrow(/requires a WeChat app id/)
  })
})
