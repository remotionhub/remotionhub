# Homepage Catalog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the RemotionHub catalog pages into a Remotion Lab-inspired centered catalog layout with a quieter header, two-row filters, stable card grid, and manual Light/Dark theme only.

**Architecture:** Keep Convex catalog queries unchanged and move UI structure into focused React components. Routes render a shared catalog page shell, the grid owns query/pagination state, filters display category facets and read-only tags, and theme handling is centralized in a small client helper used by the root script and toggle.

**Tech Stack:** React 19, TanStack Start, TanStack Router file routes, Convex React hooks, Tailwind CSS v4, shadcn/ui primitives, Vitest 4 with jsdom, Playwright e2e.

## Global Constraints

- Discussion/spec text may be Chinese, but code, comments, identifiers, commit messages, and Markdown code blocks must be English.
- Preserve `/`, `/remotion`, and `/hyperframes` as catalog list routes.
- Preserve i18n with localStorage preference and default Chinese.
- Catalog content is not translated by the app; display uploaded catalog text as-is.
- Search remains category filtering only; no full-text search and no tag filtering in this phase.
- Tags are displayed as browsing hints only and must not change URL, query, or list state.
- Infinite scrolling remains IntersectionObserver-based; do not replace it with a Load More button.
- Light/Dark supports only manual two-state selection; default Light; do not follow system theme.
- Do not change the Convex catalog schema or import format for this redesign.
- Do not introduce marketing hero imagery, gradient decoration, or heavy animation.
- Use real browser verification for UI proof when implementation is complete.
- Existing uncommitted trial UI changes may be present in `src/components/catalog/CatalogCard.tsx`, `src/components/catalog/CatalogGrid.tsx`, `src/routes/index.tsx`, `src/routes/remotion/index.tsx`, `src/routes/hyperframes/index.tsx`, and `src/styles.css`; review and incorporate only the parts that match this plan.

Reference spec: `spec/2026-06-19-homepage-catalog-redesign-design.md`.

---

## File Structure

- Create `src/lib/theme.ts`: theme mode constants, validation, DOM application helper.
- Create `src/lib/theme.test.ts`: pure tests for theme mode resolution.
- Modify `src/routes/__root.tsx`: simplify early theme init script to Light/Dark only.
- Modify `src/components/ThemeToggle.tsx`: remove `auto`, remove `matchMedia`, use `src/lib/theme.ts`.
- Create `src/components/ThemeToggle.test.tsx`: jsdom tests for default Light, toggling, and persistence.
- Modify `src/components/Header.tsx`: quiet Remotion Lab-inspired header while preserving brand, nav, GitHub, language, theme.
- Modify `src/components/Header.test.tsx`: update theme expectations and remove unnecessary system-theme setup.
- Create `src/components/catalog/CatalogPageShell.tsx`: shared centered shell, hero, separators.
- Create `src/components/catalog/CatalogFilters.test.tsx`: tests for category interaction and read-only tags.
- Modify `src/components/catalog/CatalogFilters.tsx`: two-row filters; category buttons with counts; tags as non-buttons.
- Modify `src/components/catalog/CatalogGrid.tsx`: derive category counts and tag list, pass them to filters, keep pagination and sentinel.
- Modify `src/components/catalog/CatalogCard.tsx`: image-first compact card, no footer strip, summary hidden or deemphasized for list pages.
- Modify `src/components/catalog/CatalogCard.test.tsx`: assert compact visible labels and route.
- Modify `src/routes/index.tsx`, `src/routes/remotion/index.tsx`, `src/routes/hyperframes/index.tsx`: use `CatalogPageShell`.
- Modify `src/lib/i18n.ts`: add filter section labels and adjust catalog page copy.
- Modify `src/styles.css`: page width, catalog grid tracks, header variables, remove `prefers-color-scheme` auto theme block.

---

### Task 1: Manual Light/Dark Theme Only

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/lib/theme.test.ts`
- Create: `src/components/ThemeToggle.test.tsx`
- Modify: `src/components/ThemeToggle.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `ThemeMode = 'light' | 'dark'`
- Produces: `THEME_STORAGE_KEY = 'theme'`
- Produces: `DEFAULT_THEME_MODE = 'light'`
- Produces: `resolveThemeMode(value: unknown): ThemeMode`
- Produces: `applyThemeMode(mode: ThemeMode, root?: HTMLElement): void`
- Consumes: browser `window.localStorage` and `document.documentElement`

- [ ] **Step 1: Write failing tests for pure theme resolution**

Create `src/lib/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_MODE, resolveThemeMode } from './theme'

describe('theme helpers', () => {
  it('defaults to light for missing or unsupported values', () => {
    expect(DEFAULT_THEME_MODE).toBe('light')
    expect(resolveThemeMode(null)).toBe('light')
    expect(resolveThemeMode(undefined)).toBe('light')
    expect(resolveThemeMode('auto')).toBe('light')
    expect(resolveThemeMode('system')).toBe('light')
  })

  it('accepts only light and dark values', () => {
    expect(resolveThemeMode('light')).toBe('light')
    expect(resolveThemeMode('dark')).toBe('dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- src/lib/theme.test.ts
```

Expected: FAIL because `src/lib/theme.ts` does not exist.

- [ ] **Step 3: Add the theme helper**

Create `src/lib/theme.ts`:

```ts
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
```

- [ ] **Step 4: Verify pure theme tests pass**

Run:

```bash
npm run test -- src/lib/theme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing component tests for two-state toggle**

Create `src/components/ThemeToggle.test.tsx`:

```tsx
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
```

- [ ] **Step 6: Run component test to verify it fails**

Run:

```bash
npm run test -- src/components/ThemeToggle.test.tsx
```

Expected: FAIL because current `ThemeToggle` cycles through `auto`.

- [ ] **Step 7: Implement two-state `ThemeToggle`**

Replace `src/components/ThemeToggle.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  applyThemeMode,
  resolveThemeMode,
  type ThemeMode,
} from '#/lib/theme'

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE
  }

  try {
    return resolveThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME_MODE
  }
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE)

  useEffect(() => {
    const initialMode = getInitialMode()
    setMode(initialMode)
    applyThemeMode(initialMode)
  }, [])

  function toggleMode() {
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(nextMode)
    applyThemeMode(nextMode)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode)
    } catch {
      // Keep the in-memory theme even when persistence is unavailable.
    }
  }

  const nextMode = mode === 'light' ? 'dark' : 'light'
  const label = `Theme mode: ${mode}. Click to switch to ${nextMode} mode.`

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={label}
      title={label}
      className="rounded-md border border-[var(--chip-line)] bg-transparent px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
    >
      {mode === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}
```

- [ ] **Step 8: Simplify the root theme init script**

In `src/routes/__root.tsx`, replace `THEME_INIT_SCRIPT` with:

```ts
const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=stored==='dark'?'dark':'light';var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(mode);root.setAttribute('data-theme',mode);root.style.colorScheme=mode;}catch(e){var fallback='light';var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(fallback);root.setAttribute('data-theme',fallback);root.style.colorScheme=fallback;}})();`
```

- [ ] **Step 9: Remove automatic system theme CSS**

In `src/styles.css`, delete the entire `@media (prefers-color-scheme: dark) { ... }` block. Keep the explicit `.dark, :root[data-theme="dark"] { ... }` block.

- [ ] **Step 10: Run task tests**

Run:

```bash
npm run test -- src/lib/theme.test.ts src/components/ThemeToggle.test.tsx src/components/Header.test.tsx
```

Expected: PASS after updating `Header.test.tsx` in Task 2 if it imports theme behavior indirectly. If `Header.test.tsx` fails only because it still installs `matchMedia`, leave it for Task 2.

- [ ] **Step 11: Commit Task 1**

Run:

```bash
git add src/lib/theme.ts src/lib/theme.test.ts src/components/ThemeToggle.tsx src/components/ThemeToggle.test.tsx src/routes/__root.tsx src/styles.css
git commit -m "fix: simplify theme mode selection"
```

---

### Task 2: Quieter Header Matching the Catalog Direction

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Header.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Header` remains the default export with no props.
- Consumes: `LanguageToggle` and `ThemeToggle` remain unchanged from callers' perspective.
- Produces: same navigation links and accessible names as before.

- [ ] **Step 1: Update Header tests for preserved behavior**

Modify `src/components/Header.test.tsx` to remove `installMatchMedia()` and add a Light/Dark assertion. Set the locale to English in this test so the code block remains ASCII-only:

```tsx
it('renders navigation and global controls by default', async () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
  renderHeader()

  await screen.findByRole('link', { name: 'Catalog' })
  expect(screen.getByRole('link', { name: 'Catalog' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Remotion' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'HyperFrames' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Go to RemotionHub GitHub' })).toBeTruthy()
  expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /theme mode: light/i })).toBeTruthy()
})
```

Keep the English language persistence test, but remove setup and teardown references to `matchMedia`.

- [ ] **Step 2: Run Header test to verify current mismatch**

Run:

```bash
npm run test -- src/components/Header.test.tsx
```

Expected: PASS if Task 1 is complete and the accessible controls are preserved. Visual class changes are verified later with Chrome.

- [ ] **Step 3: Implement the quieter Header layout**

Replace the returned JSX in `src/components/Header.tsx` with this structure:

```tsx
return (
  <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
    <nav className="site-nav page-wrap">
      <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[var(--sea-ink)] no-underline"
        >
          <span className="grid h-5 w-5 place-items-center rounded-md bg-[var(--brand-mark-bg)] text-[10px] font-bold text-[var(--brand-mark-fg)]">
            RH
          </span>
          RemotionHub
        </Link>
      </h2>

      <div className="site-nav-links">
        <Link
          to="/"
          className="nav-link"
          activeProps={{ className: 'nav-link is-active' }}
        >
          {t('nav.catalog')}
        </Link>
        <Link
          to="/remotion"
          className="nav-link"
          activeProps={{ className: 'nav-link is-active' }}
        >
          {t('nav.remotion')}
        </Link>
        <Link
          to="/hyperframes"
          className="nav-link"
          activeProps={{ className: 'nav-link is-active' }}
        >
          {t('nav.hyperframes')}
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <a
          href="https://github.com/tangwz/remotionhub"
          target="_blank"
          rel="noreferrer"
          className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
        >
          <span className="sr-only">{t('nav.github')}</span>
          <GithubIcon aria-hidden="true" size={21} />
        </a>

        <LanguageToggle />
        <ThemeToggle />
      </div>
    </nav>
  </header>
)
```

- [ ] **Step 4: Add the Header layout CSS tokens**

In `src/styles.css`, add these variables to both light and dark token blocks with values adjusted for each theme:

```css
--brand-mark-bg: oklch(0.93 0.04 205);
--brand-mark-fg: oklch(0.36 0.08 220);
```

For the dark block:

```css
--brand-mark-bg: oklch(0.31 0.026 220);
--brand-mark-fg: oklch(0.86 0.04 205);
```

Add these layout classes after `.catalog-grid`:

```css
.site-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  min-height: 4.75rem;
  gap: 1rem;
}

.site-nav-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  font-size: 0.95rem;
  font-weight: 650;
}

@media (max-width: 760px) {
  .site-nav {
    grid-template-columns: 1fr auto;
    min-height: auto;
    padding-block: 0.75rem;
  }

  .site-nav-links {
    grid-column: 1 / -1;
    order: 3;
    justify-content: flex-start;
    gap: 1rem;
    overflow-x: auto;
    padding-bottom: 0.15rem;
  }
}
```

- [ ] **Step 5: Run Header tests**

Run:

```bash
npm run test -- src/components/Header.test.tsx src/components/ThemeToggle.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add src/components/Header.tsx src/components/Header.test.tsx src/styles.css
git commit -m "feat: quiet catalog header"
```

---

### Task 3: Catalog Page Shell, Filters, Grid, and Cards

**Files:**
- Create: `src/components/catalog/CatalogPageShell.tsx`
- Create: `src/components/catalog/CatalogFilters.test.tsx`
- Modify: `src/components/catalog/CatalogFilters.tsx`
- Modify: `src/components/catalog/CatalogGrid.tsx`
- Modify: `src/components/catalog/CatalogCard.tsx`
- Modify: `src/components/catalog/CatalogCard.test.tsx`
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/remotion/index.tsx`
- Modify: `src/routes/hyperframes/index.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `CatalogPageShell({ eyebrow, title, description, children }: CatalogPageShellProps)`
- Produces: `CatalogFilterOption = { value: string; label: string; count?: number }`
- Updates: `CatalogFilters` props to `{ categories, tags, selectedCategory, onCategoryChange }`
- Keeps: `CatalogGrid({ runtime }: { runtime?: Runtime })`
- Keeps: `CatalogCard({ item }: { item: CatalogCardItem })`

- [ ] **Step 1: Add i18n labels for filter rows**

In `src/lib/i18n.ts`, add these keys to both dictionaries. The Chinese values are shown as Unicode escapes in this plan to keep Markdown code blocks ASCII-only:

```ts
'filters.categories': '\u5206\u7c7b',
'filters.tags': '\u6807\u7b7e',
'filters.allTags': '\u5168\u90e8\u6807\u7b7e',
```

For English:

```ts
'filters.categories': 'Categories',
'filters.tags': 'Tags',
'filters.allTags': 'All tags',
```

Also adjust home copy:

```ts
'home.title': '\u52a8\u753b\u6a21\u677f\u5e93',
'home.description': '\u6d4f\u89c8\u6a21\u677f\u3001\u4e0b\u8f7d\u6e90\u7801\u6863\u6848\uff0c\u5e76\u642d\u914d AI \u63d0\u793a\u8bcd\u5feb\u901f\u5ba2\u5236\u5316\u3002',
```

For English:

```ts
'home.title': 'Motion template library',
'home.description': 'Browse templates, download source archives, and copy prompts for AI-assisted customization.',
```

- [ ] **Step 2: Create the shared page shell**

Create `src/components/catalog/CatalogPageShell.tsx`:

```tsx
import type { ReactNode } from 'react'

export type CatalogPageShellProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export default function CatalogPageShell({
  eyebrow,
  title,
  description,
  children,
}: CatalogPageShellProps) {
  return (
    <main className="catalog-page">
      <header className="catalog-hero">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="catalog-divider" />
      {children}
    </main>
  )
}
```

- [ ] **Step 3: Update routes to use the shell**

In each list route, replace the `<main>` wrapper with `CatalogPageShell`.

For `src/routes/index.tsx`:

```tsx
return (
  <CatalogPageShell
    eyebrow={t('home.eyebrow')}
    title={t('home.title')}
    description={t('home.description')}
  >
    <CatalogGrid />
  </CatalogPageShell>
)
```

Add the import:

```ts
import CatalogPageShell from '#/components/catalog/CatalogPageShell'
```

Repeat for `/remotion` and `/hyperframes` using their existing translation keys and runtime-specific `CatalogGrid` props.

- [ ] **Step 4: Write failing filter tests**

Create `src/components/catalog/CatalogFilters.test.tsx`:

```tsx
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/components/I18nProvider'
import CatalogFilters from './CatalogFilters'

describe('CatalogFilters', () => {
  beforeEach(() => {
    window.localStorage.setItem('remotionhub.locale', 'en')
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('filters by category and exposes tags as read-only hints', () => {
    const onCategoryChange = vi.fn()

    render(
      <I18nProvider>
        <CatalogFilters
          categories={[
            { value: 'transition', label: 'transition', count: 17 },
            { value: 'title', label: 'title', count: 8 },
          ]}
          tags={[
            { value: 'minimal', label: 'minimal' },
            { value: 'social', label: 'social' },
          ]}
          selectedCategory={undefined}
          onCategoryChange={onCategoryChange}
        />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'transition (17)' }))

    expect(onCategoryChange).toHaveBeenCalledWith('transition')
    expect(screen.getByText('minimal').tagName).toBe('SPAN')
    expect(screen.queryByRole('button', { name: 'minimal' })).toBeNull()
  })

  it('clears the category filter when all is selected', () => {
    const onCategoryChange = vi.fn()

    render(
      <I18nProvider>
        <CatalogFilters
          categories={[{ value: 'transition', label: 'transition', count: 17 }]}
          tags={[]}
          selectedCategory="transition"
          onCategoryChange={onCategoryChange}
        />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'All' }))

    expect(onCategoryChange).toHaveBeenCalledWith(undefined)
  })
})
```

- [ ] **Step 5: Run filter test to verify it fails**

Run:

```bash
npm run test -- src/components/catalog/CatalogFilters.test.tsx
```

Expected: FAIL because `CatalogFilters` does not yet accept option objects or render tags.

- [ ] **Step 6: Implement two-row filters**

Replace `src/components/catalog/CatalogFilters.tsx` with:

```tsx
import { useI18n } from '#/components/I18nProvider'

export type CatalogFilterOption = {
  value: string
  label: string
  count?: number
}

export default function CatalogFilters({
  categories,
  tags,
  selectedCategory,
  onCategoryChange,
}: {
  categories: CatalogFilterOption[]
  tags: CatalogFilterOption[]
  selectedCategory?: string
  onCategoryChange: (category?: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="catalog-filters" aria-label={t('filters.categories')}>
      <div className="catalog-filter-row" aria-label={t('filters.categories')}>
        <button
          type="button"
          className="filter-chip"
          data-active={!selectedCategory}
          onClick={() => onCategoryChange(undefined)}
        >
          {t('filters.all')}
        </button>
        {categories.map((category) => (
          <button
            key={category.value}
            type="button"
            className="filter-chip"
            data-active={selectedCategory === category.value}
            onClick={() => onCategoryChange(category.value)}
          >
            {formatOptionLabel(category)}
          </button>
        ))}
      </div>

      {tags.length > 0 ? (
        <div className="catalog-tag-row" aria-label={t('filters.tags')}>
          <span className="tag-chip tag-chip-label">{t('filters.allTags')}</span>
          {tags.map((tag) => (
            <span key={tag.value} className="tag-chip">
              {tag.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function formatOptionLabel(option: CatalogFilterOption) {
  return typeof option.count === 'number'
    ? `${option.label} (${option.count})`
    : option.label
}
```

The `filters.allTags` key keeps display copy in the dictionary instead of composing mixed-language UI text in the component.

- [ ] **Step 7: Update `CatalogGrid` to compute facets and render separators**

In `src/components/catalog/CatalogGrid.tsx`, replace the category memo with category counts, tag options, and a stable facet cache:

```tsx
const [category, setCategory] = useState<string | undefined>()
const [facetItems, setFacetItems] = useState<typeof results>([])

useEffect(() => {
  if (!category && results.length > 0) {
    setFacetItems(results)
  }
}, [category, results])

const categoryOptions = useMemo(
  () => buildFacetOptions(facetItems, (item) => item.categories),
  [facetItems],
)
const tagOptions = useMemo(
  () => buildFacetOptions(facetItems, (item) => item.tags).slice(0, 18),
  [facetItems],
)
```

Add this helper in the same file:

```tsx
function buildFacetOptions<T>(
  items: T[],
  selectValues: (item: T) => string[],
) {
  const counts = new Map<string, number>()

  for (const item of items) {
    for (const value of selectValues(item)) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
}
```

Update the returned structure:

```tsx
return (
  <section className="flex flex-col gap-6">
    <CatalogFilters
      categories={categoryOptions}
      tags={tagOptions}
      selectedCategory={category}
      onCategoryChange={setCategory}
    />
    <div className="catalog-divider" />
    {results.length === 0 && status === 'Exhausted' ? (
      <Alert>
        <AlertTitle>{t('catalog.emptyTitle')}</AlertTitle>
        <AlertDescription>{t('catalog.emptyDescription')}</AlertDescription>
      </Alert>
    ) : null}
    <div className="catalog-grid">
      {results.map((item) => (
        <CatalogCard key={item.componentId} item={item} />
      ))}
    </div>
    {status === 'LoadingFirstPage' ? (
      <div className="catalog-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-video rounded-lg" />
        ))}
      </div>
    ) : null}
    {status === 'LoadingMore' ? (
      <p className="text-sm text-muted-foreground">{t('catalog.loadingMore')}</p>
    ) : null}
    {status === 'CanLoadMore' ? (
      <div ref={sentinelRef} className="h-10" aria-hidden />
    ) : null}
    {status === 'Exhausted' && results.length > 0 ? (
      <p className="text-sm text-muted-foreground">{t('catalog.end')}</p>
    ) : null}
  </section>
)
```

- [ ] **Step 8: Update card test for compact card behavior**

Modify `src/components/catalog/CatalogCard.test.tsx` to assert summary is not rendered in list cards:

```tsx
expect(screen.queryByText('Image-led Remotion title animations.')).toBeNull()
```

Keep existing route and badge assertions.

- [ ] **Step 9: Implement compact `CatalogCard`**

Use this card body shape in `src/components/catalog/CatalogCard.tsx`:

```tsx
return (
  <Link
    to={to}
    params={{ owner: item.ownerHandle, slug: item.slug }}
    className="group block no-underline"
  >
    <Card className="h-full overflow-hidden rounded-lg border-[var(--line)] bg-[var(--card)] transition group-hover:-translate-y-0.5 group-hover:shadow-md">
      <div className="aspect-video overflow-hidden bg-muted">
        <PreviewMedia
          preview={item.latestVersionSummary.preview}
          title={item.displayName}
          className="flex size-full items-center justify-center object-cover text-2xl font-semibold text-muted-foreground transition group-hover:scale-[1.02]"
        />
      </div>
      <CardContent className="flex flex-col gap-3 px-4 py-4">
        <CardTitle className="truncate text-base">{item.displayName}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {visibleBadges.map((badge) => (
            <Badge key={badge} variant="secondary">
              {badge}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  </Link>
)
```

Remove unused `CardHeader` import.

- [ ] **Step 10: Add catalog layout CSS**

In `src/styles.css`, update `.page-wrap`, `.catalog-grid`, and add page/filter classes:

```css
.page-wrap {
  width: min(1200px, calc(100% - 2rem));
  margin-inline: auto;
}

.catalog-page {
  width: min(1200px, calc(100% - 2rem));
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding-block: 4.5rem;
}

.catalog-hero {
  display: flex;
  max-width: 48rem;
  flex-direction: column;
  gap: 0.75rem;
}

.catalog-hero h1 {
  margin: 0;
  font-size: clamp(2.25rem, 4vw, 3rem);
  font-weight: 720;
  letter-spacing: 0;
  line-height: 1.05;
}

.catalog-hero p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 1.05rem;
}

.catalog-divider {
  height: 1px;
  width: 100%;
  background: var(--line);
}

.catalog-filters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.catalog-filter-row,
.catalog-tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.filter-chip {
  border: 1px solid var(--chip-line);
  border-radius: 0.5rem;
  background: var(--chip-bg);
  padding: 0.42rem 0.8rem;
  color: var(--foreground);
  font-size: 0.92rem;
  font-weight: 650;
}

.filter-chip[data-active="true"] {
  border-color: var(--foreground);
  background: var(--foreground);
  color: var(--background);
}

.tag-chip {
  border-radius: 0.45rem;
  background: transparent;
  padding: 0.35rem 0.55rem;
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 600;
}

.tag-chip-label {
  background: var(--muted);
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.75rem;
}

@media (max-width: 980px) {
  .catalog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .catalog-page {
    padding-block: 2.5rem;
  }

  .catalog-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 11: Run focused catalog tests**

Run:

```bash
npm run test -- src/components/catalog/CatalogFilters.test.tsx src/components/catalog/CatalogCard.test.tsx src/components/Header.test.tsx
```

Expected: PASS.

- [ ] **Step 12: Typecheck and route generation check**

Run:

```bash
VITE_CONVEX_URL=https://example.invalid npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 13: Commit Task 3**

Run:

```bash
git add src/components/catalog/CatalogPageShell.tsx src/components/catalog/CatalogFilters.tsx src/components/catalog/CatalogFilters.test.tsx src/components/catalog/CatalogGrid.tsx src/components/catalog/CatalogCard.tsx src/components/catalog/CatalogCard.test.tsx src/routes/index.tsx src/routes/remotion/index.tsx src/routes/hyperframes/index.tsx src/lib/i18n.ts src/styles.css
git commit -m "feat: redesign catalog browsing layout"
```

---

### Task 4: Full Verification and Browser Proof

**Files:**
- Modify only if verification finds issues in files changed by Tasks 1-3.
- Test: existing unit, build, and e2e suite.

**Interfaces:**
- Consumes: running local app at `http://127.0.0.1:<port>/`.
- Produces: real Chrome visual verification for `/`, `/remotion`, and `/hyperframes`.

- [ ] **Step 1: Run the static and unit gate**

Run:

```bash
make check
```

Expected: PASS.

- [ ] **Step 2: Run e2e separately from build-heavy commands**

Run:

```bash
make e2e
```

Expected: PASS or existing environment-specific skip. Do not run this in parallel with `make check`, because both may write `dist/`.

- [ ] **Step 3: Start a local app server for visual verification**

Run:

```bash
VITE_CONVEX_URL=http://127.0.0.1:3210 npx vite dev --host 127.0.0.1 --port 3001
```

Expected: Vite prints a local URL. If port 3001 is busy, use the next printed port.

- [ ] **Step 4: Verify desktop layout in Chrome**

Open the local URL in Chrome and verify:

- Header has left brand, centered nav, right controls.
- `/` has a centered content column with left-aligned hero, filters, and grid.
- Large viewport shows three equal card columns filling the content column.
- Category filters are buttons with counts.
- Tag row is visible and does not behave like a filter.
- Light/Dark toggle never shows `Auto`.

- [ ] **Step 5: Verify responsive layout in Chrome**

Use Chrome responsive viewport checks:

- Width around 1024px: grid uses two columns and no horizontal overflow.
- Width around 390px: grid uses one column, filters wrap, Header remains usable.
- Toggle Dark, refresh, and confirm Dark remains active.
- Toggle Light, refresh, and confirm Light remains active.

- [ ] **Step 6: Verify route variants**

Open:

```text
/
/remotion
/hyperframes
```

Expected:

- All three pages share the same shell rhythm.
- `/remotion` only lists Remotion runtime entries.
- `/hyperframes` only lists HyperFrames runtime entries.
- Runtime-specific titles and descriptions remain translated.

- [ ] **Step 7: Fix verification-only issues**

If Chrome reveals spacing, overflow, or text fitting problems, make the smallest CSS/component adjustment in the touched files. After each adjustment, rerun:

```bash
npm run test -- src/components/catalog/CatalogFilters.test.tsx src/components/catalog/CatalogCard.test.tsx src/components/Header.test.tsx src/components/ThemeToggle.test.tsx
VITE_CONVEX_URL=https://example.invalid npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit verification fixes if any**

If Step 7 changed files, run:

```bash
git add src
git commit -m "fix: polish catalog responsive layout"
```

If Step 7 did not change files, do not create an empty commit.

- [ ] **Step 9: Final status check**

Run:

```bash
git status --short
```

Expected: no unintended modified source files. Existing unrelated user changes may remain, but implementation commits should include only files touched by this plan.
