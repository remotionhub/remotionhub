# GitHub and WeChat Unified Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the GitHub login implementation from `main` with the existing WeChat Website App login so the Header has one neutral entry point and a centered Portal dialog offering both independent OAuth providers.

**Architecture:** `convex/auth.ts` remains the single Convex Auth configuration and registers GitHub plus WeChat while sharing redirect and user bootstrap callbacks. `HeaderAuth` owns auth state and the single trigger; a focused `AuthDialog` owns the Portal, provider selection, pending state, dismissal, and error feedback.

**Tech Stack:** React 19, TypeScript 6, TanStack Start, Convex Auth, Auth.js GitHub and WeChat providers, Tailwind CSS v4, Vitest 4, Testing Library, Playwright.

## Global Constraints

- Work only in `/Users/tangwz/workspace/git/remotionhub/.worktrees/wechat-web-login` on `codex/wechat-web-login`.
- Merge `origin/main`; do not rebase, force-push, or rewrite the existing PR history.
- Keep GitHub and WeChat Auth Accounts independent; do not add email-based linking, account binding, or account merging.
- Keep one neutral unauthenticated Header entry; provider branding appears only after the dialog opens.
- Render the dialog through `createPortal(..., document.body)` so Header `backdrop-filter` cannot constrain fixed positioning.
- Preserve the current relative URL across both OAuth flows and accept only safe same-site redirect targets.
- Keep OAuth credentials, `SITE_URL`, JWT keys, and JWKS in Convex environment variables only.
- Do not expose an actual WeChat application ID in source, specs, test artifacts, logs, or screenshots.
- Use English for code, comments, identifiers, commit messages, and Markdown code blocks.
- Use TDD for every behavior change: observe the focused test fail before writing production code.

---

## File Map

- Modify `convex/auth.ts`: register both providers and preserve shared callbacks.
- Modify `convex/auth.test.ts`: combine GitHub, WeChat, redirect, profile allowlist, and user bootstrap coverage.
- Create `src/components/AuthDialog.tsx`: Portal dialog and provider interaction state.
- Modify `src/components/HeaderAuth.tsx`: one neutral trigger and signed-in Header state.
- Modify `src/components/Header.test.tsx`: unified entry, Portal, provider, pending, dismissal, and signed-in tests.
- Modify `src/lib/i18n.ts`: combined GitHub and WeChat dialog copy.
- Preserve `src/lib/authRedirect.ts` and `src/lib/authRedirect.test.ts`: frontend relative URL sanitizer.
- Modify `.env.example`: document both OAuth providers and callback URLs without real credentials.
- Resolve merge conflicts in `convex/users.ts`, `convex/schema.ts`, `convex/components.ts`, and related tests by preserving the newest `main` user bootstrap behavior plus existing catalog publisher safety invariants.

---

### Task 1: Merge the GitHub auth baseline from main

**Files:**
- Merge: `origin/main` into `codex/wechat-web-login`
- Resolve: `convex/auth.ts`
- Resolve: `convex/auth.test.ts`
- Resolve: `src/components/Header.tsx`
- Resolve: `src/components/HeaderAuth.tsx`
- Resolve: `src/components/Header.test.tsx`
- Resolve: `src/lib/i18n.ts`
- Resolve as needed: `.env.example`, `convex/schema.ts`, `convex/users.ts`, `convex/users.test.ts`, `convex/lib/access.ts`, `convex/lib/handles.ts`, `convex/lib/handles.test.ts`, `convex/components.ts`, `convex/components.test.ts`, `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: `origin/main` at or after `b45dbff` and the existing WeChat branch history through the approved unified-login design.
- Produces: a clean merge baseline where GitHub login and the latest main user bootstrap behavior are intact, while feature-only specs and redirect helpers remain available for later tasks.

- [ ] **Step 1: Confirm the worktree and fetch the merge target**

Run:

```bash
git status -sb
git fetch origin main
git rev-parse --abbrev-ref HEAD
```

Expected: clean `codex/wechat-web-login` worktree and branch name `codex/wechat-web-login`.

- [ ] **Step 2: Start a non-rewriting merge**

Run:

```bash
git merge --no-commit origin/main
```

Expected: either a pending merge with conflicts in overlapping auth files or a clean pending merge. Do not commit until the conflict matrix below is satisfied.

- [ ] **Step 3: Resolve conflicts using the semantic ownership matrix**

Apply these exact ownership rules while removing all conflict markers:

| Surface | Baseline | Required preserved behavior |
|---|---|---|
| `convex/auth.ts` | `origin/main` | GitHub numeric profile ID validation, `allowDangerousEmailAccountLinking: false`, current `GenericMutationCtx`/`anyApi` publisher scheduling |
| `convex/auth.test.ts` | `origin/main` | All GitHub provider/profile allowlist tests; WeChat and redirect tests return in Task 2 through TDD |
| `src/components/HeaderAuth.tsx` | `origin/main` | Signed-in group, avatar, handle, and sign-out behavior; unified dialog arrives in Task 3 |
| `src/components/Header.test.tsx` | `origin/main` | Main navigation, loading skeleton, GitHub baseline, signed-in group behavior |
| `src/components/Header.tsx` | `origin/main` | Main control ordering and no duplicate GitHub repository icon |
| `src/lib/i18n.ts` | `origin/main` | Main dictionary remains type-complete; combined dialog keys arrive in Task 3 |
| `convex/users.ts` and helpers | `origin/main` | Latest personal Publisher reuse, handle collision, display name, and image synchronization behavior |
| `convex/components.ts` | combined | Preserve rejection of catalog imports that collide with a user Publisher handle and preserve `kind: 'system'` for catalog Publishers |
| `convex/schema.ts` | combined | Preserve auth tables, user role/profile fields, Publisher `kind`, and `linkedUserId` indexes |
| `.env.example` | combined | Keep GitHub entries now; final dual-provider documentation lands in Task 4 |

Use this command to verify every conflict is resolved:

```bash
git diff --name-only --diff-filter=U
```

Expected: no output.

- [ ] **Step 4: Verify the merged GitHub baseline before adding new behavior**

Run:

```bash
npm run test -- convex/auth.test.ts convex/users.test.ts src/components/Header.test.tsx src/components/AppProviders.test.tsx
```

Expected: all selected main baseline tests pass. If a test fails, fix the conflict resolution rather than adding WeChat behavior.

- [ ] **Step 5: Commit the merge baseline**

Run:

```bash
git add .
git diff --cached --check
git commit --no-edit
```

Expected: a merge commit with the default merge message and no whitespace errors.

---

### Task 2: Register independent GitHub and WeChat providers

**Files:**
- Modify: `convex/auth.test.ts`
- Modify: `convex/auth.ts`

**Interfaces:**
- Consumes: `createGitHubAuthProvider()`, `normalizeGitHubProfileId()`, `userDataFromAuthProfile()`, and main's `createOrUpdateUser` callback.
- Produces: `createWeChatAuthProvider()`, `normalizeWeChatProviderAccountId()`, `normalizeRelativeRedirectTo()`, `createAbsoluteRedirectUrl()`, and exported `authCallbacks` used by one `convexAuth` configuration.

- [ ] **Step 1: Add failing WeChat identity tests while retaining every GitHub test**

Add these cases to `convex/auth.test.ts` and extend the import list without deleting the existing GitHub blocks:

```ts
import {
  authCallbacks,
  createAbsoluteRedirectUrl,
  createGitHubAuthProvider,
  createWeChatAuthProvider,
  normalizeGitHubProfileId,
  normalizeRelativeRedirectTo,
  normalizeWeChatProviderAccountId,
  userDataFromAuthProfile,
} from './auth'

describe('create auth providers', () => {
  it('keeps GitHub and WeChat as independent providers', () => {
    expect(createGitHubAuthProvider().id).toBe('github')
    expect(createWeChatAuthProvider().id).toBe('wechat')
  })
})

describe('normalizeWeChatProviderAccountId', () => {
  it('keeps the WebsiteApp openid stable when unionid later appears', () => {
    expect(
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123', unionid: 'unionid-456' },
        { allowOpenIdFallback: true, appId: 'wx-test-app' },
      ),
    ).toBe('wechat:web:wx-test-app:openid-123')
  })

  it('uses unionid only when openid is unavailable', () => {
    expect(normalizeWeChatProviderAccountId({ unionid: 'unionid-456' })).toBe(
      'unionid-456',
    )
  })

  it('rejects openid without an app namespace', () => {
    expect(() =>
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123' },
        { allowOpenIdFallback: true },
      ),
    ).toThrow(/requires a WeChat app id/)
  })

  it('rejects profiles without a stable account id', () => {
    expect(() => normalizeWeChatProviderAccountId({})).toThrow(
      /missing a stable WeChat account id/,
    )
  })
})
```

- [ ] **Step 2: Run the focused backend test and observe RED**

Run:

```bash
npm run test -- convex/auth.test.ts
```

Expected: FAIL because the WeChat and redirect exports are absent from the main baseline.

- [ ] **Step 3: Implement the WeChat provider and stable identity mapping**

Add the WeChat provider import, profile type, string normalizer, and provider factory to `convex/auth.ts`:

```ts
import GitHub from '@auth/core/providers/github'
import WeChat from '@auth/core/providers/wechat'

export type WeChatProfileLike = {
  openid?: unknown
  unionid?: unknown
  nickname?: unknown
  headimgurl?: unknown
}

function normalizedString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeWeChatProviderAccountId(
  profile: WeChatProfileLike,
  options: { allowOpenIdFallback?: boolean; appId?: string } = {},
) {
  const openid = normalizedString(profile.openid)
  if (openid && options.allowOpenIdFallback) {
    const appId = normalizedString(options.appId)
    if (!appId) {
      throw new Error('WeChat openid fallback requires a WeChat app id')
    }
    return `wechat:web:${appId}:${openid}`
  }

  const unionid = normalizedString(profile.unionid)
  if (unionid) return unionid

  throw new Error('WeChat OAuth profile is missing a stable WeChat account id')
}

export function createWeChatAuthProvider() {
  const appId = process.env.AUTH_WECHAT_ID ?? ''
  return WeChat({
    clientId: appId,
    clientSecret: process.env.AUTH_WECHAT_SECRET ?? '',
    allowDangerousEmailAccountLinking: false,
    platformType: 'WebsiteApp',
    profile(profile) {
      return {
        id: normalizeWeChatProviderAccountId(profile, {
          allowOpenIdFallback: true,
          appId,
        }),
        name: normalizedString(profile.nickname) ?? 'WeChat User',
        email: null,
        image: normalizedString(profile.headimgurl) ?? undefined,
      }
    },
  })
}
```

- [ ] **Step 4: Add failing redirect and explicit-verification tests**

Add these cases to `convex/auth.test.ts`:

```ts
function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

describe('userDataFromAuthProfile verification', () => {
  it('does not infer verification from an OAuth provider', () => {
    expect(
      userDataFromAuthProfile({
        provider: { type: 'oauth', allowDangerousEmailAccountLinking: true },
        profile: { email: 'user@example.com' },
      }),
    ).toEqual({ email: 'user@example.com' })
  })
})

describe('normalizeRelativeRedirectTo', () => {
  it('keeps safe relative redirects', () => {
    expect(normalizeRelativeRedirectTo('/remotion?tag=card#top')).toBe(
      '/remotion?tag=card#top',
    )
    expect(normalizeRelativeRedirectTo('?tab=security')).toBe('?tab=security')
  })

  it('rejects external and escaped redirects', () => {
    expect(normalizeRelativeRedirectTo('https://evil.example/path')).toBe('/')
    expect(normalizeRelativeRedirectTo('//evil.example/path')).toBe('/')
    expect(normalizeRelativeRedirectTo('/\\\\evil.example/path')).toBe('/')
    expect(normalizeRelativeRedirectTo('/%2f%2fevil.example/path')).toBe('/')
    expect(normalizeRelativeRedirectTo('/safe\ndanger')).toBe('/')
  })
})

describe('authCallbacks.redirect', () => {
  it('uses SITE_URL and rejects external redirect targets', async () => {
    const previous = process.env.SITE_URL
    process.env.SITE_URL = 'https://remotionhub.ai'

    await expect(
      authCallbacks.redirect({ redirectTo: '/account/settings' }),
    ).resolves.toBe('https://remotionhub.ai/account/settings')
    await expect(
      authCallbacks.redirect({ redirectTo: 'https://evil.example/path' }),
    ).resolves.toBe('https://remotionhub.ai/')

    restoreEnv('SITE_URL', previous)
  })

  it('requires SITE_URL for final app redirects', async () => {
    const previous = process.env.SITE_URL
    delete process.env.SITE_URL

    await expect(
      authCallbacks.redirect({ redirectTo: '/account/settings' }),
    ).rejects.toThrow(/requires SITE_URL/)

    restoreEnv('SITE_URL', previous)
  })
})

describe('createAbsoluteRedirectUrl', () => {
  it('supports an explicit site URL in tests', () => {
    expect(
      createAbsoluteRedirectUrl('/account/settings', {
        siteUrl: 'https://preview.remotionhub.ai/base',
      }),
    ).toBe('https://preview.remotionhub.ai/account/settings')
  })
})
```

- [ ] **Step 5: Run the focused backend test and observe RED again**

Run:

```bash
npm run test -- convex/auth.test.ts
```

Expected: FAIL on missing redirect helpers or because verification is still inferred from provider type.

- [ ] **Step 6: Implement shared redirect and user callbacks**

Use explicit profile verification and export one callback object:

```ts
export function normalizeRelativeRedirectTo(redirectTo: string) {
  const trimmed = redirectTo.trim()
  if (!trimmed) return '/'
  if (/[\\\u0000-\u001F\u007F]/.test(trimmed)) return '/'
  if (/%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i.test(trimmed)) return '/'
  if (trimmed.startsWith('?')) return trimmed
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  return '/'
}

function getAuthSiteUrl() {
  const siteUrl = normalizedString(process.env.SITE_URL)
  if (!siteUrl) {
    throw new Error('Convex Auth redirect callback requires SITE_URL')
  }
  return siteUrl
}

export function createAbsoluteRedirectUrl(
  redirectTo: string,
  options: { siteUrl?: string } = {},
) {
  return new URL(
    normalizeRelativeRedirectTo(redirectTo),
    options.siteUrl ?? getAuthSiteUrl(),
  ).toString()
}

type ConvexAuthCallbacks = NonNullable<
  Parameters<typeof convexAuth>[0]['callbacks']
>

export const authCallbacks = {
  async redirect({ redirectTo }: { redirectTo: string }) {
    return createAbsoluteRedirectUrl(redirectTo)
  },
  async createOrUpdateUser(ctx, args) {
    const userData = userDataFromAuthProfile(args)
    if (args.existingUserId !== null) {
      const userId = args.existingUserId as Id<'users'>
      await ctx.db.patch(userId, { ...userData, updatedAt: Date.now() })
      await schedulePostUserCreatedOrUpdated(ctx, userId)
      return userId
    }

    const now = Date.now()
    const userId = await ctx.db.insert('users', {
      ...userData,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    })
    await schedulePostUserCreatedOrUpdated(ctx, userId)
    return userId
  },
} satisfies ConvexAuthCallbacks

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [createGitHubAuthProvider(), createWeChatAuthProvider()],
  callbacks: authCallbacks,
})
```

Update `userDataFromAuthProfile` so `emailVerificationTime` and `phoneVerificationTime` are emitted only when the corresponding profile field is exactly `true`. Keep the existing business-field allowlist and discard raw Provider IDs and custom claims.

- [ ] **Step 7: Run backend auth and user bootstrap tests GREEN**

Run:

```bash
npm run test -- convex/auth.test.ts convex/users.test.ts convex/lib/handles.test.ts
```

Expected: all selected tests pass, including every retained GitHub test and every new WeChat/redirect test.

- [ ] **Step 8: Commit the backend integration**

Run:

```bash
git add convex/auth.ts convex/auth.test.ts
git diff --cached --check
git commit -m "feat: combine github and wechat auth providers"
```

---

### Task 3: Build the single-entry Portal login dialog

**Files:**
- Create: `src/components/AuthDialog.tsx`
- Modify: `src/components/HeaderAuth.tsx`
- Modify: `src/components/Header.test.tsx`
- Modify: `src/lib/i18n.ts`
- Preserve: `src/lib/authRedirect.ts`
- Preserve: `src/lib/authRedirect.test.ts`

**Interfaces:**
- Consumes: `getCurrentRelativeUrl(): string`, `useAuthActions().signIn`, `useAuthStatus()`, and i18n `t()`.
- Produces: `AuthDialog` with props `{ open, onClose, onSignIn }`, one neutral Header trigger, and provider calls for `'github' | 'wechat'`.

- [ ] **Step 1: Add failing unified-entry and Portal tests**

Replace the provider-specific unauthenticated tests in `src/components/Header.test.tsx` with these behaviors:

```tsx
it('opens one provider-neutral login dialog from the header', () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
  renderHeader()

  const trigger = screen.getByRole('button', { name: 'Log in' })
  expect(screen.queryByRole('button', { name: 'Sign in with GitHub' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Log in with WeChat' })).toBeNull()

  fireEvent.click(trigger)

  const dialog = screen.getByRole('dialog', { name: 'Log in to RemotionHub' })
  expect(dialog).toBeTruthy()
  expect(dialog.parentElement?.parentElement).toBe(document.body)
  expect(screen.getByRole('button', { name: 'Sign in with GitHub' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Log in with WeChat' })).toBeTruthy()
})

it.each([
  ['github', 'Sign in with GitHub'],
  ['wechat', 'Log in with WeChat'],
] as const)('starts %s sign-in from the dialog', async (provider, label) => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
  window.history.pushState(null, '', '/remotion?tag=card#top')
  authMocks.signIn.mockResolvedValue({ signingIn: true })
  renderHeader()

  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.click(screen.getByRole('button', { name: label }))

  await waitFor(() => {
    expect(authMocks.signIn).toHaveBeenCalledWith(provider, {
      redirectTo: '/remotion?tag=card#top',
    })
  })
})
```

- [ ] **Step 2: Add failing pending, failure, and dismissal tests**

Add these cases:

```tsx
it('disables both providers while OAuth is starting', () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
  authMocks.signIn.mockReturnValue(new Promise(() => {}))
  renderHeader()

  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

  expect(screen.getByRole('button', { name: 'Sign in with GitHub' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled')).toBe(true)
})

it('restores provider controls after OAuth startup fails', async () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
  authMocks.signIn.mockRejectedValue(new Error('sign-in failed'))
  renderHeader()

  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

  await waitFor(() => {
    expect(authMocks.toastError).toHaveBeenCalledWith(
      'Sign in failed. Please try again.',
    )
  })
  expect(screen.getByRole('button', { name: 'Sign in with GitHub' }).hasAttribute('disabled')).toBe(false)
  expect(screen.getByRole('button', { name: 'Log in with WeChat' }).hasAttribute('disabled')).toBe(false)
})

it('closes on Escape and restores focus to the header trigger', () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
  renderHeader()

  const trigger = screen.getByRole('button', { name: 'Log in' })
  fireEvent.click(trigger)
  fireEvent.keyDown(document, { key: 'Escape' })

  expect(screen.queryByRole('dialog', { name: 'Log in to RemotionHub' })).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
```

Also retain the existing close-button test and add a click on the overlay element identified by `data-testid="auth-dialog-overlay"` to verify backdrop dismissal.

- [ ] **Step 3: Run the focused Header test and observe RED**

Run:

```bash
npm run test -- src/components/Header.test.tsx src/lib/authRedirect.test.ts
```

Expected: FAIL because there is no neutral trigger, Portal dialog, GitHub button inside the dialog, or pending state.

- [ ] **Step 4: Create `AuthDialog.tsx` with the approved interface**

Implement this component shape, keeping the existing WeChat SVG as a module-level component and using `GithubIcon` for GitHub:

```tsx
import { GithubIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useI18n } from './I18nProvider'

export type AuthProvider = 'github' | 'wechat'

type AuthDialogProps = {
  open: boolean
  onClose: () => void
  onSignIn: (provider: AuthProvider) => Promise<unknown>
}

export default function AuthDialog({ open, onClose, onSignIn }: AuthDialogProps) {
  const { t } = useI18n()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(null)

  useEffect(() => {
    if (!open) {
      setPendingProvider(null)
      return
    }

    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open || typeof document === 'undefined') return null

  const startSignIn = (provider: AuthProvider) => {
    if (pendingProvider) return
    setPendingProvider(provider)
    void onSignIn(provider).catch(() => {
      setPendingProvider(null)
      toast.error(t('auth.signInFailed'))
    })
  }

  return createPortal(
    <div
      data-testid="auth-dialog-overlay"
      className="fixed inset-0 z-[200] grid place-items-center bg-black/45 px-4 py-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-modal="true"
        aria-label={t('auth.loginToRemotionHub')}
        role="dialog"
        className="relative w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-7 py-8 text-[var(--sea-ink)] shadow-2xl sm:px-10"
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label={t('auth.close')}
          className="absolute top-4 right-4 rounded-md p-2 text-[var(--sea-ink-soft)] hover:bg-[var(--link-bg-hover)]"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" size={20} />
        </button>

        <h2 className="m-0 text-center text-xl font-semibold">
          {t('auth.loginToRemotionHub')}
        </h2>

        <div className="my-8 flex items-center gap-4 text-xs text-[var(--sea-ink-soft)]">
          <span className="h-px flex-1 bg-[var(--line)]" />
          <span>{t('auth.otherMethods')}</span>
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <div className="flex justify-center gap-4">
          <button
            type="button"
            aria-label={t('auth.signInWithGitHub')}
            className="grid h-14 w-20 place-items-center rounded-lg border border-[var(--line)] hover:bg-[var(--link-bg-hover)] disabled:cursor-wait disabled:opacity-50"
            disabled={pendingProvider !== null}
            onClick={() => startSignIn('github')}
          >
            <GithubIcon aria-hidden="true" size={22} />
          </button>
          <button
            type="button"
            aria-label={t('auth.signInWithWeChat')}
            className="grid h-14 w-20 place-items-center rounded-lg border border-[var(--line)] hover:bg-[var(--link-bg-hover)] disabled:cursor-wait disabled:opacity-50"
            disabled={pendingProvider !== null}
            onClick={() => startSignIn('wechat')}
          >
            <WeChatIcon />
          </button>
        </div>

        <p className="mt-8 mb-0 text-center text-xs leading-5 text-[var(--sea-ink-soft)]">
          {t('auth.agreementText')}
        </p>
      </section>
    </div>,
    document.body,
  )
}
```

Define `WeChatIcon` above `AuthDialog` using the existing green SVG from the WeChat branch. Keep it module-level so it is not recreated inside renders.

- [ ] **Step 5: Convert `HeaderAuth` to one neutral trigger**

Preserve the main signed-in branch and use this unauthenticated controller shape:

```tsx
import { CircleUserRoundIcon, LogOutIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getCurrentRelativeUrl } from '#/lib/authRedirect'
import AuthDialog, { type AuthProvider } from './AuthDialog'

const [isDialogOpen, setIsDialogOpen] = useState(false)
const loginButtonRef = useRef<HTMLButtonElement | null>(null)
const wasDialogOpen = useRef(false)

useEffect(() => {
  if (wasDialogOpen.current && !isDialogOpen) {
    loginButtonRef.current?.focus()
  }
  wasDialogOpen.current = isDialogOpen
}, [isDialogOpen])

const startSignIn = (provider: AuthProvider) =>
  signIn(provider, { redirectTo: getCurrentRelativeUrl() })

if (!isAuthenticated || !me) {
  return (
    <>
      <button
        ref={loginButtonRef}
        type="button"
        aria-label={t('auth.login')}
        className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
        onClick={() => setIsDialogOpen(true)}
      >
        <CircleUserRoundIcon aria-hidden="true" size={20} />
      </button>
      <AuthDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSignIn={startSignIn}
      />
    </>
  )
}
```

Keep the main loading skeleton dimensions and the main signed-in `role="group"` semantics. Keep sign-out error handling consistent with the existing branch behavior.

- [ ] **Step 6: Add the combined localized copy**

Add these exact keys to both dictionaries in `src/lib/i18n.ts`:

```ts
// zh
'auth.login': '登录',
'auth.loginToRemotionHub': '登录 RemotionHub',
'auth.otherMethods': '其他方式',
'auth.signInWithGitHub': '使用 GitHub 登录',
'auth.signInWithWeChat': '使用微信登录',
'auth.close': '关闭',
'auth.agreementText': '注册或登录即表示你同意用户协议和隐私政策',
'auth.signInFailed': '登录失败，请稍后重试。',
'auth.signOutFailed': '退出登录失败，请稍后重试。',

// en
'auth.login': 'Log in',
'auth.loginToRemotionHub': 'Log in to RemotionHub',
'auth.otherMethods': 'Other methods',
'auth.signInWithGitHub': 'Sign in with GitHub',
'auth.signInWithWeChat': 'Log in with WeChat',
'auth.close': 'Close',
'auth.agreementText': 'By signing up or logging in, you agree to the User Agreement and Privacy Policy.',
'auth.signInFailed': 'Sign in failed. Please try again.',
'auth.signOutFailed': 'Sign out failed. Please try again.',
```

Do not render agreement or privacy text as links until real routes exist.

- [ ] **Step 7: Run the focused frontend tests GREEN**

Run:

```bash
npm run test -- src/components/Header.test.tsx src/lib/authRedirect.test.ts src/components/AppProviders.test.tsx
```

Expected: all selected tests pass with one neutral trigger, a body-level Portal, both providers, pending protection, failure recovery, and dismissal behavior.

- [ ] **Step 8: Commit the frontend integration**

Run:

```bash
git add src/components/AuthDialog.tsx src/components/HeaderAuth.tsx src/components/Header.test.tsx src/lib/i18n.ts src/lib/authRedirect.ts src/lib/authRedirect.test.ts
git diff --cached --check
git commit -m "feat: add unified oauth login dialog"
```

---

### Task 4: Document dual-provider deployment configuration

**Files:**
- Modify: `.env.example`
- Modify if implementation details changed: `specs/2026-07-10-unified-github-wechat-login-design.md`

**Interfaces:**
- Consumes: final provider IDs and callback paths from Task 2.
- Produces: a secret-free operator checklist for configuring both providers.

- [ ] **Step 1: Replace the auth section in `.env.example`**

Use this exact secret-free block:

```dotenv
VITE_CONVEX_URL=https://example.convex.cloud

# Convex Auth values live in Convex env, not VITE_* browser env.
# SITE_URL=https://remotionhub.ai
# AUTH_GITHUB_ID=your-github-oauth-client-id
# AUTH_GITHUB_SECRET=your-github-oauth-client-secret
# AUTH_WECHAT_ID=your-wechat-open-platform-website-app-id
# AUTH_WECHAT_SECRET=your-wechat-open-platform-website-app-secret
# Register OAuth callbacks on the Convex auth site:
# ${CONVEX_SITE_URL}/api/auth/callback/github
# ${CONVEX_SITE_URL}/api/auth/callback/wechat
# JWT_PRIVATE_KEY=generated-by-convex-auth-setup
# JWKS=generated-by-convex-auth-setup
```

Do not include a real app ID, client ID, secret, callback host, or generated key.

- [ ] **Step 2: Verify docs and environment files contain no known credential values**

Run a repository search using only known test placeholders and environment variable names. Do not print environment variable values:

```bash
rg -n 'AUTH_GITHUB_ID|AUTH_WECHAT_ID|AUTH_GITHUB_SECRET|AUTH_WECHAT_SECRET|JWT_PRIVATE_KEY|JWKS|SITE_URL' .env.example specs/2026-07-10-unified-github-wechat-login-design.md
git diff --check
```

Expected: only variable names and placeholder documentation appear; `git diff --check` has no output.

- [ ] **Step 3: Commit configuration documentation**

Run:

```bash
git add .env.example specs/2026-07-10-unified-github-wechat-login-design.md
git diff --cached --check
git commit -m "docs: document unified oauth configuration"
```

If the design spec did not require an implementation-driven correction, stage only `.env.example`.

---

### Task 5: Run release verification and browser QA

**Files:**
- Verify only; do not create committed screenshots, traces, or reports.

**Interfaces:**
- Consumes: completed backend, frontend, and configuration tasks.
- Produces: fresh release evidence and an explicit list of any remaining environment-only blockers.

- [ ] **Step 1: Run focused auth verification**

Run:

```bash
npm run test -- convex/auth.test.ts convex/users.test.ts src/components/Header.test.tsx src/lib/authRedirect.test.ts src/components/AppProviders.test.tsx
```

Expected: all selected tests pass with zero failures.

- [ ] **Step 2: Run the repository verification gate**

Run:

```bash
make check
```

Expected: unit tests, catalog validation, TypeScript, and production build all pass.

- [ ] **Step 3: Run the coverage gate**

Run:

```bash
npm run ci:unit
```

Expected: all tests pass and global statements, branches, functions, and lines remain at or above 80%.

- [ ] **Step 4: Run the existing Playwright smoke when local fixtures are available**

Run:

```bash
make e2e
```

Expected: desktop and mobile projects pass. If catalog seed fails before Playwright starts, capture the exact infrastructure failure separately and do not report E2E as passed.

- [ ] **Step 5: Verify the rendered auth flow in a real browser**

Start the local app with the repository-supported Convex environment. Verify both desktop and `390x844` mobile viewports:

1. Page title is `RemotionHub` and meaningful content renders.
2. Header has exactly one neutral `Log in`/`登录` trigger before the dialog opens.
3. The dialog is centered relative to the viewport, not the sticky Header.
4. The overlay covers the full viewport and no horizontal overflow exists.
5. GitHub and WeChat buttons are both visible and equal in size.
6. Closing via button, backdrop, and `Escape` restores focus to the Header trigger.
7. Console contains no relevant errors or warnings.
8. GitHub starts the GitHub OAuth route and WeChat starts the WeChat QR route without logging query parameters or application IDs.

- [ ] **Step 6: Perform real callback acceptance with user participation**

On a configured test or preview deployment:

1. Complete one GitHub OAuth login and confirm return to the original relative URL.
2. Complete one WeChat QR scan and confirm return to the original relative URL.
3. Confirm each login creates or reuses its own Auth Account and Personal Publisher.
4. Confirm signing in through the other Provider does not silently merge the two users.

Expected: both callbacks succeed independently. This step requires real provider credentials and user approval in the external OAuth UI.

- [ ] **Step 7: Run pre-ship review**

Invoke `$autoreview` and address only accepted, actionable findings. Re-run the smallest affected test after each accepted fix, then rerun the focused auth verification.

- [ ] **Step 8: Verify final branch and PR evidence**

Run:

```bash
git status -sb
git log --oneline --decorate -8
gh pr checks 17 --repo remotionhub/remotionhub
```

Expected: clean worktree, intended commits present, and GitHub checks reported and passing. If no checks are reported, list that as a release blocker rather than claiming release readiness.
