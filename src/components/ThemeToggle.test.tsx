// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from '#/lib/theme'
import ThemeToggle from './ThemeToggle'

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

describe('ThemeToggle', () => {
  beforeEach(() => {
    installLocalStorage()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('defaults to light and persists dark when clicked', () => {
    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: /theme mode: light/i })).toBeTruthy()
    expect(document.documentElement.classList.contains('light')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /theme mode: light/i }))

    expect(screen.getByRole('button', { name: /theme mode: dark/i })).toBeTruthy()
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not expose an auto mode', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'auto')

    render(<ThemeToggle />)

    expect(screen.queryByRole('button', { name: /auto/i })).toBeNull()
    expect(screen.getByRole('button', { name: /theme mode: light/i })).toBeTruthy()
  })
})
