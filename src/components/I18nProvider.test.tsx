// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_STORAGE_KEY } from '#/lib/i18n'
import { I18nProvider, useI18n } from './I18nProvider'

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="catalog">{t('nav.catalog')}</p>
      <button type="button" onClick={() => setLocale('en')}>
        Switch to English
      </button>
      <button type="button" onClick={() => setLocale('zh')}>
        Switch to Chinese
      </button>
    </div>
  )
}

function installLocalStorage() {
  const values = new Map<string, string>()
  const storage = {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  } satisfies Storage

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

describe('I18nProvider', () => {
  beforeEach(() => {
    installLocalStorage()
    document.documentElement.lang = ''
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('defaults to Chinese', () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('locale').textContent).toBe('zh')
    expect(screen.getByTestId('catalog').textContent).toBe('目录')
    expect(document.documentElement.lang).toBe('zh')
  })

  it('switches locales, persists the selection, and syncs the document language', () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }))

    expect(screen.getByTestId('locale').textContent).toBe('en')
    expect(screen.getByTestId('catalog').textContent).toBe('Catalog')
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Chinese' }))

    expect(screen.getByTestId('locale').textContent).toBe('zh')
    expect(screen.getByTestId('catalog').textContent).toBe('目录')
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh')
    expect(document.documentElement.lang).toBe('zh')
  })

  it('uses the stored English locale after mount', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('en')
      expect(screen.getByTestId('catalog').textContent).toBe('Catalog')
      expect(document.documentElement.lang).toBe('en')
    })
  })

  it('falls back to Chinese for invalid stored locales', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'fr')
    const getItem = vi.spyOn(window.localStorage, 'getItem')

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(getItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY)
      expect(screen.getByTestId('locale').textContent).toBe('zh')
    })
    expect(screen.getByTestId('catalog').textContent).toBe('目录')
  })

  it('defaults to Chinese when localStorage getItem fails', async () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(getItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY)
      expect(screen.getByTestId('locale').textContent).toBe('zh')
    })
    expect(screen.getByTestId('catalog').textContent).toBe('目录')
  })
})
