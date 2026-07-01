# 暂缓 HyperFrames E2E 覆盖设计

## 背景

上线审计发现当前 HyperFrames catalog fixture 与仓库实际产品状态不一致：

- `catalog/components/hyperframes-lower-third.json` 使用了统一 taxonomy 不支持的 `hyperframes` 和 `caption` tags，导致 catalog seed 在 schema parse 阶段失败。
- `/hyperframes` 的 Playwright smoke 仍断言空目录，但该 fixture 被标记为 `published`；一旦导入成功，现有断言就会失败。
- 当前仓库没有已经确认可发布的 HyperFrames 内容，也没有足够的产品语义来定义 Lower Third Pack 的源码、artifact 和详情页行为。

该 fixture 是近期改动中被意外恢复的记录，不能视为已经确认的产品资产。

## 决策

现阶段不提前设计或实现 HyperFrames 内容测试。

恢复仓库当前真实语义：

1. 删除误恢复的 `catalog/components/hyperframes-lower-third.json`。
2. 保留 `/hyperframes` 空目录的 Playwright 断言。
3. 不新增 HyperFrames 专用 E2E fixture。
4. 不新增 HyperFrames 列表、详情导航、Agent Prompt、预览或 source-free artifact 的 Playwright 覆盖。

只有在仓库拥有经过确认的 HyperFrames 内容及其发布语义后，才重新设计 detail flow 契约。

## Taxonomy 与 artifact 语义

本次不改变统一 tags taxonomy：

- 不增加 `caption`。
- 不允许使用 runtime 名称 `hyperframes` 作为重复 tag。
- 继续使用现有的六类 tags：`minimal`、`retro`、`creative`、`business`、`social`、`personal`。

本次也不为真实 Lower Third Pack 定义 `artifact.kind = "none"`。该值是否适合未来 HyperFrames 产品内容，应由实际分发方式决定；在来源语义未确认前，不虚构 GitHub source、entry point、安装方式或其他 artifact 信息。

## E2E 契约

当前 HyperFrames smoke 的最小可靠契约只有：

- `/hyperframes` 路由可正常打开。
- 页面展示空目录状态。
- 测试流程不产生未处理的浏览器控制台错误。

不对尚不存在的内容绑定标题、owner、slug、preview URL 或 Agent Prompt，从而避免未来批量内容迁移再次删除或替换脆弱 fixture 时破坏 smoke。

## 影响范围

预期实现范围仅包括：

- 删除误恢复的 HyperFrames production catalog fixture。
- 如有必要，收紧现有 smoke 的控制台错误检查，但不新增内容级断言。

不修改 catalog importer、catalog schema、tags taxonomy、Convex 数据模型、发布基础设施或其他上线审计问题。

## 验证

实现后至少执行：

```bash
npm run catalog:validate
npm run test
VITE_CONVEX_URL=https://example.invalid npx tsc --noEmit
VITE_CONVEX_URL=https://example.invalid npm run build
make convex
make e2e
```

`make convex` 需要在独立终端保持本地 Convex 运行，再执行 Playwright smoke。验证重点是 catalog seed 成功、`/hyperframes` 保持空目录，以及现有 Remotion E2E 契约没有回归。

## 非目标

- 不创建或补全真实 HyperFrames 内容。
- 不实现 HyperFrames detail flow。
- 不扩展 tags taxonomy。
- 不改变 source-free artifact 的产品模型。
- 不处理上线审计问题 1、问题 5 或发布基础设施。
- 不进行 commit、push、PR 或部署。
