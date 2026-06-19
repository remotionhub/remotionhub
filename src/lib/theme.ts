export const THEME_STORAGE_KEY = 'theme'
export const THEME_MODES = ['light', 'dark'] as const
export type ThemeMode = (typeof THEME_MODES)[number]
export const DEFAULT_THEME_MODE: ThemeMode = 'light'

export function resolveThemeMode(value: unknown): ThemeMode {
  return value === 'dark' || value === 'light' ? value : DEFAULT_THEME_MODE
}

export function applyThemeMode(
  mode: ThemeMode,
  root: HTMLElement = document.documentElement,
) {
  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  root.setAttribute('data-theme', mode)
  root.style.colorScheme = mode
}
