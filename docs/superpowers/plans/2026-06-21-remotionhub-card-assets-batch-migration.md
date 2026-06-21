# RemotionHub Card Assets Batch Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 迁移 `/tmp/remotionlab/案例` 中剩余 22 个字卡类 Remotion 素材，并让它们在 `remotionhub-assets` 中可验证、在 RemotionHub catalog 中可访问、在真实浏览器中可预览。

**Architecture:** `remotionhub-assets` 继续作为素材源码和媒体 manifest 的 canonical repo；`remotionhub` 只保存 catalog JSON、导入逻辑和页面展示。执行按 4 个 batch 迁移资产源码和 OSS 媒体，随后统一生成 catalog，并由主 Agent 做最终网页验收。

**Tech Stack:** TypeScript, React, Remotion, npm workspaces, ali-oss, Vitest, RemotionHub catalog JSON, Convex catalog import, TanStack Start.

---

## Scope Check

本计划实现 `specs/2026-06-21-remotionhub-card-assets-batch-migration.md`。范围只包含以下 22 个 slug：

```text
card-elastic
card-from-left
card-from-right
card-from-top
card-glass
card-outline
card-scale
card-split
card-stagger
card-top-left
card-top-right
card-two-tone
card-typewriter
card-wipe
lower-third-box-pop
lower-third-callout
lower-third-gradient-bar
lower-third-line-expand
lower-third-minimal
lower-third-news
lower-third-slide
lower-third-social
```

本计划不实现 CLI，不迁移 `title-*`、`subtitle-*`、`social-*`，不重写 `card-avatar`。

## File Structure

`/Users/tangwz/workspace/git/remotionhub-assets`:

- Modify: `manifest/remotionlab-showcase.json` — 记录 22 个目标 slug 的迁移状态。
- Create: `remotion/card-elastic/**` — `card-elastic` asset workspace。
- Create: `remotion/card-from-left/**` — `card-from-left` asset workspace。
- Create: `remotion/card-from-right/**` — `card-from-right` asset workspace。
- Create: `remotion/card-from-top/**` — `card-from-top` asset workspace。
- Create: `remotion/card-glass/**` — `card-glass` asset workspace。
- Create: `remotion/card-outline/**` — `card-outline` asset workspace。
- Create: `remotion/card-scale/**` — `card-scale` asset workspace。
- Create: `remotion/card-split/**` — `card-split` asset workspace。
- Create: `remotion/card-stagger/**` — `card-stagger` asset workspace。
- Create: `remotion/card-top-left/**` — `card-top-left` asset workspace。
- Create: `remotion/card-top-right/**` — `card-top-right` asset workspace。
- Create: `remotion/card-two-tone/**` — `card-two-tone` asset workspace。
- Create: `remotion/card-typewriter/**` — `card-typewriter` asset workspace。
- Create: `remotion/card-wipe/**` — `card-wipe` asset workspace。
- Create: `remotion/lower-third-box-pop/**` — `lower-third-box-pop` asset workspace。
- Create: `remotion/lower-third-callout/**` — `lower-third-callout` asset workspace。
- Create: `remotion/lower-third-gradient-bar/**` — `lower-third-gradient-bar` asset workspace。
- Create: `remotion/lower-third-line-expand/**` — `lower-third-line-expand` asset workspace。
- Create: `remotion/lower-third-minimal/**` — `lower-third-minimal` asset workspace。
- Create: `remotion/lower-third-news/**` — `lower-third-news` asset workspace。
- Create: `remotion/lower-third-slide/**` — `lower-third-slide` asset workspace。
- Create: `remotion/lower-third-social/**` — `lower-third-social` asset workspace。

Each asset workspace must contain these files:

```text
LICENSE
README.md
package.json
remotion.config.ts
remotionhub.asset.draft.json
remotionhub.asset.json
source.raw.tsx
src/Root.tsx
src/index.ts
```

The component source file name must be the PascalCase component from the batch component map, for example `src/CardFromLeft.tsx` for `card-from-left` and `src/LowerThirdNews.tsx` for `lower-third-news`.

`/Users/tangwz/workspace/git/remotionhub`:

- Create: `catalog/components/card-elastic.json`
- Create: `catalog/components/card-from-left.json`
- Create: `catalog/components/card-from-right.json`
- Create: `catalog/components/card-from-top.json`
- Create: `catalog/components/card-glass.json`
- Create: `catalog/components/card-outline.json`
- Create: `catalog/components/card-scale.json`
- Create: `catalog/components/card-split.json`
- Create: `catalog/components/card-stagger.json`
- Create: `catalog/components/card-top-left.json`
- Create: `catalog/components/card-top-right.json`
- Create: `catalog/components/card-two-tone.json`
- Create: `catalog/components/card-typewriter.json`
- Create: `catalog/components/card-wipe.json`
- Create: `catalog/components/lower-third-box-pop.json`
- Create: `catalog/components/lower-third-callout.json`
- Create: `catalog/components/lower-third-gradient-bar.json`
- Create: `catalog/components/lower-third-line-expand.json`
- Create: `catalog/components/lower-third-minimal.json`
- Create: `catalog/components/lower-third-news.json`
- Create: `catalog/components/lower-third-slide.json`
- Create: `catalog/components/lower-third-social.json`

## Execution Rules

- 真正执行本计划前，先使用 `superpowers:using-git-worktrees` 创建隔离 worktree。
- 两个 repo 使用同名执行分支：`codex/card-assets-batch-migration`。
- 每个 batch 的资产迁移在 `remotionhub-assets` 中单独提交。
- catalog 汇总在 `remotionhub` 中单独提交。
- 任何 slug 如果不能通过 render 或媒体镜像，记录为 `blocked`，不要伪装成 `validated`。
- 执行 Agent 不能修改主站页面、Convex schema、`card-avatar`，也不能迁移本计划以外的素材。

## Task 1: Prepare Batch Workspace

**Files:**
- Read: `/Users/tangwz/workspace/git/remotionhub/specs/2026-06-21-remotionhub-card-assets-batch-migration.md`
- Read: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/remotionhub.asset.json`
- Read: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/src/CardAvatar.tsx`
- Read: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-avatar/src/Root.tsx`
- Read: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-avatar.json`

- [ ] **Step 1: Confirm repository state**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
git status --short --branch
git remote -v
cd /Users/tangwz/workspace/git/remotionhub-assets
git status --short --branch
git remote -v
```

Expected:

```text
Both repositories are clean before migration starts.
remotionhub origin points to remotionhub/remotionhub.
remotionhub-assets origin points to remotionhub/remotionhub-assets.
```

- [ ] **Step 2: Create execution branches**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
git switch -c codex/card-assets-batch-migration
cd /Users/tangwz/workspace/git/remotionhub-assets
git switch -c codex/card-assets-batch-migration
```

Expected:

```text
Both repositories are on branch codex/card-assets-batch-migration.
```

- [ ] **Step 3: Verify the source archive contains every target slug**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
for slug in card-elastic card-from-left card-from-right card-from-top card-glass card-outline card-scale card-split card-stagger card-top-left card-top-right card-two-tone card-typewriter card-wipe lower-third-box-pop lower-third-callout lower-third-gradient-bar lower-third-line-expand lower-third-minimal lower-third-news lower-third-slide lower-third-social; do
  test -f "/tmp/remotionlab/案例/$slug.md" && echo "found $slug"
done
```

Expected:

```text
found card-elastic
found card-from-left
found card-from-right
found card-from-top
found card-glass
found card-outline
found card-scale
found card-split
found card-stagger
found card-top-left
found card-top-right
found card-two-tone
found card-typewriter
found card-wipe
found lower-third-box-pop
found lower-third-callout
found lower-third-gradient-bar
found lower-third-line-expand
found lower-third-minimal
found lower-third-news
found lower-third-slide
found lower-third-social
```

- [ ] **Step 4: Verify baseline assets checks pass**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run test
npm run typecheck
npm run format:check
```

Expected:

```text
Vitest passes.
TypeScript exits with code 0.
Prettier check exits with code 0.
```

- [ ] **Step 5: Verify baseline catalog checks pass**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

Expected:

```text
Catalog validation exits with code 0.
Vitest reports 2 test files passed.
```

## Task 2: Migrate Batch 1 Directional Cards

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-left/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-right/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-top/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-left/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-right/**`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`

**Component Map:**

```text
card-from-left -> CardFromLeft
card-from-right -> CardFromRight
card-from-top -> CardFromTop
card-top-left -> CardTopLeft
card-top-right -> CardTopRight
```

- [ ] **Step 1: Extract all five source cases**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run extract -- --slug=card-from-left
npm run extract -- --slug=card-from-right
npm run extract -- --slug=card-from-top
npm run extract -- --slug=card-top-left
npm run extract -- --slug=card-top-right
```

Expected:

```text
Extracted card-from-left to remotion/card-from-left.
Extracted card-from-right to remotion/card-from-right.
Extracted card-from-top to remotion/card-from-top.
Extracted card-top-left to remotion/card-top-left.
Extracted card-top-right to remotion/card-top-right.
```

- [ ] **Step 2: Create final asset files for `card-from-left`**

Create these exact files:

```text
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-left/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-left/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-left/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-left/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-left/src/CardFromLeft.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-left/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-left/src/index.ts
```

Required exported API:

```ts
export type CardFromLeftProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}

export const cardFromLeftDefaultProps: CardFromLeftProps = {
  name: 'Jane Smith',
  title: 'Creative Director',
  accentColor: '#ef4444',
  titleColor: '#fca5a5',
  cardBackgroundColor: 'rgba(15,23,42,0.92)',
  animationStiffness: 140,
}
```

Required Remotion composition:

```tsx
<Composition
  id="CardFromLeft"
  component={CardFromLeft}
  durationInFrames={120}
  fps={30}
  width={1920}
  height={1080}
  defaultProps={cardFromLeftDefaultProps}
/>
```

- [ ] **Step 3: Create final asset files for `card-from-right`**

Create these exact files:

```text
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-right/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-right/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-right/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-right/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-right/src/CardFromRight.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-right/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-right/src/index.ts
```

Required exported API:

```ts
export type CardFromRightProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}

export const cardFromRightDefaultProps: CardFromRightProps = {
  name: 'Alex Johnson',
  title: 'Lead Engineer',
  accentColor: '#f97316',
  titleColor: '#fdba74',
  cardBackgroundColor: 'rgba(15,23,42,0.92)',
  animationStiffness: 140,
}
```

Required Remotion composition:

```tsx
<Composition
  id="CardFromRight"
  component={CardFromRight}
  durationInFrames={120}
  fps={30}
  width={1920}
  height={1080}
  defaultProps={cardFromRightDefaultProps}
/>
```

- [ ] **Step 4: Create final asset files for `card-from-top`**

Create these exact files:

```text
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-top/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-top/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-top/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-top/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-top/src/CardFromTop.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-top/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-from-top/src/index.ts
```

Required exported API:

```ts
export type CardFromTopProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}

export const cardFromTopDefaultProps: CardFromTopProps = {
  name: 'Maria Chen',
  title: 'Motion Designer',
  accentColor: '#f59e0b',
  titleColor: '#fde68a',
  cardBackgroundColor: 'rgba(15,23,42,0.92)',
  animationStiffness: 140,
}
```

Required Remotion composition:

```tsx
<Composition
  id="CardFromTop"
  component={CardFromTop}
  durationInFrames={120}
  fps={30}
  width={1920}
  height={1080}
  defaultProps={cardFromTopDefaultProps}
/>
```

- [ ] **Step 5: Create final asset files for `card-top-left`**

Create these exact files:

```text
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-left/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-left/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-left/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-left/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-left/src/CardTopLeft.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-left/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-left/src/index.ts
```

Required exported API:

```ts
export type CardTopLeftProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}
```

Use the default values from `/tmp/remotionlab/案例/card-top-left.md`, not from another slug.

- [ ] **Step 6: Create final asset files for `card-top-right`**

Create these exact files:

```text
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-right/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-right/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-right/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-right/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-right/src/CardTopRight.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-right/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-top-right/src/index.ts
```

Required exported API:

```ts
export type CardTopRightProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}
```

Use the default values from `/tmp/remotionlab/案例/card-top-right.md`, not from another slug.

- [ ] **Step 7: Mirror media for Batch 1**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
set -a
source /Users/tangwz/workspace/git/remotionhub/.env.local
set +a
npm run media:mirror -- --slug=card-from-left
npm run media:mirror -- --slug=card-from-right
npm run media:mirror -- --slug=card-from-top
npm run media:mirror -- --slug=card-top-left
npm run media:mirror -- --slug=card-top-right
```

Expected:

```text
Each command writes OSS previewUrl and thumbnailUrl into the corresponding remotionhub.asset.json.
Each matching inventory entry moves to media-mirrored or a later valid state.
```

- [ ] **Step 8: Generate README files for Batch 1**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run readme:generate -- --slug=card-from-left
npm run readme:generate -- --slug=card-from-right
npm run readme:generate -- --slug=card-from-top
npm run readme:generate -- --slug=card-top-left
npm run readme:generate -- --slug=card-top-right
```

Expected:

```text
Each README contains ## Props and ## Agent Prompt.
Each README preview image uses remotionhub.oss-cn-shenzhen.aliyuncs.com.
```

- [ ] **Step 9: Validate each Batch 1 slug**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run validate -- --slug=card-from-left
npm run validate -- --slug=card-from-right
npm run validate -- --slug=card-from-top
npm run validate -- --slug=card-top-left
npm run validate -- --slug=card-top-right
```

Expected:

```text
Validated card-from-left: validated.
Validated card-from-right: validated.
Validated card-from-top: validated.
Validated card-top-left: validated.
Validated card-top-right: validated.
```

- [ ] **Step 10: Run batch-level assets checks**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run test
npm run typecheck
npm run format:check
```

Expected:

```text
Vitest passes.
TypeScript exits with code 0.
Prettier check exits with code 0.
```

- [ ] **Step 11: Commit Batch 1**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git status --short
git add manifest/remotionlab-showcase.json remotion/card-from-left remotion/card-from-right remotion/card-from-top remotion/card-top-left remotion/card-top-right
git commit -m "feat: migrate directional card assets"
```

Expected:

```text
Commit includes only Batch 1 asset files and inventory changes.
```

## Task 3: Migrate Batch 2 Simple Card Effects

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-scale/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-stagger/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-wipe/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-outline/**`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`

**Component Map:**

```text
card-elastic -> CardElastic
card-scale -> CardScale
card-stagger -> CardStagger
card-wipe -> CardWipe
card-outline -> CardOutline
```

- [ ] **Step 1: Extract all five source cases**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run extract -- --slug=card-elastic
npm run extract -- --slug=card-scale
npm run extract -- --slug=card-stagger
npm run extract -- --slug=card-wipe
npm run extract -- --slug=card-outline
```

Expected:

```text
Extracted card-elastic to remotion/card-elastic.
Extracted card-scale to remotion/card-scale.
Extracted card-stagger to remotion/card-stagger.
Extracted card-wipe to remotion/card-wipe.
Extracted card-outline to remotion/card-outline.
```

- [ ] **Step 2: Build reusable props for every Batch 2 component**

For each component, export the named props type and default props shown below. Use the original source Markdown as the visual reference for fields not listed in the prompt.

```ts
export type CardElasticProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}

export type CardScaleProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}

export type CardStaggerProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}

export type CardWipeProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  wipeDurationFrames: number
}

export type CardOutlineProps = {
  name: string
  title: string
  outlineColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}
```

- [ ] **Step 3: Create final workspace files for Batch 2**

Create these files for each slug:

```text
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/src/CardElastic.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-scale/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-scale/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-scale/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-scale/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-scale/src/CardScale.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-scale/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-scale/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-stagger/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-stagger/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-stagger/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-stagger/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-stagger/src/CardStagger.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-stagger/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-stagger/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-wipe/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-wipe/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-wipe/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-wipe/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-wipe/src/CardWipe.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-wipe/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-wipe/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-outline/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-outline/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-outline/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-outline/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-outline/src/CardOutline.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-outline/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-outline/src/index.ts
```

- [ ] **Step 4: Mirror, generate README, and validate Batch 2**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
set -a
source /Users/tangwz/workspace/git/remotionhub/.env.local
set +a
for slug in card-elastic card-scale card-stagger card-wipe card-outline; do npm run media:mirror -- --slug=$slug; done
for slug in card-elastic card-scale card-stagger card-wipe card-outline; do npm run readme:generate -- --slug=$slug; done
for slug in card-elastic card-scale card-stagger card-wipe card-outline; do npm run validate -- --slug=$slug; done
npm run test
npm run typecheck
npm run format:check
```

Expected:

```text
Validated card-elastic: validated.
Validated card-scale: validated.
Validated card-stagger: validated.
Validated card-wipe: validated.
Validated card-outline: validated.
Vitest passes.
TypeScript exits with code 0.
Prettier check exits with code 0.
```

- [ ] **Step 5: Commit Batch 2**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git add manifest/remotionlab-showcase.json remotion/card-elastic remotion/card-scale remotion/card-stagger remotion/card-wipe remotion/card-outline
git commit -m "feat: migrate simple card assets"
```

Expected:

```text
Commit includes only Batch 2 asset files and inventory changes.
```

## Task 4: Migrate Batch 3 Richer Card Effects

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-glass/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-split/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-two-tone/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-typewriter/**`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`

**Component Map:**

```text
card-glass -> CardGlass
card-split -> CardSplit
card-two-tone -> CardTwoTone
card-typewriter -> CardTypewriter
```

- [ ] **Step 1: Extract all four source cases**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run extract -- --slug=card-glass
npm run extract -- --slug=card-split
npm run extract -- --slug=card-two-tone
npm run extract -- --slug=card-typewriter
```

Expected:

```text
Extracted card-glass to remotion/card-glass.
Extracted card-split to remotion/card-split.
Extracted card-two-tone to remotion/card-two-tone.
Extracted card-typewriter to remotion/card-typewriter.
```

- [ ] **Step 2: Build reusable props for every Batch 3 component**

Export these named props types and default props. For each default value, read the current constant from that slug's source file under `/tmp/remotionlab/案例`.

```ts
export type CardGlassProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  blurAmount: number
  animationStiffness: number
}

export type CardSplitProps = {
  name: string
  title: string
  leftColor: string
  rightColor: string
  textColor: string
  animationStiffness: number
}

export type CardTwoToneProps = {
  name: string
  title: string
  primaryColor: string
  secondaryColor: string
  textColor: string
  titleColor: string
  animationStiffness: number
}

export type CardTypewriterProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  charactersPerSecond: number
}
```

- [ ] **Step 3: Create final workspace files for Batch 3**

Create these files:

```text
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-glass/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-glass/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-glass/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-glass/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-glass/src/CardGlass.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-glass/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-glass/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-split/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-split/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-split/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-split/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-split/src/CardSplit.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-split/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-split/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-two-tone/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-two-tone/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-two-tone/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-two-tone/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-two-tone/src/CardTwoTone.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-two-tone/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-two-tone/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-typewriter/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-typewriter/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-typewriter/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-typewriter/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-typewriter/src/CardTypewriter.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-typewriter/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-typewriter/src/index.ts
```

- [ ] **Step 4: Mirror, generate README, and validate Batch 3**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
set -a
source /Users/tangwz/workspace/git/remotionhub/.env.local
set +a
for slug in card-glass card-split card-two-tone card-typewriter; do npm run media:mirror -- --slug=$slug; done
for slug in card-glass card-split card-two-tone card-typewriter; do npm run readme:generate -- --slug=$slug; done
for slug in card-glass card-split card-two-tone card-typewriter; do npm run validate -- --slug=$slug; done
npm run test
npm run typecheck
npm run format:check
```

Expected:

```text
Validated card-glass: validated.
Validated card-split: validated.
Validated card-two-tone: validated.
Validated card-typewriter: validated.
Vitest passes.
TypeScript exits with code 0.
Prettier check exits with code 0.
```

- [ ] **Step 5: Commit Batch 3**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git add manifest/remotionlab-showcase.json remotion/card-glass remotion/card-split remotion/card-two-tone remotion/card-typewriter
git commit -m "feat: migrate rich card assets"
```

Expected:

```text
Commit includes only Batch 3 asset files and inventory changes.
```

## Task 5: Migrate Batch 4 Lower Third Assets

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-box-pop/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-callout/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-gradient-bar/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-line-expand/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-minimal/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-slide/**`
- Create: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-social/**`
- Modify: `/Users/tangwz/workspace/git/remotionhub-assets/manifest/remotionlab-showcase.json`

**Component Map:**

```text
lower-third-box-pop -> LowerThirdBoxPop
lower-third-callout -> LowerThirdCallout
lower-third-gradient-bar -> LowerThirdGradientBar
lower-third-line-expand -> LowerThirdLineExpand
lower-third-minimal -> LowerThirdMinimal
lower-third-news -> LowerThirdNews
lower-third-slide -> LowerThirdSlide
lower-third-social -> LowerThirdSocial
```

- [ ] **Step 1: Extract all eight source cases**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
npm run extract -- --slug=lower-third-box-pop
npm run extract -- --slug=lower-third-callout
npm run extract -- --slug=lower-third-gradient-bar
npm run extract -- --slug=lower-third-line-expand
npm run extract -- --slug=lower-third-minimal
npm run extract -- --slug=lower-third-news
npm run extract -- --slug=lower-third-slide
npm run extract -- --slug=lower-third-social
```

Expected:

```text
Extracted lower-third-box-pop to remotion/lower-third-box-pop.
Extracted lower-third-callout to remotion/lower-third-callout.
Extracted lower-third-gradient-bar to remotion/lower-third-gradient-bar.
Extracted lower-third-line-expand to remotion/lower-third-line-expand.
Extracted lower-third-minimal to remotion/lower-third-minimal.
Extracted lower-third-news to remotion/lower-third-news.
Extracted lower-third-slide to remotion/lower-third-slide.
Extracted lower-third-social to remotion/lower-third-social.
```

- [ ] **Step 2: Build lower-third props consistently**

Each lower-third component must expose a props type with at least these fields unless the source prompt proves a field is irrelevant:

```ts
export type LowerThirdBaseProps = {
  name: string
  title: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}
```

For `lower-third-social`, include the social handle field:

```ts
export type LowerThirdSocialProps = {
  name: string
  title: string
  handle: string
  platform: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}
```

For `lower-third-news`, include the news context field:

```ts
export type LowerThirdNewsProps = {
  name: string
  title: string
  segmentLabel: string
  accentColor: string
  titleColor: string
  cardBackgroundColor: string
  animationStiffness: number
}
```

- [ ] **Step 3: Create final workspace files for Batch 4**

Create these files:

```text
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-box-pop/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-box-pop/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-box-pop/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-box-pop/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-box-pop/src/LowerThirdBoxPop.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-box-pop/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-box-pop/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-callout/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-callout/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-callout/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-callout/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-callout/src/LowerThirdCallout.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-callout/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-callout/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-gradient-bar/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-gradient-bar/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-gradient-bar/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-gradient-bar/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-gradient-bar/src/LowerThirdGradientBar.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-gradient-bar/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-gradient-bar/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-line-expand/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-line-expand/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-line-expand/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-line-expand/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-line-expand/src/LowerThirdLineExpand.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-line-expand/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-line-expand/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-minimal/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-minimal/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-minimal/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-minimal/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-minimal/src/LowerThirdMinimal.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-minimal/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-minimal/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/src/LowerThirdNews.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-slide/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-slide/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-slide/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-slide/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-slide/src/LowerThirdSlide.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-slide/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-slide/src/index.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-social/LICENSE
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-social/package.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-social/remotion.config.ts
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-social/remotionhub.asset.json
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-social/src/LowerThirdSocial.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-social/src/Root.tsx
/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-social/src/index.ts
```

- [ ] **Step 4: Mirror, generate README, and validate Batch 4**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
set -a
source /Users/tangwz/workspace/git/remotionhub/.env.local
set +a
for slug in lower-third-box-pop lower-third-callout lower-third-gradient-bar lower-third-line-expand lower-third-minimal lower-third-news lower-third-slide lower-third-social; do npm run media:mirror -- --slug=$slug; done
for slug in lower-third-box-pop lower-third-callout lower-third-gradient-bar lower-third-line-expand lower-third-minimal lower-third-news lower-third-slide lower-third-social; do npm run readme:generate -- --slug=$slug; done
for slug in lower-third-box-pop lower-third-callout lower-third-gradient-bar lower-third-line-expand lower-third-minimal lower-third-news lower-third-slide lower-third-social; do npm run validate -- --slug=$slug; done
npm run test
npm run typecheck
npm run format:check
```

Expected:

```text
Validated lower-third-box-pop: validated.
Validated lower-third-callout: validated.
Validated lower-third-gradient-bar: validated.
Validated lower-third-line-expand: validated.
Validated lower-third-minimal: validated.
Validated lower-third-news: validated.
Validated lower-third-slide: validated.
Validated lower-third-social: validated.
Vitest passes.
TypeScript exits with code 0.
Prettier check exits with code 0.
```

- [ ] **Step 5: Commit Batch 4**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
git add manifest/remotionlab-showcase.json remotion/lower-third-box-pop remotion/lower-third-callout remotion/lower-third-gradient-bar remotion/lower-third-line-expand remotion/lower-third-minimal remotion/lower-third-news remotion/lower-third-slide remotion/lower-third-social
git commit -m "feat: migrate lower third assets"
```

Expected:

```text
Commit includes only Batch 4 asset files and inventory changes.
```

## Task 6: Create RemotionHub Catalog Entries

**Files:**
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-elastic.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-from-left.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-from-right.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-from-top.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-glass.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-outline.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-scale.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-split.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-stagger.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-top-left.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-top-right.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-two-tone.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-typewriter.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/card-wipe.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/lower-third-box-pop.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/lower-third-callout.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/lower-third-gradient-bar.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/lower-third-line-expand.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/lower-third-minimal.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/lower-third-news.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/lower-third-slide.json`
- Create: `/Users/tangwz/workspace/git/remotionhub/catalog/components/lower-third-social.json`

- [ ] **Step 1: Capture the assets commit SHA**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub-assets
ASSETS_COMMIT="$(git rev-parse HEAD)"
printf '%s\n' "$ASSETS_COMMIT"
```

Expected:

```text
The command prints the commit SHA that contains all migrated asset directories.
```

- [ ] **Step 2: Create catalog JSON for each published slug**

Use `catalog/components/card-avatar.json` as the structural reference. Every new catalog file must use:

```json
{
  "publisher": "terence",
  "runtime": "remotion",
  "status": "published"
}
```

Each `artifact.githubSource` must use:

```json
{
  "repo": "remotionhub/remotionhub-assets",
  "ref": "main",
  "commit": "use the ASSETS_COMMIT shell value printed in Step 1",
  "path": "use remotion/card-elastic, remotion/card-from-left, or the corresponding remotion directory for the catalog slug"
}
```

Each catalog file must copy these values from the corresponding manifest. For example, `catalog/components/card-elastic.json` reads `/Users/tangwz/workspace/git/remotionhub-assets/remotion/card-elastic/remotionhub.asset.json`, and `catalog/components/lower-third-news.json` reads `/Users/tangwz/workspace/git/remotionhub-assets/remotion/lower-third-news/remotionhub.asset.json`.

```text
slug
displayName
preview.thumbnailUrl
preview.previewVideoUrl
preview.demoUrl from sourceUrl
metadata.entryPoint
metadata.aspectRatios
metadata.durationFrames
metadata.fps
artifact.license
artifact.agentPrompt
```

Use these category defaults:

```text
card-* categories: card, lower-third
lower-third-* categories: lower-third, title
```

- [ ] **Step 3: Verify no catalog file uses original R2 media**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
rg "pub-1cc20f8a898349ab9b2823b040fcd0b8\\.r2\\.dev" catalog/components
```

Expected:

```text
No matches.
```

- [ ] **Step 4: Validate catalog and focused tests**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

Expected:

```text
Catalog validation exits with code 0.
Vitest reports 2 test files passed.
```

- [ ] **Step 5: Commit catalog entries**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
git add catalog/components
git commit -m "feat: add card asset catalog entries"
```

Expected:

```text
Commit includes only catalog component JSON files unless a focused test update was required.
```

## Task 7: Import Catalog and Verify Browser Preview

**Files:**
- Read: `/Users/tangwz/workspace/git/remotionhub/catalog/components/*.json`
- Read: `/Users/tangwz/workspace/git/remotionhub-assets/remotion/*/remotionhub.asset.json`

- [ ] **Step 1: Import catalog into the local validation environment**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run catalog:import -- --apply
```

Expected:

```text
The command reports created or updated records for the newly added card and lower-third assets.
```

- [ ] **Step 2: Start the local RemotionHub server**

Run:

```bash
cd /Users/tangwz/workspace/git/remotionhub
npm run dev -- --port 3002
```

Expected:

```text
Vite starts a local server on localhost:3002 or another printed port.
```

- [ ] **Step 3: Verify every published page in a real browser**

Open these URLs in Playwright or the browser plugin:

```text
http://localhost:3002/remotion/terence/card-elastic
http://localhost:3002/remotion/terence/card-from-left
http://localhost:3002/remotion/terence/card-from-right
http://localhost:3002/remotion/terence/card-from-top
http://localhost:3002/remotion/terence/card-glass
http://localhost:3002/remotion/terence/card-outline
http://localhost:3002/remotion/terence/card-scale
http://localhost:3002/remotion/terence/card-split
http://localhost:3002/remotion/terence/card-stagger
http://localhost:3002/remotion/terence/card-top-left
http://localhost:3002/remotion/terence/card-top-right
http://localhost:3002/remotion/terence/card-two-tone
http://localhost:3002/remotion/terence/card-typewriter
http://localhost:3002/remotion/terence/card-wipe
http://localhost:3002/remotion/terence/lower-third-box-pop
http://localhost:3002/remotion/terence/lower-third-callout
http://localhost:3002/remotion/terence/lower-third-gradient-bar
http://localhost:3002/remotion/terence/lower-third-line-expand
http://localhost:3002/remotion/terence/lower-third-minimal
http://localhost:3002/remotion/terence/lower-third-news
http://localhost:3002/remotion/terence/lower-third-slide
http://localhost:3002/remotion/terence/lower-third-social
```

For each page, verify:

```text
The page title includes the asset display name.
The version block is visible.
The video src uses remotionhub.oss-cn-shenzhen.aliyuncs.com.
The video poster uses remotionhub.oss-cn-shenzhen.aliyuncs.com.
The video error is null.
The GitHub source link points to remotionhub/remotionhub-assets.
The usage section is visible.
The agent prompt section is visible.
```

- [ ] **Step 4: Produce final migration report**

Write a report in the task handoff message with this exact shape:

```text
targetSlugs: 22
published: 22
blocked: 0
missing: 0
assetsCommit: commit SHA from remotionhub-assets
mainCommit: commit SHA from remotionhub
assetsValidation:
  npm run test: passed
  npm run typecheck: passed
  npm run format:check: passed
mainValidation:
  npm run catalog:validate: passed
  npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx: passed
browserValidation:
  pagesChecked: 22
  failedPages: none
```

If one or more slugs are blocked, the report must use this shape:

```text
targetSlugs: 22
published: use the count of validated and cataloged slugs
blocked: use the count of blocked slugs
missing: 0
blockedDetails:
  - slug: use the exact blocked slug
    failedCommand: use the exact command that failed
    exitCode: use the numeric process exit code
    errorSummary: provide a concise error summary
    recommendedAction: provide a concrete diagnostic or fix
```

## Self-Review Checklist

- The plan covers all 22 target slugs from the spec.
- The plan preserves the two-repo boundary: source code in `remotionhub-assets`, catalog JSON in `remotionhub`.
- The plan requires OSS media URLs and rejects original R2 URLs in catalog.
- The plan requires manifest validation, render validation, README generation, catalog validation, and real browser verification.
- The plan includes blocked reporting instead of allowing silent skips.
- The plan does not ask any Agent to migrate non-card groups.
