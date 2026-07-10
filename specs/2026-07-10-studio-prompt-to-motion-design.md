# RemotionHub Studio Prompt-to-Motion MVP Design

## 状态

设计已在对话中确认，等待书面规格复核。

## 背景

RemotionHub 当前提供 Remotion 与 HyperFrames Catalog、版本化源码指针、预览媒体和 Agent Prompt，但没有站内创作工作台。本阶段新增 `/studio`，让已登录用户通过自然语言生成 Remotion 动画、查看实时预览、继续对话修改、自动保存，并从兼容的 Catalog 版本创建 Remix 项目。

产品与生成链路参考 [remotion-dev/template-prompt-to-motion-graphics-saas](https://github.com/remotion-dev/template-prompt-to-motion-graphics-saas)，参考检查基于 commit `044db9d4e377df0b09da2afb28e762f3134ddf3b`。参考项目使用 Prompt 校验、Skill 检测、代码生成、响应清理、浏览器内 Babel 编译、`new Function` 动态组件、Remotion Player 和最多三次自动纠错。

RemotionHub 不引入参考项目的 Next.js 应用壳层。MVP 将这些能力适配到现有 React 19、TanStack Start、TanStack Router、Convex Auth、Convex 数据层和 RemotionHub 设计系统中。

## 目标

- 在新的 `/studio` 命名空间提供 Prompt-to-Motion 功能。
- 只有 GitHub 登录用户可以生成、修改和保存项目。
- 支持从 Prompt 新建项目，以及从兼容的 Catalog 版本创建 Remix 项目。
- 使用对话与预览双栏工作台，保持 RemotionHub 现有 Geist、灰阶、轻青色强调和细边框视觉语言。
- 用户只能通过对话修改动画；MVP 不展示或编辑生成源码。
- 生成代码在浏览器主页面中动态编译，并由 Remotion Player 实时预览。
- 每次成功生成或修改形成可回退 Revision。
- 生成、编译或运行失败时保留最后一次可运行预览。
- 复用现有 Convex Auth 和 `requireUser()`，在所有后端读写路径执行项目所有权校验。

## 非目标

- 不提供 Monaco、源码查看、源码复制或手工源码编辑。
- 不支持图片附件、拖放素材或当前帧作为模型输入。
- 不提供模型选择器；客户端只使用服务端模型别名。
- 不提供云端渲染、高清导出或视频下载。
- 不提供项目分享、多人协作、公开预览或发布回 Catalog。
- 不安装或执行任意 npm 依赖。
- 不接收用户上传或粘贴的源码。
- 不在 MVP 中实现 iframe、独立 Preview Origin、远端执行容器或完整浏览器沙箱。
- 不保证所有 Catalog 版本都能 Remix；只有发布了已验证 Studio Bundle 的版本才兼容。

## 关键决策

### 集成策略

采用选择性移植，而不是嵌入或并行部署参考 Next.js 应用：

- 适配 Prompt 校验、Skill 检测、生成、精确编辑、响应清理、编译、Player 和自动纠错行为。
- 使用 TanStack Router 管理 `/studio` 路由。
- 使用 Convex 保存项目、消息、Revision 和 Generation Run。
- 使用现有 Convex Auth 保护生成与数据访问。
- 完全重写 UI，避免与现有 Catalog 产生视觉割裂。

参考仓库根目录在检查时没有独立、清晰的 `LICENSE` 文件。实现阶段不得默认复制其源码或 Skill 文本；应以行为和架构为参考进行适配实现，除非在复制前另行确认授权。Remotion 商业使用还需遵守其当前授权条件，尤其是面向用户的视频创建工具场景。

### MVP 执行模型

MVP 采用参考项目的浏览器内执行方式：

```text
Generated TSX
  -> sanitize response
  -> strip and validate imports
  -> Babel transform
  -> new Function with injected APIs
  -> React component
  -> Remotion Player
```

用户不能查看或编辑源码，但浏览器仍需取得源码并执行，才能提供实时 Player 预览。隐藏编辑器减少了产品暴露面，不构成安全隔离。

### 已知安全限制

同页面 `new Function` 不能可靠阻止生成代码访问 `window`、DOM、浏览器存储、网络 API 或阻塞主线程。Import 白名单、源码长度限制、静态语法检查和错误边界只能降低误用概率，不能形成可信沙箱。

本限制在 MVP 中被明确接受，并附带以下范围约束：

- 仅已登录用户可以触发生成。
- 项目始终私有，只能由所有者读取和运行。
- 不执行其他用户提交的项目。
- 不支持公开分享、源码上传、源码粘贴或手工源码编辑。
- Catalog Remix 仅使用 RemotionHub 发布流程验证过的 Studio Bundle。
- 流式内容不执行；只在完整响应清理与校验后编译。
- 每次失败都回退到最后一次可运行 Revision。

这些约束不能消除同源执行风险。任何公开分享、第三方源码、协作或源码编辑能力上线前，都必须重新设计 Preview 隔离边界。

## 路由与页面结构

### `/studio`

`/studio` 是极简新建入口：

- 主 Prompt 输入区。
- 少量官方 Prompt 示例。
- 已登录用户的最近项目。
- 简短能力说明，不复制完整 Catalog。

未登录用户可以查看页面，但提交 Prompt 时必须登录。提交前的 Prompt 保存在 `sessionStorage`，登录回跳后恢复；Prompt 不写入 URL、OAuth redirect 参数或日志。

首次提交成功后创建项目并导航到 `/studio/$projectId`。

### `/studio/$projectId`

项目工作台仅对所有者开放：

- 桌面端左侧为 Assistant 对话、生成状态和 Follow-up 输入。
- 桌面端右侧为 Remotion Player 预览。
- 顶部项目栏展示名称、自动保存状态、Catalog 来源、历史入口和低频 Composition 设置。
- 不显示 Code 页签或第三个属性栏。
- 移动端使用 `Chat` 与 `Preview` 两个互斥页签。
- Studio 页面保留 RemotionHub 全局 Header，但不显示 Footer。

无法访问的项目统一显示不可用状态，前端不区分不存在与无权限，避免泄漏项目标识。

### Catalog Remix

存在已验证 Studio Bundle 的 Catalog 版本显示 `Remix in Studio`。点击后：

1. 未登录用户先完成登录。
2. 后端重新读取指定 Component Version 和 Studio Bundle。
3. 创建包含固定版本、Git commit、入口文件和内容哈希的项目快照。
4. 创建初始 Revision。
5. 导航到 `/studio/$projectId` 并显示可运行预览。

没有 Studio Bundle 的版本不显示不可兑现的 Remix 操作，继续保留现有源码和 Agent Prompt 使用路径。

## 视觉与交互设计

### 桌面布局

工作台采用已确认的 Guided Split：

- 左栏宽度约 `356px`，承担完整对话流程。
- 右侧使用剩余空间展示 Preview。
- 项目栏与全局 Header 分层，避免把项目操作混入站点导航。
- Prompt 输入固定在左栏底部。
- History 作为项目栏入口打开，不常驻第三栏。
- 时长、FPS、宽高等配置通过轻量 Dialog 修改。

### 生成阶段

用户看到阶段状态而不是源码流：

```text
Validating
Selecting skills
Generating
Compiling
Preview ready
```

生成期间保留最后一次可运行 Preview。只有新候选代码完整、清理完成并编译成功后，才替换 Player 中的组件。

### 历史与回退

- History 展示 Revision 时间、来源和简短修改摘要。
- AI 生成、AI Follow-up、自动纠错和回退均形成 Revision。
- 回退不删除后续历史，而是基于旧 Revision 创建新的当前 Revision。
- 用户不需要理解 Git、commit 或源码 diff。

## 数据模型

### `studioProjects`

项目是稳定身份和当前状态投影：

- `ownerId`
- `title`
- `status`: `active | archived`
- `sourceKind`: `prompt | catalog-remix`
- 可选 Catalog 来源：`componentId`、`componentVersionId`、`ownerHandle`、`slug`、`version`、`commit`、`entryPoint`、`bundleHash`
- 可选 `currentRevisionId`
- 可选 `lastRunnableRevisionId`
- 可选 `currentRunId`
- Composition 投影：`width`、`height`、`fps`、`durationInFrames`
- `createdAt`
- `updatedAt`

索引：

```text
by_owner_updated: [ownerId, updatedAt]
by_owner_status_updated: [ownerId, status, updatedAt]
```

### `studioRevisions`

Revision 是不可变的可回退快照：

- `projectId`
- `sequence`
- 可选 `parentRevisionId`
- `origin`: `prompt | catalog-remix | follow-up | correction | rollback`
- `code`
- `codeHash`
- Composition：`width`、`height`、`fps`、`durationInFrames`
- 可选 `promptMessageId`
- `assistantSummary`
- `createdAt`

MVP 没有手工源码编辑，因此不需要单独的可变源码 Draft 表。Generation Run 中的候选源码在成功前保持瞬态；只有编译成功的候选进入 Revision。

### `studioMessages`

消息独立存储并分页读取：

- `projectId`
- `role`: `user | assistant | system`
- `kind`: `prompt | response | status | error`
- `content`
- 可选 `generationRunId`
- 可选 `revisionId`
- `createdAt`

索引：

```text
by_project_created: [projectId, createdAt]
```

### `studioGenerationRuns`

Generation Run 记录一次生成或纠错尝试：

- `projectId`
- `ownerId`
- `status`: `queued | validating | selecting-skills | generating | compiling | succeeded | failed | cancelled`
- 可选 `inputRevisionId`
- `promptMessageId`
- `modelAlias`
- `detectedSkills`
- `correctionAttempt`
- 可选 `candidateCode`
- 可选 `candidateHash`
- 可选 `errorCode`
- token 用量与耗时
- `idempotencyKey`
- `createdAt`
- `updatedAt`

同一项目最多有一个活动 Run。开始 Run 的 Mutation 必须在同一事务中完成所有权校验、并发检查、消息写入和 Run 创建。

候选代码由后端生成并保存。客户端编译候选后调用带 `runId` 与 `candidateHash` 的确认 Mutation；后端重新校验所有权、Run 状态和哈希，才创建 Revision。客户端报告的“可编译”只影响该用户项目的 Preview 状态，不能作为安全、发布或计费依据。

### `studioBundles`

Studio Bundle 是 Catalog Version 到 Studio 的显式兼容层：

- `componentVersionId`
- `entryPoint`
- 自包含 TSX 源码
- 允许的外部依赖列表
- 固定 Git commit 和源路径
- `contentHash`
- `status`: `validated | removed`
- `createdAt`

发布流程必须把本地相对 import 预打包为单个自包含入口；外部 import 只能来自 Studio Runtime 白名单。只有 `validated` Bundle 能创建 Remix 项目。

## 所有权与访问控制

现有 `convex/lib/access.ts` 的 `requireUser()` 作为基础，新增 `requireStudioProjectOwner()`：

1. 读取当前 Convex Auth 用户。
2. 读取项目。
3. 比较 `project.ownerId` 与当前用户 ID。
4. 失败时返回统一授权错误。

所有 Project、Revision、Message、Run 查询和 Mutation 都必须调用该检查。前端隐藏按钮、路由守卫或项目 ID 不构成授权。

内部 Action 和 Mutation 不能接受客户端传入的 `ownerId` 作为授权依据。异步任务通过 Run 反查 Project 和 Owner。

## 生成与修改链路

### 后端编排

公开 Mutation 只负责鉴权、并发控制和创建 Run，随后调度内部 Convex Action。Action 从 Convex 环境读取 OpenAI Key，更新 Run 阶段，调用模型，并把完整候选源码写回 Run。MVP 不需要把源码 token 持续写入数据库；用户界面只订阅阶段状态。

浏览器取得完整候选后进行清理后的最终编译：

- 成功时提交 `acceptCandidate(runId, candidateHash)`。
- 失败时提交 `rejectCandidate(runId, candidateHash, normalizedError)`。
- `acceptCandidate` 原子创建 Revision，并更新 `currentRevisionId` 与 `lastRunnableRevisionId`。
- `rejectCandidate` 保留项目指针，并调度下一次纠错；达到三次上限后结束 Run。

### 首次生成

```text
submit prompt
  -> require authenticated user
  -> create project, message, and run atomically
  -> validate motion prompt
  -> detect relevant skills
  -> generate complete TSX
  -> sanitize and validate candidate
  -> client compiles candidate
  -> create revision on success
  -> update project pointers
```

Prompt 校验失败时保留用户输入和项目，Run 标为失败，不创建 Revision。

### Follow-up 修改

Follow-up 请求包含当前 Revision、最近对话和已使用 Skills。模型优先返回结构化精确编辑：

```text
old_string + new_string + description
```

服务端只在 `old_string` 唯一匹配时应用修改。多个匹配或零匹配均视为编辑失败，不猜测目标位置。修改范围过大时允许返回完整替换源码。

### 自动纠错

- 编译错误和 Player Runtime Error 都可以触发自动纠错。
- 错误归一化后发送给模型，不发送无关浏览器或账户信息。
- 最多自动纠错三次。
- 每次纠错都关联原 Run 和尝试次数。
- 纠错成功创建 Revision；失败不覆盖 `lastRunnableRevisionId`。

## 编译与 Preview Runtime

运行时选择性适配参考项目的 Compiler 行为：

- 支持 React、Remotion、Remotion Shapes、Transitions、Lottie 和明确允许的 Three.js 能力。
- 移除静态 import，并由 Runtime 注入允许 API。
- 使用 Babel Standalone 转换 TypeScript 与 JSX。
- 从约定导出的组件中提取组件体。
- 使用 `new Function` 创建动态组件。
- 使用 Error Boundary 捕获可捕获的 Runtime Error。
- 完整响应到达前不编译。
- 页面恢复时从当前 Revision 重新编译。

编译器必须有明确的源码大小、Composition 尺寸、FPS 和时长上限。MVP 不解析任意 package、远程 module 或用户提供的构建配置。

## 模型与 Skills

- OpenAI Key 只保存在 Convex 后端环境。
- 客户端使用固定别名 `studio-default`，不暴露具体模型选择。
- 后端可以在不改客户端的情况下切换别名对应的模型。
- Prompt 校验与 Skill 检测失败时应采用明确降级：校验服务异常时允许进入生成；Skill 检测异常时使用基础 Prompt，不注入 Skill。
- 已在对话中使用的 Skills 不重复注入，避免上下文持续膨胀。
- 模型上下文只包含当前 Revision、必要的 Catalog 来源和有界的最近消息，不无限发送完整历史。

首期 Skill 范围与参考项目保持一致的能力类别，但 Skill 内容必须在授权约束下重新整理：Typography、Charts、Messaging、Transitions、Sequencing、Spring Physics、Social Media 和 3D。

## 自动保存与并发

- 项目名称和 Composition 设置变更自动保存。
- 生成源码只在成功形成 Revision 后保存为当前版本。
- 相同 `idempotencyKey` 的重复提交返回已有 Run。
- 项目存在活动 Run 时拒绝第二次提交，并返回当前 Run。
- 多标签页通过 Convex 订阅共享当前 Run 和 Revision；后到的页面不能覆盖新版本。
- 回退和新生成都检查预期 `currentRevisionId`，避免基于过期版本写入。

## 错误处理

### 用户可见错误

- 无效 Prompt：说明需要描述视觉或动画内容，并给出示例。
- 模型或网络错误：保留当前 Preview，允许重试。
- 编译错误：显示自动修复进度；三次失败后提供 Retry。
- Runtime Error：停止当前候选，恢复最后可运行 Preview。
- 所有权错误：显示统一不可用页面。
- Catalog Bundle 被移除：已有项目继续使用快照，新 Remix 操作不可用。

### 内部错误

- Run 保存稳定 `errorCode`，用户界面使用本地化映射。
- 原始模型响应、堆栈和后端异常不直接返回用户。
- 日志包含 Run ID、阶段、模型别名、耗时和 token 用量，不记录完整 Prompt 或源码。

## 国际化、响应式与可访问性

- 所有 Studio UI 文案进入现有 `I18nProvider` 词条。
- 默认中文，英文切换沿用全局设置。
- 生成阶段使用文本与图标，不只依赖颜色。
- Chat、Preview、History 和 Settings 有明确可访问名称。
- 移动端 Chat 与 Preview 页签保留键盘和屏幕阅读器语义。
- Player 错误状态提供文本替代，不把错误只画在视频区域内。
- `prefers-reduced-motion` 仅影响 Studio UI 动效，不改变用户生成的 Remotion 内容。

## 验证策略

### 单元测试

- Markdown fence 清理与组件源码提取。
- import 清理和依赖白名单。
- 精确编辑的零匹配、唯一匹配和多匹配。
- Prompt 校验与 Skill 检测降级。
- Revision 回退语义。
- 生成并发和幂等键。
- Composition 参数上下限。

### Convex 测试

- 未登录用户不能创建或读取项目。
- 用户不能读取、修改或运行其他用户的项目。
- 同一项目只允许一个活动 Run。
- 成功生成原子更新 Revision 和 Project 指针。
- 失败候选不改变 `lastRunnableRevisionId`。
- 回退创建新 Revision，不删除历史。
- Removed Studio Bundle 不能创建新 Remix。

### 组件与路由测试

- `/studio` 未登录提交触发登录，并恢复 `sessionStorage` Prompt。
- 已登录用户看到最近项目。
- Studio 路由保留 Header、不显示 Footer。
- 桌面双栏与移动端 Chat/Preview 页签。
- 生成阶段、失败、重试和自动纠错状态。
- History 选择与回退确认。

### 浏览器测试

- 使用稳定模型 Stub 完成首次生成、编译和 Player 预览。
- Follow-up 精确修改后预览更新。
- 编译失败触发纠错，并保留上一个 Preview。
- 刷新后从当前 Revision 恢复。
- Catalog Detail 创建 Remix 项目。
- 不存在 Studio Bundle 时不显示 Remix 操作。

真实 OpenAI 调用只在显式环境开关下执行冒烟测试，不进入常规确定性 CI。

### 完成交付前验证

- 运行 Studio 相关的目标测试。
- 运行 `npm run ci:unit`。
- 运行 `npm run ci:types-build`。
- 运行 `make check` 作为最终本地门禁。
- 通过真实本地 RemotionHub 实例进行浏览器视觉验收；不得使用静态 Mockup 代替交付截图。

## 验收标准

- `/studio` 可访问，未登录用户不能生成。
- 登录后可以从 Prompt 创建私有项目并看到 Remotion Player 预览。
- 用户可以通过 Follow-up 修改动画，但无法查看或编辑源码。
- 每次成功修改形成可回退 Revision。
- 编译和运行失败不会破坏最后一次可运行 Preview。
- 兼容的 Catalog 版本可以创建固定源码快照的 Remix 项目。
- 不兼容的 Catalog 版本不显示 Remix 操作。
- 所有后端 Project、Revision、Message 和 Run 访问均校验所有权。
- MVP 不包含下载、分享、协作、代码编辑或任意依赖安装。
- 同页面动态执行的安全限制在实现、测试和后续演进文档中保持明确，不被描述为安全沙箱。

## 后续演进

按优先级考虑：

1. 独立 Preview Origin 或远端执行环境。
2. 图片附件与当前帧视觉反馈。
3. 云端高清渲染和下载。
4. 源码查看与受控编辑。
5. 项目分享、协作与发布到 Catalog。
6. 更丰富的依赖与多文件项目支持。

任何扩大代码来源或项目可见性的演进，都必须先升级执行隔离，而不能继续依赖 MVP 的同页面 `new Function` 模型。
