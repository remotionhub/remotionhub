# 发布链路问题 4 子项 6 设计：修正文档和命令不一致

## 背景

发布链路问题 4 的主问题仍包括缺少真实 `deploy.yml`、GitHub `Production` environment 未配置、域名与 TLS 状态异常等。本子项只处理文档和实际命令不一致，不实现完整发布链路，不配置远端服务，不做生产发布。

当前仓库是 npm 单应用结构，并通过 `Makefile` 提供本地开发和验证入口。`AGENTS.md` 的部分提交、PR、合并前说明仍残留来自其他仓库或旧布局的命令，例如 `bun run ci:static`、`bun run ci:packages`、`bun run ci:e2e-http`，以及 `packages/schema`、`packages/remotionhub` 的 monorepo TypeScript 检查路径。这些命令在当前仓库不存在，会误导后续 agent 和维护者。

## 已验证事实

- `package.json` 当前 package manager 入口是 npm scripts，没有 Bun lockfile，也没有 workspace package 布局。
- 当前 npm scripts 包括 `ci:unit`、`ci:types-build` 和 `ci:playwright-smoke`，不包括 `ci:static`、`ci:packages` 或 `ci:e2e-http`。
- `Makefile` 定义了 `make check`、`make e2e`、`make smoke`、`make typecheck`、`make build` 等本地验证入口。
- `make -n check` 展开为：

```bash
npm run test
npm run catalog:validate
VITE_CONVEX_URL="https://example.invalid" npx tsc --noEmit
VITE_CONVEX_URL="https://example.invalid" npm run build
```

- 在未安装依赖的 worktree 中，`make check` 会因为 `vitest` 不存在而失败；执行 `npm ci` 后，`make check` 已实际通过。
- 已验证通过的 `make check` 结果包括 23 个测试文件、164 个测试通过，catalog dry-run 验证 288 个组件，TypeScript 检查和 production build 通过。
- `.github/workflows/issue-5-security-quality.yml` 当前只运行 `npm audit --omit=dev --audit-level=high` 和 `npm run ci:unit`，不运行 `ci:static`。

## 目标

- 让 `AGENTS.md` 中的命令说明与当前真实 npm scripts、Makefile targets 和 CI workflow 一致。
- 明确 `make check` 是安装依赖后的主本地验证 gate，而不是不加条件的裸环境命令。
- 保留更细粒度的可执行命令，便于根据改动范围选择验证：
  - `npm run ci:unit`
  - `npm run ci:types-build`
  - `npm run ci:playwright-smoke`
  - `make e2e`
  - `make smoke`
- 删除或替换当前不存在的 Bun、workspace package、以及未定义 CI gate 表述。
- 避免让文档暗示发布链路问题 4 已经修好。

## 非目标

- 不新增 npm scripts。
- 不修改 `Makefile`。
- 不修改 GitHub Actions workflow。
- 不新增或修复 `deploy.yml`。
- 不配置 GitHub `Production` environment、repository secrets、Vercel、Convex 或域名/TLS。
- 不运行远端发布。
- 不重写历史规格文档中的历史命令，除非它们是当前指引文档的一部分。

## 方案

采用保守文档修正方案：只修改当前会直接指导 agent 和维护者操作的命令文档，优先修正 `AGENTS.md`，不通过新增脚本来适配旧文档。

### `AGENTS.md` 命令地图

`Build, Test, and Development Commands` 保持当前 npm 基础命令，同时补充当前常用 Makefile gate：

- `make check`：安装依赖后的主本地验证 gate，覆盖 unit tests、catalog validation、TypeScript check 和 build。
- `make e2e` / `make smoke`：需要本地 Convex 可用的 Playwright smoke path。
- `npm run ci:unit`：coverage gate。
- `npm run ci:types-build`：TypeScript check 和 build gate。
- `npm run ci:playwright-smoke`：build + Playwright test script，是否可用取决于测试环境和 Convex 前置条件。

### 提交和 PR 指引

将 `Commit & Pull Request Guidelines` 中的 Bun 和 monorepo 残留替换为当前真实命令：

- `bun run ci:static` 改为安装依赖后运行 `make check`。
- `bun run ci:unit` 改为 `npm run ci:unit`。
- `bun run ci:types-build` 改为 `npm run ci:types-build`。
- `bun run ci:playwright-smoke` 改为 `npm run ci:playwright-smoke`，并在需要本地 Convex fixture 的场景优先使用 `make e2e` 或 `make smoke`。
- 删除 `ci:packages` 和 `ci:e2e-http`，因为当前仓库没有这些 scripts。
- 删除 `bunx tsc -p packages/schema/tsconfig.json --noEmit` 和 `bunx tsc -p packages/remotionhub/tsconfig.json --noEmit`，改为当前单应用的 `npm run ci:types-build` 或 `make typecheck`。

### 发布段落

`Production Release` 可以保留“生产发布是手动流程”的定位，但必须避免把不存在或未验证的 `deploy.yml` 写成当前可执行事实。若保留发布 workflow 命令，应明确它属于目标发布链路或待补齐事项，不能作为本子项的验收证据。

## 风险与权衡

- 只修文档不能修复发布链路本身；这是本子项的有意边界。
- 不新增 `ci:static` 可以避免制造新的命令 API，但意味着后续若要统一 CI gate 名称，需要另起任务设计脚本层。
- 把 `make check` 写成主 gate 前必须保留依赖前置条件；否则新的 worktree 会因为未安装依赖而得到误导性失败。
- `npm run ci:playwright-smoke` 和 `make e2e` 的环境前置条件不同，文档需要避免把二者混成完全等价。

## 验证计划

文档修正实现后运行：

```bash
npx @tanstack/intent@latest list
npm pkg get scripts
make help
rg -n "bun|ci:static|ci:packages|ci:e2e-http|packages/schema|packages/remotionhub" AGENTS.md README.md
```

如果只修改文档，不需要重复运行重型测试。若实现过程中触碰 scripts、Makefile、workflow 或其他可执行配置，则补跑对应 gate：

```bash
npm run ci:unit
npm run ci:types-build
```

`make check` 已在设计阶段通过一次完整验证，可作为当前命令可用性的依据；实现阶段除非命令配置发生变化，不需要再次用它证明文档编辑本身。

## 验收标准

- `AGENTS.md` 不再建议当前不存在的 Bun、workspace package 或 CI gate 命令。
- `AGENTS.md` 明确当前 npm/Makefile 命令如何对应提交、PR 和合并前验证。
- 文档不声称生产发布链路已经可用或已修复。
- 文档和命令一致性检查没有发现目标残留字符串。
- 没有新增脚本、workflow、远端配置或发布行为。
