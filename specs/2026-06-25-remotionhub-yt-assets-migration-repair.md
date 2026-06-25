# RemotionHub `yt-*` Assets Migration Repair Spec

## 1. 目标

本修复用于关闭 2026-06-24 至 2026-06-25 两轮代码审查发现的迁移缺陷，使 113 个 `yt-*` Remotion 资产达到可合并、可安装、可独立渲染、可追溯发布的状态。

修复完成后必须同时满足：

1. `remotionhub-assets` 中存在 113 个唯一 `yt-*` 资产目录。
2. `remotionhub` 中存在 113 个唯一且一一对应的 catalog JSON。
3. 每个 catalog 固定到实际包含目标资产路径的 assets commit。
4. 每个资产从独立目录获取后仍包含运行所需源码、运行时媒体映射、README 和 LICENSE；二进制媒体统一存储在 RemotionHub OSS。
5. composition 时长、manifest、README、catalog 和实际渲染保持一致。
6. 根 workspace lockfile 包含全部 113 个 `yt-*` workspace，干净 checkout 可以执行 `npm ci`。
7. 自动校验能够阻止同类问题再次进入 `validated` 或 `published` 状态。

本修复不改变现有 catalog 数据模型，不重做 RemotionHub 页面，不发布新的 CLI，也不扩大到非 `yt-*` 资产。

## 2. 当前状态与已确认问题

### 2.1 仓库与 worktree

涉及两个仓库：

- 主仓库：`/Users/tangwz/workspace/git/remotionhub`
- 资产仓库：`/Users/tangwz/workspace/git/remotionhub-assets`

当前功能 worktree：

- 主仓库：`/Users/tangwz/workspace/git/remotionhub/.worktrees/feat-animation-category-i18n`
- 资产仓库：`/Users/tangwz/workspace/git/remotionhub-assets/.worktrees/feat-migrate-yt-animation-assets`

当前已提交状态：

- 主仓库提交 `f037f994bc7c360e08b9cec7cfe4d1ea72efbd2c` 包含 108 个 catalog。
- 资产仓库提交 `bb0f0020bbbe7da9ec0060dae3d1ccce4206dc38` 包含 108 个资产。
- 缺少的 5 个资产和 5 个 catalog 已存在于 dirty worktree，但尚未形成可引用提交。

### 2.2 阻塞问题

#### 2.2.1 Catalog artifact 指向不存在的路径

5 个未提交 catalog 仍固定到 `bb0f0020...`：

- `yt-audio-add-vocals`
- `yt-audio-complex-pop-question`
- `yt-audio-fast-results`
- `yt-audio-rock-remix`
- `yt-connection-recap-outro`

该提交不包含这些路径，因此发布后无法按 pinned commit 获取源码。

#### 2.2.2 运行时媒体未进入统一镜像流程

13 个资产共有 53 个 `staticFile()` 引用，依赖资产仓库根目录下被忽略的 `public/`：

- `yt-ai-not-understand`
- `yt-ai-skill-network`
- `yt-audio-control`
- `yt-audio-lets-start`
- `yt-audio-prompt-skill`
- `yt-audio-software-criteria`
- `yt-from-scratch`
- `yt-like-subscribe-bell`
- `yt-line-phase-intro`
- `yt-mcp-chapter-card`
- `yt-mcp-pipeline`
- `yt-pencil-intro`
- `yt-svg-cards`

根目录媒体包括 9 个 connection 音频和 4 个独立媒体文件。当前这些文件不受 Git 跟踪，现有 `upload-media.ts` 又只处理 preview video 和 thumbnail，导致运行时媒体既没有可追溯的远程 URL，也不能从干净 checkout 渲染。

本项目不要求离线可用。运行时音频和图片应与 preview、thumbnail 一起纳入统一 OSS 镜像流程，代码仓库不提交这些二进制文件。

#### 2.2.3 Workspace lockfile 与目录不一致

`package.json` 的 workspace 模式是：

```json
{
  "workspaces": ["remotion/*"]
}
```

但 `package-lock.json` 不包含任何 `remotion/yt-*` workspace 记录。问题范围是全部 113 个 `yt-*` workspace，不只是最后新增的 5 个。

当前执行：

```bash
npm ci --dry-run --ignore-scripts
```

会报告 113 个 `@remotionhub/yt-*` package 缺失并退出失败。

#### 2.2.4 Composition 时长被硬编码为 120 帧

下列脚本把时长固定为 120：

- `scripts/extract-case.ts`
- `scripts/scaffold-batch.ts`
- `scripts/generate-readme.ts`

审查共发现 69 个 manifest 时长与组件导出的 `*_DURATION_FRAMES` 不一致：

- 68 个资产的真实时间线长于 120 帧，核心动画被截断。
- `yt-mcp-chapter-card` 的声明时长为 75 帧，但 manifest 和 Root 为 120 帧。

最严重示例：

- `yt-connection-recap-outro`：120 -> 480，频道和 CTA 分别从 210、340 帧开始。
- `yt-mcp-pipeline`：120 -> 600。
- `yt-skill-showcase`：120 -> 600。
- `yt-tool-showcase`：120 -> 900。

当前 `validate-case.ts` 根据错误的 Root 时长成功渲染 120 帧，因此“render 成功”不能证明时间线完整。

#### 2.2.5 静态检查失败

资产仓库 lint 已发现：

- `scripts/run-migration-pipeline.ts` 有未使用 import。
- `scripts/scaffold-batch.ts` 有无效正则转义。

修复已出现在 dirty worktree，但必须纳入正式提交并通过完整 lint。

#### 2.2.6 Durable spec 清单不可靠

原 final-batch spec 和执行计划虽然各有 113 次 slug 提及，但只有 102 个唯一 slug：

- 11 个 slug 重复。
- 11 个实际资产遗漏。

临时目录 `/tmp/remotionlab/案例` 不是 durable inventory，不能继续作为唯一验收依据。修复后的明确 113 项集合必须保存在仓库中，并由自动校验读取。

#### 2.2.7 Catalog 中文 fallback 不够稳健

`scripts/generate-catalog.ts` 使用 nullish fallback：

```typescript
const titleZh = manifest.displayNameZh ?? fallback
const summaryZh = manifest.summaryZh ?? fallback
```

空字符串或纯空白不会触发 fallback。现有中文摘要也会生成类似 `适用于 Remotion 的AI...组件。` 的中英文边界问题。

## 3. 核心设计决策

### 3.1 运行时媒体统一存储在 OSS

选择扩展现有 `scripts/upload-media.ts`，让同一条媒体流水线处理：

1. preview video；
2. thumbnail；
3. composition runtime audio；
4. composition runtime image。

运行时媒体使用全局内容寻址路径，不按 slug 重复保存：

```text
runtime/sha256/<sha256>
```

对象 URL 由 `OSS_PUBLIC_BASE_URL` 和 object key 组成。对象元数据必须包含准确的 `Content-Type`。相同字节内容只上传一次，即使多个组件或多个原始文件名引用它。

preview 和 thumbnail 继续使用现有 slug 范围路径：

```text
showcase/<slug>/<hash>-preview.mp4
showcase/<slug>/<hash>-thumb.jpg
```

`remotionhub.asset.json` 增加：

```json
{
  "runtimeAssets": [
    {
      "sourcePath": "audio/connection/woosh.wav",
      "url": "https://remotionhub.oss-cn-shenzhen.aliyuncs.com/runtime/sha256/<sha256>",
      "sha256": "<64 lowercase hex characters>",
      "byteSize": 12345,
      "contentType": "audio/wav"
    }
  ]
}
```

约束：

- `sourcePath` 是迁移前 `staticFile()` 的相对路径，用于可读性和追溯。
- `url` 必须属于 RemotionHub 控制的 OSS hostname。
- `sha256` 必须匹配远程对象内容。
- `byteSize` 必须是远程对象实际字节数。
- `contentType` 必须与媒体类型匹配。
- 最终 manifest 中所有资产都显式包含 `runtimeAssets`；无运行时媒体时使用空数组。
- draft manifest 可以省略 `runtimeAssets`，由媒体镜像阶段生成。

媒体镜像完成后，根据 manifest 生成：

```text
remotion/<slug>/src/runtime-assets.ts
```

生成文件提供稳定的源码接口：

```typescript
export const runtimeAssets = {
  'audio/connection/woosh.wav':
    'https://remotionhub.oss-cn-shenzhen.aliyuncs.com/runtime/sha256/<sha256>',
} as const

export type RuntimeAssetPath = keyof typeof runtimeAssets

export function runtimeAsset(path: RuntimeAssetPath): string {
  return runtimeAssets[path]
}
```

组件中的：

```typescript
staticFile('audio/connection/woosh.wav')
```

替换为：

```typescript
runtimeAsset('audio/connection/woosh.wav')
```

每个受影响组件必须导入 `runtimeAsset`。最终 113 个 `yt-*` 组件中不允许残留 `staticFile()` 调用。

本方案明确允许联网渲染，不提供离线 fallback，也不把运行时音频或图片提交到 Git。OSS 对象使用 hash key，因此已发布 URL 是不可变内容地址。

### 3.2 Manifest 是发布元数据真源，源码常量是迁移输入

批量修复时，从组件源码中读取唯一的正整数 `*_DURATION_FRAMES` 导出，作为恢复原始时间线的输入。修复完成后：

- `remotionhub.asset.json.durationFrames` 是发布元数据真源。
- `Root.tsx` 的 `durationInFrames` 必须与 manifest 相等。
- README 示例必须使用 manifest 时长。
- catalog `metadata.durationFrames` 必须来自 manifest。
- 如果组件仍导出 `*_DURATION_FRAMES`，校验器必须确认其值与 manifest 相等。

若某资产没有唯一可判定的 duration 常量，自动脚本不得猜测，必须报告该 slug 并要求人工确认。

### 3.3 校验必须验证语义一致性

现有校验只证明 TypeScript 和指定帧数的 render 能执行。新增完整性校验必须覆盖：

1. 源 slug、资产目录、inventory 和 catalog 集合相等。
2. manifest、Root、README、catalog 的 composition metadata 相等。
3. 运行时媒体 manifest、生成模块和组件引用一致。
4. workspace package 已进入 lockfile。
5. catalog commit 中存在 artifact path。
6. 从干净 checkout 复制单个资产后，在允许联网访问 OSS 的环境中可以 typecheck 和 render。
7. 所有运行时媒体 URL 可下载，内容 hash、byte size 和 content type 与 manifest 一致。
8. OSS CORS 允许 Remotion 浏览器上下文读取音频和图片，并支持媒体所需的 range request。

### 3.4 跨仓库发布必须分两阶段

发布顺序固定为：

1. 先完成并提交 `remotionhub-assets`。
2. 获取不可变 assets commit SHA。
3. 主仓库基于该 SHA 重新生成全部 113 个 catalog。
4. 验证每个 `<commit>:<path>`。
5. 再提交主仓库。

禁止在 assets dirty worktree 上生成最终 catalog，因为 `git rev-parse HEAD` 不包含未提交文件。

## 4. 修复范围

### 4.1 资产仓库基础设施

需要修改：

- `scripts/extract-case.ts`
- `scripts/scaffold-batch.ts`
- `scripts/generate-readme.ts`
- `scripts/upload-media.ts`
- `scripts/validate-case.ts`
- `scripts/run-migration-pipeline.ts`
- `scripts/lib/assetManifest.ts`
- `scripts/lib/media.ts`
- `package-lock.json`
- 相关 Vitest 测试

建议新增：

- `scripts/lib/compositionMetadata.ts`
- `scripts/lib/runtimeAssets.ts`
- `scripts/verify-yt-assets.ts`
- `scripts/verify-yt-assets.test.ts`

`compositionMetadata.ts` 负责：

- 使用 TypeScript AST 查找导出的 `*_DURATION_FRAMES`。
- 要求候选值是正整数。
- 对零个或多个候选给出包含 slug 和文件路径的明确错误。
- 提供 manifest、Root 和源码常量一致性检查。

禁止使用简单正则直接修改源码；读取 TypeScript 结构必须使用 TypeScript compiler API 或现有 AST 工具。

`runtimeAssets.ts` 负责：

- 使用 TypeScript AST 查找静态字符串形式的 `staticFile()` 调用。
- 把相对路径解析到迁移输入目录 `public/`。
- 生成确定性排序的 manifest `runtimeAssets`。
- 生成 `src/runtime-assets.ts`。
- 使用 AST 更新 import 和调用表达式，避免基于字符串的全文件替换。
- 对动态参数、缺失文件、未知扩展名和冲突 source path 给出明确错误。

`upload-media.ts` 和 `lib/media.ts` 必须扩展为同时支持远程 URL 输入和本地文件输入。runtime media 的 content type 至少覆盖：

```text
audio/mpeg
audio/wav
image/jpeg
image/png
```

对同一 SHA-256 的对象，上传逻辑必须幂等。manifest 中 `runtimeAssets` 按 `sourcePath` 升序输出，避免重复运行产生无意义 diff。

`verify-yt-assets.ts` 负责只读验证，不得更新时间戳、重写 manifest 或触发上传。

### 4.2 69 个时长不一致资产

需要修复的 68 个延长资产：

`yt-ai-not-understand` (120 -> 240), `yt-ai-skill-network` (120 -> 240), `yt-audio-add-vocals` (120 -> 240), `yt-audio-complex-pop-question` (120 -> 240), `yt-audio-control` (120 -> 240), `yt-audio-fast-results` (120 -> 240), `yt-audio-lets-start` (120 -> 150), `yt-audio-prompt-skill` (120 -> 300), `yt-audio-rock-remix` (120 -> 300), `yt-audio-software-criteria` (120 -> 300), `yt-brand-value-stripped` (120 -> 210), `yt-bug-fix-loop` (120 -> 240), `yt-build-stability` (120 -> 180), `yt-build-trust-first` (120 -> 210), `yt-cloudflare-api-key` (120 -> 150), `yt-code-controls` (120 -> 300), `yt-connection-recap-outro` (120 -> 480), `yt-consistent-output` (120 -> 180), `yt-core-flow` (120 -> 210), `yt-deploy-cloudflare` (120 -> 210), `yt-dev-flow-steps` (120 -> 240), `yt-distribution-hard` (120 -> 210), `yt-easy-channel-hard-dist` (120 -> 180), `yt-equity-design` (120 -> 180), `yt-exclusive-app` (120 -> 210), `yt-far-stranger-pains` (120 -> 210), `yt-far-strangers` (120 -> 150), `yt-faster-higher-quality` (120 -> 150), `yt-first-deal-hard` (120 -> 180), `yt-focus-one-topic` (120 -> 210), `yt-from-scratch` (120 -> 270), `yt-generic-chatbot` (120 -> 180), `yt-generic-means-lacking` (120 -> 180), `yt-growth-24` (120 -> 180), `yt-idea-check` (120 -> 210), `yt-influencer-dms` (120 -> 180), `yt-inside-the-problem` (120 -> 210), `yt-iterate-two-days` (120 -> 210), `yt-like-subscribe-bell` (120 -> 300), `yt-line-phase-intro` (120 -> 180), `yt-magazine-layout` (120 -> 180), `yt-manual-first` (120 -> 360), `yt-mcp-pipeline` (120 -> 600), `yt-mid-ask-experts` (120 -> 150), `yt-narrative-redesign` (120 -> 180), `yt-near-self-friends` (120 -> 150), `yt-not-that-simple` (120 -> 240), `yt-page-scroll-metrics` (120 -> 210), `yt-prompt-dev` (120 -> 180), `yt-prompt-spec` (120 -> 240), `yt-report-transform` (120 -> 300), `yt-scatter-shot` (120 -> 210), `yt-service-first` (120 -> 450), `yt-shortest-path` (120 -> 210), `yt-skill-showcase` (120 -> 600), `yt-start-small` (120 -> 210), `yt-start-with-service` (120 -> 180), `yt-success-path` (120 -> 210), `yt-svg-cards` (120 -> 270), `yt-tech-boosts-stability` (120 -> 150), `yt-think-distribution` (120 -> 180), `yt-three-dimensions` (120 -> 150), `yt-too-many-coincidences` (120 -> 240), `yt-tool-selection` (120 -> 180), `yt-tool-showcase` (120 -> 900), `yt-trust-is-currency` (120 -> 240), `yt-trust-transfer` (120 -> 180), `yt-user-iterate` (120 -> 180)。

需要缩短的资产：

- `yt-mcp-chapter-card`：120 -> 75。

每个资产必须同步更新：

- `remotionhub.asset.json`
- `remotionhub.asset.draft.json`
- `src/Root.tsx`
- `README.md`
- inventory 中与 composition metadata 相关的字段（若存在）
- 主仓库对应 catalog JSON

`validate-case.ts` 不得仅依赖 Root 时长。渲染前必须先执行 metadata consistency check。

### 4.3 13 个媒体依赖资产

根目录现有媒体需要通过统一流水线上传 OSS：

```text
audio/connection/ding.mp3
audio/connection/micro-riser.mp3
audio/connection/satisfying-fill.wav
audio/connection/soft-click.wav
audio/connection/soft-impact.wav
audio/connection/tick.wav
audio/connection/tiny-pop.mp3
audio/connection/whoosh-out.mp3
audio/connection/woosh.wav
avatar-2.png
bell-notification.mp3
click.mp3
pencil-logo.jpeg
```

迁移规则：

- `upload-media.ts` 必须扫描静态字符串形式的 `staticFile()` 调用。
- 每个 `sourcePath` 从当前本地 `public/` 读取一次，计算 SHA-256、byte size 和 content type。
- 使用 `runtime/sha256/<sha256>` 上传；上传前允许通过 HEAD 或对象存储 API 判断对象是否已存在。
- 相同 hash 不重复上传，但每个 manifest 保留自己的 `sourcePath` 映射。
- 生成或更新 `src/runtime-assets.ts`。
- 机械替换组件源码中的 `staticFile()`，并删除不再使用的 `staticFile` import。
- 不允许把本地绝对路径写入源码或 manifest。
- 不允许提交根 `public/` 下的二进制文件。
- 动态构造的 `staticFile()` 参数必须进入人工检查列表，不能默认为通过。
- `verify-yt-assets.ts` 必须确认 `yt-*` 源码中 `staticFile()` 调用数量为零。
- 远程校验必须下载每个唯一 runtime URL，并验证 SHA-256、byte size 和 response `Content-Type`。
- 对 13 个受影响资产执行真实 Remotion render，以验证 OSS CORS 和浏览器媒体加载。

现有本地 `public/` 仅作为一次性迁移输入。上传和源码改写完成后，可以继续被 `.gitignore` 排除；它不属于发布 artifact。

### 4.4 5 个未提交资产

需要纳入最终 assets commit：

- `remotion/yt-audio-add-vocals/`
- `remotion/yt-audio-complex-pop-question/`
- `remotion/yt-audio-fast-results/`
- `remotion/yt-audio-rock-remix/`
- `remotion/yt-connection-recap-outro/`
- `manifest/remotionlab-showcase.json` 对应记录

主仓库根目录的以下 5 个摘录文件不是迁移输入，内容不完整且部分不可编译，不得进入功能提交：

- `Scene15-RockRemix.tsx`
- `Scene16-RecapOutro.tsx`
- `Scene19-FastResults.tsx`
- `Scene20-ComplexPopQuestion.tsx`
- `Scene23-AddVocals.tsx`

完整来源快照应保留在各资产的 `source.raw.tsx`。

### 4.5 Catalog generator

需要修改 `scripts/generate-catalog.ts`：

```typescript
const titleZh =
  manifest.displayNameZh?.trim() || (await readMarkdownTitle(slug))
const summaryZh =
  manifest.summaryZh?.trim() || `适用于 Remotion 的「${titleZh}」组件。`
```

同时要求：

- 生成前确认 assets worktree 干净，或显式传入 `--asset-commit=<sha>`。
- 如果传入 commit，必须从该 commit tree 读取 manifest，而不是从 dirty filesystem 读取 manifest 后只写入旧 SHA。
- 生成每个 catalog 前执行：

```bash
git -C <asset-repo> cat-file -e <asset-commit>:remotion/<slug>
```

- 最终重新生成全部 113 个 `yt-*` catalog，避免只修 5 个后留下不同摘要格式或 metadata。

### 4.6 Corrected durable inventory

以下集合是本修复的 113 项 canonical slug set：

`yt-acq-ret-ref`, `yt-ai-not-understand`, `yt-ai-reads-only`, `yt-ai-report-doubt`, `yt-ai-skill-network`, `yt-ai-use-cases`, `yt-ai-wrappers-dead`, `yt-animation-suffice`, `yt-arcade-beat-em-up`, `yt-ask-ai-tip`, `yt-audio-add-vocals`, `yt-audio-complex-pop-question`, `yt-audio-control`, `yt-audio-fast-results`, `yt-audio-lets-start`, `yt-audio-prompt-skill`, `yt-audio-rock-remix`, `yt-audio-software-criteria`, `yt-brand-value-stripped`, `yt-bug-fix-loop`, `yt-build-stability`, `yt-build-trust-first`, `yt-can-do-animation`, `yt-char-animations`, `yt-cloudflare-api-key`, `yt-code-controls`, `yt-connection-recap-outro`, `yt-consistent-output`, `yt-core-dist-card`, `yt-core-flow`, `yt-customize-own`, `yt-deploy-cloudflare`, `yt-dev-flow-intro`, `yt-dev-flow-steps`, `yt-distribution-first`, `yt-distribution-hard`, `yt-easy-channel-hard-dist`, `yt-engine-abilities`, `yt-engine-criteria`, `yt-equity-design`, `yt-exclusive-app`, `yt-execute-validate`, `yt-experiment-conclusion`, `yt-extract-tool`, `yt-far-stranger-pains`, `yt-far-strangers`, `yt-far-to-near`, `yt-faster-higher-quality`, `yt-first-deal-hard`, `yt-first-version`, `yt-focus-one-topic`, `yt-four-ai-tools`, `yt-from-scratch`, `yt-game-mashup`, `yt-generic-chatbot`, `yt-generic-means-lacking`, `yt-growth-24`, `yt-idea-check`, `yt-idea-feasibility`, `yt-influencer-dms`, `yt-inside-the-problem`, `yt-iterate-two-days`, `yt-like-subscribe-bell`, `yt-line-phase-intro`, `yt-magazine-layout`, `yt-manual-first`, `yt-mcp-chapter-card`, `yt-mcp-pipeline`, `yt-mid-ask-experts`, `yt-mobile-patience`, `yt-narrative-redesign`, `yt-near-self-friends`, `yt-no-3d-needed`, `yt-not-about-analysis`, `yt-not-just-effects`, `yt-not-that-simple`, `yt-page-scroll-metrics`, `yt-pencil-intro`, `yt-product-overflow`, `yt-prompt-dev`, `yt-prompt-spec`, `yt-reach-pain-points`, `yt-rejected-ideas`, `yt-report-transform`, `yt-scatter-shot`, `yt-service-first`, `yt-shadcn-prompt`, `yt-shadcn-results`, `yt-shortest-path`, `yt-simple-ai-product`, `yt-skill-showcase`, `yt-solve-first-point`, `yt-start-small`, `yt-start-with-service`, `yt-success-path`, `yt-svg-cards`, `yt-tailor-for-audience`, `yt-tech-boosts-stability`, `yt-think-distribution`, `yt-three-dimensions`, `yt-three-questions`, `yt-too-many-coincidences`, `yt-tool-selection`, `yt-tool-showcase`, `yt-trust-is-currency`, `yt-trust-transfer`, `yt-two-errors-detail`, `yt-two-focus`, `yt-two-lessons`, `yt-user-iterate`, `yt-version-2-card`, `yt-version-3-card`, `yt-zero-revenue`。

该集合必须存放在一个机器可读的单一位置。推荐在 assets 仓库新增：

```text
manifest/yt-animation-slugs.json
```

其他脚本通过读取该文件获取 slug，不再分别维护 `SUPPORTED_SLUGS`、`scaffold-batch.ts` 列表和计划文档列表。

## 5. 实施阶段与依赖顺序

### Phase 1: 修复基础脚本和测试

1. 修复 lint 错误。
2. 引入 composition metadata 解析。
3. 删除 `extract-case.ts`、`scaffold-batch.ts` 和 `generate-readme.ts` 中的 120 帧硬编码。
4. 扩展 `validate-case.ts`，在 render 前检查 metadata 一致性。
5. 新增 canonical slug 文件和只读完整性校验脚本。
6. 为以下失败场景添加测试：
   - manifest 和 Root 时长不同。
   - manifest 和源码常量时长不同。
   - runtime media manifest 与生成模块不一致。
   - runtime media URL 不属于允许的 OSS hostname。
   - runtime media hash、byte size 或 content type 不一致。
   - `yt-*` 源码仍包含 `staticFile()`。
   - slug 集合缺失、重复或多出。
   - lockfile 缺少 workspace。
   - catalog commit 不包含 artifact path。

Phase 1 完成前不得批量重写资产。

### Phase 2: 修复资产数据

1. 批量更新 69 个资产的时长。
2. 更新 69 个 Root 和 README。
3. 通过 `upload-media.ts` 上传 13 个资产引用的运行时媒体，并按 SHA-256 全局去重。
4. 为 13 个资产生成 `src/runtime-assets.ts`，改写组件引用并移除 `staticFile` import。
5. 纳入最后 5 个资产和 inventory 记录。
6. 运行 `npm install`，一次性更新全部 113 个 workspace 的 lockfile。
7. 对所有 113 个资产运行只读 metadata 校验。
8. 对 69 个时长修复资产运行完整 render。
9. 对 13 个媒体资产从隔离目录联网运行 render。

若远程 preview video 的时长与修复后的 manifest 已一致，可以保留现有 OSS URL。若不一致，必须重新渲染或重新镜像，并更新 manifest 和 catalog。

### Phase 3: Assets clean-checkout gate

在提交候选状态创建干净临时 worktree或 clone：

```bash
git worktree add --detach /tmp/remotionhub-assets-repair-check <candidate-sha>
cd /tmp/remotionhub-assets-repair-check
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run verify:yt-assets
npm run verify:yt-assets -- --check-remote
```

然后至少验证：

- 全部 69 个时长修复资产的 composition metadata。
- 全部 13 个媒体资产在联网环境下的完整 render。
- 每个唯一 runtime URL 的 hash、byte size 和 content type 校验。
- 最后新增 5 个资产的完整 render。
- `package-lock.json` 中存在 113 个 `remotion/yt-*` workspace entry。

只有 clean-checkout gate 通过后才能创建最终 assets commit。

### Phase 4: 生成并验证 catalog

1. 记录最终 assets commit：

```bash
ASSET_COMMIT=$(git -C /Users/tangwz/workspace/git/remotionhub-assets rev-parse HEAD)
```

2. 在主仓库从该 commit 重新生成全部 113 个 catalog。
3. 验证 113 个 catalog 的：
   - slug 唯一性。
   - category 为 `animation`。
   - publisher 为 `remotionlab`。
   - duration、fps、entryPoint 与 assets manifest 相等。
   - commit 等于 `$ASSET_COMMIT`。
   - path 在 `$ASSET_COMMIT` tree 中存在。
4. 运行 catalog schema 和单元测试。

禁止只重新生成最后 5 个 catalog。

### Phase 5: 修复 durable spec 和收尾

1. 用 canonical slug 文件生成或校验 final-batch spec 的清单。
2. 同步修复执行计划中的重复与遗漏。
3. 删除或明确排除主仓库根目录 5 个 `Scene*.tsx` 摘录。
4. 对两个仓库运行最终 review。
5. 在 PR 描述中记录 assets commit、catalog commit 和全部验证命令。

## 6. 验证命令

### 6.1 Assets repository

```bash
npm install
npm ci --dry-run --ignore-scripts
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run verify:yt-assets
```

对单资产：

```bash
npm run manifest:validate -- --slug=<slug>
npm run validate -- --slug=<slug>
```

`validate` 会更新时间戳，只能在明确准备更新迁移状态时使用。代码审查和 CI 的默认完整性检查必须使用只读命令。

### 6.2 Main repository

```bash
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

按仓库交付门槛还需运行：

```bash
bun run ci:static
VITE_CONVEX_URL=https://example.invalid bun run ci:unit
bunx tsc -p packages/schema/tsconfig.json --noEmit
bunx tsc -p packages/remotionhub/tsconfig.json --noEmit
```

如果当前分支结构不包含上述 package 路径，应运行该分支实际存在的等价 TypeScript gate，并在交付说明中明确差异。

### 6.3 Cross-repository artifact verification

对每个 catalog 执行等价检查：

```bash
git -C <asset-repo> cat-file -e <commit>:<path>
```

最终要求：

```text
catalog_count = 113
asset_count = 113
inventory_count = 113
unique_slug_count = 113
missing_artifact_paths = 0
duration_mismatches = 0
remaining_static_file_calls = 0
invalid_runtime_asset_mappings = 0
remote_runtime_asset_failures = 0
missing_lockfile_workspaces = 0
```

## 7. 测试策略

### 7.1 单元测试

必须覆盖：

- duration AST 解析正常、无候选、多候选、非整数和负数。
- 空白 `displayNameZh` 与 `summaryZh` fallback。
- 中文摘要格式。
- `staticFile()` AST 路径解析和动态参数拒绝。
- runtime asset manifest 的确定性排序和 source path 唯一性。
- runtime object key 的 SHA-256 内容寻址。
- MP3、WAV、JPEG 和 PNG content type。
- canonical slug set 唯一性。
- inventory upsert 不产生重复 slug。

### 7.2 集成测试

必须覆盖：

- scaffold 后 manifest、Root 和 README 使用同一 duration。
- validation 在 duration mismatch 时于 render 前失败。
- validation 在 runtime asset mapping 缺失或不一致时失败。
- remote verification 在 OSS URL、hash、byte size 或 content type 不一致时失败。
- 生成 catalog 时旧 commit 不含 path 会失败。
- 生成 catalog时指定 commit 后，读取的 manifest 与 commit tree 一致。

### 7.3 隔离在线渲染测试

针对 13 个媒体资产：

1. 只复制 `remotion/<slug>` 到临时项目。
2. 安装声明依赖。
3. 确认目录中不存在运行时音频和图片二进制文件。
4. typecheck。
5. 在允许访问 RemotionHub OSS 的环境中 render 完整 composition。
6. 验证输出帧数等于 manifest duration。
7. 验证浏览器日志中没有 CORS、403、404 或媒体解码错误。

该测试用于证明资产目录是真正的分发边界。

## 8. 提交策略

建议保持以下提交边界：

1. `fix: validate yt asset metadata and runtime files`
   - 基础脚本、测试、canonical slug set、lint 修复。
2. `fix: restore yt asset durations and mirror runtime media`
   - 69 个时长修复、13 个资产的 OSS runtime media、README 和 Root 更新。
3. `feat: complete 113 yt animation assets`
   - 最后 5 个资产、inventory、lockfile。
4. `fix: regenerate yt catalogs from pinned asset commit`
   - 主仓库 generator 修复和 113 个 catalog。
5. `docs: correct yt migration inventory and repair rationale`
   - durable spec 与执行计划修正。

实际提交可以合并相邻步骤，但不得把主仓库 catalog 提交放在最终 assets commit 之前。

## 9. 验收标准

以下条件全部满足后才可标记 ready to merge：

- 两个功能 worktree 均无意外未跟踪文件。
- 113 个 assets、inventory entries 和 catalog slugs 集合完全相等。
- 最后 5 个 catalog 固定到包含自身路径的新 assets commit。
- 113 个 workspace 全部进入 `package-lock.json`。
- 干净 checkout 的 `npm ci` 成功。
- 69 个 duration mismatch 清零。
- 13 个媒体资产不依赖仓库根目录的未提交文件。
- 13 个媒体资产的源码不再包含 `staticFile()`。
- 所有运行时媒体已进入内容寻址 OSS 路径，manifest hash、byte size 和 content type 校验成功。
- 从独立资产目录联网渲染 13 个媒体资产成功。
- assets lint、format、typecheck、tests 全部通过。
- catalog validation 和相关主仓库测试通过。
- final-batch spec 和执行计划不再包含重复或遗漏 slug。
- 主仓库根目录 5 个不完整 `Scene*.tsx` 不进入提交。
- 最终 code review 没有未处理的 Critical 或 Important 发现。

## 10. 风险与回滚

### 10.1 OSS 可用性与联网依赖

运行时媒体统一放在 OSS 后，Remotion preview 和 render 依赖网络、OSS 可用性、CORS 配置和正确的 `Content-Type`。这是明确接受的产品约束，不提供离线 fallback。

降低风险的措施：

- 使用 SHA-256 内容地址，禁止覆盖已发布对象。
- OSS bucket 配置允许 Remotion 浏览器来源跨域读取。
- 保留 range request 支持。
- 发布前从真实 Chromium/Remotion render 验证音频和图片加载。
- manifest 保存 hash 和 byte size，发布检查实际下载内容。
- 不在组件中使用临时签名 URL。

### 10.2 批量时长修复影响预览成本

最长 composition 从 120 增加到 900 帧，完整 render 会增加 CI 时间。CI 可以将 metadata consistency 和抽样 render 分层，但发布前必须至少完成一次全部 69 个修复资产的完整 render。

### 10.3 临时来源目录不稳定

`/tmp/remotionlab/案例` 可能被清理或只保留部分文件。修复不得依赖该目录继续存在。`source.raw.tsx`、canonical slug set、manifest 和 Git 历史必须足以重建并验证发布结果。

### 10.4 跨仓库提交顺序

如果 assets commit 需要修订，旧 catalog commit 必须作废并重新生成。不得手工只替换 SHA，因为 manifest metadata 也可能变化。

回滚时优先回滚主仓库 catalog commit，再回滚 assets commit，避免线上 catalog 指向已删除的源码路径。
