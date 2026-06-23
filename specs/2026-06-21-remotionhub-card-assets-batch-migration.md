# RemotionHub Card Assets Batch Migration Spec

## 目标

本阶段迁移 `/tmp/remotionlab/案例` 中剩余 22 个字卡类 Remotion 素材。`card-avatar` 已经作为第一例迁移完成，本 spec 以它作为参考样例，要求执行 Agent 按同一资产仓库结构、同一媒体镜像策略和同一验收标准迁移剩余素材。

本阶段的工作组织方式是：主 Agent 负责策划 spec、分配执行边界和最终验收；执行 Agent 负责按 batch 迁移素材、提交可审阅结果和失败报告。执行 Agent 不负责最终主干合并，也不能自行放宽验收标准。

## 范围

本阶段只包含以下 22 个 slug。执行 Agent 不得扩展到 `title-*`、`subtitle-*`、`social-*` 或其他看起来相似的案例。

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

不在本阶段范围内：

- 发布或实现 `npx remotionhub add`。
- 改造 RemotionHub 页面设计。
- 一次性迁移全部 264 个案例。
- 覆盖 `card-avatar` 已发布版本；如发现第一例存在问题，应单独报告，不夹带在本阶段批量迁移中。

## 关键仓库边界

`/Users/tangwz/workspace/git/remotionhub-assets` 是素材源码仓库。每个素材源码必须落在：

```text
remotion/<slug>/
```

`/Users/tangwz/workspace/git/remotionhub` 是产品站和 catalog 仓库。每个可发布素材必须在这里生成或更新：

```text
catalog/components/<slug>.json
```

主仓库不得复制完整素材源码。主仓库 catalog 只保存展示、索引、版本、GitHub source pointer、usage、prompt 和 preview metadata。

## 批次划分

执行 Agent 应按以下 batch 工作。每个 batch 可以由一个 Agent 串行完成，也可以由多个 Agent 分别完成，但一个 slug 在同一时间只能有一个 owner。

### Batch 1: Directional Cards

```text
card-from-left
card-from-right
card-from-top
card-top-left
card-top-right
```

这组主要验证滑入方向、对齐方式、强调线位置和 spring 参数是否被正确参数化。

### Batch 2: Simple Card Effects

```text
card-elastic
card-scale
card-stagger
card-wipe
card-outline
```

这组主要验证基础卡片动效、描边、擦除、缩放和 stagger 动画是否保持原视觉语义。

### Batch 3: Richer Card Effects

```text
card-glass
card-split
card-two-tone
card-typewriter
```

这组通常会有更多样式状态或文本动画。执行 Agent 需要特别关注 props schema 与默认值是否真实驱动组件，而不是只改常量名。

### Batch 4: Lower Thirds

```text
lower-third-box-pop
lower-third-callout
lower-third-gradient-bar
lower-third-line-expand
lower-third-minimal
lower-third-news
lower-third-slide
lower-third-social
```

这组是 lower-third 字卡。执行 Agent 需要保持 lower-third 作为视频叠加元素的语义，不能为了方便改造成居中 title card。

## 单个素材交付物

每个素材在 `remotionhub-assets` 中必须包含：

```text
remotion/<slug>/
  LICENSE
  README.md
  package.json
  remotion.config.ts
  remotionhub.asset.draft.json
  remotionhub.asset.json
  source.raw.tsx
  src/
    <ComponentName>.tsx
    Root.tsx
    index.ts
```

要求：

- `source.raw.tsx` 保留从 `/tmp/remotionlab/案例/<slug>.md` 提取出的原始代码块，允许只做格式上必要的包裹，不作为用户主要入口。
- `src/<ComponentName>.tsx` 是经过清理、参数化和可复用的组件源码。
- `src/Root.tsx` 注册 Remotion composition，composition id 必须与 manifest 中 `compositionId` 一致。
- `src/index.ts` 导出主要组件和 props 类型。
- `remotionhub.asset.json` 是最终 manifest，只能在通过校验后进入 `validated`。
- `remotionhub.asset.draft.json` 可保存提取阶段的原始元数据，不能作为 catalog 发布来源。

每个可发布素材在 `remotionhub` 中必须包含：

```text
catalog/components/<slug>.json
```

要求：

- `runtime` 必须是 `remotion`。
- `owner` 使用 `terence`。
- `artifact.githubSource.repo` 必须是 `remotionhub/remotionhub-assets`。
- `artifact.githubSource.path` 必须指向 `remotion/<slug>`。
- `artifact.githubSource.commit` 必须指向资产仓库中包含该素材的固定 commit。
- `preview.thumbnailUrl` 和 `preview.previewVideoUrl` 必须指向 RemotionHub 控制的 OSS URL。

## 媒体镜像规范

原始 Markdown 中的 preview 和 thumbnail 通常来自：

```text
https://pub-1cc20f8a898349ab9b2823b040fcd0b8.r2.dev/showcase/<slug>/preview.mp4
https://pub-1cc20f8a898349ab9b2823b040fcd0b8.r2.dev/showcase/<slug>/thumb.jpg
```

发布到 RemotionHub 时必须镜像到：

```text
https://remotionhub.oss-cn-shenzhen.aliyuncs.com/showcase/<slug>/<hash>-preview.mp4
https://remotionhub.oss-cn-shenzhen.aliyuncs.com/showcase/<slug>/<hash>-thumb.jpg
```

执行 Agent 必须使用资产仓库已有媒体脚本完成镜像，不得手写 URL 或人工猜测 hash。

推荐命令：

```bash
set -a
source /Users/tangwz/workspace/git/remotionhub/.env.local
set +a
npm run media:mirror -- --slug=<slug>
```

验收要求：

- OSS preview URL 的 `HEAD` 请求返回 `200`。
- OSS thumbnail URL 的 `HEAD` 请求返回 `200`。
- `content-type` 与文件类型匹配。
- catalog 中不得保留原始 R2 preview 或 thumbnail URL。
- README 中展示的 preview image 也必须使用 OSS URL。

## Props Schema 规范

执行 Agent 必须把原始 prompt 中可替换的内容提取成 `propsSchema`，并在组件中真实使用这些 props。不得只把原始常量移动到 manifest，却不接入组件。

常见字段：

```text
name
title
subtitle
label
accentColor
backgroundColor
textColor
secondaryTextColor
lineColor
cardBackgroundColor
animationStiffness
```

命名要求：

- 使用 English camelCase。
- 颜色字段使用 CSS color string。
- 数值动画参数使用 number。
- 字段描述使用 English，面向素材用户说明效果。
- 默认值必须与迁移后组件的默认视觉一致。

如果某个素材需要数组配置，例如多行文字、社交帐号或新闻 ticker，可以使用 array/object props，但必须在 README 中说明结构，并保证默认值可 render。

## 执行 Agent 契约

每个执行 Agent 接到 batch 后，必须按以下顺序工作：

1. 从 `/tmp/remotionlab/案例/<slug>.md` 提取 frontmatter、source URL、preview URL、thumbnail URL、prompt 和 Remotion code block。
2. 在 `remotionhub-assets` 中创建 `remotion/<slug>`。
3. 运行或补齐 extraction/sanitization 脚本，使目标 workspace 符合 `card-avatar` 的结构。
4. 将可配置项提取为 props，并保证默认 props 复现原始案例。
5. 运行媒体镜像，把 preview 和 thumbnail 上传到 OSS。
6. 生成 `README.md` 和 `remotionhub.asset.json`。
7. 运行资产仓库验证命令。
8. 在 `remotionhub` 中新增 catalog JSON。
9. 运行 catalog 验证。
10. 提交执行报告，列出每个 slug 的状态、验证命令和失败原因。

执行 Agent 禁止：

- 在未验证 render 的情况下把状态标为 `validated`。
- 发布仍指向原始 R2 媒体的 catalog。
- 把源码复制进 `remotionhub` 主仓库。
- 用全局安装或单个案例目录独立 `npm install` 作为常规验证方式。
- 修改不属于本 batch 的素材。
- 修改主站页面、Convex schema 或 import 逻辑，除非 spec reviewer 明确要求。
- 删除或重写 `card-avatar` 的已发布文件。

## 状态机

每个 slug 必须在 `manifest/remotionlab-showcase.json` 中有状态记录。允许状态：

```text
pending
extracted
media-mirrored
sanitized
validated
published
blocked
```

状态含义：

- `pending`: 已在范围内，但尚未开始。
- `extracted`: 已提取 Markdown 元数据和原始代码。
- `media-mirrored`: preview 和 thumbnail 已上传到 OSS 并写回 manifest。
- `sanitized`: 源码已整理为 workspace，可运行校验。
- `validated`: manifest、TypeScript 和 Remotion render 已通过。
- `published`: 主仓库 catalog 已生成并通过 catalog 校验。
- `blocked`: 当前 slug 无法继续，必须记录失败命令、错误摘要和建议处理方式。

执行 Agent 可以提交 `blocked`，但不能留下未解释的 `pending`、`extracted`、`media-mirrored` 或 `sanitized`。

## Blocked 记录格式

如果某个 slug 失败，执行 Agent 必须在报告中提供：

```text
slug: <slug>
status: blocked
failedCommand: <command>
exitCode: <number>
errorSummary: <short error summary>
currentState: <what files were generated or skipped>
recommendedAction: <manual fix or next diagnostic step>
```

`errorSummary` 不应贴完整日志，只保留足以定位问题的核心错误。完整日志可以保存在执行 Agent 的工作记录中，但不写进用户可见 README。

## 验证命令

每个 slug 至少需要通过：

```bash
npm run manifest:validate -- --slug=<slug>
npm run sanitize -- --slug=<slug>
npm run validate -- --slug=<slug>
npm run readme:generate -- --slug=<slug>
```

每个 batch 完成后，资产仓库必须通过：

```bash
npm run test
npm run typecheck
npm run format:check
```

主仓库 catalog 必须通过：

```bash
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

如果执行 Agent 修改了脚本、schema 或测试，必须运行相关新增/变更测试。只迁移素材文件时，不能跳过 batch 级别的 assets 验证。

## 页面验收

最终验收由主 Agent 执行，不由执行 Agent 自行宣布完成。验收步骤：

1. 确认 assets 仓库 `main` 或待合并分支包含所有目标素材目录。
2. 确认主仓库 catalog 中包含所有可发布素材。
3. 运行 catalog import 到本地 Convex 或当前验收环境。
4. 启动 RemotionHub 本地服务。
5. 用真实浏览器打开每个详情页。
6. 对每个页面确认：
   - 标题、slug、owner、version 正确。
   - thumbnail 可见。
   - preview video 有 OSS `src`，有 poster，`error` 为 `null`。
   - GitHub source 指向资产仓库的正确 commit 和 path。
   - Usage 与 Agent Prompt 可读。

页面 URL 形态：

```text
http://localhost:<port>/remotion/terence/<slug>
```

如果页面未更新，优先检查 catalog JSON、Convex import 目标环境、browser cache 和 dev server 是否指向同一代码与环境。不能仅凭文件已修改就声明网页预览通过。

## 推荐提交粒度

执行 Agent 应按 batch 提交，避免 22 个素材混成一个难以审阅的大提交。

推荐提交形态：

```text
feat: migrate directional card assets
feat: migrate simple card assets
feat: migrate rich card assets
feat: migrate lower third assets
feat: add card asset catalog entries
```

如果某 batch 中有 blocked slug，提交信息仍应准确表达范围，报告中必须列出 published 与 blocked 数量。

## 执行报告模板

每个执行 Agent 完成 batch 后必须输出：

```text
batch: <batch name>
assetRepoCommit: <commit sha or local branch>
mainRepoCommit: <commit sha or local branch>
published:
  - <slug>
blocked:
  - <slug>: <reason>
validation:
  assets:
    - <command>: <result>
  main:
    - <command>: <result>
notes:
  - <important implementation detail or risk>
```

如果没有 blocked，写 `blocked: none`。如果某命令未运行，必须写明原因；不能把未运行命令写成通过。

## 最终验收标准

本阶段完成时必须满足：

```text
targetSlugs: 22
missing: 0
published + blocked = 22
```

其中：

- `missing` 必须为 0。
- `published` 的每个 slug 都必须通过 manifest、render、README、catalog 和页面预览验收。
- `blocked` 可以大于 0，但每个 blocked slug 必须有失败命令、错误摘要和下一步建议。
- 主仓库 catalog 不得引用原始 R2 媒体。
- 资产仓库 inventory 不得遗漏目标 slug。

只有当 `missing = 0` 且所有 published slug 都完成真实浏览器预览，主 Agent 才能建议 Terence 进入下一类素材迁移。

## 与第一阶段 spec 的关系

本 spec 承接 `specs/2026-06-20-remotionhub-assets-migration.md`，不替代它。第一阶段 spec 定义了资产仓库、manifest、媒体镜像、源码清理和 catalog 的基础架构；本 spec 定义第二阶段字卡类批量迁移的执行范围、分工、状态报告和验收门槛。

如果两个 spec 对同一行为有冲突，以更严格、更可验证的规则为准。特别是媒体镜像、GitHub source 固定 commit、根目录 workspace 验证和真实浏览器预览，不能降级。
