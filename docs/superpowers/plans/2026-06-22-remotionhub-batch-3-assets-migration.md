# RemotionHub Batch 3 Assets Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 迁移 `/tmp/remotionlab/案例` 中的剩下 96 个素材到 `remotionhub-assets` 并在主站 `remotionhub` 支持中英文多语言 i18n 呈现与真机浏览器预览。

**Architecture:** 主站 `remotionhub` 数据库 Schema、Zod 校验模型和前端视图扩展可选的中文属性 `displayNameZh` 和 `summaryZh`。素材库继续以 monorepo npms 独立管理。新增 `scripts/generate-catalog.ts` 从资源仓库 manifest 以及 Markdown 中文元数据自动生成多语言 Catalog JSON 记录并导入。

**Tech Stack:** TypeScript, React, Remotion, npm workspaces, ali-oss, Convex, Vitest, TanStack Start, Zod.

---

## Scope Check

本计划实现 `specs/2026-06-22-remotionhub-batch-3-assets-migration.md`。包含以下 96 个组件的提取、清洗、镜像、验证及多语言导入：

* **Batch 1 (Audio & Logo - 21个)**: `audio-bar-spectrum`, `audio-circle-viz`, `audio-pulse-ring`, `audio-vinyl-record`, `audio-waveform`, `logo-badge-unfold`, `logo-block-build`, `logo-brand-kit`, `logo-emblem`, `logo-glow-pulse`, `logo-hologram`, `logo-icon-reveal`, `logo-line-draw`, `logo-minimal-dot`, `logo-negative-reveal`, `logo-orbit-reveal`, `logo-pin-drop`, `logo-ring-focus`, `logo-shield-crest`, `logo-stamp-reveal`, `logo-triangle-form`
* **Batch 2 (Transitions - 17个)**: `transition-blinds`, `transition-curtain`, `transition-diagonal-wipe`, `transition-diamond-reveal`, `transition-fade-cross`, `transition-film-burn`, `transition-flash-white`, `transition-ink-spread`, `transition-morph-circle`, `transition-page-flip`, `transition-pixelate`, `transition-slide-push`, `transition-spin-zoom`, `transition-split-doors`, `transition-wipe-clock`, `transition-zoom-out-in`, `transition-zoom-through`
* **Batch 3 (Intros & Outros - 18个)**: `intro-cinematic-bars`, `intro-cinematic-text`, `intro-countdown-3`, `intro-geometric`, `intro-logo-morph`, `intro-minimal-fade`, `intro-news-broadcast`, `intro-particle-burst`, `intro-split-screen`, `intro-typewriter`, `intro-vhs-retro`, `outro-comment-cta`, `outro-credits-roll`, `outro-end-screen`, `outro-playlist`, `outro-social-links`, `outro-sponsor`, `outro-subscribe-cta`
* **Batch 4 (Basic Data Viz - 10个)**: `dataviz-bar-chart`, `dataviz-horizontal-bar`, `dataviz-stacked-bar`, `dataviz-line-draw`, `dataviz-area-chart`, `dataviz-pie-donut`, `dataviz-progress-ring`, `dataviz-counter-card`, `dataviz-bubble`, `dataviz-scatter-plot`
* **Batch 5 (Advanced Data Viz - 10个)**: `dataviz-bullet`, `dataviz-candlestick`, `dataviz-comparison-split`, `dataviz-funnel`, `dataviz-gantt`, `dataviz-heatmap`, `dataviz-radar`, `dataviz-sankey`, `dataviz-treemap`, `dataviz-waterfall`
* **Batch 6 (Social Media - 20个)**: `social-app-store`, `social-comment-wall`, `social-facebook`, `social-github`, `social-ig-masonry`, `social-ig-post`, `social-linkedin`, `social-notifications`, `social-producthunt`, `social-reddit-feed`, `social-reddit`, `social-stats-wall`, `social-stories-row`, `social-testimonial-wall`, `social-tiktok`, `social-trending`, `social-twitter-feed`, `social-twitter-quote`, `social-youtube-feed`, `social-yt-video`

---

## File Structure

`/Users/tangwz/workspace/git/remotionhub`:
* **Modify**: `convex/schema.ts` - 扩展 `components` 与 `componentSearchDigest` 表的 Schema。
* **Modify**: `shared/catalog.ts` - 扩展 Zod 校验模式支持多语言。
* **Modify**: `convex/components.ts` - 变动函数 `importCatalogComponent` 逻辑更新。
* **Modify**: `convex/lib/catalog.ts` - `buildDigestDoc` 逻辑更新。
* **Modify**: `scripts/import-catalog.ts` - 导入脚本映射适配。
* **Modify**: `src/components/catalog/CatalogCard.tsx` - 前端卡片支持根据 locale 显示中文/英文。
* **Modify**: `src/components/catalog/DetailPage.tsx` - 前端详情支持根据 locale 显示中文/英文。
* **Create**: `scripts/generate-catalog.ts` - 批量根据素材和 Markdown 自动生成 Catalog JSON 的脚本。
* **Create**: 96 个 Catalog JSON 文件落于 `catalog/components/` 下。

`/Users/tangwz/workspace/git/remotionhub-assets`:
* **Modify**: `scripts/extract-case.ts` - 补充 96 个 slug 至 `SUPPORTED_SLUGS` 白名单，生成默认英文 DisplayName。
* **Modify**: `scripts/scaffold-batch.ts` - 补充 96 个 slug 至 `slugs` 白名单，处理横杠常量名转换。
* **Modify**: `manifest/remotionlab-showcase.json` - 追踪 96 个新组件的提取/发布状态。
* **Create**: 96 个素材的 npm workspaces 落于 `remotion/` 下。

---

## Execution Rules
- 先在两个 repo 建立隔离 worktree，分支名称：`codex/batch-3-assets-migration`。
- 在 `remotionhub-assets` 中按 Batch 运行提取、镜像和 validate 后 Commit。
- 最后在 `remotionhub` 中新增多语言架构、前端逻辑和 Catalog 脚本，运行脚本生成 JSON 文件并导入。

---

## Task 1: Setup Workspace & Branches

**Files:**
- None

- [ ] **Step 1: Check branch status**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  git status --short --branch
  cd /Users/tangwz/workspace/git/remotionhub-assets
  git status --short --branch
  ```
  Expected: Both repos are clean and on branch main.

- [ ] **Step 2: Create execution branches**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  git switch -c codex/batch-3-assets-migration
  cd /Users/tangwz/workspace/git/remotionhub-assets
  git switch -c codex/batch-3-assets-migration
  ```
  Expected: Both repositories are now on branch `codex/batch-3-assets-migration`.

---

## Task 2: Convex Schema & TS i18n Extensions

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub/convex/schema.ts`
- Modify: `/Users/tangwz/workspace/git/remotionhub/shared/catalog.ts`

- [ ] **Step 1: Update Convex schemas**
  Modify `/Users/tangwz/workspace/git/remotionhub/convex/schema.ts` around line 54 and line 110, adding `displayNameZh` and `summaryZh` fields:
  ```typescript
  // In components: defineTable
  displayName: v.string(),
  displayNameZh: v.optional(v.string()),
  summary: v.string(),
  summaryZh: v.optional(v.string()),
  
  // In componentSearchDigest: defineTable
  displayName: v.string(),
  displayNameZh: v.optional(v.string()),
  summary: v.string(),
  summaryZh: v.optional(v.string()),
  ```

- [ ] **Step 2: Update Zod validation schema**
  Modify `/Users/tangwz/workspace/git/remotionhub/shared/catalog.ts` inside `catalogComponentSchema` (around line 85):
  ```typescript
  displayName: z.string().min(1),
  displayNameZh: z.string().min(1).optional(),
  summary: z.string().min(1),
  summaryZh: z.string().min(1).optional(),
  ```

- [ ] **Step 3: Verify TypeScript compilation**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  npx tsc -p tsconfig.json --noEmit
  ```
  Expected: Compile successfully.

- [ ] **Step 4: Commit schema extensions**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  git add convex/schema.ts shared/catalog.ts
  git commit -m "feat: extend Convex schema and Zod catalog for i18n support"
  ```

---

## Task 3: Convex Server-side Mutation & Import Script Updates

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub/convex/components.ts`
- Modify: `/Users/tangwz/workspace/git/remotionhub/convex/lib/catalog.ts`
- Modify: `/Users/tangwz/workspace/git/remotionhub/scripts/import-catalog.ts`

- [ ] **Step 1: Update importCatalogComponent mutation**
  Modify `/Users/tangwz/workspace/git/remotionhub/convex/components.ts` at mutation args definition (around line 134) and mutation handler implementation (around line 170):
  ```typescript
  // args definition
  displayName: v.string(),
  displayNameZh: v.optional(v.string()),
  summary: v.string(),
  summaryZh: v.optional(v.string()),

  // handler insertion
  const componentId = await ctx.db.insert('components', {
    runtime: args.runtime,
    publisherId: publisher._id,
    slug: args.slug,
    displayName: args.displayName,
    displayNameZh: args.displayNameZh,
    summary: args.summary,
    summaryZh: args.summaryZh,
    categories: args.categories,
    tags: args.tags,
    status: args.status,
    isActive: isActiveStatus(args.status),
    stats: { views: 0, downloads: 0, stars: 0 },
    createdAt: now,
    updatedAt: now,
  })

  // handler patch
  await ctx.db.patch(component._id, {
    displayName: args.displayName,
    displayNameZh: args.displayNameZh,
    summary: args.summary,
    summaryZh: args.summaryZh,
    categories: args.categories,
    tags: args.tags,
    status: args.status,
    isActive: isActiveStatus(args.status),
    updatedAt: now,
  })
  ```

- [ ] **Step 2: Update syncComponentSearchDigest helper**
  Modify `/Users/tangwz/workspace/git/remotionhub/convex/lib/catalog.ts` around line 58:
  ```typescript
  displayName: args.component.displayName,
  displayNameZh: args.component.displayNameZh,
  summary: args.component.summary,
  summaryZh: args.component.summaryZh,
  ```

- [ ] **Step 3: Update local import-catalog mapping**
  Modify `/Users/tangwz/workspace/git/remotionhub/scripts/import-catalog.ts` in `toImportPayload` (around line 77):
  ```typescript
  displayName: component.displayName,
  displayNameZh: component.displayNameZh,
  summary: component.summary,
  summaryZh: component.summaryZh,
  ```

- [ ] **Step 4: Verify typecheck**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  npx tsc --noEmit
  ```
  Expected: PASS with no compilation errors.

- [ ] **Step 5: Commit server-side updates**
  Run:
  ```bash
  git add convex/components.ts convex/lib/catalog.ts scripts/import-catalog.ts
  git commit -m "feat: update Convex mutation and import script to support i18n data payload"
  ```

---

## Task 4: Frontend UI i18n Mapping

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub/src/components/catalog/CatalogCard.tsx`
- Modify: `/Users/tangwz/workspace/git/remotionhub/src/components/catalog/DetailPage.tsx`

- [ ] **Step 1: Update CatalogCard Item Typing and Render**
  Modify `/Users/tangwz/workspace/git/remotionhub/src/components/catalog/CatalogCard.tsx`:
  ```typescript
  // Update CatalogCardItem type
  export type CatalogCardItem = {
    runtime: Runtime
    ownerHandle: string
    slug: string
    displayName: string
    displayNameZh?: string
    summary: string
    tags: string[]
    categories: string[]
    latestVersionSummary: {
      version: string
      preview: { thumbnailUrl?: string; previewVideoUrl?: string }
      metadata: { aspectRatios: string[] }
    }
  }

  // Update rendering inside CatalogCard component
  import { useI18n } from '#/components/I18nProvider'

  export default function CatalogCard({ item }: { item: CatalogCardItem }) {
    const { locale } = useI18n()
    const displayName = locale === 'zh' ? (item.displayNameZh ?? item.displayName) : item.displayName
    // Use displayName variable in PreviewMedia title attribute and CardTitle content.
  ```

- [ ] **Step 2: Update DetailPage Item Typing and Render**
  Modify `/Users/tangwz/workspace/git/remotionhub/src/components/catalog/DetailPage.tsx`:
  ```typescript
  // Update CatalogDetail component type
  export type CatalogDetail = {
    publisher: { handle: string; displayName: string }
    component: {
      runtime: 'remotion' | 'hyperframes'
      slug: string
      displayName: string
      displayNameZh?: string
      summary: string
      summaryZh?: string
      tags: string[]
      categories: string[]
      latestIsPrerelease?: boolean
    }
    // ...
  }

  // Update DetailPage rendering
  export default function DetailPage({ detail }: { detail: CatalogDetail }) {
    const { locale, t } = useI18n()
    const displayName = locale === 'zh' ? (detail.component.displayNameZh ?? detail.component.displayName) : detail.component.displayName
    const summary = locale === 'zh' ? (detail.component.summaryZh ?? detail.component.summary) : detail.component.summary
    // Use displayName variable in PreviewMedia title, Page Header Title and summary variable in Summary paragraph.
  ```

- [ ] **Step 3: Run unit tests**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  npm run test
  ```
  Expected: All tests pass.

- [ ] **Step 4: Commit UI changes**
  Run:
  ```bash
  git add src/components/catalog/CatalogCard.tsx src/components/catalog/DetailPage.tsx
  git commit -m "feat: implement locale-aware component name and summary rendering in frontend"
  ```

---

## Task 5: Assets Repository White-List Preparation

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/extract-case.ts`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/scaffold-batch.ts`

- [ ] **Step 1: Add 96 slugs to extract-case whitelist**
  Modify `SUPPORTED_SLUGS` whitelist array in `/Users/tangwz/workspace/git/remotionhub-assets/scripts/extract-case.ts` to include all 96 slugs listed in the Scope Check.

- [ ] **Step 2: Add 96 slugs to scaffold-batch list**
  Modify `slugs` array in `/Users/tangwz/workspace/git/remotionhub-assets/scripts/scaffold-batch.ts` to match the exact same whitelist.

- [ ] **Step 3: Commit whitelist modifications**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub-assets
  git add scripts/extract-case.ts scripts/scaffold-batch.ts
  git commit -m "chore: add 96 new batch slugs to extraction and scaffolding scripts"
  ```

---

## Task 6: Migrate Batch 1 (Audio & Logo Animations - 21 slugs)

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/audio-*` (5 workspaces)
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/logo-*` (16 workspaces)

- [ ] **Step 1: Initialize raw extraction**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub-assets
  for slug in audio-bar-spectrum audio-circle-viz audio-pulse-ring audio-vinyl-record audio-waveform logo-badge-unfold logo-block-build logo-brand-kit logo-emblem logo-glow-pulse logo-hologram logo-icon-reveal logo-line-draw logo-minimal-dot logo-negative-reveal logo-orbit-reveal logo-pin-drop logo-ring-focus logo-shield-crest logo-stamp-reveal logo-triangle-form; do
    npm run extract -- --slug=$slug
  done
  ```

- [ ] **Step 2: Scaffold batch files**
  Execute scaffold-batch logic (renaming and hyphen replacement) for the 21 slugs.
  Run:
  ```bash
  npx tsx scripts/scaffold-batch.ts
  ```

- [ ] **Step 3: Upload media resources to Aliyun OSS**
  Ensure credentials from `.env.local` are loaded and run mirror upload.
  Run:
  ```bash
  set -a
  source /Users/tangwz/workspace/git/remotionhub/.env.local
  set +a
  for slug in audio-bar-spectrum audio-circle-viz audio-pulse-ring audio-vinyl-record audio-waveform logo-badge-unfold logo-block-build logo-brand-kit logo-emblem logo-glow-pulse logo-hologram logo-icon-reveal logo-line-draw logo-minimal-dot logo-negative-reveal logo-orbit-reveal logo-pin-drop logo-ring-focus logo-shield-crest logo-stamp-reveal logo-triangle-form; do
    npm run media:mirror -- --slug=$slug
    npm run sanitize -- --slug=$slug
    npm run validate -- --slug=$slug
    npm run readme:generate -- --slug=$slug
  done
  ```

- [ ] **Step 4: Run root tests**
  Run:
  ```bash
  npm run test
  npm run typecheck
  npm run format:check
  ```
  Expected: All validate tasks and tests PASS.

- [ ] **Step 5: Commit Batch 1**
  Run:
  ```bash
  git add manifest/remotionlab-showcase.json remotion/
  git commit -m "feat: migrate audio and logo animation assets"
  ```

---

## Task 7: Migrate Batch 2 (Transitions - 17 slugs)

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/transition-*` (17 workspaces)

- [ ] **Step 1: Raw extraction**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub-assets
  for slug in transition-blinds transition-curtain transition-diagonal-wipe transition-diamond-reveal transition-fade-cross transition-film-burn transition-flash-white transition-ink-spread transition-morph-circle transition-page-flip transition-pixelate transition-slide-push transition-spin-zoom transition-split-doors transition-wipe-clock transition-zoom-out-in transition-zoom-through; do
    npm run extract -- --slug=$slug
  done
  ```

- [ ] **Step 2: Scaffold batch workspaces**
  Run:
  ```bash
  npx tsx scripts/scaffold-batch.ts
  ```

- [ ] **Step 3: Mirror Media & Sanitize & Validate**
  Run:
  ```bash
  set -a
  source /Users/tangwz/workspace/git/remotionhub/.env.local
  set +a
  for slug in transition-blinds transition-curtain transition-diagonal-wipe transition-diamond-reveal transition-fade-cross transition-film-burn transition-flash-white transition-ink-spread transition-morph-circle transition-page-flip transition-pixelate transition-slide-push transition-spin-zoom transition-split-doors transition-wipe-clock transition-zoom-out-in transition-zoom-through; do
    npm run media:mirror -- --slug=$slug
    npm run sanitize -- --slug=$slug
    npm run validate -- --slug=$slug
    npm run readme:generate -- --slug=$slug
  done
  ```

- [ ] **Step 4: Run validation tests**
  Run:
  ```bash
  npm run test
  npm run typecheck
  ```
  Expected: PASS.

- [ ] **Step 5: Commit Batch 2**
  Run:
  ```bash
  git add manifest/remotionlab-showcase.json remotion/
  git commit -m "feat: migrate transition assets"
  ```

---

## Task 8: Migrate Batch 3 (Intros & Outros - 18 slugs)

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/intro-*` (11 workspaces)
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/outro-*` (7 workspaces)

- [ ] **Step 1: Raw extraction**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub-assets
  for slug in intro-cinematic-bars intro-cinematic-text intro-countdown-3 intro-geometric intro-logo-morph intro-minimal-fade intro-news-broadcast intro-particle-burst intro-split-screen intro-typewriter intro-vhs-retro outro-comment-cta outro-credits-roll outro-end-screen outro-playlist outro-social-links outro-sponsor outro-subscribe-cta; do
    npm run extract -- --slug=$slug
  done
  ```

- [ ] **Step 2: Scaffold workspaces**
  Run:
  ```bash
  npx tsx scripts/scaffold-batch.ts
  ```

- [ ] **Step 3: Mirror Media & Sanitize & Validate**
  Run:
  ```bash
  set -a
  source /Users/tangwz/workspace/git/remotionhub/.env.local
  set +a
  for slug in intro-cinematic-bars intro-cinematic-text intro-countdown-3 intro-geometric intro-logo-morph intro-minimal-fade intro-news-broadcast intro-particle-burst intro-split-screen intro-typewriter intro-vhs-retro outro-comment-cta outro-credits-roll outro-end-screen outro-playlist outro-social-links outro-sponsor outro-subscribe-cta; do
    npm run media:mirror -- --slug=$slug
    npm run sanitize -- --slug=$slug
    npm run validate -- --slug=$slug
    npm run readme:generate -- --slug=$slug
  done
  ```

- [ ] **Step 4: Run validation tests**
  Run:
  ```bash
  npm run test
  npm run typecheck
  ```
  Expected: PASS.

- [ ] **Step 5: Commit Batch 3**
  Run:
  ```bash
  git add manifest/remotionlab-showcase.json remotion/
  git commit -m "feat: migrate intro and outro assets"
  ```

---

## Task 9: Migrate Batch 4 (Basic Data Visualizations - 10 slugs)

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/dataviz-*` (10 workspaces)

- [ ] **Step 1: Raw extraction**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub-assets
  for slug in dataviz-bar-chart dataviz-horizontal-bar dataviz-stacked-bar dataviz-line-draw dataviz-area-chart dataviz-pie-donut dataviz-progress-ring dataviz-counter-card dataviz-bubble dataviz-scatter-plot; do
    npm run extract -- --slug=$slug
  done
  ```

- [ ] **Step 2: Scaffold workspaces**
  Run:
  ```bash
  npx tsx scripts/scaffold-batch.ts
  ```

- [ ] **Step 3: Mirror Media & Sanitize & Validate**
  Run:
  ```bash
  set -a
  source /Users/tangwz/workspace/git/remotionhub/.env.local
  set +a
  for slug in dataviz-bar-chart dataviz-horizontal-bar dataviz-stacked-bar dataviz-line-draw dataviz-area-chart dataviz-pie-donut dataviz-progress-ring dataviz-counter-card dataviz-bubble dataviz-scatter-plot; do
    npm run media:mirror -- --slug=$slug
    npm run sanitize -- --slug=$slug
    npm run validate -- --slug=$slug
    npm run readme:generate -- --slug=$slug
  done
  ```

- [ ] **Step 4: Run validation tests**
  Run:
  ```bash
  npm run test
  npm run typecheck
  ```
  Expected: PASS.

- [ ] **Step 5: Commit Batch 4**
  Run:
  ```bash
  git add manifest/remotionlab-showcase.json remotion/
  git commit -m "feat: migrate basic dataviz assets"
  ```

---

## Task 10: Migrate Batch 5 (Advanced Data Visualizations - 10 slugs)

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/dataviz-*` (10 workspaces)

- [ ] **Step 1: Raw extraction**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub-assets
  for slug in dataviz-bullet dataviz-candlestick dataviz-comparison-split dataviz-funnel dataviz-gantt dataviz-heatmap dataviz-radar dataviz-sankey dataviz-treemap dataviz-waterfall; do
    npm run extract -- --slug=$slug
  done
  ```

- [ ] **Step 2: Scaffold workspaces**
  Run:
  ```bash
  npx tsx scripts/scaffold-batch.ts
  ```

- [ ] **Step 3: Mirror Media & Sanitize & Validate**
  Run:
  ```bash
  set -a
  source /Users/tangwz/workspace/git/remotionhub/.env.local
  set +a
  for slug in dataviz-bullet dataviz-candlestick dataviz-comparison-split dataviz-funnel dataviz-gantt dataviz-heatmap dataviz-radar dataviz-sankey dataviz-treemap dataviz-waterfall; do
    npm run media:mirror -- --slug=$slug
    npm run sanitize -- --slug=$slug
    npm run validate -- --slug=$slug
    npm run readme:generate -- --slug=$slug
  done
  ```

- [ ] **Step 4: Run validation tests**
  Run:
  ```bash
  npm run test
  npm run typecheck
  ```
  Expected: PASS.

- [ ] **Step 5: Commit Batch 5**
  Run:
  ```bash
  git add manifest/remotionlab-showcase.json remotion/
  git commit -m "feat: migrate advanced dataviz assets"
  ```

---

## Task 11: Migrate Batch 6 (Social Media Elements - 20 slugs)

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/social-*` (20 workspaces)

- [ ] **Step 1: Raw extraction**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub-assets
  for slug in social-app-store social-comment-wall social-facebook social-github social-ig-masonry social-ig-post social-linkedin social-notifications social-producthunt social-reddit-feed social-reddit social-stats-wall social-stories-row social-testimonial-wall social-tiktok social-trending social-twitter-feed social-twitter-quote social-youtube-feed social-yt-video; do
    npm run extract -- --slug=$slug
  done
  ```

- [ ] **Step 2: Scaffold workspaces**
  Run:
  ```bash
  npx tsx scripts/scaffold-batch.ts
  ```

- [ ] **Step 3: Mirror Media & Sanitize & Validate**
  Run:
  ```bash
  set -a
  source /Users/tangwz/workspace/git/remotionhub/.env.local
  set +a
  for slug in social-app-store social-comment-wall social-facebook social-github social-ig-masonry social-ig-post social-linkedin social-notifications social-producthunt social-reddit-feed social-reddit social-stats-wall social-stories-row social-testimonial-wall social-tiktok social-trending social-twitter-feed social-twitter-quote social-youtube-feed social-yt-video; do
    npm run media:mirror -- --slug=$slug
    npm run sanitize -- --slug=$slug
    npm run validate -- --slug=$slug
    npm run readme:generate -- --slug=$slug
  done
  ```

- [ ] **Step 4: Run validation tests**
  Run:
  ```bash
  npm run test
  npm run typecheck
  ```
  Expected: PASS.

- [ ] **Step 5: Commit Batch 6**
  Run:
  ```bash
  git add manifest/remotionlab-showcase.json remotion/
  git commit -m "feat: migrate social media assets"
  ```

---

## Task 12: Catalog Generation Script & Running Generation

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub/scripts/generate-catalog.ts`
- Create: 96 Catalog JSON files inside `/Users/tangwz/workspace/git/remotionhub/catalog/components/`

- [ ] **Step 1: Create generation script**
  Create the file `/Users/tangwz/workspace/git/remotionhub/scripts/generate-catalog.ts`:
  ```typescript
  import fs from 'node:fs/promises'
  import path from 'node:path'
  import { execFileSync } from 'node:child_process'

  const assetRepo = '/Users/tangwz/workspace/git/remotionhub-assets'
  const targetDir = 'catalog/components'

  async function getAssetCommit() {
    return execFileSync('git', ['-C', assetRepo, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  }

  function toPascalCase(slug: string) {
    return slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  }

  function toDisplayName(slug: string) {
    return slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function getCategory(slug: string): string {
    if (slug.startsWith('audio-')) return 'audio'
    if (slug.startsWith('logo-')) return 'logo'
    if (slug.startsWith('transition-')) return 'transition'
    if (slug.startsWith('intro-')) return 'intro'
    if (slug.startsWith('outro-')) return 'outro'
    if (slug.startsWith('dataviz-')) return 'dataviz'
    if (slug.startsWith('social-')) return 'social'
    return 'other'
  }

  async function readMarkdownTitle(slug: string): Promise<string> {
    const mdPath = `/tmp/remotionlab/案例/${slug}.md`
    const content = await fs.readFile(mdPath, 'utf8')
    const match = content.match(/^title:\s+"?([^"\n]+)"?$/m)
    if (!match?.[1]) {
      throw new Error(`Title not found in ${slug}.md`)
    }
    return match[1]
  }

  async function generate(slug: string, commit: string) {
    const manifestPath = path.join(assetRepo, 'remotion', slug, 'remotionhub.asset.json')
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    const titleZh = await readMarkdownTitle(slug)
    const category = getCategory(slug)
    
    const catalog = {
      publisher: 'remotionlab',
      runtime: 'remotion',
      slug,
      displayName: toDisplayName(slug),
      displayNameZh: titleZh,
      summary: `${toDisplayName(slug)} component for Remotion.`,
      summaryZh: `适用于 Remotion 的${titleZh}组件。`,
      categories: [category],
      tags: ['remotion', category, ...slug.split('-').slice(1)],
      status: 'published',
      versions: [
        {
          version: '1.0.0',
          changelog: 'Initial migrated release.',
          preview: {
            thumbnailUrl: manifest.thumbnailUrl,
            previewVideoUrl: manifest.previewUrl,
            demoUrl: manifest.sourceUrl,
          },
          metadata: {
            runtime: 'remotion',
            entryPoint: manifest.entryPoint,
            aspectRatios: manifest.aspectRatios,
            durationFrames: manifest.durationFrames,
            fps: manifest.fps,
          },
          tags: [category, ...slug.split('-').slice(1)],
          artifact: {
            kind: 'github-source',
            githubSource: {
              repo: 'remotionhub/remotionhub-assets',
              ref: 'main',
              commit,
              path: `remotion/${slug}`,
            },
            license: manifest.license,
            usageMarkdown: `Copy \`remotion/${slug}/src/${toPascalCase(slug)}.tsx\` into your Remotion project, import \`${toPascalCase(slug)}\` and \`${toPascalCase(slug).charAt(0).toLowerCase() + toPascalCase(slug).slice(1)}DefaultProps\`, then register the composition.`,
            agentPrompt: `Add the ${toDisplayName(slug)} Remotion asset from remotionhub/remotionhub-assets at remotion/${slug} to my project. Preserve the exported ${toPascalCase(slug)}Props API and register the ${toPascalCase(slug)} composition with the default props.`,
          },
        },
      ],
    }
    
    const outputPath = path.join(targetDir, `${slug}.json`)
    await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
    console.log(`Generated ${outputPath} at commit ${commit}`)
  }

  async function main() {
    const commit = await getAssetCommit()
    const slugs = process.argv.slice(2)
    if (slugs.length === 0) {
      console.error('Please specify slugs to generate.')
      process.exit(1)
    }
    
    for (const slug of slugs) {
      await generate(slug, commit)
    }
  }

  main().catch(console.error)
  ```

- [ ] **Step 2: Run generation script for all 96 slugs**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  npx tsx scripts/generate-catalog.ts audio-bar-spectrum audio-circle-viz audio-pulse-ring audio-vinyl-record audio-waveform logo-badge-unfold logo-block-build logo-brand-kit logo-emblem logo-glow-pulse logo-hologram logo-icon-reveal logo-line-draw logo-minimal-dot logo-negative-reveal logo-orbit-reveal logo-pin-drop logo-ring-focus logo-shield-crest logo-stamp-reveal logo-triangle-form transition-blinds transition-curtain transition-diagonal-wipe transition-diamond-reveal transition-fade-cross transition-film-burn transition-flash-white transition-ink-spread transition-morph-circle transition-page-flip transition-pixelate transition-slide-push transition-spin-zoom transition-split-doors transition-wipe-clock transition-zoom-out-in transition-zoom-through intro-cinematic-bars intro-cinematic-text intro-countdown-3 intro-geometric intro-logo-morph intro-minimal-fade intro-news-broadcast intro-particle-burst intro-split-screen intro-typewriter intro-vhs-retro outro-comment-cta outro-credits-roll outro-end-screen outro-playlist outro-social-links outro-sponsor outro-subscribe-cta dataviz-bar-chart dataviz-horizontal-bar dataviz-stacked-bar dataviz-line-draw dataviz-area-chart dataviz-pie-donut dataviz-progress-ring dataviz-counter-card dataviz-bubble dataviz-scatter-plot dataviz-bullet dataviz-candlestick dataviz-comparison-split dataviz-funnel dataviz-gantt dataviz-heatmap dataviz-radar dataviz-sankey dataviz-treemap dataviz-waterfall social-app-store social-comment-wall social-facebook social-github social-ig-masonry social-ig-post social-linkedin social-notifications social-producthunt social-reddit-feed social-reddit social-stats-wall social-stories-row social-testimonial-wall social-tiktok social-trending social-twitter-feed social-twitter-quote social-youtube-feed social-yt-video
  ```
  Expected: 96 JSON files generated in `catalog/components/`.

- [ ] **Step 3: Validate generated catalogs**
  Run:
  ```bash
  npm run catalog:validate
  ```
  Expected: Validated successfully.

- [ ] **Step 4: Commit generated catalogs**
  Run:
  ```bash
  git add catalog/components/ scripts/generate-catalog.ts
  git commit -m "feat: generate catalog entries for 96 batch 3 components"
  ```

---

## Task 13: Convex Catalog Import & Manual Verification

**Files:**
- None

- [ ] **Step 1: Run local Convex import**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  npm run catalog:import -- --apply
  ```
  Expected: All 150 components validated and imported successfully into local Convex.

- [ ] **Step 2: Start local server**
  Run:
  ```bash
  npm run dev
  ```
  Expected: Local server starts at `http://localhost:3000`.

- [ ] **Step 3: Browser preview check**
  Open local browser and visit Details pages for at least one component from each category batch:
  - `http://localhost:3000/remotion/remotionlab/audio-bar-spectrum`
  - `http://localhost:3000/remotion/remotionlab/logo-badge-unfold`
  - `http://localhost:3000/remotion/remotionlab/transition-blinds`
  - `http://localhost:3000/remotion/remotionlab/intro-cinematic-bars`
  - `http://localhost:3000/remotion/remotionlab/dataviz-area-chart`
  - `http://localhost:3000/remotion/remotionlab/social-ig-post`
  Verify video preview, thumbnail renders, Chinese display names display by default, toggle locale to `EN` and verify names switch to English.
