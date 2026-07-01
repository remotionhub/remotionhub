# Defer HyperFrames E2E Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除误恢复且无法通过 catalog schema 校验的 HyperFrames production fixture，恢复 `/hyperframes` 当前无内容的真实语义，并保留现有空目录 Playwright smoke。

**Architecture:** `catalog/components/` 继续只表示可导入的 production catalog；在没有确认 HyperFrames 产品内容前，不引入测试专用内容或详情页契约。现有 importer、taxonomy、Convex schema 和 E2E 页面断言均保持不变，catalog 校验和完整 smoke 负责验证删除后的系统一致性。

**Tech Stack:** TypeScript 6、Zod 4、Convex、Vitest 4、Playwright 1.61、TanStack Start、Vite 8

---

## 文件范围

- Delete: `catalog/components/hyperframes-lower-third.json`
- Verify unchanged: `e2e/catalog-smoke.pw.test.ts`
- Reference: `specs/2026-07-01-defer-hyperframes-e2e-design.md`

不修改 importer、catalog schema、tags taxonomy、Convex 数据模型或发布配置。根据用户约束，本计划不包含 commit、push、PR 或部署步骤。

### Task 1: 恢复 production catalog 的有效状态

**Files:**

- Delete: `catalog/components/hyperframes-lower-third.json`
- Verify unchanged: `e2e/catalog-smoke.pw.test.ts:83-102`

- [ ] **Step 1: 安装依赖（仅当当前 worktree 尚未安装）**

Run:

```bash
npm ci
```

Expected: dependencies install from `package-lock.json` without changing the lockfile, and `node_modules/.bin/tsx` exists.

- [ ] **Step 2: 运行当前 catalog 校验，确认删除前的失败信号**

Run:

```bash
npm run catalog:validate
```

Expected: FAIL while parsing `catalog/components/hyperframes-lower-third.json`, because `hyperframes` and `caption` are not members of the unified tag taxonomy.

- [ ] **Step 3: 删除无效的 HyperFrames production fixture**

Apply exactly this file deletion:

```diff
*** Delete File: catalog/components/hyperframes-lower-third.json
```

不要用新的 HyperFrames fixture、GitHub source 或 taxonomy 值替代该文件。

- [ ] **Step 4: 再次运行 catalog 校验**

Run:

```bash
npm run catalog:validate
```

Expected: PASS; all remaining files under `catalog/components/` parse successfully in dry-run mode.

- [ ] **Step 5: 确认现有 HyperFrames 空目录契约没有被修改**

Run:

```bash
git diff -- e2e/catalog-smoke.pw.test.ts
```

Expected: no output. The existing test must continue to assert the `/hyperframes` heading, absence of the Remotion fixture link, and `No components found`/`未找到组件`.

### Task 2: 运行 catalog、Convex 与 UI 相关测试

**Files:**

- Test: `shared/catalog.test.ts`
- Test: `scripts/import-catalog.test.ts`
- Test: `convex/lib/catalog.test.ts`
- Test: `convex/components.test.ts`
- Test: `src/components/catalog/CatalogGrid.test.tsx`

- [ ] **Step 1: 运行直接相关的 Vitest 测试**

Run:

```bash
npx vitest run \
  shared/catalog.test.ts \
  scripts/import-catalog.test.ts \
  convex/lib/catalog.test.ts \
  convex/components.test.ts \
  src/components/catalog/CatalogGrid.test.tsx
```

Expected: PASS. These tests confirm catalog parsing/import behavior, runtime-scoped Convex queries, and empty catalog rendering remain valid.

- [ ] **Step 2: 运行完整单元与 Convex 测试集**

Run:

```bash
npm run test
```

Expected: PASS with no failed Vitest suites.

### Task 3: 验证类型检查与 production build

**Files:**

- Verify only: application and Convex TypeScript sources

- [ ] **Step 1: 运行 TypeScript 检查**

Run:

```bash
VITE_CONVEX_URL=https://example.invalid npx tsc --noEmit
```

Expected: PASS with no TypeScript diagnostics.

- [ ] **Step 2: 运行 production build**

Run:

```bash
VITE_CONVEX_URL=https://example.invalid npm run build
```

Expected: PASS; Vite and Nitro complete the production build without errors.

### Task 4: 使用本地 Convex 运行 Playwright smoke

**Files:**

- Verify unchanged: `e2e/catalog-smoke.pw.test.ts`
- Verify only: `Makefile`

- [ ] **Step 1: 在独立终端启动本地 Convex**

Run:

```bash
make convex
```

Expected: the local Convex backend remains reachable at `http://127.0.0.1:3210`.

- [ ] **Step 2: 在第二个终端运行完整 E2E smoke**

Run:

```bash
make e2e
```

Expected:

- catalog seed completes without schema parse errors;
- the production build against local Convex succeeds;
- Playwright catalog smoke passes;
- `/hyperframes` displays the empty catalog state;
- no HyperFrames detail page or content fixture is required.

### Task 5: 最终范围检查

**Files:**

- Delete: `catalog/components/hyperframes-lower-third.json`
- Verify: `specs/2026-07-01-defer-hyperframes-e2e-design.md`
- Verify: `specs/2026-07-01-defer-hyperframes-e2e-implementation-plan.md`

- [ ] **Step 1: 检查 patch 格式**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 2: 检查最终变更范围**

Run:

```bash
git status --short
git diff --stat
```

Expected: the implementation change is limited to deleting `catalog/components/hyperframes-lower-third.json`; the only additional files are the approved design and implementation-plan documents under `specs/`.

- [ ] **Step 3: 停止在未提交状态**

Do not run `git add`, `git commit`, `git push`, create a pull request, or deploy. Report the exact validation commands and their results to the user.
