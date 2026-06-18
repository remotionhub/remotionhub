import type { TranslationKey } from './i18n'

export type Runtime = 'remotion' | 'hyperframes'
export type RuntimeLabelKey = Extract<
  TranslationKey,
  'runtime.remotion' | 'runtime.hyperframes'
>

export function runtimePath(runtime: Runtime) {
  return runtime === 'remotion' ? '/remotion' : '/hyperframes'
}

export function runtimeLabelKey(runtime: Runtime): RuntimeLabelKey {
  return runtime === 'remotion' ? 'runtime.remotion' : 'runtime.hyperframes'
}
