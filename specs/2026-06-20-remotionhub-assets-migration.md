# RemotionHub Assets Migration Design

## 目标

把 `/tmp/remotionlab/案例` 中的 Remotion 案例迁移为 RemotionHub 的素材库。迁移后的每个案例必须同时满足两类需求：用户可以在 RemotionHub 网页中正常预览，也可以从代码仓库获取可运行、可复用的案例源码。

本设计采用分阶段迁移。第一阶段只迁移一个案例，默认选择 `card-avatar`，由 Terence 验收页面预览、源码可用性和使用文档。验收通过后，再用同一条流水线批量迁移后续案例。

## 背景与当前状态

RemotionHub 当前已经有 catalog 数据模型和页面能力：

- `catalog/components/*.json` 保存组件元数据。
- `scripts/import-catalog.ts` 校验并导入 catalog。
- Convex 中的 `components`、`componentVersions`、`artifacts` 保存展示、版本和源码信息。
- `/remotion/$owner/$slug` 详情页已经展示 preview、thumbnail、版本信息、GitHub source、usage 和 agent prompt。

`/tmp/remotionlab/案例` 当前是抓取后的 Markdown 内容，不是可直接分发的源码仓库。每个案例通常包含 frontmatter、preview video、thumbnail、prompt 和一个 Remotion 代码块。部分代码块需要规范化后才能成为可编译的 TypeScript，例如带连字符的常量名。迁移流程不能只复制 Markdown，必须包含提取、修复、验证和发布记录。

## 范围

第一阶段包含：

- 建立或准备 `tangwz/remotionhub-assets` 作为素材源码仓库，并采用 npm workspaces 的 monorepo 结构。
- 迁移 `card-avatar` 一个案例。
- 为该案例生成可运行 Remotion 项目或可独立复制的组件包。
- 为该案例生成 RemotionHub catalog JSON。
- 设计并验证轻量媒体镜像脚本，避免 preview 和 thumbnail 长期依赖来源站点。
- 设计源码清理与校验管道，把抓取源码的语法错误、缺失依赖和 Remotion 兼容性问题转化为可追踪状态。
- 在 RemotionHub 网页中验证详情页 preview、thumbnail、source、usage 和 prompt。
- 写入完整迁移策略，保证后续 264 个案例不会漏迁。

第一阶段不包含：

- 一次性迁移所有案例。
- 发布 npm CLI。
- 重新设计 RemotionHub catalog 页面。
- 重做现有 Convex schema，除非实现时发现当前字段无法表达 source 或 preview 的必要信息。

## 推荐架构

采用独立资产仓库 `tangwz/remotionhub-assets` 保存素材源码，RemotionHub 主仓库继续保存产品站、catalog metadata、导入脚本和页面展示逻辑。

核心边界：

- `remotionhub-assets` 是源码分发边界。用户 clone、copy 或未来通过 npx 获取素材时，来源都指向这里。
- RemotionHub 主仓库是索引和展示边界。它不承载大量案例源码，只记录每个案例的 metadata、预览资源 URL 和 GitHub source pointer。
- 预览媒体必须镜像到 RemotionHub 可控的对象存储。调研和 dry-run 可以读取来源站点 URL，但第一阶段验收和后续 catalog 发布不得继续引用来源站点媒体 URL。

资产仓库建议结构：

```text
package.json
package-lock.json
tsconfig.base.json
scripts/
  extract-case.ts
  sanitize-case.ts
  upload-media.ts
  validate-case.ts
remotion/
  card-avatar/
    README.md
    LICENSE
    package.json
    remotion.config.ts
    src/
      CardAvatar.tsx
      Root.tsx
      index.ts
    remotionhub.asset.json
manifest/
  remotionlab-showcase.json
```

根目录 `package.json` 必须配置 workspaces：

```json
{
  "private": true,
  "workspaces": ["remotion/*"]
}
```

每个案例目录保留自己的 `package.json`，但它只表达案例身份、入口、脚本和额外运行时依赖。`react`、`react-dom`、`remotion`、`typescript`、lint/format 工具等核心依赖由根目录统一管理，开发者和 CI 只在仓库根目录安装一次依赖。根目录脚本负责按 workspace 或按 slug 执行 typecheck、render 和 manifest 校验。

未来 CLI 分发时，不暴露 monorepo 细节。`npx remotionhub add <slug>` 只拉取目标子目录源码和 manifest，读取该案例 `package.json` 中的额外依赖，并把依赖合并进用户项目的 `package.json`。

`remotionhub.asset.json` 是单案例的机器可读 manifest，包含 slug、display name、source URL、preview URL、thumbnail URL、entry point、duration、fps、aspect ratios、license、prompt、props schema、extra dependencies 和迁移状态。`manifest/remotionlab-showcase.json` 是全量 inventory，用于保证每个源案例都有状态记录。

## 数据流

单个案例迁移的数据流：

1. 从 `/tmp/remotionlab/案例/<slug>.md` 读取 frontmatter、prompt、code block、preview video 和 thumbnail。
2. 运行 `scripts/upload-media.ts`，读取 Markdown 中的 preview 和 thumbnail URL 或本地缓存文件，把媒体上传到 RemotionHub 控制的 R2/S3 bucket，并按内容 hash 或 slug/version 生成稳定目标路径。脚本必须是幂等的，重复运行不能产生无意义的新 URL。
3. 运行 `scripts/sanitize-case.ts`，将抓取代码整理为资产仓库中的 Remotion 源码，修复可机械处理的问题，例如非法 identifier、缺失文件扩展名、代码块语言缺失和格式化问题。
4. 人工处理自动清理无法可靠修复的问题，例如缺失三方库、Remotion API 不兼容或需要重构的 props 设计。
5. 补齐 `Root.tsx`、composition 注册、workspace package metadata、README、props schema 和 `remotionhub.asset.json`。
6. 运行 `scripts/validate-case.ts`，对目标 workspace 执行 TypeScript、format、manifest 校验和 Remotion render。失败时把 inventory 状态写为 `blocked`，并记录 stderr、失败命令和建议修复位置。
7. 在 RemotionHub 主仓库生成或手写 `catalog/components/<slug>.json`，其中 `artifact.githubSource` 指向资产仓库的 tag、commit 和案例路径，preview URLs 使用 RemotionHub 控制的对象存储 URL。
8. 运行 catalog 校验，再导入 Convex。
9. 在真实 RemotionHub 页面中打开详情页，确认 video、thumbnail、source、usage 和 prompt 可用。

现有 `catalog` schema 暂时可以承载第一阶段需求。实现时优先复用 `preview.thumbnailUrl`、`preview.previewVideoUrl`、`metadata.entryPoint`、`artifact.githubSource`、`usageMarkdown` 和 `agentPrompt`。

## 全量迁移保证

后续批量迁移必须先生成完整 inventory，而不是人工逐个追踪。inventory 以 `/tmp/remotionlab/案例/README.md` 和实际 `*.md` 文件为输入，排除 `README.md` 与 `index.md` 这类索引页后，每个案例都有唯一 slug。

每个 slug 必须处于下列状态之一：

- `pending`: 已发现，尚未开始。
- `extracted`: 已提取 preview、thumbnail、prompt 和源码。
- `media-mirrored`: preview 和 thumbnail 已上传到 RemotionHub 控制的对象存储，并写回 manifest。
- `sanitized`: 源码已完成自动清理和格式化，等待编译与 render 校验。
- `validated`: 源码通过类型检查和 Remotion 验证。
- `published`: 已进入资产仓库并导入 RemotionHub catalog。
- `blocked`: 暂时不能发布，并记录原因，例如源码无法编译、缺少媒体、license 不明确或需要人工重写。

批量迁移完成的验收条件不是“脚本跑完”，而是 inventory 中没有无原因的 `pending`、`extracted`、`media-mirrored` 或 `sanitized`。`blocked` 可以存在，但必须有明确原因、失败命令、错误摘要和后续处理建议。

## 媒体镜像

`scripts/upload-media.ts` 必须在第一阶段设计并对 `card-avatar` 跑通。它读取源 Markdown 或 `remotionhub.asset.json` 中的 preview/thumbnail 来源，支持远程 URL 和本地缓存文件两种输入。

脚本职责：

- 下载或读取 preview video 与 thumbnail。
- 计算内容 hash，避免重复上传。
- 上传到 RemotionHub 控制的 R2/S3 bucket。
- 写回 `remotionhub.asset.json` 和全量 inventory。
- 输出上传清单，包含 slug、source URL、target URL、content hash 和 byte size。

脚本不得把存储密钥写入仓库。凭证通过环境变量注入，例如 `ASSETS_R2_ACCOUNT_ID`、`ASSETS_R2_ACCESS_KEY_ID`、`ASSETS_R2_SECRET_ACCESS_KEY` 和 `ASSETS_R2_BUCKET`。如果凭证缺失，脚本可以 dry-run 并校验 URL 提取，但不能把案例推进到 `media-mirrored`。

## 源码清理与校验管道

抓取源码进入资产仓库前必须经过 sanitization pipeline。目标不是完全自动修复所有案例，而是把可机械处理的问题自动修掉，把不可机械处理的问题转成高质量的 `blocked` 记录。

自动清理范围：

- 修复明显非法的 TypeScript identifier，例如把 `WAVE-LAYERS` 转成 `WAVE_LAYERS`。
- 补齐代码块语言、文件名和默认入口文件。
- 统一 import quote、format 和基础 tsconfig。
- 检测常见外部依赖并写入案例 package metadata。

自动校验范围：

- `tsc --noEmit` 覆盖目标 workspace。
- Remotion render 或 still render 覆盖目标 composition。
- manifest schema 校验，确认 preview、thumbnail、entry point、duration、fps、aspect ratios、props schema 和 source provenance 完整。

失败时，pipeline 必须写入 `blocked`，并保存失败命令、退出码、stderr 摘要和建议 owner action。不能把未通过 TypeScript 或 Remotion render 的案例标记为 `validated`。

## 第一案例：card-avatar

`card-avatar` 适合作为第一例，因为它依赖少，preview 和 thumbnail 明确，代码体量适中，能快速验证完整链路。

试点验收标准：

- 资产仓库中存在 `remotion/card-avatar`，可以在 workspace 根目录统一安装依赖后运行 Remotion preview 或 render；该子目录也可以被复制到用户已有 Remotion 项目中使用。
- `CardAvatar.tsx` 中的代码是有效 TypeScript，导出的 component API 清晰。
- `Root.tsx` 注册 composition，包含明确的 duration、fps、width 和 height。
- README 使用统一模板，说明 preview、props schema、手动接入步骤、额外依赖、license 和引用的 agent prompt。
- RemotionHub catalog 中新增 `card-avatar`，runtime 为 `remotion`，source 指向资产仓库准确路径。
- Preview video 和 thumbnail 已经由 `scripts/upload-media.ts` 镜像到 RemotionHub 控制的对象存储，catalog 不再引用来源站点外链。
- 该 workspace 能从资产仓库根目录统一安装依赖并执行验证，不需要在 `remotion/card-avatar` 下单独 `npm install`。
- `/remotion/terence/card-avatar` 可以看到缩略图、播放 preview video、打开 GitHub source、复制 prompt，并查看 usage。

## README 与 Props 模板

每个案例 README 必须使用统一结构，避免批量迁移后开发体验不一致。模板应包含：

- 案例名称、slug、preview image 和原始来源 URL。
- 适用场景和视觉效果摘要。
- Props schema，列出可配置字段、类型、默认值和说明。
- 手动接入步骤，包括复制哪些文件、如何注册 composition、需要安装哪些额外依赖。
- RemotionHub 页面 URL 和 GitHub source URL。
- Agent Prompt，保留用户可复制和改写的原始 prompt。
- License 和素材来源说明。

`remotionhub.asset.json` 中的 props schema 是 README 的结构化来源。README 可以由脚本生成初稿，但发布前必须人工 review，确认配置项真实可用。

## CLI 与 npx 方向

第一阶段不发布 CLI，但 manifest 必须为未来 CLI 留出稳定接口。推荐第二阶段在 3 到 5 个案例通过同一流程后，再实现用户安装命令。

推荐命令形态：

```bash
npx remotionhub add card-avatar
```

CLI 的职责：

- 根据 slug 读取 RemotionHub 或资产仓库 manifest。
- 下载或复制案例源码到当前项目。
- 检查 `remotion`、`react` 和 `react-dom` 版本。
- 读取目标案例 workspace package metadata，将额外依赖合并到用户项目的 `package.json`。
- 输出需要用户手动接入的 composition import 或自动写入可安全修改的入口文件。
- 保留源案例 README、license 和 prompt。

不建议第一阶段就发布 CLI，因为一个案例不足以稳定目录结构、依赖策略和 API 命名。先用资产仓库结构验证真实素材，再固化 CLI 接口。

## 错误处理与质量门槛

迁移脚本和人工流程都必须区分数据错误与代码错误：

- 缺少 preview 或 thumbnail：不能发布为 `published`，除非明确允许 fallback。
- preview 或 thumbnail 仍指向来源站点：第一阶段验收不能通过，必须先完成媒体镜像。
- 源码无法通过 TypeScript：不能发布，需要进入 `blocked` 或人工修复。
- Remotion render 失败：不能发布，需要进入 `blocked`，即使 TypeScript 已通过。
- 源码依赖外部资源：必须把资源纳入案例目录或在 README 中明确远程依赖。
- 已发布版本内容变化：不能覆盖同一 semver version，应发布新版本。
- GitHub source 必须指向固定 commit，页面可展示 tag，但 provenance 需要可追溯。
- 单个案例目录下不得独立安装依赖作为常规流程。验证必须从资产仓库根目录通过 workspace 脚本执行。

## 验证计划

第一阶段验证命令：

```bash
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts
```

资产仓库验证命令由该仓库定义，最低要求：

```bash
npm install
npm run media:mirror -- --slug=card-avatar
npm run sanitize -- --slug=card-avatar
npm run typecheck -- --workspace=remotion/card-avatar
npm run render -- --workspace=remotion/card-avatar -- --composition=CardAvatar
npm run manifest:validate -- --slug=card-avatar
```

网页验收：

- 本地运行 RemotionHub。
- 导入或使用本地 Convex fixture 后打开 `/remotion/terence/card-avatar`。
- 用真实浏览器确认 preview video 可播放，thumbnail 不报错，GitHub source URL 指向正确路径。

如果实现只修改 catalog JSON 和 spec，主仓库至少运行 catalog 校验。若修改页面、schema 或导入逻辑，还需要运行对应单元测试和 e2e smoke。

## 风险与取舍

独立资产仓库增加了仓库管理和发布流程，但把素材源码的生命周期从产品站中隔离出来，长期更可维护。RemotionHub 主仓库可以继续保持轻量，只负责展示和导入。

引用来源站点的 R2 URL 可以让早期调研更快，但不能作为第一阶段验收结果。`card-avatar` 试点必须跑通媒体镜像，否则批量迁移会积累大量人工上传和外链清理债务。

自动提取 Markdown 能提高覆盖率，但不能保证源码质量。批量阶段需要自动检查加人工修复并行，尤其是 TypeScript 语法、依赖资源、中文文案和可参数化字段。

如果每个案例都独立安装依赖，264 个案例会导致安装和验证成本不可接受。因此资产仓库必须使用 workspaces，共享核心依赖，案例级 `package.json` 只表达差异化依赖和元数据。

## 交付顺序

1. 准备 `remotionhub-assets` workspace 仓库结构、根依赖、manifest schema 和 README 模板。
2. 实现或补齐 `upload-media`、`sanitize-case`、`validate-case` 的第一阶段能力。
3. 迁移 `card-avatar` 源码，补齐 Remotion 项目文件、props schema 和 README。
4. 从仓库根目录验证 `card-avatar` 能 typecheck、render 和 manifest validate。
5. 在 RemotionHub 主仓库新增 `card-avatar` catalog JSON。
6. 校验 catalog，导入到本地或开发 Convex。
7. 在真实浏览器验收 RemotionHub 详情页。
8. Terence 验收通过后，再按 inventory 分批迁移剩余案例。

## 验收标准

第一阶段完成时必须满足：

- `card-avatar` 在资产仓库中有可运行源码。
- 资产仓库使用 workspaces，共享核心依赖，并能从根目录验证目标案例。
- `card-avatar` 的 preview 和 thumbnail 已镜像到 RemotionHub 控制的对象存储。
- RemotionHub 页面可正常预览 `card-avatar`。
- 页面上的 GitHub source 指向正确代码。
- README 和 props schema 足以让用户把案例接入自己的 Remotion 项目。
- inventory 方案已经明确，后续批量迁移不会依赖人工记忆。
- sanitization pipeline 可以把失败案例标记为带错误摘要的 `blocked`。
- CLI 方向已经保留，但未过早发布 npm 接口。
