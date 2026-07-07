# Task 3 Report

## What you implemented
- Switched `src/components/AppProviders.tsx` from `ConvexProvider` to `ConvexAuthProvider` using `convexReactClient`.
- Added `UserBootstrap` to run `api.users.ensure` once after authenticated user state is available.
- Added `sanitizeRelativeRedirect` and `getCurrentRelativeUrl` in `src/lib/authRedirect.ts`.
- Added `useAuthStatus` in `src/lib/useAuthStatus.ts` to combine Convex auth state with `api.users.me`.
- Added and updated focused tests for redirect sanitization, auth status behavior, and provider composition.

## Tests run and results
- `npm run test -- src/lib/authRedirect.test.ts` -> PASS (`3 passed`)
- `npm run test -- src/lib/useAuthStatus.test.tsx` -> PASS (`4 passed`)
- `npm run test -- src/lib/authRedirect.test.ts src/lib/useAuthStatus.test.tsx src/components/AppProviders.test.tsx` -> PASS (`8 passed` across `3` files)

## TDD Evidence
### RED command/output summary
- `npm run test -- src/lib/authRedirect.test.ts` -> FAIL because `src/lib/authRedirect.ts` did not exist (`Cannot find module './authRedirect'`).
- `npm run test -- src/lib/useAuthStatus.test.tsx` -> FAIL because `src/lib/useAuthStatus.ts` did not exist (`Failed to resolve import "./useAuthStatus"`).
- `npm run test -- src/components/AppProviders.test.tsx` -> FAIL because the app still rendered the old provider shape (`Unable to find [data-testid="convex-auth-provider"]`).

### GREEN command/output summary
- `npm run test -- src/lib/authRedirect.test.ts` -> PASS (`3 passed`).
- `npm run test -- src/lib/useAuthStatus.test.tsx` -> PASS (`4 passed`).
- `npm run test -- src/lib/authRedirect.test.ts src/lib/useAuthStatus.test.tsx src/components/AppProviders.test.tsx` -> PASS (`8 passed`, `3` files).

## Files changed
- `src/components/AppProviders.tsx`
- `src/components/AppProviders.test.tsx`
- `src/components/UserBootstrap.tsx`
- `src/lib/authRedirect.ts`
- `src/lib/authRedirect.test.ts`
- `src/lib/useAuthStatus.ts`
- `src/lib/useAuthStatus.test.tsx`

## Self-review findings
- Reviewed the diff for all touched files after tests passed.
- No additional correctness issues found in the Task 3 scope.
- One subtle fix was needed during GREEN: `useAuthStatus` return-property order was adjusted to match the required test assertions without changing behavior.

## Concerns, if any
- None.

## Task 3 fix after review

### What you fixed
- Updated `src/components/UserBootstrap.tsx` so bootstrap runs once whenever auth is resolved and authenticated, including the `me === null` case that represents a newly authenticated user without a user document yet.
- Kept `ensureUser({})` best-effort and caught, preserving the existing retry-on-failure behavior.
- Added focused `UserBootstrap` tests covering loading, signed-out, authenticated-with-null-user, and authenticated-with-user-object states.

### Tests run and results
- `npm run test -- src/components/UserBootstrap.test.tsx src/lib/authRedirect.test.ts src/lib/useAuthStatus.test.tsx src/components/AppProviders.test.tsx` -> PASS
- Output summary: `4 passed` in `src/components/UserBootstrap.test.tsx`; `12 passed` total across `4` files; test run completed successfully with no failures.

### Files changed
- `src/components/UserBootstrap.tsx`
- `src/components/UserBootstrap.test.tsx`
- `.superpowers/sdd/task-3-report.md`

### Concerns
- None.
