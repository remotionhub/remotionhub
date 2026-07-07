# WeChat Web Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 RemotionHub 增加网页端微信扫码登录，并按少数派交互形态提供 Header 登录入口、登录弹窗、微信跳转和登录态展示。

**Architecture:** 使用 `@convex-dev/auth` 作为会话层，使用 Auth.js WeChat provider 并设置 `platformType: "WebsiteApp"` 触发 `open.weixin.qq.com/connect/qrconnect`。Convex 侧新增 provider-agnostic 用户模型、WeChat profile 归一化、个人 publisher 自举；前端将 `ConvexProvider` 替换为 `ConvexAuthProvider`，并在 Header 增加少数派式登录弹窗。

**Tech Stack:** React 19, TanStack Start, TanStack Router, Convex, `@convex-dev/auth`, Auth.js WeChat provider, Vitest, convex-test, TypeScript strict, npm.

## Global Constraints

- 第一版只启用网页端微信登录，不启用小程序、公众号网页登录、手机号、邮箱、密码、GitHub、Google、Weibo。
- 微信登录必须使用 WeChat Open Platform 网站应用能力和 `snsapi_login` scope。
- UI 交互模仿少数派：Header 图标入口、居中登录弹窗、`其他方式` 区域、微信图标按钮、全页跳转微信扫码页。
- 安全上必须使用并验证 OAuth `state`，即使少数派观察到的首跳 URL 没带 `state`。
- 身份模型必须 provider-agnostic，不能把微信字段散落到业务授权逻辑里。
- Provider account binding 优先使用 `unionid`；如果没有 `unionid`，只能使用带 app namespace 的 `openid` fallback。
- OAuth nickname、avatar、openid、unionid 只能作为身份绑定或 profile 数据，不能作为授权证明。
- 所有后端授权必须从 `getAuthUserId(ctx)` 或等价 helper 派生，不能接受客户端传入的 user id 作为授权证明。
- 回跳目标必须是相对 URL，禁止接受绝对 URL 作为 `redirectTo`。
- `AUTH_WECHAT_SECRET` 和 token 交换结果只能存在服务端环境，不能出现在 `VITE_*` 前端变量里。
- 代码、注释、标识符、提交信息和 Markdown 代码块内内容全部使用 English。
- Superpowers 生成的计划文档放在 `specs/`。

---

## File Structure

- Modify: `package.json` and `package-lock.json`
  - Add `@convex-dev/auth` and `@auth/core`.
- Modify: `.env.example`
  - Document browser env and server-only Convex auth env names.
- Create: `convex/auth.ts`
  - Configure Convex Auth and WeChat WebsiteApp provider.
  - Export `auth`, `signIn`, `signOut`, `store`, `isAuthenticated`.
  - Export WeChat profile normalization helpers for tests.
- Create: `convex/auth.config.ts`
  - Configure Convex Auth JWT provider metadata.
- Modify: `convex/schema.ts`
  - Add `authTables`, `users`, and publisher ownership fields/indexes.
- Create: `convex/lib/access.ts`
  - Centralize optional and required current-user lookup.
- Create: `convex/lib/handles.ts`
  - Normalize public handles and generate deterministic fallback handles.
- Create: `convex/users.ts`
  - Add `me`, `ensure`, and internal personal publisher bootstrap.
- Test: `convex/auth.test.ts`
  - Cover WeChat provider account id normalization.
- Test: `convex/lib/handles.test.ts`
  - Cover handle normalization and fallback behavior.
- Test: `convex/users.test.ts`
  - Cover signed-out `me`, signed-in `me`, idempotent bootstrap, and conflict fallback.
- Modify: `src/lib/convex.ts`
  - Keep one shared `ConvexReactClient`.
- Create: `src/lib/authRedirect.ts`
  - Build and validate relative redirect targets.
- Create: `src/lib/useAuthStatus.ts`
  - Wrap Convex auth and `api.users.me`.
- Create: `src/components/UserBootstrap.tsx`
  - Best-effort repair after sign-in.
- Modify: `src/components/AppProviders.tsx`
  - Replace `ConvexProvider` with `ConvexAuthProvider`; include `UserBootstrap`.
- Test: `src/components/AppProviders.test.tsx`
  - Verify provider nesting and bootstrap placement.
- Test: `src/lib/authRedirect.test.ts`
  - Verify relative URL generation and absolute URL rejection.
- Test: `src/lib/useAuthStatus.test.tsx`
  - Verify signed-out, loading, and signed-in state mapping.
- Create: `src/components/HeaderAuth.tsx`
  - Render Header account icon, login modal, WeChat action, signed-in user, and sign-out action.
- Modify: `src/components/Header.tsx`
  - Insert `HeaderAuth` near existing global controls.
- Modify: `src/lib/i18n.ts`
  - Add auth UI copy in `zh` and `en`.
- Test: `src/components/Header.test.tsx`
  - Cover login dialog, WeChat sign-in, loading, signed-in, and sign-out states.
- Modify generated: `convex/_generated/api.*`, `convex/_generated/dataModel.d.ts`
  - Regenerate after schema/function changes.

---

### Task 1: Convex Auth Dependency, Schema, And WeChat Provider

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `convex/schema.ts`
- Create: `convex/auth.ts`
- Create: `convex/auth.config.ts`
- Test: `convex/auth.test.ts`

**Interfaces:**
- Produces: `normalizeWeChatProviderAccountId(profile: WeChatProfileLike, options?: { allowOpenIdFallback?: boolean; appId?: string }): string`
- Produces: `createWeChatAuthProvider(): ReturnType<typeof WeChat>`
- Produces: Convex Auth exports from `convex/auth.ts`: `auth`, `signIn`, `signOut`, `store`, `isAuthenticated`
- Produces: schema tables `users`, `authAccounts`, `authSessions`, `authRefreshTokens`, `authVerificationCodes`, and updated `publishers`

- [ ] **Step 1: Install Convex Auth dependencies**

Run:

```bash
npm install @convex-dev/auth @auth/core
```

Expected: `package.json` and `package-lock.json` include `@convex-dev/auth` and `@auth/core`.

- [ ] **Step 2: Write failing WeChat profile tests**

Create `convex/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeWeChatProviderAccountId } from './auth'

describe('normalizeWeChatProviderAccountId', () => {
  it('prefers unionid when present', () => {
    expect(
      normalizeWeChatProviderAccountId({
        openid: 'openid-123',
        unionid: 'unionid-456',
      }),
    ).toBe('unionid-456')
  })

  it('uses a namespaced openid fallback when explicitly allowed', () => {
    expect(
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123' },
        { allowOpenIdFallback: true, appId: 'wxabc123' },
      ),
    ).toBe('wechat:web:wxabc123:openid-123')
  })

  it('rejects missing stable identifiers', () => {
    expect(() => normalizeWeChatProviderAccountId({})).toThrow(
      /missing a stable WeChat account id/,
    )
  })

  it('rejects openid fallback without an app id namespace', () => {
    expect(() =>
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123' },
        { allowOpenIdFallback: true },
      ),
    ).toThrow(/requires a WeChat app id/)
  })
})
```

- [ ] **Step 3: Run failing WeChat profile tests**

Run:

```bash
npm run test -- convex/auth.test.ts
```

Expected: FAIL because `convex/auth.ts` does not exist or does not export `normalizeWeChatProviderAccountId`.

- [ ] **Step 4: Add Convex Auth provider code**

Create `convex/auth.ts`:

```ts
import WeChat from '@auth/core/providers/wechat'
import { convexAuth } from '@convex-dev/auth/server'
import type { Id } from './_generated/dataModel'

type AuthProfile = Record<string, unknown> & {
  email?: string | null
  phone?: string | null
  emailVerified?: boolean
  phoneVerified?: boolean
}

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
  const unionid = normalizedString(profile.unionid)
  if (unionid) return unionid

  const openid = normalizedString(profile.openid)
  if (openid && options.allowOpenIdFallback) {
    const appId = normalizedString(options.appId)
    if (!appId) {
      throw new Error('WeChat openid fallback requires a WeChat app id')
    }
    return `wechat:web:${appId}:${openid}`
  }

  throw new Error('WeChat OAuth profile is missing a stable WeChat account id')
}

function profileName(profile: WeChatProfileLike) {
  return normalizedString(profile.nickname) ?? 'WeChat User'
}

function profileImage(profile: WeChatProfileLike) {
  return normalizedString(profile.headimgurl) ?? undefined
}

export function createWeChatAuthProvider() {
  const appId = process.env.AUTH_WECHAT_ID ?? ''
  return WeChat({
    clientId: appId,
    clientSecret: process.env.AUTH_WECHAT_SECRET ?? '',
    platformType: 'WebsiteApp',
    profile(profile) {
      return {
        id: normalizeWeChatProviderAccountId(profile, {
          allowOpenIdFallback: true,
          appId,
        }),
        name: profileName(profile),
        email: null,
        image: profileImage(profile),
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
  providers: [createWeChatAuthProvider()],
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

- [ ] **Step 5: Add Convex Auth config**

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

- [ ] **Step 6: Update schema with auth and user ownership fields**

Modify `convex/schema.ts` imports:

```ts
import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
```

Add before `export default defineSchema`:

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
  .index('by_email', ['email'])
```

Extend `publishers` fields:

```ts
    kind: v.optional(
      v.union(v.literal('user'), v.literal('org'), v.literal('system')),
    ),
    linkedUserId: v.optional(v.id('users')),
```

Extend `publishers` indexes:

```ts
  }).index('by_handle', ['handle']).index('by_linked_user', ['linkedUserId']),
```

Change schema start:

```ts
export default defineSchema({
  ...authTables,
  users,

  publishers: defineTable({
```

- [ ] **Step 7: Update environment example**

Modify `.env.example`:

```dotenv
VITE_CONVEX_URL=https://example.convex.cloud

# Convex Auth values live in Convex env, not VITE_* browser env.
# SITE_URL=https://remotionhub.ai
# AUTH_WECHAT_ID=your-wechat-open-platform-website-app-id
# AUTH_WECHAT_SECRET=your-wechat-open-platform-website-app-secret
# Register the WeChat callback as ${CONVEX_SITE_URL}/api/auth/callback/wechat
# (or ${CUSTOM_AUTH_SITE_URL}/api/auth/callback/wechat when overriding the auth site).
# SITE_URL controls the final post-auth app redirect origin; set it to the canonical frontend origin in production.
# AUTH_WECHAT_CALLBACK_URL is derived by Convex Auth; do not mirror it into browser env files.
# JWT_PRIVATE_KEY=generated-by-convex-auth-setup
# JWKS=generated-by-convex-auth-setup
```

- [ ] **Step 8: Run WeChat profile tests**

Run:

```bash
npm run test -- convex/auth.test.ts
```

Expected: PASS for all `normalizeWeChatProviderAccountId` tests.

- [ ] **Step 9: Commit Task 1**

Run:

```bash
git add package.json package-lock.json .env.example convex/schema.ts convex/auth.ts convex/auth.config.ts convex/auth.test.ts
git commit -m "feat: configure convex wechat auth"
```

Expected: one commit containing dependency, schema, auth config, env docs, and WeChat profile tests.

---

### Task 2: Users API, Auth Helpers, And Personal Publisher Bootstrap

**Files:**
- Create: `convex/lib/access.ts`
- Create: `convex/lib/handles.ts`
- Create: `convex/users.ts`
- Modify: `convex/auth.ts`
- Test: `convex/lib/handles.test.ts`
- Test: `convex/users.test.ts`

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
  it('normalizes ascii profile names', () => {
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
        name: 'WeChat User',
        handle: 'wechat-user',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })
    vi.mocked(getAuthUserId).mockResolvedValue(userId)

    const me = await t.query(api.users.me, {})

    expect(me?._id).toBe(userId)
    expect(me?.handle).toBe('wechat-user')
  })

  it('ensures one personal publisher for the authenticated user', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'WeChat User',
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
        handle: 'wechat-user',
        displayName: 'Existing Publisher',
        createdAt: 1,
        updatedAt: 1,
      })
      return await ctx.db.insert('users', {
        name: 'WeChat User',
        handle: 'wechat-user',
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
    expect(publisher?.handle).toMatch(/^wechat-user-[a-z0-9]{8}$/)
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

function shortUserSuffix(userId: Id<'users'>) {
  return fallbackHandleForUserId(userId.toString()).replace(/^user-/, '')
}

async function choosePersonalPublisherHandle(
  ctx: Pick<MutationCtx, 'db'>,
  user: UserDoc,
) {
  const base =
    normalizeHandleCandidate(user.handle) ??
    normalizeHandleCandidate(user.name) ??
    fallbackHandleForUserId(user._id.toString())

  const existing = await getPublisherByHandle(ctx, base)
  if (!existing) return base
  if (existing.linkedUserId === user._id) return base

  const fallbackBase = `${base}-${shortUserSuffix(user._id)}`
  const fallback = fallbackBase.slice(0, 39).replace(/-+$/g, '')
  const fallbackExisting = await getPublisherByHandle(ctx, fallback)
  if (!fallbackExisting || fallbackExisting.linkedUserId === user._id) {
    return fallback
  }

  return fallbackHandleForUserId(user._id.toString())
}

async function ensurePersonalPublisher(ctx: MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId)
  if (!user) throw new Error('User not found')

  if (user.personalPublisherId) {
    const existing = await ctx.db.get(user.personalPublisherId)
    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: displayNameForUser(user),
        imageUrl: imageUrlForUser(user),
        updatedAt: Date.now(),
      })
      return existing._id
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
    handle,
    displayName: displayNameForUser(user),
    imageUrl: imageUrlForUser(user),
    kind: 'user',
    linkedUserId: userId,
    createdAt: now,
    updatedAt: now,
  })

  await ctx.db.patch(userId, {
    handle,
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
```

- [ ] **Step 9: Schedule publisher bootstrap from auth callback**

Modify `convex/auth.ts` imports:

```ts
import { internal } from './_generated/api'
```

Add helper before `export const { auth, signIn, signOut, store, isAuthenticated }`:

```ts
async function schedulePostUserCreatedOrUpdated(
  ctx: {
    scheduler: {
      runAfter: (
        delayMs: number,
        functionReference: typeof internal.users.ensurePersonalPublisherInternal,
        args: { userId: Id<'users'> },
      ) => Promise<unknown>
    }
  },
  userId: Id<'users'>,
) {
  await ctx.scheduler.runAfter(0, internal.users.ensurePersonalPublisherInternal, {
    userId,
  })
}
```

Call it in both callback branches:

```ts
        await schedulePostUserCreatedOrUpdated(ctx, userId)
        return userId
```

- [ ] **Step 10: Run targeted Convex tests**

Run:

```bash
npm run test -- convex/auth.test.ts convex/lib/handles.test.ts convex/users.test.ts
```

Expected: PASS. If TypeScript reports generated API missing `users`, run `npx convex codegen` once and rerun this command.

- [ ] **Step 11: Commit Task 2**

Run:

```bash
git add convex/auth.ts convex/lib/access.ts convex/lib/handles.ts convex/lib/handles.test.ts convex/users.ts convex/users.test.ts convex/_generated
git commit -m "feat: add wechat user bootstrap"
```

Expected: one commit containing user auth helpers and publisher bootstrap.

---

### Task 3: Frontend Auth Provider, Redirect Helper, Auth Status Hook, And Bootstrap

**Files:**
- Modify: `src/components/AppProviders.tsx`
- Modify: `src/components/AppProviders.test.tsx`
- Create: `src/components/UserBootstrap.tsx`
- Create: `src/lib/authRedirect.ts`
- Create: `src/lib/authRedirect.test.ts`
- Create: `src/lib/useAuthStatus.ts`
- Test: `src/lib/useAuthStatus.test.tsx`

**Interfaces:**
- Consumes: `api.users.me` and `api.users.ensure` from Task 2
- Produces: `getCurrentRelativeUrl(): string`
- Produces: `sanitizeRelativeRedirect(value: string | null | undefined): string`
- Produces: `useAuthStatus(): { me: Doc<'users'> | null | undefined; isAuthenticated: boolean; isLoading: boolean }`
- Produces: `UserBootstrap` React component

- [ ] **Step 1: Write failing redirect helper tests**

Create `src/lib/authRedirect.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sanitizeRelativeRedirect } from './authRedirect'

describe('sanitizeRelativeRedirect', () => {
  it('keeps relative redirects', () => {
    expect(sanitizeRelativeRedirect('/remotion?tag=card#top')).toBe(
      '/remotion?tag=card#top',
    )
  })

  it('falls back to root for absolute urls', () => {
    expect(sanitizeRelativeRedirect('https://example.com/evil')).toBe('/')
    expect(sanitizeRelativeRedirect('//example.com/evil')).toBe('/')
  })

  it('falls back to root for empty values', () => {
    expect(sanitizeRelativeRedirect(undefined)).toBe('/')
    expect(sanitizeRelativeRedirect('')).toBe('/')
  })
})
```

- [ ] **Step 2: Run redirect helper tests to verify failure**

Run:

```bash
npm run test -- src/lib/authRedirect.test.ts
```

Expected: FAIL because `src/lib/authRedirect.ts` does not exist.

- [ ] **Step 3: Implement redirect helper**

Create `src/lib/authRedirect.ts`:

```ts
export function sanitizeRelativeRedirect(value: string | null | undefined) {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export function getCurrentRelativeUrl() {
  if (typeof window === 'undefined') return '/'
  return sanitizeRelativeRedirect(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
}
```

- [ ] **Step 4: Run redirect helper tests**

Run:

```bash
npm run test -- src/lib/authRedirect.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing `useAuthStatus` tests**

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
    const me = { _id: 'users:1', handle: 'wechat-user' }
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

- [ ] **Step 6: Run failing hook tests**

Run:

```bash
npm run test -- src/lib/useAuthStatus.test.tsx
```

Expected: FAIL because `src/lib/useAuthStatus.ts` does not exist.

- [ ] **Step 7: Implement `useAuthStatus`**

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

- [ ] **Step 8: Write failing AppProviders test**

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
  })
})
```

- [ ] **Step 9: Implement frontend bootstrap**

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
      didRun.current = false
    })
  }, [ensureUser, isAuthenticated, isLoading, me])

  return null
}
```

- [ ] **Step 10: Switch AppProviders to ConvexAuthProvider**

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

- [ ] **Step 11: Run frontend provider tests**

Run:

```bash
npm run test -- src/lib/authRedirect.test.ts src/lib/useAuthStatus.test.tsx src/components/AppProviders.test.tsx
```

Expected: PASS.

- [ ] **Step 12: Commit Task 3**

Run:

```bash
git add src/lib/authRedirect.ts src/lib/authRedirect.test.ts src/lib/useAuthStatus.ts src/lib/useAuthStatus.test.tsx src/components/AppProviders.tsx src/components/AppProviders.test.tsx src/components/UserBootstrap.tsx
git commit -m "feat: wire wechat auth provider"
```

Expected: one commit containing frontend provider, redirect helper, auth status hook, and bootstrap wiring.

---

### Task 4: Header Login Dialog And WeChat Sign-In UI

**Files:**
- Create: `src/components/HeaderAuth.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Header.test.tsx`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `useAuthStatus` from Task 3
- Consumes: `getCurrentRelativeUrl` from Task 3
- Consumes: `useAuthActions` from `@convex-dev/auth/react`
- Produces: `HeaderAuth` React component

- [ ] **Step 1: Extend i18n copy**

Modify `src/lib/i18n.ts` in both dictionaries.

Add these keys to `zhDictionary` with Chinese display values:

```text
auth.login
auth.loginToRemotionHub
auth.otherMethods
auth.signInWithWeChat
auth.signOut
auth.accountMenu
auth.loading
auth.signedInAs
auth.signInFailed
auth.signOutFailed
auth.agreementPrefix
auth.userAgreement
auth.privacyPolicy
```

Add these keys to `enDictionary` with English display values:

```ts
  'auth.login': 'Log in',
  'auth.loginToRemotionHub': 'Log in to RemotionHub',
  'auth.otherMethods': 'Other methods',
  'auth.signInWithWeChat': 'Log in with WeChat',
  'auth.signOut': 'Sign out',
  'auth.accountMenu': 'Account menu',
  'auth.loading': 'Loading auth state',
  'auth.signedInAs': 'Signed in as {handle}',
  'auth.signInFailed': 'Login failed. Please try again.',
  'auth.signOutFailed': 'Sign out failed. Please try again.',
  'auth.agreementPrefix': 'By registering or logging in, you agree to',
  'auth.userAgreement': 'User Agreement',
  'auth.privacyPolicy': 'Privacy Policy',
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
  it('opens a login dialog from the header account button', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.getByRole('dialog', { name: 'Log in to RemotionHub' })).toBeTruthy()
    expect(screen.getByText('Other methods')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log in with WeChat' })).toBeTruthy()
  })

  it('starts WeChat sign-in with the current relative URL', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    window.history.pushState(null, '', '/remotion?tag=card#top')
    authMocks.signIn.mockResolvedValue({ signingIn: true })
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in with WeChat' }))

    await waitFor(() => {
      expect(authMocks.signIn).toHaveBeenCalledWith('wechat', {
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
        handle: 'wechat-user',
        name: 'WeChat User',
        image: 'https://example.com/avatar.png',
      },
    })
    authMocks.signOut.mockResolvedValue(undefined)

    renderHeader()

    expect(screen.getByRole('button', { name: 'Signed in as wechat-user' })).toBeTruthy()
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
import { LogInIcon, LogOutIcon, MessageCircleIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getCurrentRelativeUrl } from '#/lib/authRedirect'
import { useAuthStatus } from '#/lib/useAuthStatus'
import { useI18n } from './I18nProvider'

function getDisplayHandle(me: { handle?: string; name?: string } | null | undefined) {
  return me?.handle?.trim() || me?.name?.trim() || 'user'
}

export default function HeaderAuth() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const { signIn, signOut } = useAuthActions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <span
        aria-label={t('auth.loading')}
        className="h-9 w-9 rounded-md bg-[var(--surface-muted)]"
      />
    )
  }

  if (!isAuthenticated || !me) {
    return (
      <>
        <button
          type="button"
          aria-label={t('auth.login')}
          className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
          onClick={() => setIsDialogOpen(true)}
        >
          <LogInIcon aria-hidden="true" size={20} />
        </button>

        {isDialogOpen ? (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/40 px-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsDialogOpen(false)
            }}
          >
            <section
              aria-modal="true"
              aria-label={t('auth.loginToRemotionHub')}
              role="dialog"
              className="w-full max-w-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--sea-ink)] shadow-xl"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="m-0 text-lg font-semibold">
                  {t('auth.loginToRemotionHub')}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                  onClick={() => setIsDialogOpen(false)}
                >
                  <XIcon aria-hidden="true" size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="m-0 text-center text-sm text-[var(--sea-ink-soft)]">
                  {t('auth.otherMethods')}
                </p>
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] text-sm font-medium text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
                  onClick={() => {
                    void signIn('wechat', {
                      redirectTo: getCurrentRelativeUrl(),
                    }).catch(() => {
                      toast.error(t('auth.signInFailed'))
                    })
                  }}
                >
                  <MessageCircleIcon aria-hidden="true" size={18} />
                  {t('auth.signInWithWeChat')}
                </button>
              </div>

              <p className="mt-5 mb-0 text-xs leading-5 text-[var(--sea-ink-soft)]">
                {t('auth.agreementPrefix')}{' '}
                <a className="text-[var(--sea-ink)]" href="/page/agreement">
                  {t('auth.userAgreement')}
                </a>{' '}
                <a className="text-[var(--sea-ink)]" href="/page/privacy">
                  {t('auth.privacyPolicy')}
                </a>
              </p>
            </section>
          </div>
        ) : null}
      </>
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

Modify `src/components/Header.tsx` imports:

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
git commit -m "feat: add wechat login dialog"
```

Expected: one commit containing the Header auth UI and localized copy.

---

### Task 5: Codegen, Verification, And Manual WeChat Setup Notes

**Files:**
- Modify: `convex/_generated/api.d.ts`
- Modify: `convex/_generated/api.js`
- Modify: `convex/_generated/dataModel.d.ts`
- Modify: `convex/_generated/server.d.ts` only if Convex codegen changes it
- Modify: `.env.example` only if implementation discovers the installed auth package requires different env names
- Modify: `specs/2026-07-07-wechat-web-login-design.md` only if implementation discovers a durable invariant not already documented

**Interfaces:**
- Consumes: all previous tasks
- Produces: generated Convex types that include `api.users`, `internal.users`, auth tables, and `users`

- [ ] **Step 1: Regenerate Convex types**

Run:

```bash
npx convex codegen
```

Expected: Convex generated files update successfully and include `users`.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test -- convex/auth.test.ts convex/lib/handles.test.ts convex/users.test.ts src/lib/authRedirect.test.ts src/lib/useAuthStatus.test.tsx src/components/AppProviders.test.tsx src/components/Header.test.tsx
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

- [ ] **Step 6: Manually validate the WeChat authorization URL shape**

With local/staging auth env configured, open RemotionHub, click the Header login icon, then click WeChat.

Expected authorization page origin:

```text
https://open.weixin.qq.com/connect/qrconnect
```

Expected authorization URL parameters:

```text
appid=<configured app id>
redirect_uri=<encoded callback url>
response_type=code
scope=snsapi_login
state=<non-empty opaque value>
```

- [ ] **Step 7: Inspect the final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- . ':!package-lock.json'
```

Expected: changes are limited to WeChat auth bootstrap, generated Convex types, tests, dependency files, env docs, and any approved spec updates.

- [ ] **Step 8: Commit generated files and any final fixes**

Run:

```bash
git add convex/_generated package.json package-lock.json .env.example convex src specs
git commit -m "chore: verify wechat auth bootstrap"
```

Expected: a final commit exists only if Task 5 produced codegen updates or verification fixes not already committed. If there are no changes, skip this commit.

- [ ] **Step 9: Document manual setup for handoff**

Include this in the final implementation report:

```text
Manual setup required:
- Create and approve a WeChat Open Platform Website Application.
- Configure the production callback domain for remotionhub.ai.
- Configure a staging or tunnel callback domain for local validation if needed.
- Set AUTH_WECHAT_ID and AUTH_WECHAT_SECRET in Convex env.
- Generate and set the Convex Auth JWT_PRIVATE_KEY and JWKS values required by the installed @convex-dev/auth version.
- Keep VITE_CONVEX_URL as the only browser-exposed auth-adjacent env var.
```

Expected: the handoff makes clear that secrets are not committed and a full login cannot be manually completed until WeChat credentials and callback domains are configured.

---

## Plan Self-Review

- Spec coverage: Header icon entry, 少数派-style modal, WeChat alternative method, `qrconnect`, `snsapi_login`, `state`, provider-neutral identity, `unionid` preference, namespaced `openid` fallback, personal publisher bootstrap, server-only secrets, relative redirects, and verification are covered.
- Scope check: phone/email, password, GitHub, Google, Weibo, mini program, official account login, embedded QR, settings, publishing, orgs, and billing remain excluded.
- Placeholder scan: the plan contains no unfinished markers or unspecified implementation steps.
- Type consistency: `normalizeWeChatProviderAccountId`, `createWeChatAuthProvider`, `normalizeHandleCandidate`, `fallbackHandleForUserId`, `requireUser`, `api.users.me`, `api.users.ensure`, `internal.users.ensurePersonalPublisherInternal`, `getCurrentRelativeUrl`, `sanitizeRelativeRedirect`, `useAuthStatus`, `UserBootstrap`, and `HeaderAuth` are defined before later tasks consume them.
- External-source check: the Auth.js WeChat provider supports `platformType: "WebsiteApp"`, which maps authorization to `https://open.weixin.qq.com/connect/qrconnect` and scope to `snsapi_login`; this matches the observed 少数派 flow.
