# GitHub Auth Bootstrap Design

## Summary

RemotionHub will add first-party web authentication using Convex Auth. The first implementation enables GitHub OAuth only, then creates or repairs the signed-in user's personal publisher so later publish and account workflows have a stable ownership base.

The design is provider-agnostic even though the first enabled provider is GitHub. Future Google, WeChat, and Weibo login must fit the same identity model without rewriting user or publisher ownership.

## Goals

- Add GitHub sign-in and sign-out to the existing TanStack Start frontend.
- Store authenticated users in Convex and expose the current user through a server-derived `users.me` query.
- Ensure every active user has at most one personal publisher linked by Convex user id.
- Preserve current public catalog routes as public routes.
- Leave explicit space for future Google, WeChat, and Weibo OAuth providers.

## Non-Goals

- Password registration or password login.
- Google, WeChat, or Weibo login switches in the first implementation.
- A full settings page.
- Publishing UI or protected publish routes.
- Organization publishers, publisher memberships, or account recovery flows.
- Automatic account linking by email, username, nickname, or avatar.

## Current Context

RemotionHub currently uses Convex for catalog data and `ConvexProvider` in `src/components/AppProviders.tsx`. The current `convex/schema.ts` contains catalog publisher and component tables, but no authentication tables or user table.

ClawHub uses `@convex-dev/auth` with GitHub OAuth and keeps a strong identity invariant: the immutable provider account id is the account binding key, while usernames and emails are profile data. RemotionHub should reuse that model, but generalize it so GitHub is only the first provider.

Convex Auth uses Auth.js provider configs. Convex Auth officially documents GitHub and Google OAuth support and allows trying other Auth.js OAuth providers. Auth.js has a WeChat provider. Weibo should be treated as a future custom OAuth provider unless implementation-time research proves a maintained provider is available.

## Chosen Approach

Use `@convex-dev/auth` as the session and OAuth layer.

First implementation:

- Register only the GitHub provider.
- Replace the frontend `ConvexProvider` with `ConvexAuthProvider`.
- Add `users`, Convex Auth tables, and minimal auth helpers on the Convex side.
- Add a Header sign-in button and signed-in user menu.
- Add idempotent personal publisher bootstrap.

Rejected alternatives:

- TanStack Start self-managed OAuth session: higher security and maintenance surface, plus extra work to project trusted identity into Convex functions.
- Hosted auth provider such as Clerk or WorkOS: useful later if RemotionHub needs a broader managed identity product, but it diverges from ClawHub and adds an external service dependency for the first version.

## Identity Invariants

OAuth identity is provider-agnostic.

- A RemotionHub user is authorized by Convex Auth's current session principal, read server-side through `getAuthUserId(ctx)` or an equivalent helper.
- Client-supplied user ids, handles, provider ids, emails, usernames, and nicknames are never authorization proof.
- Provider account binding uses the provider's stable account id as stored by Convex Auth in `authAccounts.providerAccountId`.
- OAuth profile email, username, nickname, and avatar are profile fields only.
- All OAuth providers must use `allowDangerousEmailAccountLinking: false` unless a later security design explicitly changes that.
- If a provider profile lacks a valid stable account id, sign-in fails closed and no user or publisher is created.

Provider account id expectations:

- GitHub: numeric OAuth profile `id`.
- Google: OIDC `sub`.
- WeChat WebsiteApp: use namespaced app-scoped `openid` when present to keep the account id stable for the single configured website app. Use `unionid` only when `openid` is unavailable; any future cross-WeChat-app identity unification needs an explicit account linking or migration design.
- Weibo: stable user id/uid returned by the provider or custom OAuth profile mapper.

Future multi-provider linking must be explicit. A user who is already signed in may link another provider through a dedicated flow. RemotionHub must not silently merge users because two providers expose the same email address or display name.

## Data Model

Add Convex Auth tables by spreading `authTables` into `convex/schema.ts`.

Add a `users` table shaped for Convex Auth profile compatibility and RemotionHub business fields:

- `name`
- `image`
- `email`
- `emailVerificationTime`
- `handle`
- `displayName`
- `role`
- `personalPublisherId`
- `createdAt`
- `updatedAt`

Extend the existing `publishers` table without invalidating existing catalog rows:

- `kind?: "user" | "org" | "system"`
- `linkedUserId?: Id<"users">`

First-version personal publishers use `kind: "user"` and `linkedUserId`. Existing catalog publishers may remain legacy/system rows until a later migration gives them explicit ownership semantics.

Indexes should support:

- User lookup by `handle`.
- Publisher lookup by `handle`.
- Publisher lookup by `linkedUserId`.

## Personal Publisher Bootstrap

Every active user should have at most one personal publisher.

Bootstrap is idempotent:

1. If the user already has `personalPublisherId` and the publisher exists, keep it and patch profile-derived fields only when appropriate.
2. If no personal publisher exists, create one with `kind: "user"` and `linkedUserId` equal to the authenticated Convex user id.
3. If the preferred handle is unavailable, generate a deterministic fallback using a short id suffix.
4. Patch `users.personalPublisherId` after the publisher exists.

Handle generation is provider-neutral:

- Prefer a normalized profile handle/name when it can become a safe public handle.
- If the candidate is empty, non-ASCII-only, reserved, or already taken, fallback to a stable generated handle such as `user-<short-id>` or `<candidate>-<short-id>`.
- Never transfer or overwrite an existing publisher because an OAuth profile now uses the same username.

Bootstrap should run in two places:

- Auth callback path schedules or calls an internal `ensurePersonalPublisher` operation after user creation/update.
- A frontend `UserBootstrap` component best-effort calls a public `users.ensure` mutation after `isAuthenticated && me`.

The frontend bootstrap must catch failures. A bootstrap failure should not crash public catalog browsing or make sign-out impossible. Later publish/settings flows can surface a precise remediation error when they require a publisher.

## Frontend Flow

No standalone login page is required for the first version.

`AppProviders` changes:

- Use `ConvexAuthProvider`.
- Keep existing i18n, theme, and toast providers.
- Add auth error handling only if implementation testing shows the default Convex Auth code handling is insufficient for TanStack Start routing.

`useAuthStatus`:

- Wrap `useConvexAuth()`.
- Load `api.users.me` only when authenticated.
- Return `isLoading`, `isAuthenticated`, and `me`.

`Header` states:

- Loading: render a stable skeleton placeholder to avoid flicker.
- Signed out: show `Sign in with GitHub`.
- Signed in: show avatar/handle and a small account menu with sign out.

Sign-in behavior:

- Call `signIn("github", { redirectTo })`.
- `redirectTo` defaults to the current relative URL.
- Redirect targets must remain relative to avoid open redirect bugs.

Sign-out behavior:

- Call Convex Auth `signOut`.
- On failure, keep the current UI state and show a toast.

## Route And API Protection

The first implementation has no private pages, so it should not add an authenticated route layout yet.

When later settings or publish routes are added:

- Use TanStack Router `beforeLoad` for page UX and redirect behavior.
- Do not treat route guards as a data boundary.
- Every Convex mutation/action that reads or writes private user or publisher data must call `requireUser(ctx)` or an equivalent server-side helper.

## Error Handling

- User cancels OAuth or provider returns an error: show a generic login failure message.
- Missing or malformed GitHub profile id: fail closed server-side, record diagnostics, and do not create user or publisher rows.
- OAuth provider configuration missing: show a clear development error locally; production should show a generic failure.
- Publisher handle conflict: fallback automatically.
- `me` query fails or remains unresolved: keep Header conservative and hide user-only menu items.
- Sign-out fails: keep current authenticated state and show a toast.

## Configuration

Convex environment:

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- Convex Auth JWT/JWKS configuration required by the installed `@convex-dev/auth` version.

Frontend environment:

- Continue using `VITE_CONVEX_URL`.
- Do not expose GitHub client secrets, Convex deploy keys, or backend-only auth secrets through `VITE_*` variables.

Documentation:

- Update `.env.example` with non-secret placeholders.
- Add or update a durable spec for auth identity invariants if implementation details reveal additional constraints.

## Testing

Unit tests:

- GitHub profile id normalization accepts numeric ids and rejects missing or non-numeric values.
- Provider-neutral handle normalization covers GitHub-style handles, empty names, non-ASCII names, reserved handles, and collision fallback.
- `ensurePersonalPublisher` is idempotent and never creates two personal publishers for one user.
- `users.me` returns `null` when signed out and the current user when signed in.
- Header renders signed-out, loading, and signed-in states.

Convex tests:

- New OAuth user creation stores user profile fields and ensures a personal publisher.
- Existing user login updates profile fields without replacing the personal publisher.
- Auth helpers derive user identity server-side and do not accept client-supplied user ids for authorization.
- Provider account linking does not rely on email.

Manual validation:

- Local GitHub OAuth returns to the original public page.
- Header shows avatar/handle after login.
- Sign out returns the Header to the signed-out state.
- Convex dashboard shows a user linked to a personal publisher.

Verification commands:

```bash
npm run test
npm run ci:types-build
```

For broader handoff after implementation, run `make check` unless the implementation scope or local prerequisites make that impractical.

## Implementation Boundary

Implementation should happen in a new worktree on a branch such as `codex/github-auth-bootstrap`.

First implementation includes:

- Convex Auth GitHub provider.
- User table and helpers.
- Personal publisher bootstrap.
- Header login/logout UI.
- Tests for the touched behavior.

First implementation excludes:

- Password auth.
- Google, WeChat, and Weibo provider activation.
- Settings page.
- Publishing UI.
- Organization membership.
- CLI/API tokens.

## References

- ClawHub `convex/auth.ts`, `convex/schema.ts`, `src/components/AppProviders.tsx`, `src/lib/useAuthStatus.ts`.
- Convex Auth OAuth documentation: https://labs.convex.dev/auth/config/oauth
- Convex Auth overview: https://docs.convex.dev/auth/convex-auth
- Auth.js Google provider: https://authjs.dev/getting-started/providers/google
- Auth.js WeChat provider: https://authjs.dev/reference/core/providers/wechat
