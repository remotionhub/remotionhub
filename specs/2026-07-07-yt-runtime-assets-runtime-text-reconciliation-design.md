# YT Catalog 与 runtimeAssets 真源对齐设计

## 1. 背景与目标

`catalog/components/yt-*.json` 的 113 条资产指针已经确认都指向 `remotionhub/remotionhub-assets` 的稳定 commit/path。当前剩余风险来自“runtime 依赖存在性”的可见性口径差异：

- runtime 媒体的真值当前定义在 `remotionhub-assets` 的 `remotion/<slug>/remotionhub.asset.json.runtimeAssets`。
- catalog 并未要求携带 `runtimeAssets` 数据结构。
- 目前应避免在 catalog schema 上新增字段，避免影响 `scripts`、校验链路和消费端兼容。

本设计确定为**方案 1**：以 `remotionhub-assets` 为运行时真源，catalog 仅保留现有结构，但统一校验并修复文本提示一致性。

## 2. 结论（已选方案）

- 不引入 `runtimeAssets` 至 catalog 结构。
- 不扩展 `CatalogVersion` / `Artifact` schema。
- 只保证 catalog 的 `usageMarkdown` 与 `agentPrompt` 与 `assets` commit 内的 `runtime-assets.ts` 存在性一致。
- 所有 runtime 断言均基于 `githubSource.commit/path` 固定提交树。

## 3. 方案边界

### 3.1 保留项

- `githubSource` 的 `repo/ref/commit/path` 约束（`shared/catalog.ts`）不改。
- `generate-catalog.ts` 的现有字段形状不扩展。
- catalog 现有的 `versions[*].artifact.usageMarkdown/agentPrompt` 模板保留。

### 3.2 范围内

- 新增/复用一个只读一致性核验脚本：
  - 核验每个 `yt-*.json` 的 `githubSource` 指向 commit/path 有效。
  - 从 commit tree 读取 `remotionhub.asset.json`。
  - 通过 `commit:remotion/<slug>/src/runtime-assets.ts` 判断 `runtime` 是否需要展示。
  - 校验 `usageMarkdown` 与 `agentPrompt` 中对 runtime 的描述与上述判定一致。
  - 输出可复用的修复清单。
- 在发现文本不一致时，按 slug 使用 `generate-catalog.ts --asset-commit=<slugCommit>` 重新生成该条 catalog（或整批重建）以恢复一致。

### 3.3 非目标

- 不新增 catalog 字段消费逻辑。
- 不改前端详情页渲染。
- 不强制生成 runtime-assets 资源的下载路径到 catalog。

## 4. 数据流与校验逻辑

1. 读取所有 `catalog/components/yt-*.json`。
2. 对每条记录：
   - 取 `versions[0].artifact.githubSource`。
   - `git -C remotionhub-assets cat-file -e <commit>:remotion/<slug>/src/runtime-assets.ts`，得到 `hasRuntimeAssets`。
   - `git -C remotionhub-assets show <commit>:remotion/<slug>/remotionhub.asset.json`，校验解析成功且 `runtimeAssets` 可读。
   - 校验 `metadata.entryPoint/durationFrames/fps` 与 `remotionhub.asset.json` 一致（已在先前流程中覆盖）。
   - 校验 `usageMarkdown`、`agentPrompt` 与 `hasRuntimeAssets` 的一致性：
     - `hasRuntimeAssets = true` 时应包含 `runtime-assets.ts` 的 copy/提示。
     - `hasRuntimeAssets = false` 时不应包含该提示。
3. 所有检查通过则输出 `PASS`，否则输出 `FAIL` 与 slug 清单。
4. `FAIL` 后，优先触发修复：使用 `--asset-commit` 重生成 catalog（可按单文件或 113 全量）。

## 5. 错误处理与决策

- 指针无效（提交/路径不存在）：阻断并提示精确 `slug` 与 `commit`。
- `remotionhub.asset.json` 读取失败：阻断并提示文件路径。
- 文案不一致：记录 `slug` 与具体偏差字段，建议执行 catalog 重生成。
- 任何异常不修改原始仓库数据文件，仅出报告；修复通过重建脚本显式执行。

## 6. 质量与验证

### 6.1 自动化检查

- `npm run verify:yt-assets`（已通过时）仍为主要资产真相检查入口。
- `npm run verify:yt-runtime-text`（建议）用于核对 yt-* 的 runtime 文案一致性。
- 新增/复用的核验脚本按 `catalog` 可验证清单返回非零码。
- 必要时对 13 个历史异常 slug 做回归 spot-check。

运行示例：

```bash
npm run verify:yt-runtime-text
npm run verify:yt-runtime-text -- --catalog-dir=/tmp/catalog --throw-on-mismatch
```

### 6.2 可观测输出

- 输出包括：
  - `checked: 113`
  - `runtimeTextMismatches: N`
  - 每个不一致 slug 的 `hasRuntime`, `usageHasRuntime`, `promptHasRuntime`。

失败时建议执行：

```bash
npm run verify:yt-runtime-text > /tmp/yt-runtime-audit.txt
tsx scripts/generate-catalog.ts --asset-commit=<commit> <slug>
```

## 7. 交付说明

- 修改内容仅限一致性核验（不改 schema）。
- 如需“根因修复”才执行 catalog 重生；否则保持现状。
- 优先级：先通过核验，确认全量一致后再决定是否触发批量重生。
