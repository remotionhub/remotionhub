# 2026-06-29 Fix Catalog E2E Tests Design

E2E tests in `e2e/catalog-smoke.pw.test.ts` are currently failing because they rely on `Kinetic Title Pack` and `Lower Third Pack`, which have been deleted from the catalog. This document details the design to restore E2E test coverage using existing active components.

## User Review Required

> [!IMPORTANT]
> Since there are currently no `hyperframes` components in the production catalog, the `/hyperframes` route will be tested for its **empty state** (displaying "未找到组件" / "No components found"), and we will verify that `remotion` components do not appear there.

## Proposed Changes

### E2E Tests

#### [MODIFY] [catalog-smoke.pw.test.ts](file:///Users/tangwz/.gemini/antigravity/worktrees/remotionhub/fix-catalog-e2e-tests/e2e/catalog-smoke.pw.test.ts)

Introduce constants at the top of the file to represent the test component:
- `TEST_REMOTION_NAME = 'Title Kinetic Bounce'`
- `TEST_REMOTION_PROMPT_REGEX = /Add the Title Kinetic Bounce/`

Update the test cases:
1. **`desktop catalog and detail pages render core content`**:
   - Assert `TEST_REMOTION_NAME` is visible on `/`.
   - Click `TEST_REMOTION_NAME` link.
   - Assert page heading is `TEST_REMOTION_NAME`.
   - Assert `textarea` value matches `TEST_REMOTION_PROMPT_REGEX`.

2. **`language toggle switches platform UI without translating catalog data`**:
   - Assert `TEST_REMOTION_NAME` is visible on `/` in Chinese.
   - Click "EN" button.
   - Assert `TEST_REMOTION_NAME` remains visible.
   - Reload page, assert `TEST_REMOTION_NAME` remains visible.
   - Click "中文" button, assert `TEST_REMOTION_NAME` remains visible.

3. **`runtime catalog pages render independently`**:
   - Assert `TEST_REMOTION_NAME` is visible on `/remotion`.
   - Navigate to `/hyperframes`.
   - Assert `TEST_REMOTION_NAME` is **not** visible.
   - Assert empty state alert is visible (matching `/未找到组件|No components found/`).

4. **`mobile catalog keeps cards readable`**:
   - Assert `TEST_REMOTION_NAME` is visible on `/`.

## Verification Plan

### Automated Tests
- Run Playwright E2E tests locally against a running dev server:
  ```bash
  make e2e
  ```
- Run the full local verification gate:
  ```bash
  make check
  ```
