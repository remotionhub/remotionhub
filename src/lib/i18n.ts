export const LOCALES = ['zh', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'zh'
export const LOCALE_STORAGE_KEY = 'remotionhub.locale'

const zhDictionary = {
  'nav.catalog': '目录',
  'nav.remotion': 'Remotion',
  'nav.hyperframes': 'HyperFrames',
  'nav.github': '打开 RemotionHub GitHub',
  'language.label': '语言',
  'language.zh': '中文',
  'language.en': 'EN',
  'footer.github': 'GitHub',
  'home.title': '动画模板库',
  'remotion.title': 'Remotion 组件',
  'hyperframes.title': 'HyperFrames 组件',
  'filters.allRuntimes': '全部运行时',
  'filters.remotionCatalog': 'Remotion 目录',
  'filters.hyperframesCatalog': 'HyperFrames 目录',
  'filters.all': '全部',
  'filters.categories': '分类',
  'filters.tags': '标签',
  'filters.allTags': '全部标签',
  'category.card': '字卡',
  'catalog.emptyTitle': '未找到组件',
  'catalog.emptyDescription': '试试其他运行时或分类。',
  'catalog.loadingMore': '正在加载更多...',
  'catalog.end': '目录已到底。',
  'detail.backRemotion': '返回 Remotion 目录',
  'detail.backHyperframes': '返回 HyperFrames 目录',
  'detail.versionBy': '版本 {version}，作者 {publisher}',
  'detail.entry': '入口',
  'detail.aspect': '画幅',
  'detail.timing': '时长',
  'detail.timingValue': '{frames} 帧 / {fps} 帧每秒',
  'detail.license': '许可证',
  'detail.source': '来源',
  'detail.agentPrompt': 'Agent 提示词',
  'detail.githubSource': 'GitHub 源码',
  'detail.usage': '使用说明',
  'detail.copyPrompt': '复制提示词',
  'detail.openSource': '打开源码',
  'detail.ref': 'Ref',
  'detail.commit': 'Commit',
  'detail.path': 'Path',
  'preview.label': '{title} 预览',
  'preview.unavailable': '{title} 预览不可用',
  'toast.copied': '已复制到剪贴板',
  'runtime.remotion': 'Remotion',
  'runtime.hyperframes': 'HyperFrames',
  'about.eyebrow': '关于',
  'about.title': '面向 agent-assisted 项目的版本化动态组件。',
  'about.description':
    'RemotionHub 管理稳定组件、不可变版本和源码 artifact，方便团队预览、下载，并接入本地 Remotion 或 HyperFrames 项目。',
} as const

export type TranslationKey = keyof typeof zhDictionary
type Dictionary = Record<TranslationKey, string>

const enDictionary = {
  'nav.catalog': 'Catalog',
  'nav.remotion': 'Remotion',
  'nav.hyperframes': 'HyperFrames',
  'nav.github': 'Go to RemotionHub GitHub',
  'language.label': 'Language',
  'language.zh': '中文',
  'language.en': 'EN',
  'footer.github': 'GitHub',
  'home.title': 'Motion template library',
  'remotion.title': 'Remotion components',
  'hyperframes.title': 'HyperFrames components',
  'filters.allRuntimes': 'All runtimes',
  'filters.remotionCatalog': 'Remotion catalog',
  'filters.hyperframesCatalog': 'HyperFrames catalog',
  'filters.all': 'All',
  'filters.categories': 'Categories',
  'filters.tags': 'Tags',
  'filters.allTags': 'All tags',
  'category.card': 'Card',
  'catalog.emptyTitle': 'No components found',
  'catalog.emptyDescription': 'Try another runtime or category.',
  'catalog.loadingMore': 'Loading more...',
  'catalog.end': 'End of catalog.',
  'detail.backRemotion': 'Back to Remotion catalog',
  'detail.backHyperframes': 'Back to HyperFrames catalog',
  'detail.versionBy': 'Version {version} by {publisher}',
  'detail.entry': 'Entry',
  'detail.aspect': 'Aspect',
  'detail.timing': 'Timing',
  'detail.timingValue': '{frames} frames / {fps} fps',
  'detail.license': 'License',
  'detail.source': 'Source',
  'detail.agentPrompt': 'Agent Prompt',
  'detail.githubSource': 'GitHub Source',
  'detail.usage': 'Usage',
  'detail.copyPrompt': 'Copy prompt',
  'detail.openSource': 'Open source',
  'detail.ref': 'Ref',
  'detail.commit': 'Commit',
  'detail.path': 'Path',
  'preview.label': '{title} preview',
  'preview.unavailable': '{title} preview unavailable',
  'toast.copied': 'Copied to clipboard',
  'runtime.remotion': 'Remotion',
  'runtime.hyperframes': 'HyperFrames',
  'about.eyebrow': 'About',
  'about.title': 'Versioned motion components for agent-assisted projects.',
  'about.description':
    'RemotionHub catalogs stable components, immutable versions, and source artifacts so teams can preview, download, and wire assets into local Remotion or HyperFrames projects.',
} satisfies Dictionary

export const dictionaries = {
  zh: zhDictionary,
  en: enDictionary,
} as const

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value as Locale)
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  values: Record<string, string | number> = {},
): string {
  const template: string = dictionaries[locale][key] ?? key
  return Object.entries(values).reduce<string>(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  )
}
