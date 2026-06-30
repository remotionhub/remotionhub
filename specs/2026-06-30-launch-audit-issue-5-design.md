# 上线审计问题 5 设计：依赖安全、覆盖率门禁与仓库治理

## 背景

上线审计问题 5 包含三个相关但可独立回滚的风险面：生产依赖漏洞、覆盖率门禁缺失，以及 GitHub 仓库安全能力未启用。三者共同决定代码进入 `main` 前是否满足最低安全质量要求，因此使用一个统一设计管理最终验收，同时拆成三个实施阶段分别验证。

当前基线如下：

- `npm audit --omit=dev` 报告 3 个 High，涉及直接依赖 `convex@1.41.0` 及传递依赖 `ws`、`undici`。
- `convex@1.41.0` 使用 `ws@8.20.1`；`convex@1.42.1` 已使用 `ws@8.21.0`。
- `undici@7.27.2` 除开发依赖外，还由生产依赖 `shadcn` 的依赖链引入。
- `shadcn` 不能直接移到 `devDependencies`，因为 `src/styles.css` 引用了 `shadcn/tailwind.css`。
- 现有 15 个测试文件共 58 个测试通过。
- 当前覆盖率为 Statements 70.82%、Branches 58.29%、Functions 72%、Lines 72.4%，但只统计测试实际加载的文件，不是真实的全局覆盖率。
- GitHub Dependabot vulnerability alerts 已启用；secret scanning、push protection、Dependabot security updates 均未启用。
- `main` 当前没有 branch protection 或 repository ruleset，仓库内也没有 GitHub Actions workflow。

## 目标

- 将生产依赖中的 Critical 和 High 漏洞降为 0，并建立可重复执行的审计门禁。
- 对 `src/**`、`convex/**`、`shared/**` 以及仍受支持的 catalog 生成和导入脚本建立包含未加载文件的真实全局覆盖统计。
- 强制 Statements、Branches、Functions、Lines 四项全局覆盖率均不低于 80%。
- 启用 GitHub secret scanning、push protection 和 Dependabot security updates。
- 处置启用扫描后发现的全部历史 secret 告警：有效凭据必须轮换或撤销，误报必须有明确的 dismiss 理由。
- 通过独立 workflow 和 required checks 在 `main` 上强制执行生产依赖审计与单元测试覆盖率门禁。
- 独立记录上线审计问题 1/2 的既有失败，避免它们掩盖或污染本问题的验证结果。

## 非目标

- 不修复上线审计问题 1/2 或其他无关失败。
- 不升级与漏洞修复无关的直接依赖。
- 不通过排除关键生产代码、降低指标或只统计已加载文件提高覆盖率。
- 不要求 Moderate 和 Low 漏洞为 0；它们需要记录并进入后续跟踪。
- 不进行无关业务重构。仅允许为可测试性做局部、行为保持的拆分。
- 不为已退役的一次性迁移脚本 `scripts/clean-existing-tags.ts` 和 `scripts/scrape-prompts.ts` 补测试；它们不再属于受支持的生产或运维路径。
- 不在本问题中增加审批人数、CODEOWNERS、签名提交或额外 secret 扫描模式。
- 不自动部署、提交、推送或创建 PR。

## 总体方案与阶段边界

问题 5 使用一个设计和一个最终验收标准，但分成三个阶段：

1. 依赖安全：修改依赖清单和 lockfile，使生产依赖 Critical/High 为 0。
2. 覆盖率：固定真实统计边界，补齐行为测试，并启用四项 80% threshold。
3. 仓库治理：增加独立 workflow；经再次明确授权后修改 GitHub 远端设置、处置历史 secret 告警并建立 required checks。

三个阶段分别验证和回滚。只有三个阶段全部通过，问题 5 才能关闭。任一阶段失败时，不回滚其他已经验证且安全的阶段，但整体状态保持未完成。

## 阶段 1：依赖安全

### 升级策略

- 将直接依赖最低版本从 `convex ^1.41.0` 提升到 `^1.42.1`，避免新安装再次选择已知易受影响版本。
- 通过正常 lockfile 解析将 Convex 内部 `ws` 提升到 `8.21.0` 或更高的兼容版本。
- 在现有 semver 约束内单独刷新 `undici` 到 `7.28.0` 或更高的兼容 7.x。
- 保留 `shadcn` 在生产依赖中。
- 禁止使用 `npm audit fix`。
- 不预先增加 `overrides`。只有正常依赖解析无法获得安全版本时，才暂停实施并重新评估 override 的兼容性与长期维护成本。
- 实施前检查 Convex 1.42.x release notes，核对当前使用的 client、server function、schema、generated API 和 `convex-test` 兼容性。
- `convex-test@0.0.53` 声明的 peer dependency 为 `convex ^1.32.0`，semver 范围覆盖 1.42.x，因此不预设 peer 冲突。仍需以实际安装、测试和类型检查结果确认运行兼容性。

### 风险控制

- Convex minor upgrade 可能影响类型生成、客户端行为或开发/部署工具行为，因此需要覆盖测试、类型检查和构建验证。
- 如果 `convex-test@0.0.53` 在 1.42.x 上出现实际运行或类型不兼容，先评估升级到保持兼容的 `convex-test` 版本；不得用 override 掩盖 peer 或运行时不兼容。若没有兼容版本，则本阶段回滚并保持未完成。
- lockfile 刷新可能顺带移动其他满足既有范围的传递依赖。必须审阅完整 lockfile diff，拒绝无关的大范围漂移。
- `undici` 修复涉及网络协议行为，需要关注代理、HTTP 与 WebSocket 使用路径是否出现回归。
- 类型或构建命令若命中问题 1/2 的既有失败，必须与修改前基线比较。只有新增失败归因于本阶段，既有失败单独记录且不顺手修复。

### 验证

```text
npm ls convex ws undici
npm audit --omit=dev --audit-level=high
npm run test -- convex/components.test.ts
npm run test
npm run ci:types-build
```

验收条件：

- 生产依赖审计命令成功，Critical/High 均为 0。
- `convex` 不再解析到 `1.41.0`，其内部 `ws` 不低于 `8.21.0`。
- `undici` 不再落入已知受影响范围。
- 没有新增测试、类型或构建失败。

### 回滚

- 仅回退本阶段对 `package.json` 和 `package-lock.json` 的修改，再用原 lockfile 恢复依赖树。
- 如果安全版本存在无法接受的兼容问题，本阶段保持未完成；不得降低安全门禁或忽略 advisory。

## 阶段 2：覆盖率口径与硬门禁

### 统计边界

覆盖率显式包含：

```text
src/**/*.{ts,tsx}
convex/**/*.{ts,tsx}
shared/**/*.{ts,tsx}
scripts/generate-catalog.ts
scripts/import-catalog.ts
```

只允许排除：

- `**/*.test.{ts,tsx}` 与 `**/*.spec.{ts,tsx}`；
- `src/routeTree.gen.ts`；
- `convex/_generated/**`；
- 已退役的一次性脚本 `scripts/clean-existing-tags.ts` 和 `scripts/scrape-prompts.ts`；
- TypeScript 声明文件；
- 上述显式统计边界之外的配置文件、E2E 测试和非生产资产。

`scripts/generate-catalog.ts` 和 `scripts/import-catalog.ts` 仍被 catalog 生成、`package.json` 与 `Makefile` 的导入流程调用，属于受支持的运维代码，必须纳入统计。两个已退役脚本的排除是生命周期分类，不是临时降低覆盖率要求；如果未来恢复使用，必须先重新纳入覆盖统计并补足测试。

### 门禁迁移

1. 在当前从零开始的 coverage 配置中显式设置 `provider: 'v8'` 和 `coverage.include`，暂不启用 threshold，取得包含所有未加载生产文件的真实基线。依据 [Vitest 4 coverage 配置](https://vitest.dev/config/coverage.html)，Vitest 4 不再提供旧的 `coverage.all`；显式 `coverage.include` 负责将匹配但未被测试加载的文件纳入报告和全局 threshold。
2. 按风险和覆盖缺口补测试。必要时提取纯函数、注入文件系统或网络依赖，并分离 CLI 入口与核心逻辑；这些重构必须保持现有行为。
3. 四项实际达到 80% 后，一次性启用全局 threshold：
   - Statements 不低于 80%；
   - Branches 不低于 80%；
   - Functions 不低于 80%；
   - Lines 不低于 80%。
4. `npm run coverage` 与 `npm run ci:unit` 使用同一 Vitest 配置，避免本地和 CI 统计口径分叉。

### 测试重点

- `scripts/generate-catalog.ts` 与 `scripts/import-catalog.ts`：参数解析、dry-run、输入校验、文件异常、网络异常、部分失败和幂等行为。
- `convex/**`：正常路径、权限与所有权边界、缺失数据、非法状态及错误传播。
- `src/routes/**` 和当前未被测试加载的组件：路由分支、空态、错误态和用户交互。
- `shared/**`：边界值及无效 catalog 数据。
- 所有新增测试必须包含行为断言，禁止只为执行行数而调用代码。

### 验证

```text
npm run test
npm run coverage
npm run ci:unit
```

除检查命令退出状态和四项汇总数据外，还必须检查覆盖报告文件清单。`convex/lib/catalog.ts`、`scripts/generate-catalog.ts`、`scripts/import-catalog.ts` 和至少一个原先未被测试加载的 `src/**` 文件必须明确出现在报告中；这是判断真实统计口径是否生效的必要验收条件。报告还必须覆盖三个代码根目录内的全部非生成生产文件。

### 风险与回滚

- 真实基线预计明显低于当前 70.82%，测试工作量可能扩大；不允许通过缩小 include 范围消化缺口。
- CLI 脚本测试不得访问真实外部服务或污染工作树，必须使用依赖注入、mock 和临时目录隔离。
- 可以整体回退本阶段新增测试、局部可测试性重构和覆盖配置，但回退后问题 5 恢复为未完成。
- 完成后不得单独删除 threshold、降低数字或扩大 exclusions。

## 阶段 3：GitHub 安全治理与远端门禁

任何远端变更都必须在实施阶段再次取得明确授权。

### 独立 workflow

新增 `.github/workflows/issue-5-security-quality.yml`，workflow 显示名称固定为 `Issue 5 Security and Quality`，并包含两个稳定命名的 job：

- Job ID `production-audit`，显示名称 `Issue 5 / Production audit`
  - `npm ci`
  - `npm audit --omit=dev --audit-level=high`
- Job ID `unit-coverage`，显示名称 `Issue 5 / Unit coverage`
  - `npm ci`
  - `npm run ci:unit`

workflow 在 pull request 和 `main` push 上运行，权限最小化为 `contents: read`，使用 Node.js 22，并将 GitHub-maintained actions 固定到完整 commit SHA。Node.js 22 与仓库的 `@types/node ^22` 对齐，避免无必要地引入运行时版本差异。不运行问题 1/2 对应的综合检查。Job 与 check 名称是 branch protection 引用的持久接口，后续不得无迁移地重命名。

### Required checks

只有在 workflow 已成功产生两个 check context 后，才为 `main` 建立 branch protection：

- 要求 `Issue 5 / Production audit` 与 `Issue 5 / Unit coverage` 成功；
- 启用 strict status checks，要求基于最新 `main` 验证；
- 管理员同样受约束；
- 不额外启用审批人数、CODEOWNERS 或签名提交要求；
- 保持 force-push 和 branch deletion 禁止状态。

该配置会改变当前允许直接推送 `main` 的行为。以后进入 `main` 的提交必须拥有两个成功 check。

### Secret scanning 与 push protection

1. 保存远端设置基线。
2. 启用 secret scanning。
3. 拉取全部 open alerts，但不得在日志、spec 或 PR 文本中输出 secret 内容。
4. 对有效 secret，先在对应提供方轮换或撤销，验证旧凭据失效，再关闭告警并记录不含敏感值的依据。
5. 对误报使用准确的 dismiss reason，并补充不含敏感值的审计说明。
6. 全部历史告警清零后启用 push protection。
7. 通过设置或 API 状态验证 push protection，不使用真实 secret 做推送测试。
8. 不启用 non-provider patterns 等未明确要求的扩展扫描功能。

### Dependabot security updates

- 仅在生产依赖 Critical/High 清零后启用，避免初始漏洞噪声与本次修复混合。
- 保留现有 Dependabot vulnerability alerts。
- 验证 automated security fixes 状态为 enabled。
- 后续 Dependabot PR 同样必须通过两个 required checks。

### 远端验证

通过 GitHub API 重新读取并确认：

- `secret_scanning.status == enabled`；
- `secret_scanning_push_protection.status == enabled`；
- `dependabot_security_updates.status == enabled`；
- open secret-scanning alerts 数量为 0；
- `main` protection 包含两个 required checks；
- 两个 check 在目标提交上均成功。

### 回滚

- workflow 或 branch protection 配置错误时，按实施前快照恢复对应设置，避免锁死 `main`。
- Secret scanning、push protection 和 Dependabot 可分别回退，不做全量联动关闭。
- 已轮换或撤销的 secret 不恢复旧值。
- required check 因 GitHub 或 npm 基础设施故障持续不可用时，临时解除必须由管理员明确批准并留下审计记录，恢复后立即重新启用。

## 实施顺序

1. 记录依赖、覆盖率、测试、问题 1/2 既有失败和 GitHub 设置基线。
2. 完成依赖安全阶段并独立验证。
3. 完成覆盖率阶段并独立验证。
4. 增加独立 workflow，确认两个 check context 能正常产生并通过。
5. 再次取得远端变更授权。
6. 启用 secret scanning，处置全部历史告警，再启用 push protection。
7. 启用 Dependabot security updates。
8. 最后建立 required checks，避免不存在的 check 锁死 `main`。

## 最终验收

问题 5 只有在以下条件同时满足时才能关闭：

- 生产依赖 Critical/High 为 0。
- `convex`、`ws` 和 `undici` 均解析到安全版本。
- 58 个现有测试及新增测试无回归。
- 严格统计边界下四项覆盖率均不低于 80%。
- Vitest threshold 已启用并能够阻止低覆盖提交。
- 两个独立 GitHub check 在目标提交上成功，且被 `main` 强制要求。
- Secret scanning、push protection 和 Dependabot security updates 均已启用。
- Open secret alerts 为 0；有效凭据已失效，误报有明确依据。
- 问题 1/2 的既有失败没有被修改、隐藏或错误归因。
- 没有无关依赖升级、业务重构或部署操作。
