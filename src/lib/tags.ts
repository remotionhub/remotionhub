export type TagKey = 'minimal' | 'retro' | 'creative' | 'business' | 'social' | 'personal'

export interface TagInfo {
  en: string
  zh: string
}

export const TAG_DICTIONARY: Record<TagKey, TagInfo> = {
  minimal: { en: 'Minimal', zh: '极简' },
  retro: { en: 'Retro', zh: '复古' },
  creative: { en: 'Creative', zh: '创意' },
  business: { en: 'Business', zh: '商务' },
  social: { en: 'Social', zh: '社交' },
  personal: { en: 'Personal', zh: '个人' },
}

export function isValidTag(tag: string): tag is TagKey {
  return tag in TAG_DICTIONARY
}

export function getLocalizedTag(tag: string, locale: 'zh' | 'en'): string {
  if (isValidTag(tag)) {
    return locale === 'zh' ? TAG_DICTIONARY[tag].zh : TAG_DICTIONARY[tag].en
  }
  return tag
}
