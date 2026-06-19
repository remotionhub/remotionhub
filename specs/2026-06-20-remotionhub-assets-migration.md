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

- 建立或准备 `tangwz/remotionhub-assets` 作为素材源码仓库。
- 迁移 `card-avatar` 一个案例。
- 为该案例生成可运行 Remotion 项目或可独立复制的组件包。
- 为该案例生成 RemotionHub catalog JSON。
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
- 预览媒体应最终镜像到 RemotionHub 可控的对象存储。试点阶段可以暂时引用现有 R2 URL，但批量迁移前必须把资源托管权纳入 RemotionHub 控制范围，避免来源站点变更导致预览失效。

资产仓库建议结构：

```text
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

`remotionhub.asset.json` 是单案例的机器可读 manifest，包含 slug、display name、source URL、preview URL、thumbnail URL、entry point、duration、fps、aspect ratios、license、prompt 和迁移状态。`manifest/remotionlab-showcase.json` 是全量 inventory，用于保证每个源案例都有状态记录。

## 数据流

单个案例迁移的数据流：

1. 从 `/tmp/remotionlab/案例/<slug>.md` 读取 frontmatter、prompt、code block、preview video 和 thumbnail。
2. 将代码块整理为资产仓库中的 Remotion 源码，补齐 `Root.tsx`、composition 注册、package metadata 和 README。
3. 对源码运行 TypeScript、format 和 Remotion preview 或 render 验证。
4. 把 preview video 和 thumbnail 写入 `remotionhub.asset.json`。批量迁移阶段使用 RemotionHub 控制的对象存储 URL。
5. 在 RemotionHub 主仓库生成或手写 `catalog/components/<slug>.json`，其中 `artifact.githubSource` 指向资产仓库的 tag、commit 和案例路径。
6. 运行 catalog 校验，再导入 Convex。
7. 在真实 RemotionHub 页面中打开详情页，确认 video、thumbnail、source、usage 和 prompt 可用。

现有 `catalog` schema 暂时可以承载第一阶段需求。实现时优先复用 `preview.thumbnailUrl`、`preview.previewVideoUrl`、`metadata.entryPoint`、`artifact.githubSource`、`usageMarkdown` 和 `agentPrompt`。

## 全量迁移保证

后续批量迁移必须先生成完整 inventory，而不是人工逐个追踪。inventory 以 `/tmp/remotionlab/案例/README.md` 和实际 `*.md` 文件为输入，排除 `README.md` 与 `index.md` 这类索引页后，每个案例都有唯一 slug。

每个 slug 必须处于下列状态之一：

- `pending`: 已发现，尚未开始。
- `extracted`: 已提取 preview、thumbnail、prompt 和源码。
- `validated`: 源码通过类型检查和 Remotion 验证。
- `published`: 已进入资产仓库并导入 RemotionHub catalog。
- `blocked`: 暂时不能发布，并记录原因，例如源码无法编译、缺少媒体、license 不明确或需要人工重写。

批量迁移完成的验收条件不是“脚本跑完”，而是 inventory 中没有无原因的 `pending` 或 `extracted`。`blocked` 可以存在，但必须有明确原因和后续处理建议。

## 第一案例：card-avatar

`card-avatar` 适合作为第一例，因为它依赖少，preview 和 thumbnail 明确，代码体量适中，能快速验证完整链路。

试点验收标准：

- 资产仓库中存在 `remotion/card-avatar`，可以独立安装依赖并运行 Remotion preview 或 render。
- `CardAvatar.tsx` 中的代码是有效 TypeScript，导出的 component API 清晰。
- `Root.tsx` 注册 composition，包含明确的 duration、fps、width 和 height。
- README 说明如何复制到已有 Remotion 项目，以及可修改的字段。
- RemotionHub catalog 中新增 `card-avatar`，runtime 为 `remotion`，source 指向资产仓库准确路径。
- `/remotion/terence/card-avatar` 可以看到缩略图、播放 preview video、打开 GitHub source、复制 prompt，并查看 usage。

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
- 输出需要用户手动接入的 composition import 或自动写入可安全修改的入口文件。
- 保留源案例 README、license 和 prompt。

不建议第一阶段就发布 CLI，因为一个案例不足以稳定目录结构、依赖策略和 API 命名。先用资产仓库结构验证真实素材，再固化 CLI 接口。

## 错误处理与质量门槛

迁移脚本和人工流程都必须区分数据错误与代码错误：

- 缺少 preview 或 thumbnail：不能发布为 `published`，除非明确允许 fallback。
- 源码无法通过 TypeScript：不能发布，需要进入 `blocked` 或人工修复。
- 源码依赖外部资源：必须把资源纳入案例目录或在 README 中明确远程依赖。
- 已发布版本内容变化：不能覆盖同一 semver version，应发布新版本。
- GitHub source 必须指向固定 commit，页面可展示 tag，但 provenance 需要可追溯。

## 验证计划

第一阶段验证命令：

```bash
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts
```

资产仓库验证命令由该仓库定义，最低要求：

```bash
npm install
npm run typecheck
npm run render -- --composition=CardAvatar
```

网页验收：

- 本地运行 RemotionHub。
- 导入或使用本地 Convex fixture 后打开 `/remotion/terence/card-avatar`。
- 用真实浏览器确认 preview video 可播放，thumbnail 不报错，GitHub source URL 指向正确路径。

如果实现只修改 catalog JSON 和 spec，主仓库至少运行 catalog 校验。若修改页面、schema 或导入逻辑，还需要运行对应单元测试和 e2e smoke。

## 风险与取舍

独立资产仓库增加了仓库管理和发布流程，但把素材源码的生命周期从产品站中隔离出来，长期更可维护。RemotionHub 主仓库可以继续保持轻量，只负责展示和导入。

引用来源站点的 R2 URL 可以让试点更快，但不是长期方案。正式批量迁移前应镜像 preview 和 thumbnail，否则无法保证网页预览长期稳定。

自动提取 Markdown 能提高覆盖率，但不能保证源码质量。批量阶段需要自动检查加人工修复并行，尤其是 TypeScript 语法、依赖资源、中文文案和可参数化字段。

## 交付顺序

1. 准备 `remotionhub-assets` 仓库结构和 manifest schema。
2. 迁移 `card-avatar` 源码，补齐 Remotion 项目文件。
3. 验证资产仓库能运行和 render。
4. 在 RemotionHub 主仓库新增 `card-avatar` catalog JSON。
5. 校验 catalog，导入到本地或开发 Convex。
6. 在真实浏览器验收 RemotionHub 详情页。
7. Terence 验收通过后，再按 inventory 分批迁移剩余案例。

## 验收标准

第一阶段完成时必须满足：

- `card-avatar` 在资产仓库中有可运行源码。
- RemotionHub 页面可正常预览 `card-avatar`。
- 页面上的 GitHub source 指向正确代码。
- 使用说明足以让用户把案例接入自己的 Remotion 项目。
- inventory 方案已经明确，后续批量迁移不会依赖人工记忆。
- CLI 方向已经保留，但未过早发布 npm 接口。
