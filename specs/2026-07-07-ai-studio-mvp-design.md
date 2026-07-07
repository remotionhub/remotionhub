# RemotionHub AI Studio MVP Design

## 1. 目标

本迭代的目标是交付一个最小可行的在线 AI 动画工作台，让用户在网页里输入提示词后，直接生成可播放、可下载的 Remotion 或 HyperFrames 成片。

第一版聚焦官网和产品演示场景，默认输出横屏 `16:9` 视频。产品形态参考即梦这类低操作创作入口，但 RemotionHub 的核心差异不是泛视频生成，而是复用已有开源模板、素材和 `agentPrompt`，用更可控的模板渲染链路生成稳定结果。

## 2. 核心结论

采用模板驱动的 Agent 生成方案：

1. 用户输入一段创作提示词。
2. 系统从 RemotionHub catalog 中自动推荐或允许用户手动选择模板/素材。
3. 模型基于用户提示词和模板元数据生成结构化 render plan。
4. 后台 worker 使用 Remotion 或 HyperFrames 渲染视频。
5. 页面展示生成状态，完成后提供在线播放和下载。

第一版不做时间线、多轨道、手动关键帧、代码编辑器或复杂素材上传。工作台不是传统剪辑器，而是一个“AI 制片台”：用户表达意图和选择素材，系统完成规划、合成、渲染和交付。

## 3. 范围

### 3.1 In Scope

- 新增在线工作台入口，例如 `/studio`。
- 支持 `16:9` 官网/产品演示动画生成。
- 支持 Remotion 和 HyperFrames 两类 runtime，但允许第一批模板先从稳定 runtime 开始白名单化。
- 支持 prompt 输入、模板推荐、模板手动选择、一键使用素材提示词。
- 支持生成任务状态展示：排队、规划、渲染、上传、完成、失败。
- 支持生成结果在线播放、下载。
- 支持每个登录用户 1-2 次免费生成额度。
- 支持失败任务不扣额度或自动返还额度。
- 记录模型调用、渲染输入输出和任务状态，便于排障和后续计费。

### 3.2 Out of Scope

- 时间线编辑器。
- 多轨道剪辑和素材逐帧调整。
- 用户在线编辑 Remotion 或 HyperFrames 源码。
- 任意代码生成和任意依赖安装。
- 批量素材上传、素材抠图、图片生成、文生图。
- 完整会员订阅、充值、发票、订单后台。
- 多人协作、项目文件夹、团队空间。

## 4. 用户体验设计

### 4.1 桌面布局

工作台采用左右结构：

- 左侧是对话和输入区，包含生成历史、当前 prompt、模板引用和生成按钮。
- 右侧是成片工作区，包含当前任务状态、视频播放器、下载入口、使用的模板和生成参数摘要。
- 素材/模板库以侧边抽屉、底部横向列表或右侧区域的卡片组出现，重点动作是“使用此模板”或“插入提示词”。

页面应保持工作台感，不做营销 hero。用户进入后第一屏即可输入 prompt 或选择模板。

### 4.2 移动布局

移动端不强求完整双栏体验：

- 顶部保留 prompt 输入和生成按钮。
- 中间展示生成状态和视频结果。
- 模板/素材卡片改为横向滑动列表。
- 历史记录收进抽屉。

### 4.3 核心流程

1. 用户进入 `/studio`。
2. 系统展示一个大输入框和推荐模板。
3. 用户输入产品演示需求，或点击模板卡片将 `agentPrompt` 注入输入框。
4. 用户点击生成。
5. 系统检查登录态和免费额度。
6. 系统创建 generation job，并进入规划状态。
7. 模型输出 render plan。
8. worker 渲染并上传视频。
9. 页面自动切换到播放器，显示下载按钮。

### 4.4 失败体验

失败状态必须让用户知道下一步能做什么：

- 模型无法规划：提示用户补充产品、场景、文案或目标受众。
- 模板不匹配：展示可手动选择的候选模板。
- 渲染失败：保留原 prompt，允许重试；如果已扣额度则自动返还。
- 超时：任务标记为失败或可恢复重试，避免前端无限等待。

## 5. 系统架构

### 5.1 组件边界

`Studio UI` 负责用户输入、模板选择、状态订阅、结果播放和下载。

`Generation Orchestrator` 负责创建任务、校验额度、推进状态、调用模型、写任务事件。

`Template Planner` 负责根据用户 prompt、catalog 元数据和模板能力生成结构化 render plan。

`Render Worker` 负责执行 Remotion 或 HyperFrames 渲染，上传 `mp4`、缩略图和 metadata。

`Usage Ledger` 负责记录免费额度发放、消耗、返还和未来付费充值的余额变化。

### 5.2 数据流

1. 前端调用 `createGenerationJob`。
2. Convex mutation 校验登录用户和额度，写入 `generationJobs` 和 `usageLedger`。
3. 后台 action 或外部 worker 拉取待处理任务。
4. planner 调用模型，输出 render plan。
5. worker 根据 render plan 执行渲染。
6. worker 上传 artifact，回写 `generationJobs`。
7. 前端订阅任务状态并展示结果。

## 6. 数据模型草案

### 6.1 generationJobs

记录一次用户生成任务。

关键字段：

- `userId`
- `status`
- `prompt`
- `runtime`
- `aspectRatio`
- `durationSeconds`
- `selectedComponentIds`
- `plannerOutput`
- `artifactId`
- `errorCode`
- `errorMessage`
- `createdAt`
- `updatedAt`

状态集合：

- `queued`
- `planning`
- `rendering`
- `uploading`
- `completed`
- `failed`
- `canceled`

### 6.2 generationJobEvents

记录任务状态流转，服务前端进度展示和后台排障。

关键字段：

- `jobId`
- `type`
- `message`
- `metadata`
- `createdAt`

### 6.3 generationArtifacts

记录生成结果。

关键字段：

- `jobId`
- `videoUrl`
- `thumbnailUrl`
- `storageKey`
- `durationSeconds`
- `aspectRatio`
- `runtime`
- `createdAt`

### 6.4 usageLedger

记录额度变化，而不是只在用户表上存一个计数器。这样后续免费次数、会员、积分充值、退款和运营赠送都能复用同一套账本。

关键字段：

- `userId`
- `kind`
- `amount`
- `balanceAfter`
- `jobId`
- `reason`
- `createdAt`

`kind` 初期只需要：

- `grant`
- `consume`
- `refund`

### 6.5 modelRuns

记录模型调用，便于成本分析和质量回放。

关键字段：

- `jobId`
- `provider`
- `model`
- `inputDigest`
- `outputDigest`
- `tokenUsage`
- `estimatedCost`
- `latencyMs`
- `createdAt`

## 7. 模板与素材复用

第一版应该建立模板白名单，而不是直接开放全部 catalog。每个可用于 AI Studio 的模板需要具备：

- 稳定预览视频。
- 明确 runtime。
- `16:9` 支持。
- 可被模型填写的 props schema。
- 高质量 `agentPrompt`。
- 适用场景标签，例如 `hero`、`product-demo`、`feature-showcase`、`dashboard`、`launch`。

现有 catalog 的 `agentPrompt` 可以作为模板能力描述和 prompt 注入来源。后续可以补充 `studioHints` 类元数据，但第一版可以先通过白名单配置或 catalog 扩展实现。

模板卡片在工作台中应强调三件事：

- 预览效果。
- 适用场景。
- 一键使用提示词。

## 8. 模型编排

模型不直接输出可执行代码。模型输出必须是结构化 render plan，便于校验、重试和渲染。

render plan 至少包含：

- 选择的模板。
- 用户意图摘要。
- 页面/镜头段落。
- 文案。
- 颜色和品牌风格。
- props 参数。
- 素材引用。
- 时长和节奏。

生成前必须做 schema validation。校验失败时，可以让模型修复一次；仍失败则任务失败并返还额度。

第一版模型 provider 应通过内部网关封装，避免前端直接接触 provider key。provider 选择、模型名称、限流策略和成本记录都在后端处理。

## 9. 渲染与存储

渲染链路应与网页请求解耦，避免长时间请求阻塞。

第一版可以使用以下执行方式之一：

- Convex action 调用外部 render service。
- 独立 worker 轮询 Convex 待处理任务。
- GitHub Actions 或临时队列只适合内部试验，不适合作为产品路径。

推荐使用独立 render worker，因为 Remotion 渲染通常需要 Node 环境、浏览器依赖、字体和较明确的资源限制。

渲染结果上传到对象存储，Convex 只保存 URL、metadata 和状态。前端播放使用 `videoUrl`，下载使用同一 artifact 或签名下载 URL。

## 10. 免费额度与付费预留

第一版只需要实现免费额度账本和消耗规则，不需要完整支付。

规则建议：

- 新用户首次登录获得 2 次免费生成额度。
- 创建任务并进入规划前消耗 1 次。
- 任务失败、取消或系统超时自动返还 1 次。
- 用户主动多次重试需要创建新任务并重新检查额度。

后续会员和积分充值可以基于 `usageLedger` 扩展：

- 会员每月 grant 固定额度。
- 积分充值写入 grant。
- 退款或补偿写入 refund。
- 高成本模型或长视频可以消耗更多 amount。

## 11. 安全与滥用控制

第一版必须避免任意代码执行。

安全边界：

- 模型只能选择白名单模板。
- render plan 必须通过 schema validation。
- worker 只能渲染已注册模板和受控 props。
- 视频时长、分辨率、fps、并发数必须有限制。
- 每个用户和 IP 需要基础限流。
- provider key 只能存在后端或 worker 环境。

## 12. 验证计划

### 12.1 单元测试

- usage ledger 消耗和返还。
- job 状态机合法流转。
- render plan schema validation。
- template selection helper。

### 12.2 集成测试

- 创建 job 时额度不足会拒绝。
- 创建 job 后状态可从 `queued` 推进到 `completed`。
- 失败任务会返还额度。
- catalog 模板白名单只返回 `16:9` 且可用于 studio 的素材。

### 12.3 浏览器验收

- `/studio` 首屏能输入 prompt。
- 模板卡片可注入 prompt。
- 生成任务创建后能看到状态变化。
- 完成任务显示视频播放器和下载入口。
- 无额度用户看到清晰的登录或充值提示。

## 13. 风险与缓解

模板覆盖不足是最大产品风险。缓解方式是先挑 20-30 个高质量官网/产品演示模板，并为每个模板准备黄金 prompt。

模型选择模板不准会影响体验。缓解方式是允许用户手动选择模板，并在 planner 输出前把选中模板作为硬约束。

渲染时间过长会影响转化。缓解方式是限制第一版视频时长，优先支持短视频段，例如 10-30 秒。

成本失控会影响免费策略。缓解方式是所有生成必须走 `usageLedger`，并记录 `modelRuns` 与 render duration。

任意代码生成会带来安全风险。第一版明确禁止模型生成可执行源码，只允许生成结构化 props。

## 14. 迭代顺序

第一步：数据和状态闭环。

- 增加 job、event、artifact、ledger、model run 数据结构。
- 实现创建任务、查任务、额度检查和失败返还。

第二步：工作台 UI。

- 新增 `/studio`。
- 实现 prompt 输入、模板列表、任务状态和结果播放器。

第三步：planner stub。

- 先用确定性规则或固定模板返回 render plan。
- 打通端到端任务状态和假 artifact。

第四步：接入真实模型。

- 接内部模型网关。
- 输出结构化 render plan。
- 加 schema validation 和一次修复。

第五步：接入 render worker。

- 执行白名单模板渲染。
- 上传 artifact。
- 回写完成状态。

第六步：扩大模板白名单。

- 从现有 catalog 中筛选官网/产品演示适用模板。
- 补齐 `agentPrompt`、标签和 props schema。

## 15. 验收标准

本 MVP 完成时应满足：

- 登录用户可以在 `/studio` 输入 prompt 并创建生成任务。
- 系统能检查和消耗免费额度。
- 工作台能展示任务进度。
- 至少一个白名单 Remotion 或 HyperFrames 模板可以被 prompt 驱动生成 `16:9` 成片。
- 完成后用户可以在线播放和下载视频。
- 失败任务不会永久消耗免费额度。
- 所有模型调用和渲染结果有可追踪记录。
