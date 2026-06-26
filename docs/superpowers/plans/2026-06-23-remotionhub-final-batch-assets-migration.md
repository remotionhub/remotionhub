# RemotionHub Final Batch Assets Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 迁移 `/tmp/remotionlab/案例` 中剩下的 113 个以 `yt-` 开头的组件到 `remotionhub-assets`（保留繁体中文），并在主站主页和分类目录中以全新的 `animation` (动画) 分类呈现，添加完整的出处与版权标识。

**Architecture:** 主站主页和分类过滤器的 i18n 字典中注册 `animation` 分类；主仓库脚本支持将 `yt-` 开头的资产归入该分类。资产清单 (Manifest) 中扩展 `displayNameZh` 以在生成 `README.md` 时展示原有的繁体中文标题，并规范输出 `Attribution Note` 和 `LICENSE` 声明。

**Tech Stack:** TypeScript, React, Remotion, Convex, npm workspaces, ali-oss, Vitest, Zod.

---

## Scope Check

本计划是早期执行计划，保留用于说明迁移背景，不再作为可执行 slug 清单使用。后续修复发现旧 batch 划分存在重复与遗漏；新的生成、校验或回滚必须以以下 canonical source 为准：

- `specs/2026-06-25-remotionhub-yt-assets-migration-repair.md`
- `catalog/components/yt-*.json`
- `remotionhub-assets/manifest/yt-animation-slugs.json`

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
