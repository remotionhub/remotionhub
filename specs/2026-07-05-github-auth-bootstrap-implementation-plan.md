# GitHub Auth Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 RemotionHub 增加第一版 GitHub OAuth 登录，并在登录后幂等创建或修复个人 publisher。

**Architecture:** 使用 `@convex-dev/auth` 作为 OAuth/session 层。Convex 侧新增 provider-agnostic `users`、auth helpers、personal publisher bootstrap；前端用 `ConvexAuthProvider`、`useAuthStatus` 和 Header 登录控件暴露登录态。

**Tech Stack:** React 19, TanStack Start, TanStack Router, Convex, `@convex-dev/auth`, Auth.js GitHub provider, Vitest, convex-test, TypeScript strict, npm.

## Global Constraints

- 第一版只启用 GitHub OAuth，不启用 Google、WeChat、Weibo 或密码登录。
- 身份模型必须 provider-agnostic，不能把 `githubId` 写入业务 schema。
- OAuth account binding 只依赖 provider stable account id；email、username、nickname、avatar 只能作为 profile 数据。
- GitHub provider 必须设置 `allowDangerousEmailAccountLinking: false`。
- GitHub profile 缺少合法 numeric `id` 时必须 fail closed，不创建 user 或 publisher。
- 所有后端授权必须从 `getAuthUserId(ctx)` 或等价 helper 派生，不能接受客户端传入的 user id 作为授权证明。
- Superpowers 生成的计划和设计文档放在 `specs/`。
- 代码、注释、标识符、提交信息和 Markdown 代码块内容必须使用 English。
- 实现必须在新 worktree 中执行，建议分支 `codex/github-auth-bootstrap`。
- 不引入 settings 页面、发布 UI、组织 membership、CLI/API tokens。

---

## File Structure

- Modify: `package.json` and `package-lock.json`
  - Add Convex Auth dependencies.
- Modify: `.env.example`
  - Document non-secret auth example values.
- Create: `convex/auth.ts`
  - Configure Convex Auth providers and callbacks.
  - Export `auth`, `signIn`, `signOut`, `store`, `isAuthenticated`.
  - Export `normalizeGitHubProfileId` for tests.
- Create: `convex/auth.config.ts`
  - Configure Convex Auth JWT provider metadata.
- Modify: `convex/schema.ts`
  - Add `authTables`, `users`, and publisher ownership fields/indexes.
- Create: `convex/lib/access.ts`
  - Centralize `getOptionalAuthUserId` and `requireUser`.
- Create: `convex/lib/handles.ts`
  - Provider-neutral public handle normalization and fallback generation.
- Create: `convex/users.ts`
  - Implement `me`, `ensure`, and internal personal publisher helpers.
- Test: `convex/auth.test.ts`
  - Test GitHub profile id normalization.
- Test: `convex/lib/handles.test.ts`
  - Test handle candidates and fallback behavior.
- Test: `convex/users.test.ts`
  - Test `me`, `ensure`, idempotent publisher bootstrap, and conflict fallback.
- Modify: `convex/auth.ts`
  - Schedule personal publisher bootstrap after `convex/users.ts` exists.
- Modify: `src/lib/convex.ts`
  - Keep a single `ConvexReactClient` instance usable by `ConvexAuthProvider`.
- Create: `src/lib/useAuthStatus.ts`
  - Wrap Convex auth and `api.users.me`.
- Create: `src/components/UserBootstrap.tsx`
  - Best-effort frontend repair after sign-in.
- Modify: `src/components/AppProviders.tsx`
  - Replace `ConvexProvider` with `ConvexAuthProvider`; include `UserBootstrap`.
- Test: `src/components/AppProviders.test.tsx`
  - Verify provider nesting and bootstrap placement.
- Test: `src/lib/useAuthStatus.test.tsx`
  - Verify signed-out, loading, and signed-in status mapping.
- Create: `src/components/HeaderAuth.tsx`
  - Render sign-in button, loading skeleton, signed-in menu, and sign-out handling.
- Modify: `src/components/Header.tsx`
  - Insert `HeaderAuth` near existing global controls.
- Modify: `src/lib/i18n.ts`
  - Add auth UI copy in `zh` and `en`.
- Test: `src/components/Header.test.tsx`
  - Cover Header auth states and existing navigation regressions.
- Modify generated: `convex/_generated/api.*`, `convex/_generated/dataModel.d.ts`
  - Regenerate after schema/function changes.

---

### Task 1: Convex Auth Dependency, Schema, And GitHub Provider

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `convex/schema.ts`
- Create: `convex/auth.ts`
- Create: `convex/auth.config.ts`
- Test: `convex/auth.test.ts`

**Interfaces:**
- Produces: `normalizeGitHubProfileId(profileId: unknown): string`
- Produces: Convex Auth exports from `convex/auth.ts`: `auth`, `signIn`, `signOut`, `store`, `isAuthenticated`
- Produces: schema tables `users`, `authAccounts`, `authSessions`, `authRefreshTokens`, `authVerificationCodes`, and updated `publishers`

- [ ] **Step 1: Create the implementation worktree**

Run from the current main checkout:

```bash
git worktree add .worktrees/github-auth-bootstrap -b codex/github-auth-bootstrap
cd .worktrees/github-auth-bootstrap
```

Expected: the new worktree is created on branch `codex/github-auth-bootstrap`.

- [ ] **Step 2: Install Convex Auth dependencies**

Run:

```bash
npm install @convex-dev/auth @auth/core
```

Expected: `package.json` and `package-lock.json` include `@convex-dev/auth` and `@auth/core`.

- [ ] **Step 3: Write failing tests for GitHub profile id normalization**

Create `convex/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeGitHubProfileId } from './auth'

describe('normalizeGitHubProfileId', () => {
  it('accepts a numeric GitHub profile id', () => {
    expect(normalizeGitHubProfileId(123456)).toBe('123456')
  })

  it('accepts a numeric string GitHub profile id', () => {
    expect(normalizeGitHubProfileId(' 123456 ')).toBe('123456')
  })

  it('rejects missing and malformed GitHub profile ids', () => {
    expect(() => normalizeGitHubProfileId(undefined)).toThrow(
      /missing a valid numeric id/,
    )
    expect(() => normalizeGitHubProfileId('octocat')).toThrow(
      /missing a valid numeric id/,
    )
    expect(() => normalizeGitHubProfileId(1.5)).toThrow(
      /missing a valid numeric id/,
    )
  })
})
```

- [ ] **Step 4: Run the failing normalization test**

Run:

```bash
npm run test -- convex/auth.test.ts
```

Expected: FAIL because `convex/auth.ts` does not exist or does not export `normalizeGitHubProfileId`.

- [ ] **Step 5: Add Convex Auth provider code**

Create `convex/auth.ts`:

```ts
import GitHub from '@auth/core/providers/github'
import { convexAuth } from '@convex-dev/auth/server'
import type { Id } from './_generated/dataModel'

type AuthProfile = Record<string, unknown> & {
  email?: string
  phone?: string
  emailVerified?: boolean
  phoneVerified?: boolean
}

export function normalizeGitHubProfileId(profileId: unknown) {
  const id =
    typeof profileId === 'number' && Number.isSafeInteger(profileId)
      ? String(profileId)
      : typeof profileId === 'string'
        ? profileId.trim()
        : null

  if (!id || !/^\d+$/.test(id)) {
    throw new Error('GitHub OAuth profile is missing a valid numeric id')
  }

  return id
}

export function createGitHubAuthProvider() {
  return GitHub({
    clientId: process.env.AUTH_GITHUB_ID ?? '',
    clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
    allowDangerousEmailAccountLinking: false,
    profile(profile) {
      return {
        id: normalizeGitHubProfileId(profile.id),
        name: profile.login,
        email: profile.email ?? undefined,
        image: profile.avatar_url,
      }
    },
  })
}

function userDataFromAuthProfile(args: {
  provider: { type: string; allowDangerousEmailAccountLinking?: boolean }
  profile: AuthProfile
}) {
  const {
    emailVerified: profileEmailVerified,
    phoneVerified: profilePhoneVerified,
    ...profile
  } = args.profile
  const emailVerified =
    profileEmailVerified ??
    ((args.provider.type === 'oauth' || args.provider.type === 'oidc') &&
      args.provider.allowDangerousEmailAccountLinking !== false)
  const phoneVerified = profilePhoneVerified ?? false

  return {
    ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
    ...(phoneVerified ? { phoneVerificationTime: Date.now() } : null),
    ...profile,
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [createGitHubAuthProvider()],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const userData = userDataFromAuthProfile(args)
      if (args.existingUserId !== null) {
        const userId = args.existingUserId as Id<'users'>
        await ctx.db.patch(userId, {
          ...userData,
          updatedAt: Date.now(),
        })
        return userId
      }

      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        ...userData,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      })
      return userId
    },
  },
})
```

- [ ] **Step 6: Add Convex Auth config**

Create `convex/auth.config.ts`:

```ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
}
```

- [ ] **Step 7: Update schema with auth and user ownership fields**

Modify the top of `convex/schema.ts`:

```ts
import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
```

Add a `users` table before `export default defineSchema`:

```ts
const users = defineTable({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
  handle: v.optional(v.string()),
  displayName: v.optional(v.string()),
  role: v.optional(v.union(v.literal('admin'), v.literal('user'))),
  personalPublisherId: v.optional(v.id('publishers')),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index('by_handle', ['handle'])
  .index('email', ['email'])
  .index('phone', ['phone'])
```

Extend the existing `publishers` table fields:

```ts
    kind: v.optional(
      v.union(v.literal('user'), v.literal('org'), v.literal('system')),
    ),
    linkedUserId: v.optional(v.id('users')),
```

Extend publisher indexes:

```ts
  })
    .index('by_handle', ['handle'])
    .index('by_linked_user', ['linkedUserId']),
```

Update `export default defineSchema({` to include auth tables and users first:

```ts
export default defineSchema({
  ...authTables,
  users,

  publishers: defineTable({
```

- [ ] **Step 8: Update environment example**

Modify `.env.example`:

```dotenv
VITE_CONVEX_URL=https://example.convex.cloud

# Convex Auth values live in Convex env, not VITE_* browser env.
# AUTH_GITHUB_ID=your-github-oauth-client-id
# AUTH_GITHUB_SECRET=your-github-oauth-client-secret
# JWKS=generated-by-convex-auth-setup
```

- [ ] **Step 9: Run the normalization test**

Run:

```bash
npm run test -- convex/auth.test.ts
```

Expected: PASS for all `normalizeGitHubProfileId` tests.

- [ ] **Step 10: Commit Task 1**

Run:

```bash
git add package.json package-lock.json .env.example convex/schema.ts convex/auth.ts convex/auth.config.ts convex/auth.test.ts
git commit -m "feat: configure convex github auth"
```

Expected: one commit containing dependency, schema, auth config, and normalization tests.

---

### Task 2: Users API, Auth Helpers, And Personal Publisher Bootstrap

**Files:**
- Create: `convex/lib/access.ts`
- Create: `convex/lib/handles.ts`
- Create: `convex/users.ts`
- Modify: `convex/auth.ts`
- Test: `convex/lib/handles.test.ts`
- Test: `convex/users.test.ts`
- Modify: `convex/schema.ts` only if Task 1 index placement needs correction

**Interfaces:**
- Consumes: `users` and `publishers.by_linked_user` from Task 1
- Produces: `normalizeHandleCandidate(value: string | null | undefined): string | null`
- Produces: `fallbackHandleForUserId(userId: string): string`
- Produces: `requireUser(ctx: QueryCtx | MutationCtx): Promise<{ userId: Id<'users'>; user: Doc<'users'> }>`
- Produces: `api.users.me`
- Produces: `api.users.ensure`
- Produces: `internal.users.ensurePersonalPublisherInternal`
- Produces: auth callback scheduling for `internal.users.ensurePersonalPublisherInternal`

- [ ] **Step 1: Write failing handle tests**

Create `convex/lib/handles.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  fallbackHandleForUserId,
  normalizeHandleCandidate,
} from './handles'

describe('normalizeHandleCandidate', () => {
  it('normalizes GitHub-style handles', () => {
    expect(normalizeHandleCandidate(' Terence.Dev_01 ')).toBe('terence-dev-01')
  })

  it('rejects empty, non-ascii, and too-short candidates', () => {
    expect(normalizeHandleCandidate('')).toBeNull()
    expect(normalizeHandleCandidate('用户')).toBeNull()
    expect(normalizeHandleCandidate('a')).toBeNull()
  })

  it('trims repeated separators and caps length', () => {
    expect(normalizeHandleCandidate('---Alpha___Beta---')).toBe('alpha-beta')
    expect(normalizeHandleCandidate('a'.repeat(80))).toHaveLength(39)
  })
})

describe('fallbackHandleForUserId', () => {
  it('creates a deterministic public fallback handle', () => {
    expect(fallbackHandleForUserId('users:abcdef1234567890')).toBe(
      'user-abcdef12',
    )
  })
})
```

- [ ] **Step 2: Run handle tests to verify failure**

Run:

```bash
npm run test -- convex/lib/handles.test.ts
```

Expected: FAIL because `convex/lib/handles.ts` does not exist.

- [ ] **Step 3: Implement handle helpers**

Create `convex/lib/handles.ts`:

```ts
const MAX_HANDLE_LENGTH = 39
const MIN_HANDLE_LENGTH = 2

export function normalizeHandleCandidate(value: string | null | undefined) {
  if (!value) return null

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_HANDLE_LENGTH)
    .replace(/-+$/g, '')

  if (normalized.length < MIN_HANDLE_LENGTH) return null
  return normalized
}

export function fallbackHandleForUserId(userId: string) {
  const suffix = userId.replace(/^[^:]+:/, '').replace(/[^a-zA-Z0-9]/g, '')
  return `user-${suffix.slice(0, 8).toLowerCase()}`
}
```

- [ ] **Step 4: Run handle tests**

Run:

```bash
npm run test -- convex/lib/handles.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing users bootstrap tests**

Create `convex/users.test.ts`:

```ts
import { convexTest } from 'convex-test'
import { describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

vi.mock('@convex-dev/auth/server', async () => {
  const actual = await vi.importActual<typeof import('@convex-dev/auth/server')>(
    '@convex-dev/auth/server',
  )
  return {
    ...actual,
    getAuthUserId: vi.fn(),
  }
})

const { getAuthUserId } = await import('@convex-dev/auth/server')
const modules = import.meta.glob('./**/*.*s')

describe('users auth queries and publisher bootstrap', () => {
  it('returns null from me when signed out', async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null)
    const t = convexTest(schema, modules)

    await expect(t.query(api.users.me, {})).resolves.toBeNull()
  })

  it('returns the current active user from me', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'Octocat',
        handle: 'octocat',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })
    vi.mocked(getAuthUserId).mockResolvedValue(userId)

    const me = await t.query(api.users.me, {})

    expect(me?._id).toBe(userId)
    expect(me?.handle).toBe('octocat')
  })

  it('ensures one personal publisher for the authenticated user', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'Octocat',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })
    vi.mocked(getAuthUserId).mockResolvedValue(userId)

    const first = await t.mutation(api.users.ensure, {})
    const second = await t.mutation(api.users.ensure, {})

    expect(first.publisherId).toBe(second.publisherId)
    const publishers = await t.run(async (ctx) => {
      return await ctx.db.query('publishers').collect()
    })
    expect(publishers).toHaveLength(1)
    expect(publishers[0]?.kind).toBe('user')
    expect(publishers[0]?.linkedUserId).toBe(userId)
  })

  it('uses a fallback handle when the preferred handle is taken', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      await ctx.db.insert('publishers', {
        handle: 'octocat',
        displayName: 'Existing Octocat',
        createdAt: 1,
        updatedAt: 1,
      })
      return await ctx.db.insert('users', {
        name: 'Octocat',
        handle: 'octocat',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })

    await t.mutation(internal.users.ensurePersonalPublisherInternal, { userId })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    const publisher = await t.run(
      async (ctx) =>
        await ctx.db.get(user?.personalPublisherId as Id<'publishers'>),
    )
    expect(publisher?.handle).toMatch(/^octocat-[a-z0-9]{8}$/)
    expect(publisher?.linkedUserId).toBe(userId)
  })
})
```

- [ ] **Step 6: Run users tests to verify failure**

Run:

```bash
npm run test -- convex/users.test.ts
```

Expected: FAIL because `convex/users.ts` and `convex/lib/access.ts` do not exist.

- [ ] **Step 7: Implement auth access helpers**

Create `convex/lib/access.ts`:

```ts
import { getAuthUserId } from '@convex-dev/auth/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function getOptionalAuthUserId(ctx: QueryCtx | MutationCtx) {
  try {
    return await getAuthUserId(ctx)
  } catch {
    return null
  }
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<{ userId: Id<'users'>; user: Doc<'users'> }> {
  const userId = await getOptionalAuthUserId(ctx)
  if (!userId) throw new Error('Unauthorized')

  const user = await ctx.db.get(userId)
  if (!user) throw new Error('User not found')

  return { userId, user }
}
```

- [ ] **Step 8: Implement users API and personal publisher bootstrap**

Create `convex/users.ts`:

```ts
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { getOptionalAuthUserId, requireUser } from './lib/access'
import {
  fallbackHandleForUserId,
  normalizeHandleCandidate,
} from './lib/handles'

type UserDoc = Doc<'users'>

async function getPublisherByHandle(
  ctx: Pick<QueryCtx | MutationCtx, 'db'>,
  handle: string,
) {
  return await ctx.db
    .query('publishers')
    .withIndex('by_handle', (q) => q.eq('handle', handle))
    .unique()
}

async function getPublisherByLinkedUser(
  ctx: Pick<QueryCtx | MutationCtx, 'db'>,
  userId: Id<'users'>,
) {
  return await ctx.db
    .query('publishers')
    .withIndex('by_linked_user', (q) => q.eq('linkedUserId', userId))
    .unique()
}

function displayNameForUser(user: UserDoc) {
  return user.displayName?.trim() || user.name?.trim() || user.handle || 'User'
}

function imageUrlForUser(user: UserDoc) {
  return user.image?.trim() || undefined
}

async function choosePersonalPublisherHandle(
  ctx: Pick<MutationCtx, 'db'>,
  user: UserDoc,
) {
  const userIdText = user._id.toString()
  const base =
    normalizeHandleCandidate(user.handle) ??
    normalizeHandleCandidate(user.name) ??
    fallbackHandleForUserId(userIdText)
  const existingBase = await getPublisherByHandle(ctx, base)
  if (!existingBase || existingBase.linkedUserId === user._id) return base

  const fallback = fallbackHandleForUserId(userIdText)
  const existingFallback = await getPublisherByHandle(ctx, fallback)
  if (!existingFallback || existingFallback.linkedUserId === user._id) {
    return fallback
  }

  const suffix = userIdText
    .replace(/^[^:]+:/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase()
  return `${base.slice(0, Math.max(2, 30 - suffix.length))}-${suffix}`
}

async function ensurePersonalPublisher(ctx: MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId)
  if (!user) throw new Error('User not found')

  if (user.personalPublisherId) {
    const publisher = await ctx.db.get(user.personalPublisherId)
    if (publisher) {
      await ctx.db.patch(publisher._id, {
        displayName: displayNameForUser(user),
        imageUrl: imageUrlForUser(user),
        kind: publisher.kind ?? 'user',
        linkedUserId: publisher.linkedUserId ?? userId,
        updatedAt: Date.now(),
      })
      return publisher._id
    }
  }

  const linkedPublisher = await getPublisherByLinkedUser(ctx, userId)
  if (linkedPublisher) {
    await ctx.db.patch(userId, {
      personalPublisherId: linkedPublisher._id,
      updatedAt: Date.now(),
    })
    return linkedPublisher._id
  }

  const now = Date.now()
  const handle = await choosePersonalPublisherHandle(ctx, user)
  const publisherId = await ctx.db.insert('publishers', {
    kind: 'user',
    linkedUserId: userId,
    handle,
    displayName: displayNameForUser(user),
    imageUrl: imageUrlForUser(user),
    createdAt: now,
    updatedAt: now,
  })

  await ctx.db.patch(userId, {
    handle: user.handle ?? handle,
    displayName: user.displayName ?? displayNameForUser(user),
    personalPublisherId: publisherId,
    updatedAt: now,
  })

  return publisherId
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx)
    if (!userId) return null
    return await ctx.db.get(userId)
  },
})

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const publisherId = await ensurePersonalPublisher(ctx, userId)
    return { publisherId }
  },
})

export const ensurePersonalPublisherInternal = internalMutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const publisherId = await ensurePersonalPublisher(ctx, args.userId)
    return { publisherId }
  },
})

export const getByIdInternal = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})
```

- [ ] **Step 9: Patch auth callback scheduling**

Patch `convex/auth.ts` to schedule personal publisher bootstrap after create/update.

Add imports near the top:

```ts
import type { GenericMutationCtx } from 'convex/server'
import { internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
```

Add the scheduler helper before the `convexAuth` export:

```ts
async function schedulePostUserCreatedOrUpdated(
  ctx: GenericMutationCtx<DataModel>,
  userId: Id<'users'>,
) {
  await ctx.scheduler.runAfter(0, internal.users.ensurePersonalPublisherInternal, {
    userId,
  })
}
```

Call it in the existing-user branch:

```ts
        await ctx.db.patch(userId, {
          ...userData,
          updatedAt: Date.now(),
        })
        await schedulePostUserCreatedOrUpdated(ctx, userId)
        return userId
```

Call it in the new-user branch:

```ts
      const userId = await ctx.db.insert('users', {
        ...userData,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      })
      await schedulePostUserCreatedOrUpdated(ctx, userId)
      return userId
```

- [ ] **Step 10: Run targeted Convex tests**

Run:

```bash
npm run test -- convex/lib/handles.test.ts convex/users.test.ts convex/auth.test.ts
```

Expected: PASS. If TypeScript reports generated API missing `users`, run `npx convex codegen` once and rerun this command.

- [ ] **Step 11: Commit Task 2**

Run:

```bash
git add convex/auth.ts convex/lib/access.ts convex/lib/handles.ts convex/lib/handles.test.ts convex/users.ts convex/users.test.ts convex/_generated
git commit -m "feat: add user publisher bootstrap"
```

Expected: one commit containing user auth helpers and publisher bootstrap.

---

### Task 3: Frontend Auth Provider, Auth Status Hook, And Bootstrap

**Files:**
- Modify: `src/components/AppProviders.tsx`
- Modify: `src/components/AppProviders.test.tsx`
- Create: `src/components/UserBootstrap.tsx`
- Create: `src/lib/useAuthStatus.ts`
- Test: `src/lib/useAuthStatus.test.tsx`

**Interfaces:**
- Consumes: `api.users.me` and `api.users.ensure` from Task 2
- Produces: `useAuthStatus(): { me: Doc<'users'> | null | undefined; isAuthenticated: boolean; isLoading: boolean }`
- Produces: `UserBootstrap` React component

- [ ] **Step 1: Write failing `useAuthStatus` tests**

Create `src/lib/useAuthStatus.test.tsx`:

```tsx
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStatus } from './useAuthStatus'

const mocks = vi.hoisted(() => ({
  useConvexAuth: vi.fn(),
  useQuery: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: mocks.useConvexAuth,
  useQuery: mocks.useQuery,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: {
      me: 'users.me',
    },
  },
}))

function Probe() {
  return <pre>{JSON.stringify(useAuthStatus())}</pre>
}

describe('useAuthStatus', () => {
  afterEach(() => {
    cleanup()
    mocks.useConvexAuth.mockReset()
    mocks.useQuery.mockReset()
  })

  it('returns loading while Convex auth is loading', () => {
    mocks.useConvexAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    })
    mocks.useQuery.mockReturnValue(undefined)

    render(<Probe />)

    expect(screen.getByText('{"isAuthenticated":false,"isLoading":true}')).toBeTruthy()
    expect(mocks.useQuery).toHaveBeenCalledWith('users.me', 'skip')
  })

  it('returns signed out when auth is resolved without a session', () => {
    mocks.useConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    })

    render(<Probe />)

    expect(
      screen.getByText('{"isAuthenticated":false,"isLoading":false,"me":null}'),
    ).toBeTruthy()
    expect(mocks.useQuery).toHaveBeenCalledWith('users.me', 'skip')
  })

  it('returns loading while the current user query is unresolved', () => {
    mocks.useConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    })
    mocks.useQuery.mockReturnValue(undefined)

    render(<Probe />)

    expect(screen.getByText('{"isAuthenticated":true,"isLoading":true}')).toBeTruthy()
    expect(mocks.useQuery).toHaveBeenCalledWith('users.me', {})
  })

  it('returns the current user when authenticated', () => {
    const me = { _id: 'users:1', handle: 'octocat' }
    mocks.useConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    })
    mocks.useQuery.mockReturnValue(me)

    render(<Probe />)

    expect(
      screen.getByText(JSON.stringify({ isAuthenticated: true, isLoading: false, me })),
    ).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the failing hook tests**

Run:

```bash
npm run test -- src/lib/useAuthStatus.test.tsx
```

Expected: FAIL because `src/lib/useAuthStatus.ts` does not exist.

- [ ] **Step 3: Implement `useAuthStatus`**

Create `src/lib/useAuthStatus.ts`:

```ts
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'

export function useAuthStatus() {
  const auth = useConvexAuth()
  const shouldLoadUser = auth.isAuthenticated
  const userResult = useQuery(api.users.me, shouldLoadUser ? {} : 'skip') as
    | Doc<'users'>
    | null
    | undefined
  const isUserLoading = shouldLoadUser && userResult === undefined
  const me = shouldLoadUser ? userResult : auth.isLoading ? undefined : null

  return {
    me,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading || isUserLoading,
  }
}
```

- [ ] **Step 4: Run hook tests**

Run:

```bash
npm run test -- src/lib/useAuthStatus.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Write failing AppProviders test for ConvexAuthProvider and bootstrap**

Modify `src/components/AppProviders.test.tsx`:

```tsx
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppProviders from './AppProviders'

const { client } = vi.hoisted(() => ({ client: { name: 'convex-client' } }))

vi.mock('#/lib/convex', () => ({ convexReactClient: client }))
vi.mock('@convex-dev/auth/react', () => ({
  ConvexAuthProvider: ({
    children,
    client: providerClient,
  }: React.PropsWithChildren<{ client: unknown }>) => (
    <div data-testid="convex-auth-provider" data-client={providerClient === client}>
      {children}
    </div>
  ),
}))
vi.mock('./I18nProvider', () => ({
  I18nProvider: ({ children }: React.PropsWithChildren) => (
    <div data-testid="i18n-provider">{children}</div>
  ),
}))
vi.mock('./UserBootstrap', () => ({
  UserBootstrap: () => <div data-testid="user-bootstrap" />,
}))
vi.mock('#/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

describe('AppProviders', () => {
  afterEach(cleanup)

  it('nests content, bootstrap, and toaster inside i18n and Convex auth providers', () => {
    render(
      <AppProviders>
        <div data-testid="content" />
      </AppProviders>,
    )

    const convexProvider = screen.getByTestId('convex-auth-provider')
    const i18nProvider = screen.getByTestId('i18n-provider')
    expect(convexProvider.getAttribute('data-client')).toBe('true')
    expect(convexProvider.firstElementChild).toBe(i18nProvider)
    expect(i18nProvider.contains(screen.getByTestId('user-bootstrap'))).toBe(true)
    expect(i18nProvider.contains(screen.getByTestId('content'))).toBe(true)
    expect(i18nProvider.contains(screen.getByTestId('toaster'))).toBe(true)
    expect(screen.getAllByTestId('toaster')).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Implement frontend bootstrap**

Create `src/components/UserBootstrap.tsx`:

```tsx
import { useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../../convex/_generated/api'
import { useAuthStatus } from '#/lib/useAuthStatus'

export function UserBootstrap() {
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const ensureUser = useMutation(api.users.ensure)
  const didRun = useRef(false)

  useEffect(() => {
    if (isLoading || !isAuthenticated || !me || didRun.current) return
    didRun.current = true
    void ensureUser({}).catch(() => {
      // Best-effort repair. Broken bootstrap state should not crash public browsing.
    })
  }, [ensureUser, isAuthenticated, isLoading, me])

  return null
}
```

- [ ] **Step 7: Switch AppProviders to ConvexAuthProvider**

Modify `src/components/AppProviders.tsx`:

```tsx
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { Toaster } from '#/components/ui/sonner'
import { convexReactClient } from '#/lib/convex'
import { I18nProvider } from './I18nProvider'
import { UserBootstrap } from './UserBootstrap'

export default function AppProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexAuthProvider client={convexReactClient}>
      <I18nProvider>
        <UserBootstrap />
        {children}
        <Toaster />
      </I18nProvider>
    </ConvexAuthProvider>
  )
}
```

- [ ] **Step 8: Run frontend provider tests**

Run:

```bash
npm run test -- src/components/AppProviders.test.tsx src/lib/useAuthStatus.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

Run:

```bash
git add src/components/AppProviders.tsx src/components/AppProviders.test.tsx src/components/UserBootstrap.tsx src/lib/useAuthStatus.ts src/lib/useAuthStatus.test.tsx
git commit -m "feat: wire convex auth provider"
```

Expected: one commit containing frontend provider and bootstrap wiring.

---

### Task 4: Header Auth UI And I18n

**Files:**
- Create: `src/components/HeaderAuth.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Header.test.tsx`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `useAuthStatus` from Task 3
- Consumes: `useAuthActions` from `@convex-dev/auth/react`
- Produces: `HeaderAuth` React component

- [ ] **Step 1: Extend i18n copy**

Modify `src/lib/i18n.ts` in both dictionaries.

In `zhDictionary`, add:

```ts
  'auth.signInWithGitHub': '使用 GitHub 登录',
  'auth.signOut': '退出登录',
  'auth.accountMenu': '账户菜单',
  'auth.loading': '正在加载登录状态',
  'auth.signedInAs': '已登录为 {handle}',
  'auth.signInFailed': '登录失败，请稍后重试。',
  'auth.signOutFailed': '退出登录失败，请稍后重试。',
```

In `enDictionary`, add:

```ts
  'auth.signInWithGitHub': 'Sign in with GitHub',
  'auth.signOut': 'Sign out',
  'auth.accountMenu': 'Account menu',
  'auth.loading': 'Loading auth state',
  'auth.signedInAs': 'Signed in as {handle}',
  'auth.signInFailed': 'Sign in failed. Please try again.',
  'auth.signOutFailed': 'Sign out failed. Please try again.',
```

- [ ] **Step 2: Write failing Header auth tests**

Modify `src/components/Header.test.tsx` with mocks:

```tsx
const authMocks = vi.hoisted(() => ({
  useAuthStatus: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('#/lib/useAuthStatus', () => ({
  useAuthStatus: authMocks.useAuthStatus,
}))

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({
    signIn: authMocks.signIn,
    signOut: authMocks.signOut,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: authMocks.toastError,
  },
}))
```

Set the default auth state in `beforeEach`:

```tsx
    authMocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      me: null,
    })
    authMocks.signIn.mockReset()
    authMocks.signOut.mockReset()
    authMocks.toastError.mockReset()
```

Add tests:

```tsx
  it('starts GitHub sign-in with the current relative URL', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    window.history.pushState(null, '', '/remotion?tag=card#top')
    authMocks.signIn.mockResolvedValue({ signingIn: true })
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))

    await waitFor(() => {
      expect(authMocks.signIn).toHaveBeenCalledWith('github', {
        redirectTo: '/remotion?tag=card#top',
      })
    })
  })

  it('shows a stable auth loading skeleton', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      me: undefined,
    })

    renderHeader()

    expect(screen.getByLabelText('Loading auth state')).toBeTruthy()
  })

  it('shows the signed-in user and signs out', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    authMocks.useAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: {
        _id: 'users:1',
        handle: 'octocat',
        name: 'Octocat',
        image: 'https://example.com/avatar.png',
      },
    })
    authMocks.signOut.mockResolvedValue(undefined)

    renderHeader()

    expect(screen.getByRole('button', { name: 'Signed in as octocat' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(authMocks.signOut).toHaveBeenCalled()
    })
  })
```

- [ ] **Step 3: Run Header tests to verify failure**

Run:

```bash
npm run test -- src/components/Header.test.tsx
```

Expected: FAIL because `HeaderAuth` has not been implemented and Header does not render auth UI.

- [ ] **Step 4: Implement `HeaderAuth`**

Create `src/components/HeaderAuth.tsx`:

```tsx
import { useAuthActions } from '@convex-dev/auth/react'
import { GithubIcon, LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStatus } from '#/lib/useAuthStatus'
import { useI18n } from './I18nProvider'

function getCurrentRelativeUrl() {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function getDisplayHandle(me: { handle?: string; name?: string } | null | undefined) {
  return me?.handle?.trim() || me?.name?.trim() || 'user'
}

export default function HeaderAuth() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const { signIn, signOut } = useAuthActions()

  if (isLoading) {
    return (
      <span
        aria-label={t('auth.loading')}
        className="h-9 w-28 rounded-md bg-[var(--surface-muted)]"
      />
    )
  }

  if (!isAuthenticated || !me) {
    return (
      <button
        type="button"
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-medium text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
        onClick={() => {
          void signIn('github', { redirectTo: getCurrentRelativeUrl() }).catch(() => {
            toast.error(t('auth.signInFailed'))
          })
        }}
      >
        <GithubIcon aria-hidden="true" size={17} />
        <span className="hidden sm:inline">{t('auth.signInWithGitHub')}</span>
      </button>
    )
  }

  const handle = getDisplayHandle(me)

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={t('auth.signedInAs', { handle })}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-2 text-sm text-[var(--sea-ink)]"
      >
        {me.image ? (
          <img
            src={me.image}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-mark-bg)] text-[10px] font-bold text-[var(--brand-mark-fg)]">
            {handle.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-28 truncate sm:inline">{handle}</span>
      </button>
      <button
        type="button"
        className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
        onClick={() => {
          void signOut().catch(() => {
            toast.error(t('auth.signOutFailed'))
          })
        }}
      >
        <span className="sr-only">{t('auth.signOut')}</span>
        <LogOutIcon aria-hidden="true" size={18} />
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Insert Header auth control**

Modify `src/components/Header.tsx`:

```tsx
import { Link } from '@tanstack/react-router'
import { GithubIcon } from 'lucide-react'
import HeaderAuth from './HeaderAuth'
import { useI18n } from './I18nProvider'
import LanguageToggle from './LanguageToggle'
import ThemeToggle from './ThemeToggle'
```

Add `<HeaderAuth />` before `LanguageToggle`:

```tsx
          <HeaderAuth />
          <LanguageToggle />
          <ThemeToggle />
```

- [ ] **Step 6: Run Header tests**

Run:

```bash
npm run test -- src/components/Header.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add src/components/HeaderAuth.tsx src/components/Header.tsx src/components/Header.test.tsx src/lib/i18n.ts
git commit -m "feat: add header github sign in"
```

Expected: one commit containing Header auth UI and localized copy.

---

### Task 5: Codegen, Verification, And Manual Auth Setup Notes

**Files:**
- Modify: `convex/_generated/api.d.ts`
- Modify: `convex/_generated/api.js`
- Modify: `convex/_generated/dataModel.d.ts`
- Modify: `convex/_generated/server.d.ts` only if Convex codegen changes it
- Modify: `specs/2026-07-05-github-auth-bootstrap-design.md` only if implementation discovers a durable auth invariant not already documented

**Interfaces:**
- Consumes: all previous tasks
- Produces: generated Convex types that include `api.users`, `internal.users`, and auth tables

- [ ] **Step 1: Regenerate Convex types**

Run:

```bash
npx convex codegen
```

Expected: Convex generated files update successfully and include `users`.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test -- convex/auth.test.ts convex/lib/handles.test.ts convex/users.test.ts src/lib/useAuthStatus.test.tsx src/components/AppProviders.test.tsx src/components/Header.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full unit tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 4: Run typecheck and build**

Run:

```bash
npm run ci:types-build
```

Expected: PASS.

- [ ] **Step 5: Run final local gate when prerequisites are available**

Run:

```bash
make check
```

Expected: PASS. If local Convex or environment prerequisites are unavailable, record the exact failure and confirm `npm run test` plus `npm run ci:types-build` passed.

- [ ] **Step 6: Inspect the final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- . ':!package-lock.json'
```

Expected: changes are limited to GitHub auth bootstrap, generated Convex types, tests, dependency files, and `.env.example`.

- [ ] **Step 7: Commit generated files and any final fixes**

Run:

```bash
git add convex/_generated package.json package-lock.json .env.example convex src specs
git commit -m "chore: verify github auth bootstrap"
```

Expected: a final commit exists only if Task 5 produced codegen updates or verification fixes not already committed. If there are no changes, skip this commit.

- [ ] **Step 8: Document manual OAuth setup for handoff**

Include this in the final implementation report:

```text
Manual setup required:
- Create a GitHub OAuth app for the local and production callback URLs used by Convex Auth.
- Set AUTH_GITHUB_ID and AUTH_GITHUB_SECRET in Convex env.
- Set the Convex Auth JWKS value required by the installed @convex-dev/auth version.
- Keep VITE_CONVEX_URL as the only browser-exposed auth-adjacent env var.
```

Expected: the handoff makes clear that secrets are not committed and OAuth cannot be manually completed until provider credentials are configured.

---

## Plan Self-Review

- Spec coverage: GitHub-only auth, provider-agnostic identity, no email linking, personal publisher bootstrap, Header UI, env examples, route/API boundary, tests, worktree execution, and final verification are covered.
- Scope check: Google, WeChat, Weibo, password login, settings, publishing, orgs, and tokens remain excluded.
- Red-flag scan: the plan contains no unfinished markers or vague future work. The only conditional path is the explicit Convex codegen fallback when generated API types are missing.
- Type consistency: `normalizeGitHubProfileId`, `normalizeHandleCandidate`, `fallbackHandleForUserId`, `requireUser`, `api.users.me`, `api.users.ensure`, `internal.users.ensurePersonalPublisherInternal`, `useAuthStatus`, `UserBootstrap`, and `HeaderAuth` are defined before later tasks consume them.
