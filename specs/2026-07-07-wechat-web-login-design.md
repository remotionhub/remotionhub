# WeChat Web Login Design

## Summary

RemotionHub will add website WeChat login for desktop and mobile browsers. The interaction should follow the pattern observed on 少数派: a top navigation account entry opens a centered login dialog, the dialog offers WeChat under alternative login methods, and clicking WeChat navigates the browser to WeChat Open Platform's QR login page.

The implementation should reuse the provider-agnostic Convex Auth direction already documented for GitHub auth. WeChat is a login provider, not a business identity model. Business authorization must continue to derive from the authenticated Convex user id, then link that user to a personal publisher.

## Goals

- Add WeChat website login using WeChat Open Platform `qrconnect` and `snsapi_login`.
- Match the 少数派 login shape: header account icon, modal dialog, "other methods" WeChat entry, then full-page WeChat QR login.
- Store users and provider accounts with a provider-neutral model.
- Create or repair one personal publisher for each authenticated user.
- Keep all public catalog routes accessible when signed out.
- Keep WeChat credentials server-only.

## Non-Goals

- WeChat Mini Program login.
- WeChat Official Account in-WeChat `snsapi_base` or `snsapi_userinfo` login.
- In-page embedded QR code as the first version.
- Phone, email, password, SMS, GitHub, Weibo, or Google login in the first WeChat implementation.
- Account linking UI between WeChat and future providers.
- Settings, publish UI, organization membership, or billing.

## Current Context

RemotionHub currently has a public catalog frontend using TanStack Start, React, Convex, and `ConvexProvider`. The catalog schema contains publishers, components, versions, artifacts, and search digests. It does not currently include auth tables, a `users` table, a session provider, or a signed-in Header state.

The repository already contains a GitHub auth bootstrap design and implementation plan in `specs/2026-07-05-github-auth-bootstrap-design.md` and `specs/2026-07-05-github-auth-bootstrap-implementation-plan.md`. The WeChat design should reuse the same long-term identity invariants and replace the first provider with WeChat.

## Chosen Approach

Use Convex Auth as the session layer and add a custom WeChat website OAuth provider if the installed Auth.js provider cannot be used cleanly.

The user-facing flow:

1. Signed-out Header shows an account icon button.
2. Clicking the icon opens a centered login dialog.
3. The dialog title is "登录 RemotionHub".
4. The dialog shows a WeChat login action under "其他方式".
5. Clicking WeChat starts `signIn("wechat", { redirectTo })`.
6. The browser navigates to WeChat Open Platform `qrconnect`.
7. After scanning and confirming in WeChat, WeChat redirects to RemotionHub's server callback with `code` and `state`.
8. The server validates `state`, exchanges `code`, maps the stable WeChat identity, creates or updates the Convex user, and returns to the original relative URL.
9. The Header reloads to the signed-in state and a best-effort bootstrap ensures the personal publisher exists.

Rejected alternatives:

- Embedded QR iframe on the RemotionHub modal: closer to a single-page feel, but higher integration and polling complexity. 少数派 currently uses full-page navigation to WeChat QR login, so first implementation should match that behavior.
- TanStack Start self-managed OAuth session: viable, but it duplicates session security work and then still needs identity projection into Convex.
- Hosted identity provider: reduces OAuth plumbing but adds a new external dependency and does not match the existing Convex-first direction.

## WeChat Open Platform Requirements

Terence must register and configure:

- A WeChat Open Platform developer account.
- A website application.
- The application `AppID`.
- The application `AppSecret`.
- An authorized callback domain for production, such as `remotionhub.ai`.
- A local or staging callback domain for development if WeChat allows it for the approved app.
- Website login permission using `snsapi_login`.

The callback URL must be served over a domain accepted by WeChat Open Platform. Production should use HTTPS. Local development may require a real tunnel or staging domain because arbitrary `localhost` callbacks are usually not suitable for third-party OAuth provider review and callback-domain validation.

## Identity Invariants

Authorization must be server-derived:

- Convex functions authorize from `getAuthUserId(ctx)` or an equivalent helper.
- Client-supplied user ids, provider ids, openids, unionids, nicknames, and avatars are never authorization proof.
- WeChat account binding must use a stable provider account id stored through the auth layer.
- Prefer `unionid` when WeChat returns it.
- If `unionid` is missing, the first implementation may fall back to `openid` only under a provider/app namespace such as `wechat:web:<appid>:<openid>`.
- The fallback must be documented because `openid` is app-scoped, while `unionid` is cross-application under the same WeChat Open Platform account.
- Nickname and avatar are profile fields only.
- Missing stable identity must fail closed and create no user or publisher.
- Future account linking must be explicit and initiated by an already signed-in user.

## Data Model

Add Convex Auth tables and a `users` table compatible with Convex Auth profile data and RemotionHub business fields.

Recommended `users` business fields:

- `name`
- `image`
- `handle`
- `displayName`
- `role`
- `personalPublisherId`
- `createdAt`
- `updatedAt`

Provider account data should live in auth/provider tables managed by the auth layer where possible. If custom tables are required for WeChat callback state, keep them narrow:

- `provider`
- `stateHash`
- `redirectTo`
- `expiresAt`
- `consumedAt`
- `createdAt`

Extend `publishers` without breaking existing catalog rows:

- `kind?: "user" | "org" | "system"`
- `linkedUserId?: Id<"users">`

Existing catalog publishers may remain legacy/system rows until a later migration gives them explicit ownership semantics.

## WeChat OAuth Flow

Authorization URL parameters:

```text
appid=<WECHAT_WEB_APP_ID>
redirect_uri=<urlencoded callback URL>
response_type=code
scope=snsapi_login
state=<opaque random state>
```

The callback handler must:

1. Reject missing or expired `state`.
2. Reject reused `state`.
3. Reject missing `code`.
4. Exchange `code` for token data using server-side credentials.
5. Validate the response shape and provider error codes.
6. Fetch user profile data if needed.
7. Choose `unionid` as the provider account id when present.
8. Fall back to namespaced `openid` only when the design's single-app constraint holds.
9. Create or update the auth user.
10. Ensure the personal publisher.
11. Redirect only to a validated relative `redirectTo`.

The implementation must not put `AppSecret`, token responses, or provider access tokens in browser-accessible state.

## Frontend UX

Header signed-out state:

- Render an icon-only account/login button near the existing global controls.
- Provide accessible text such as "登录".
- Keep the button compact to match the current Header density.

Login dialog:

- Centered modal with backdrop.
- Title: "登录 RemotionHub".
- Primary active method: WeChat.
- Secondary structure: "其他方式" label, matching 少数派's placement.
- Terms text at the bottom: registering or logging in means agreeing to user agreement and privacy policy.
- Close button returns focus to the Header login button.

WeChat action:

- Use a WeChat-styled icon treatment.
- On click, start the provider sign-in and navigate to WeChat's QR login page.
- Preserve the current relative URL as `redirectTo`.
- Reject absolute redirect targets to avoid open redirects.

Header signed-in state:

- Show avatar if available.
- Fall back to initials or a compact user mark.
- Show sign out action.
- Do not add a full account settings page in this feature.

Error states:

- Login start failure: show a toast.
- WeChat callback error: return to the original page with a generic login failure toast or query flag.
- User cancels or closes the WeChat flow: no account rows are created.
- Bootstrap failure: public browsing stays usable; user-only actions can later surface a precise error.

## Configuration

Convex/server-only environment:

```dotenv
SITE_URL=https://remotionhub.ai
AUTH_WECHAT_ID=your-wechat-open-platform-website-app-id
AUTH_WECHAT_SECRET=your-wechat-open-platform-website-app-secret
JWT_PRIVATE_KEY=generated-by-convex-auth-setup
JWKS=generated-by-convex-auth-setup
```

Frontend environment:

```dotenv
VITE_CONVEX_URL=https://example.convex.cloud
```

Register the WeChat Open Platform website app callback as `${CONVEX_SITE_URL}/api/auth/callback/wechat`, or `${CUSTOM_AUTH_SITE_URL}/api/auth/callback/wechat` when overriding the Convex Auth site.

Do not expose `AUTH_WECHAT_SECRET`, Convex deploy keys, token exchange results, or provider refresh tokens through `VITE_*` variables.

## Testing

Unit tests:

- WeChat profile normalization chooses `unionid` when present.
- WeChat profile normalization falls back to a namespaced `openid` only when allowed.
- Missing `unionid` and `openid` fails closed.
- `state` generation stores a hashed state and relative `redirectTo`.
- Callback rejects expired, reused, missing, or mismatched `state`.
- Callback rejects absolute `redirectTo` targets.
- Personal publisher bootstrap is idempotent.
- Header renders signed-out, dialog-open, loading, signed-in, and sign-out states.

Convex tests:

- `users.me` returns `null` when signed out.
- Auth helpers derive identity server-side.
- User creation/update does not authorize from client-provided ids.
- Existing user login updates profile fields without replacing the personal publisher.

Manual validation:

- Signed-out Header opens the login dialog.
- WeChat button navigates to `open.weixin.qq.com/connect/qrconnect`.
- The authorization URL includes `appid`, encoded `redirect_uri`, `response_type=code`, `scope=snsapi_login`, and `state`.
- Successful scan returns to the original RemotionHub path.
- Header shows the signed-in user.
- Sign out returns Header to the signed-out state.

Suggested verification commands after implementation:

```bash
npm run test
npm run ci:types-build
make check
```

## Implementation Boundary

This design is focused enough for one implementation plan:

- Add auth dependencies and schema.
- Add WeChat provider/callback/state handling.
- Add user helpers and personal publisher bootstrap.
- Replace `ConvexProvider` with auth-aware provider wiring.
- Add Header login dialog and signed-in state.
- Add focused tests for WeChat identity, state safety, provider wiring, and Header UX.

It should not implement phone/email login just because 少数派 shows those fields. The modal should leave visual room for those methods later without introducing inactive or fake controls.

## References

- 少数派 homepage login flow observed at `https://sspai.com/`.
- WeChat Open Platform QR login endpoint observed through the 少数派 flow: `https://open.weixin.qq.com/connect/qrconnect`.
- WeChat Open Platform website login documentation: `https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html`.
- Existing RemotionHub GitHub auth design: `specs/2026-07-05-github-auth-bootstrap-design.md`.
