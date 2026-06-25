# RemotionHub Final Batch Assets Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 迁移 `/tmp/remotionlab/案例` 中剩下的 113 个以 `yt-` 开头的组件到 `remotionhub-assets`（保留繁体中文），并在主站主页和分类目录中以全新的 `animation` (动画) 分类呈现，添加完整的出处与版权标识。

**Architecture:** 主站主页和分类过滤器的 i18n 字典中注册 `animation` 分类；主仓库脚本支持将 `yt-` 开头的资产归入该分类。资产清单 (Manifest) 中扩展 `displayNameZh` 以在生成 `README.md` 时展示原有的繁体中文标题，并规范输出 `Attribution Note` 和 `LICENSE` 声明。

**Tech Stack:** TypeScript, React, Remotion, Convex, npm workspaces, ali-oss, Vitest, Zod.

---

## Scope Check

本计划实现 `specs/2026-06-23-remotionhub-final-batch-assets-migration.md` 中的设计规范。共包含 113 个 `yt-` 开头的组件的迁移（分 5 个 Batch 执行）：

* **Batch 1 (AI & Dev - 23个)**: `yt-ai-not-understand`, `yt-ai-reads-only`, `yt-ai-report-doubt`, `yt-ai-skill-network`, `yt-ai-use-cases`, `yt-ai-wrappers-dead`, `yt-dev-flow-intro`, `yt-dev-flow-steps`, `yt-cloudflare-api-key`, `yt-deploy-cloudflare`, `yt-mcp-chapter-card`, `yt-mcp-pipeline`, `yt-prompt-dev`, `yt-prompt-spec`, `yt-shadcn-prompt`, `yt-shadcn-results`, `yt-code-controls`, `yt-from-scratch`, `yt-extract-tool`, `yt-four-ai-tools`, `yt-idea-check`, `yt-idea-feasibility`, `yt-generic-chatbot`
* **Batch 2 (Audio & Game - 23个)**: `yt-audio-add-vocals`, `yt-audio-complex-pop-question`, `yt-audio-control`, `yt-audio-fast-results`, `yt-audio-lets-start`, `yt-audio-prompt-skill`, `yt-audio-rock-remix`, `yt-audio-software-criteria`, `yt-arcade-beat-em-up`, `yt-char-animations`, `yt-game-mashup`, `yt-bug-fix-loop`, `yt-build-stability`, `yt-can-do-animation`, `yt-execute-validate`, `yt-iterate-two-days`, `yt-no-3d-needed`, `yt-not-just-effects`, `yt-solve-first-point`, `yt-start-small`, `yt-three-dimensions`, `yt-tool-selection`, `yt-tool-showcase`
* **Batch 3 (Growth & Marketing - 23个)**: `yt-acq-ret-ref`, `yt-brand-value-stripped`, `yt-build-trust-first`, `yt-distribution-first`, `yt-distribution-hard`, `yt-easy-channel-hard-dist`, `yt-equity-design`, `yt-first-deal-hard`, `yt-focus-one-topic`, `yt-reach-pain-points`, `yt-rejected-ideas`, `yt-service-first`, `yt-start-with-service`, `yt-success-path`, `yt-think-distribution`, `yt-trust-is-currency`, `yt-trust-transfer`, `yt-zero-revenue`, `yt-influencer-dms`, `yt-inside-the-problem`, `yt-manual-first`, `yt-not-about-analysis`, `yt-not-that-simple`
* **Batch 4 (Web & Metrics - 22个)**: `yt-magazine-layout`, `yt-mobile-patience`, `yt-narrative-redesign`, `yt-page-scroll-metrics`, `yt-shortest-path`, `yt-svg-cards`, `yt-growth-24`, `yt-simple-ai-product`, `yt-solve-first-point`, `yt-tailor-for-audience`, `yt-tech-boosts-stability`, `yt-three-questions`, `yt-too-many-coincidences`, `yt-two-errors-detail`, `yt-two-focus`, `yt-two-lessons`, `yt-user-iterate`, `yt-version-2-card`, `yt-version-3-card`, `yt-generic-means-lacking`, `yt-consistent-output`, `yt-core-dist-card`
* **Batch 5 (Outros & General - 22个)**: `yt-connection-recap-outro`, `yt-like-subscribe-bell`, `yt-pencil-intro`, `yt-core-flow`, `yt-first-version`, `yt-line-phase-intro`, `yt-near-self-friends`, `yt-mid-ask-experts`, `yt-far-strangers`, `yt-far-stranger-pains`, `yt-far-to-near`, `yt-four-ai-tools`, `yt-game-mashup`, `yt-generic-chatbot`, `yt-generic-means-lacking`, `yt-growth-24`, `yt-idea-check`, `yt-idea-feasibility`, `yt-influencer-dms`, `yt-inside-the-problem`, `yt-iterate-two-days`, `yt-skill-showcase`

---

## File Structure

`/Users/tangwz/workspace/git/remotionhub`:
* **Modify**: `src/lib/i18n.ts` - 在 `zhDictionary` 和 `enDictionary` 中注册 `animation` 分类翻译。
* **Modify**: `scripts/generate-catalog.ts` - 增加匹配 `yt-` 属性前缀分类为 `animation`，并读取 manifest 中的 `displayNameZh` 作为中文标题。
* **Create**: 113 个 Catalog JSON 配置文件落于 `catalog/components/` 下。

`/Users/tangwz/workspace/git/remotionhub-assets`:
* **Modify**: `scripts/lib/assetManifest.ts` - 扩展 manifest 校验 schema 支持可选的 `displayNameZh` 字段。
* **Modify**: `scripts/extract-case.ts` - 增加提取 markdown title 写入 manifest 的逻辑。
* **Modify**: `scripts/generate-readme.ts` - 调整 `README.md` 的标题头和出处注解（Attribution Note）输出。
* **Modify**: `manifest/remotionlab-showcase.json` - 追踪新组件迁移状态。
* **Create**: 113 个资产 workspaces 落于 `remotion/` 下。

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
  Expected: Both working directories are clean.

- [ ] **Step 2: Create execution branches**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  git switch -c feat/animation-category-i18n
  cd /Users/tangwz/workspace/git/remotionhub-assets
  git switch -c feat/migrate-yt-animation-assets
  ```
  Expected: Both repositories are now on their respective new branches.

---

## Task 2: Main Repo i18n & Category Configurations

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub/src/lib/i18n.ts`
- Modify: `/Users/tangwz/workspace/git/remotionhub/scripts/generate-catalog.ts`

- [ ] **Step 1: Add animation category translations**
  Modify `/Users/tangwz/workspace/git/remotionhub/src/lib/i18n.ts`.
  In `zhDictionary` (around line 36):
  ```typescript
    'category.logo': 'logo 动画',
    'category.audio': '音频视觉化',
    'category.animation': '动画',
  ```
  In `enDictionary` (around line 101):
  ```typescript
    'category.logo': 'Logo Animation',
    'category.audio': 'Audio Visualization',
    'category.animation': 'Animation',
  ```

- [ ] **Step 2: Map yt- slugs to animation category**
  Modify `/Users/tangwz/workspace/git/remotionhub/scripts/generate-catalog.ts`.
  Update `getCategory` (around line 49):
  ```typescript
  function getCategory(slug: string): string {
    if (slug.startsWith('audio-')) return 'audio'
    if (slug.startsWith('logo-')) return 'logo'
    if (slug.startsWith('transition-')) return 'transition'
    if (slug.startsWith('intro-')) return 'intro'
    if (slug.startsWith('outro-')) return 'outro'
    if (slug.startsWith('dataviz-')) return 'dataviz'
    if (slug.startsWith('social-')) return 'social'
    if (slug.startsWith('yt-')) return 'animation'
    return 'other'
  }
  ```

- [ ] **Step 3: Update catalog generation metadata**
  Modify `/Users/tangwz/workspace/git/remotionhub/scripts/generate-catalog.ts`.
  In `generate` function (around line 69), change `displayNameZh` and `summaryZh` mappings to use the manifest values if available:
  ```typescript
    const titleZh = manifest.displayNameZh ?? (await readMarkdownTitle(slug))
    const category = getCategory(slug)
  ```

- [ ] **Step 4: Verify main repo types**
  Run:
  ```bash
  npm run typecheck
  ```
  Expected: Success without any errors.

---

## Task 3: Assets Manifest Schema & Extraction Integration

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/assetManifest.ts`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/extract-case.ts`

- [ ] **Step 1: Extend asset manifest schemas**
  Modify `/Users/tangwz/workspace/git/remotionhub-assets/scripts/lib/assetManifest.ts`.
  In `assetManifestSchema` (around line 45) and `draftAssetManifestSchema` (around line 75):
  ```typescript
    displayName: z.string().min(1),
    displayNameZh: z.string().min(1).optional(),
    runtime: z.literal('remotion'),
  ```

- [ ] **Step 2: Save Chinese title in extract script**
  Modify `/Users/tangwz/workspace/git/remotionhub-assets/scripts/extract-case.ts`.
  In `runExtraction` (around line 383), set the `displayNameZh` property in `draftManifest`:
  ```typescript
    const draftManifest: DraftAssetManifest = {
      slug: parsed.slug,
      displayName,
      displayNameZh: parsed.title,
      runtime: 'remotion',
      // ...
  ```

- [ ] **Step 3: Add new slugs to supported whitelist**
  Ensure all 113 `yt-` slugs are correctly Whitelisted in the `SUPPORTED_SLUGS` Set in `/Users/tangwz/workspace/git/remotionhub-assets/scripts/extract-case.ts` and `scaffold-batch.ts`.
  *(Check if they are already present as verified during brainstorming. If not, add them).*

- [ ] **Step 4: Verify assets tests**
  Run:
  ```bash
  npm run test
  ```
  Expected: Tests pass.

---

## Task 4: Generate README & LICENSE Templates

**Files:**
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/scripts/generate-readme.ts`

- [ ] **Step 1: Generate README with title & attribution note**
  Modify `/Users/tangwz/workspace/git/remotionhub-assets/scripts/generate-readme.ts` (around line 27):
  ```typescript
    const titleHeader = manifest.displayNameZh
      ? `# ${manifest.displayNameZh} (${manifest.displayName})`
      : `# ${manifest.displayName}`

    const readme = `${titleHeader}

  > **Attribution Note**: This component is migrated from the original template on [remotionlab.com](https://remotionlab.com/showcase/${manifest.slug}). Credit goes to the original creator at remotionlab.

  ![Preview](${manifest.thumbnailUrl})

  Reusable Remotion component migrated from ${manifest.sourceUrl}.

  // ... (rest of usage, props, prompt, links unchanged)
  `
  ```

- [ ] **Step 2: Check README layout tests**
  Run:
  ```bash
  npm run format:check
  ```
  Expected: Passed.

---

## Task 5: Scaffold and Migrate Assets in Batches

**Files:**
- Create: Component packages under `/Users/tangwz/workspace/git/remotionhub-assets/remotion/yt-*`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`

- [ ] **Step 1: Initialize manifest case list**
  Ensure all 113 `yt-` slugs exist in `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json` with status `"pending"`.
  *(Run a quick check of the manifest. If they are missing, append them as `"status": "pending"`).*

- [ ] **Step 2: Run batch extraction & sanitization**
  For each batch:
  1. Extract and scaffold components:
     ```bash
     # Example for single slug
     npm run extract -- --slug=yt-like-subscribe-bell
     npm run sanitize -- --slug=yt-like-subscribe-bell
     ```
  2. Upload/Mirror original R2 preview and thumbnail media to AliOSS:
     ```bash
     set -a
     source /Users/tangwz/workspace/git/remotionhub/.env.local
     set +a
     npm run media:mirror -- --slug=yt-like-subscribe-bell
     ```
  3. Validate and Generate README:
     ```bash
     npm run validate -- --slug=yt-like-subscribe-bell
     npm run readme:generate -- --slug=yt-like-subscribe-bell
     ```
  4. Ensure `LICENSE` in `/Users/tangwz/workspace/git/remotionhub-assets/remotion/<slug>/LICENSE` has the correct copyright:
     ```text
     Copyright (c) 2026 remotionlab (https://remotionlab.com)
     ```
  5. Check assets quality and commit:
     ```bash
     git add .
     git commit -m "feat: migrate <batch-name> assets"
     ```

---

## Task 6: Import Catalog in Main Repository

**Files:**
- Create: Catalog components JSON under `/Users/tangwz/workspace/git/remotionhub/catalog/components/yt-*`

- [ ] **Step 1: Generate Catalog JSON entries**
  Run:
  ```bash
  cd /Users/tangwz/workspace/git/remotionhub
  npm run generate-catalog -- <list-of-all-113-yt-slugs>
  ```
  Expected: JSON files generated under `catalog/components/yt-*.json` mapping category to `animation`.

- [ ] **Step 2: Run catalog validations**
  Run:
  ```bash
  npm run catalog:validate
  ```
  Expected: Verification successful.

- [ ] **Step 3: Run catalog import to local Convex**
  Run:
  ```bash
  set -a
  source .env.local
  set +a
  npx tsx scripts/import-catalog.ts --apply
  ```
  Expected: Components successfully uploaded/patched on local Convex db.

---

## Task 7: Verification and Manual Check

**Files:**
- None

- [ ] **Step 1: Run unit tests**
  Run:
  ```bash
  npm run test
  ```
  Expected: All unit tests pass.

- [ ] **Step 2: Run dev server**
  Run:
  ```bash
  npm run dev
  ```
  Expected: Server starts at `http://localhost:3000`.

- [ ] **Step 3: Manual browser check**
  Open `http://localhost:3000/` and verify:
  1. The new "动画" category option appears in filters.
  2. Clicking "动画" displays the migrated `yt-` components.
  3. Clicking a card displays details with:
     - Traditional Chinese title & summary.
     - License showing copyright to `remotionlab`.
     - Output video playing successfully.
