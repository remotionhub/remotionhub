# Task 1 Report

## Summary

Implemented the GitHub auth bootstrap foundation for Convex:

- Added `@convex-dev/auth` and `@auth/core` to the project dependencies.
- Created `convex/auth.ts` with GitHub provider wiring, GitHub profile ID normalization, and the `convexAuth()` exports required by later tasks.
- Created `convex/auth.config.ts` with the Convex auth provider config.
- Updated `convex/schema.ts` to include Convex Auth tables, the extended `users` table, and the updated `publishers` table.
- Updated `.env.example` with the Convex Auth environment notes from the brief.
- Added `convex/auth.test.ts` and drove the normalization helper from a failing test to a passing test.

## Verification

- `npm run test -- convex/auth.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run build`

## Commit

- `521af06 feat: configure convex github auth`

## Fix

Addressed the review findings from Task 1:

- Removed OAuth `id` from the business user payload in `convex/auth.ts` before `createOrUpdateUser()` writes to `users`.
- Wrapped the GitHub provider returned by `createGitHubAuthProvider()` so `profile()` now rejects missing or malformed `profile.id` values and returns normalized string ids for valid numeric ids.
- Removed the redundant `by_email` index from `convex/schema.ts` and kept the `email` / `phone` indexes expected by Convex Auth.

Verification:

- `npm run test -- convex/auth.test.ts` -> passed, 1 file / 6 tests
- `npx tsc --noEmit --pretty false` -> passed
