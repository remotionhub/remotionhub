# Task 2 Report

## Scope

Implemented Task 2 in `/Users/tangwz/workspace/git/remotionhub/.worktrees/github-auth-bootstrap`:

- Added backend auth access helpers in `convex/lib/access.ts`
- Added provider-neutral handle helpers in `convex/lib/handles.ts`
- Added users API and personal publisher bootstrap in `convex/users.ts`
- Patched `convex/auth.ts` to schedule personal publisher bootstrap after user create/update
- Added TDD coverage in `convex/lib/handles.test.ts` and `convex/users.test.ts`
- Updated `convex/_generated/api.d.ts` so `api.users` and `internal.users` type references exist locally

## TDD Execution

### Handle helpers

1. Added `convex/lib/handles.test.ts`.
2. Ran:

```bash
npm run test -- convex/lib/handles.test.ts
```

Observed expected red state:

- suite failed because `convex/lib/handles.ts` did not exist

3. Added `convex/lib/handles.ts`.
4. Re-ran:

```bash
npm run test -- convex/lib/handles.test.ts
```

Observed green state:

- 4 tests passed

### Users bootstrap

1. Added `convex/users.test.ts`.
2. Ran:

```bash
npm run test -- convex/users.test.ts
```

Observed expected red state:

- tests failed because the `users` Convex module did not exist

3. Added:

- `convex/lib/access.ts`
- `convex/users.ts`
- auth scheduling patch in `convex/auth.ts`

4. Re-ran:

```bash
npm run test -- convex/users.test.ts
```

Observed one remaining behavior mismatch:

- handle collision path returned `user-...`
- test expected `octocat-<8 hex-ish chars>`

5. Adjusted `choosePersonalPublisherHandle` to preserve the preferred public prefix and append the deterministic 8-character suffix on collision.
6. Re-ran:

```bash
npm run test -- convex/users.test.ts
```

Observed green state:

- 4 tests passed

## Implementation Notes

### `convex/lib/access.ts`

- Added `getOptionalAuthUserId(ctx)` as a null-safe wrapper around `getAuthUserId(ctx)`
- Added `requireUser(ctx)` to centralize authenticated user lookup
- Authorization still derives only from backend auth context

### `convex/lib/handles.ts`

- Added `normalizeHandleCandidate`
- Added `fallbackHandleForUserId`
- Kept logic provider-neutral and ASCII-only for public handles

### `convex/users.ts`

- Added `api.users.me`
- Added `api.users.ensure`
- Added `internal.users.ensurePersonalPublisherInternal`
- Added `internal.users.getByIdInternal`
- Implemented idempotent personal publisher bootstrap using:
  - `publishers.by_handle`
  - `publishers.by_linked_user`

Important behavior preserved:

- no provider id is written into business `users` data
- publisher creation is linked by internal `users` id only

### `convex/auth.ts`

- Added `schedulePostUserCreatedOrUpdated`
- Existing users now schedule publisher ensure after patch
- New users now schedule publisher ensure after insert

## Generated API Note

The brief says to run `npx convex codegen` if generated API types are missing `users`.

I attempted exactly that:

```bash
npx convex codegen
```

This failed locally because the worktree has no configured local Convex deployment:

- first failure: `No CONVEX_DEPLOYMENT set`
- second attempt with the main checkout deployment id also failed because that deployment name was not available in this worktree environment

Because TypeScript then failed on missing `api.users` / `internal.users` references, I applied the minimal local generated-type patch in `convex/_generated/api.d.ts` to keep the worktree type-safe without changing runtime behavior.

## Verification

### Targeted tests required by the brief

Ran:

```bash
npm run test -- convex/lib/handles.test.ts convex/users.test.ts convex/auth.test.ts
```

Result:

- 3 test files passed
- 14 tests passed

### Extra type verification

Ran:

```bash
VITE_CONVEX_URL=https://example.invalid npx tsc --noEmit
```

Result:

- passed after updating `convex/_generated/api.d.ts`

## Files Changed

- `/Users/tangwz/workspace/git/remotionhub/.worktrees/github-auth-bootstrap/convex/auth.ts`
- `/Users/tangwz/workspace/git/remotionhub/.worktrees/github-auth-bootstrap/convex/lib/access.ts`
- `/Users/tangwz/workspace/git/remotionhub/.worktrees/github-auth-bootstrap/convex/lib/handles.ts`
- `/Users/tangwz/workspace/git/remotionhub/.worktrees/github-auth-bootstrap/convex/lib/handles.test.ts`
- `/Users/tangwz/workspace/git/remotionhub/.worktrees/github-auth-bootstrap/convex/users.ts`
- `/Users/tangwz/workspace/git/remotionhub/.worktrees/github-auth-bootstrap/convex/users.test.ts`
- `/Users/tangwz/workspace/git/remotionhub/.worktrees/github-auth-bootstrap/convex/_generated/api.d.ts`

## Remaining Concern

- `npx convex codegen` could not run in this worktree because no usable local Convex deployment was configured. The local type declaration patch is sufficient for this branch, but once a valid deployment is available, regenerating `convex/_generated` is still the preferred cleanup step.
