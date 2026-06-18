import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  dictionaries,
  isLocale,
  resolveLocale,
  translate,
} from './i18n'

describe('i18n core', () => {
  it('defaults to Chinese', () => {
    expect(DEFAULT_LOCALE).toBe('zh')
    expect(resolveLocale(undefined)).toBe('zh')
    expect(resolveLocale('')).toBe('zh')
    expect(resolveLocale('fr')).toBe('zh')
  })

  it('recognizes supported locales only', () => {
    expect(isLocale('zh')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('zh-CN')).toBe(false)
  })

  it('translates known UI keys in Chinese and English', () => {
    expect(translate('zh', 'nav.catalog')).toBe('目录')
    expect(translate('en', 'nav.catalog')).toBe('Catalog')
    expect(translate('zh', 'detail.agentPrompt')).toBe('Agent 提示词')
    expect(translate('en', 'detail.agentPrompt')).toBe('Agent Prompt')
  })

  it('interpolates placeholder values', () => {
    expect(
      translate('zh', 'detail.versionBy', {
        version: '1.2.3',
        publisher: 'Terence',
      }),
    ).toBe('版本 1.2.3，作者 Terence')
    expect(
      translate('en', 'detail.versionBy', {
        version: '1.2.3',
        publisher: 'Terence',
      }),
    ).toBe('Version 1.2.3 by Terence')
  })

  it('keeps dictionary key sets identical', () => {
    const zhKeys = Object.keys(dictionaries.zh).sort()
    const enKeys = Object.keys(dictionaries.en).sort()
    expect(enKeys).toEqual(zhKeys)
  })
})
