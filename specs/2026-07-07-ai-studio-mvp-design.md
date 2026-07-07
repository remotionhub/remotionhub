# RemotionHub AI Studio MVP Design

## 1. 目标

本迭代的目标是交付一个最小可行的在线 AI 动画工作台，让用户在网页里输入提示词后，生成可在线播放和下载的 `16:9` MP4 视频。MVP 阶段由 Remotion 白名单模板完成渲染，系统架构预留 HyperFrames runtime。

第一版聚焦官网和产品演示场景。产品形态参考即梦这类低操作创作入口，但 RemotionHub 的核心差异不是泛视频生成，而是复用已有开源模板、素材和 `agentPrompt`，用更可控的模板渲染链路生成稳定结果。

## 2. 核心结论

采用模板驱动的 Agent 生成方案。

MVP 分为两个验收层级：P0 技术闭环和 MVP 上线。P0 技术闭环只需要 1 个 Remotion 白名单模板打通 `prompt -> render plan -> worker render -> MP4 playback/download`。MVP 上线阶段只支持 Remotion runtime，但需要至少 5 个高质量白名单模板，理想目标为 5-10 个。HyperFrames、素材上传、源码下载、智能模板推荐和完整付费系统都不进入本阶段。

1. 用户输入一段创作提示词。
2. 用户可以从 RemotionHub catalog 白名单模板中手动选择模板。
3. 用户确认最终使用的模板。
4. 后端在同一事务中创建 `queued` 状态的 generation job，并写入 `consume:{jobId}` 的 usage ledger 记录。
5. 模型基于用户提示词和模板元数据生成结构化 render plan。
6. 后台 worker 使用受控 Remotion 模板渲染视频。
7. 页面展示生成状态，完成后提供 MP4 在线播放和下载。

如果用户没有手动选择模板，MVP 使用后台配置的默认模板规则选择模板并要求用户确认。默认模板规则先采用白名单模板的 `priority` 排序，选择 `priority` 最高且状态为 `active` 的模板。智能模板推荐放到后续版本。

第一版不做时间线、多轨道、手动关键帧、代码编辑器或复杂素材上传。工作台不是传统剪辑器，而是一个“AI 制片台”：用户表达意图和选择模板，系统完成规划、合成、渲染和交付。

MVP 不追求生成结果完全符合用户品牌视觉，也不追求真实产品 UI 还原。MVP 只验证模板驱动的 prompt-to-video 闭环、稳定性和基础转化。

## 3. 范围

### 3.1 In Scope

- 新增在线工作台入口，例如 `/studio`。
- 支持 `16:9` 官网/产品演示动画生成。
- 系统架构预留 Remotion 和 HyperFrames 两类 runtime，但 MVP 上线只支持 Remotion runtime。
- 支持 prompt 输入、模板白名单列表、模板手动选择、默认模板规则、一键使用模板提示词。
- 支持生成任务状态展示：排队、规划、渲染、上传、完成、失败、取消。
- 支持 `queued` 状态取消任务，并按规则返还额度。
- 支持 `planning` 状态取消任务，但返还额度取决于模型调用是否已经开始。
- 支持生成结果 MP4 在线播放、下载。
- 支持当前用户最近 10 条 generation job 历史，点击后可以查看状态、视频和下载入口。
- 支持每个新登录用户 2 次免费生成额度。
- 支持系统失败自动返还额度，且同一个 job 最多返还一次。
- 记录模型调用、渲染输入输出和任务状态，便于排障和后续计费。
- 技术验收至少打通 1 个模板端到端。
- MVP 上线验收至少提供 5 个高质量模板，理想目标为 5-10 个。

### 3.2 Out of Scope

- 时间线编辑器。
- 多轨道剪辑和素材逐帧调整。
- 用户在线编辑 Remotion 或 HyperFrames 源码。
- Remotion 或 HyperFrames 源码下载。
- 任意代码生成和任意依赖安装。
- 用户上传图片、logo、视频或其他二进制素材。
- 模型生成新图片、文生图、素材抠图。
- 智能模板推荐。
- HyperFrames runtime 实际渲染上线。
- 完整会员订阅、充值、发票、订单后台。
- 多人协作、项目文件夹、团队空间。

### 3.3 Media Constraints

MVP 固定以下媒体约束：

- Aspect ratio: `16:9`
- Resolution: `1280x720`
- Future resolution option: `1920x1080`
- Duration: `10-30` seconds
- FPS: `30`
- Output format: `mp4`
- Target render time per job: within `5` minutes
- Max active generation jobs per user: `1`
- Worker concurrency: deployment-specific, small scale for MVP

`5` 分钟是 MVP 目标，不是不可调整的固定超时。具体 hard timeout 需要根据首批模板压测确认，初期应配置化。

素材来源限制：

- RemotionHub catalog 中已有素材。
- 模板自带素材。
- 用户在 prompt 中输入的纯文本信息。

MVP 不允许用户上传图片、logo、视频，也不允许模型生成新图片或新视频素材。

MVP 的产品演示视频主要基于用户输入的文字、模板内置视觉和 catalog 素材生成，不保证还原用户真实产品 UI、logo 或截图。真实品牌素材上传放到后续版本。

## 4. 用户体验设计

### 4.1 桌面布局

工作台采用左右结构：

- 左侧是对话和输入区，包含最近 10 条生成历史、当前 prompt、模板引用和生成按钮。
- 左侧输入区下方展示模板列表，重点动作是“使用此模板”或“插入提示词”。
- 右侧是成片工作区，只展示当前任务状态、视频播放器、下载入口、使用的模板和生成参数摘要。

页面应保持工作台感，不做营销 hero。用户进入后第一屏即可输入 prompt 或选择模板。

### 4.2 移动布局

移动端不强求完整双栏体验：

- 顶部保留 prompt 输入和生成按钮。
- 中间展示生成状态和视频结果。
- 模板/素材卡片改为横向滑动列表。
- 最近 10 条生成历史收进抽屉。
- MVP 不做复杂素材抽屉。

最近 10 条历史只查询当前用户自己的 `generationJobs`，按 `createdAt desc` 排序。历史中的 artifact 播放和下载链接仍通过读取接口动态签发，不直接暴露长期 URL。

### 4.3 核心流程

1. 用户进入 `/studio`。
2. 系统展示一个大输入框和白名单模板列表。
3. 用户输入产品演示需求，或点击模板卡片将 `agentPrompt` 注入输入框。
4. 如果用户已选择模板，系统展示“将使用这个模板生成”。
5. 如果用户未选择模板，系统按后台配置的 `priority` 规则选择默认模板并展示“将使用这个模板生成”。
6. 用户确认模板后点击生成。
7. 系统检查登录态、免费额度、并发限制、prompt 完整性和内容安全。
8. 系统创建 `queued` 状态的 generation job，并在同一事务中写入 `consume:{jobId}` usage ledger。
9. 模型输出 render plan。
10. worker 渲染并上传 MP4 视频。
11. 页面自动切换到播放器，显示下载按钮。

### 4.4 失败体验

失败状态必须让用户知道下一步能做什么：

- 输入不完整：例如用户只写“帮我做个视频”时，不创建 generation job，不扣额度，提示用户补充产品、场景、文案或目标受众。
- 模型或系统规划失败：已创建 job 后，planner 输出无效且修复一次仍失败，任务失败并自动返还额度。
- MVP 不单独实现模板匹配失败判断。如果 planner 无法基于当前模板生成合法 render plan，则视为规划失败，任务失败并返还额度。前端提示用户可以换一个模板重试。
- 渲染失败：保留原 prompt，允许重试；如果已扣额度则自动返还。
- 超时：任务标记为失败或可恢复重试，避免前端无限等待。
- 用户取消：`queued` 状态取消返还额度；`planning` 状态如果模型尚未开始调用则返还，如果模型已经开始调用则不返还；`rendering` 状态 MVP 不支持取消。

## 5. 系统架构

### 5.1 组件边界

`Studio UI` 负责用户输入、模板选择、状态订阅、结果播放和下载。

`Generation Orchestrator` 负责创建任务、校验额度、推进状态和写任务事件。

`Template Planner` 负责根据用户 prompt、catalog 元数据和模板能力生成结构化 render plan。

`Render Worker` 负责执行 Remotion 渲染，上传 `mp4`、缩略图和 metadata。系统边界预留 HyperFrames runtime，但 MVP worker 只启用 Remotion。

`Usage Ledger` 负责记录免费额度发放、消耗、返还和未来付费充值的余额变化。

### 5.2 数据流

1. 前端调用 `createGenerationJob`。
2. `createGenerationJob` mutation 只做轻量同步校验：登录态、额度、并发限制、模板确认状态和 prompt 基础完整性。内容安全 MVP 先做基础规则检查；如果后续接外部审核服务，应拆成独立 preflight 或 action，不阻塞 mutation。
3. 校验通过后，mutation 在同一事务中创建 `queued` 状态的 `generationJobs` 记录，并写入一条 `consume:{jobId}` 的 `usageLedger` 记录；这两个操作必须同时成功或同时失败。
4. MVP 阶段由同一个外部 worker 领取 `queued` job，并串行执行 planning 和 rendering。
5. worker 内部的 planner 模块切换 job 到 `planning`，调用模型，输出 render plan。
6. render plan 通过 schema validation 后，worker 内部的 renderer 模块切换 job 到 `rendering`，执行 Remotion 渲染。
7. renderer 模块完成本地渲染后，将 job 切换到 `uploading`。
8. worker 上传 MP4 和缩略图到对象存储。
9. 上传成功后创建 `generationArtifact`，并将 job 切换到 `completed`。
10. 前端订阅任务状态并展示结果。

虽然 MVP 可以由同一个外部 worker 串行执行 planning 和 rendering，但代码上必须保留 planner 与 renderer 两个模块边界，便于后续拆成独立队列或服务。

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
- `templateId`
- `templateVersion`
- `propsSchemaVersion`
- `assetIds`
- `plannerOutput`
- `artifactId`
- `progress`
- `idempotencyKey`
- `workerId`
- `lockedAt`
- `heartbeatAt`
- `lockExpiresAt`
- `errorCode`
- `errorMessage`
- `startedAt`
- `completedAt`
- `failedAt`
- `refundedAt`
- `modelStartedAt`
- `canceledAt`
- `cancelReason`
- `canceledBy`
- `createdAt`
- `updatedAt`

`durationSeconds` 在 job 创建时可以为空或使用默认值，例如 `15` 秒。planner 输出 render plan 后，使用通过 schema validation 的 `output.durationSeconds` 回写到 job。最终 artifact 的 `durationSeconds` 以实际渲染结果为准。

`progress` 是阶段式粗略进度，不是真实渲染百分比。MVP 默认映射：`queued = 5`、`planning = 20`、`rendering = 60`、`uploading = 90`、`completed = 100`。`failed` 和 `canceled` 保持最后进度，由前端按状态展示。

状态集合：

- `queued`
- `planning`
- `rendering`
- `uploading`
- `completed`
- `failed`
- `canceled`

合法状态流转：

- `queued -> planning -> rendering -> uploading -> completed`
- `queued -> failed`
- `planning -> failed`
- `rendering -> failed`
- `uploading -> failed`
- `queued -> canceled`
- `planning -> canceled`

`completed`、`failed`、`canceled` 是终态，不能再变更。

active generation job 指 `queued`、`planning`、`rendering`、`uploading` 状态。`completed`、`failed`、`canceled` 不算 active。

worker 领取任务时必须写入 `workerId`、`lockedAt` 和 `lockExpiresAt`，防止多个 worker 同时渲染同一个任务。worker 处理期间定期更新 `heartbeatAt`。系统根据 `heartbeatAt` 判断任务是否悬挂；如果任务超过约定时间没有心跳，系统可以将任务标记为 `failed` 或重新入队。MVP 推荐先标记为 `failed` 并返还额度，避免重复渲染导致成本不可控。

所有状态流转必须基于当前 `status` 做条件更新。只有当前状态仍为 `queued` 时，用户取消才可以进入 `canceled` 并返还额度。`planning` 取消时必须检查 `modelStartedAt`。worker 在 planning 完成后、进入 rendering 前，需要重新读取 job 状态；如果任务已经 `canceled`，则停止后续渲染。

worker 在真正调用模型 provider 之前，必须先以条件更新方式写入 `modelStartedAt`。如果写入后用户取消，则不返还额度；如果尚未写入 `modelStartedAt`，`planning` 取消可以返还额度。

### 6.2 generationJobEvents

记录任务状态流转，服务前端进度展示和后台排障。

关键字段：

- `jobId`
- `type`
- `message`
- `metadata`
- `createdAt`

`generationJobEvents.metadata` 不应直接保存敏感 prompt、完整模型输出或完整 render props。如需排障，应保存 `snapshotRef` 或脱敏摘要。

### 6.3 generationArtifacts

记录生成结果。

持久字段：

- `userId`
- `jobId`
- `storageKey`
- `thumbnailStorageKey`
- `fileSizeBytes`
- `mimeType`
- `width`
- `height`
- `fps`
- `durationSeconds`
- `aspectRatio`
- `runtime`
- `createdAt`

`storageKey` 和 `thumbnailStorageKey` 是 artifact 的长期存储标识。读取接口可以返回动态生成的 `videoUrl` 和 `thumbnailUrl` 短期签名 URL，但 URL 不作为长期真相；如果数据库保存 URL，则必须允许过期后重新签发。

artifact 默认按用户隔离访问。用户只能访问自己的 `generationArtifacts`。未登录用户或其他用户访问 artifact 下载链接时会被拒绝，或只能通过仍有效的签名 URL 访问。

MP4 是主 artifact，thumbnail 是辅助 artifact。MVP 中如果缩略图生成失败，可以使用模板预览图或默认占位图，不应导致整个 job 失败，除非后续产品明确要求 thumbnail 必须存在。

### 6.4 usageLedger

记录额度变化，而不是只在用户表上存一个计数器。这样后续免费次数、会员、积分充值、退款和运营赠送都能复用同一套账本。

关键字段：

- `userId`
- `kind`
- `amount`
- `balanceAfter`
- `jobId`
- `reason`
- `idempotencyKey`
- `createdAt`

`kind` 初期只需要：

- `grant`
- `consume`
- `refund`

返还必须幂等。同一个 job 最多只能产生一次 `refund`，写入 `generationJobs.refundedAt` 和 `usageLedger.idempotencyKey` 防止重复返还。

`usageLedger.idempotencyKey` 必须唯一。初始 grant 使用固定 key，例如 `initial-grant-v1:{userId}`；job consume 使用 `consume:{jobId}`；job refund 使用 `refund:{jobId}`。`balanceAfter` 必须在服务端事务中计算，不能由前端传入。

一个 job 最多只能产生一次 `refund`，不论原因是系统失败、超时、上传失败，还是允许返还的用户取消。

新用户首次进入 Studio 或首次创建 job 前，后端执行 `ensureInitialGrant`。该操作必须幂等，避免重复登录或重复进入 Studio 时重复发放额度。

### 6.5 studioTemplates

记录 AI Studio 可用的白名单模板。它是默认模板规则、模板版本锁定、license 状态和 props schema 的来源。

关键字段：

- `templateId`
- `templateVersion`
- `runtime`
- `status`
- `priority`
- `supportedAspectRatios`
- `supportedResolution`
- `fps`
- `propsSchema`
- `propsSchemaVersion`
- `agentPrompt`
- `tags`
- `previewStorageKey`
- `licenseStatus`
- `createdAt`
- `updatedAt`

`status` 初期使用 `active` 和 `inactive`。默认模板规则只选择 `status = active` 的模板。

### 6.6 modelRuns

记录模型调用，便于成本分析和质量回放。

关键字段：

- `jobId`
- `provider`
- `model`
- `attemptIndex`
- `runType`
- `inputDigest`
- `outputDigest`
- `inputSnapshotRef`
- `outputSnapshotRef`
- `validationErrors`
- `errorCode`
- `errorMessage`
- `promptVersion`
- `schemaVersion`
- `tokenUsage`
- `estimatedCost`
- `latencyMs`
- `createdAt`

`inputSnapshotRef` 和 `outputSnapshotRef` 指向加密存储或权限受控存储。只保存 digest 不足以支持质量回放和失败排障；MVP 至少需要保存脱敏后的模型输入输出，或保存指向受控存储的引用。

每次模型调用都创建一条 `modelRuns` 记录。schema validation 失败后的修复调用也要单独记录，并用 `attemptIndex` 区分。`runType` 初期使用 `plan` 和 `repair`。

model input/output snapshot 和 render logs 默认只保留有限时间，例如 `30` 天或 `90` 天。超过保留期后可以删除，或只保留 digest、成本和错误码。

### 6.7 renderRuns

记录渲染执行过程，便于定位 worker、Remotion、上传和环境问题。

关键字段：

- `jobId`
- `workerId`
- `runtime`
- `templateId`
- `templateVersion`
- `rendererVersion`
- `remotionVersion`
- `workerVersion`
- `startedAt`
- `completedAt`
- `durationMs`
- `exitCode`
- `errorCode`
- `errorMessage`
- `logsRef`
- `renderInputSnapshotRef`
- `outputStorageKey`
- `createdAt`

`renderInputSnapshotRef` 指向本次渲染实际使用的 `props`、`assetIds`、`templateId`、`templateVersion` 和 output 设置，确保老视频可以复现和排查。它默认只存储渲染所需的最小 props 和 asset ids；敏感内容需要脱敏或权限控制，不应直接写入公开日志。

### 6.8 Error Codes

MVP 初版错误码：

- `AUTH_REQUIRED`
- `INSUFFICIENT_CREDITS`
- `ACTIVE_JOB_LIMIT`
- `PROMPT_INCOMPLETE`
- `CONTENT_BLOCKED`
- `TEMPLATE_NOT_FOUND`
- `TEMPLATE_NOT_ALLOWED`
- `PLAN_VALIDATION_FAILED`
- `MODEL_PROVIDER_ERROR`
- `RENDER_TIMEOUT`
- `RENDER_FAILED`
- `UPLOAD_FAILED`
- `JOB_CANCELED`

`AUTH_REQUIRED`、`INSUFFICIENT_CREDITS`、`ACTIVE_JOB_LIMIT`、`PROMPT_INCOMPLETE`、`CONTENT_BLOCKED` 主要是 `createGenerationJob` API 错误，不一定对应 job 记录。`PLAN_VALIDATION_FAILED`、`MODEL_PROVIDER_ERROR`、`RENDER_TIMEOUT`、`RENDER_FAILED`、`UPLOAD_FAILED`、`JOB_CANCELED` 可以作为 job `errorCode`。

### 6.9 Key Constraints and Indexes

关键约束和索引：

- `usageLedger.idempotencyKey` unique.
- `generationJobs.idempotencyKey` unique per user.
- `generationJobs` 按 `userId + createdAt` 查询当前用户最近历史。
- `generationJobs` 按 `status + lockExpiresAt` 查询可领取任务。
- `generationJobs` 按 `userId + status` 检查 active job。
- `generationArtifacts` 按 `userId + jobId` 查询结果。
- `studioTemplates` 按 `status + priority` 查询默认模板。

`generationJobs.idempotencyKey` 用于防止用户重复点击生成按钮创建多个 job。前端每次点击生成前生成一个 request id，后端对同一用户和同一 `idempotencyKey` 只创建一次 job。

## 7. 模板与素材复用

第一版应该建立模板白名单，而不是直接开放全部 catalog。P0 技术验收至少需要 1 个白名单 Remotion 模板打通端到端；MVP 上线至少需要 5 个高质量模板，理想目标为 5-10 个；后续再扩展到 20-30 个模板。每个可用于 AI Studio 的模板需要具备：

- 稳定预览视频。
- 明确 runtime。
- `16:9` 支持。
- 支持 `1280x720` 和 `30fps` 渲染。
- 可被模型填写的 props schema。
- 高质量 `agentPrompt`。
- 适用场景标签，例如 `hero`、`product-demo`、`feature-showcase`、`dashboard`、`launch`。
- license 确认可用于生成和下载。

现有 catalog 的 `agentPrompt` 可以作为模板能力描述和 prompt 注入来源。后续可以补充 `studioHints` 类元数据，但第一版可以先通过白名单配置或 catalog 扩展实现。

MVP 使用白名单模板列表。用户可以手动选择模板；如果用户没有选择，系统用简单规则选择默认模板；智能模板推荐放到后续版本。

默认模板规则由后台配置，不由模型选择。MVP 可以先采用白名单模板的 `priority` 排序，选择 `priority` 最高且状态为 `active` 的模板。后续再加入标签匹配和智能推荐。

模板卡片在工作台中应强调三件事：

- 预览效果。
- 适用场景。
- 一键使用提示词。

## 8. 模型编排

模型不直接输出可执行代码。模型输出必须是结构化 render plan，便于校验、重试和渲染。

render plan 使用结构化 JSON。MVP 简化 schema 如下：

```json
{
  "schemaVersion": 1,
  "templateId": "string",
  "templateVersion": "string",
  "propsSchemaVersion": "string",
  "runtime": "remotion",
  "output": {
    "aspectRatio": "16:9",
    "width": 1280,
    "height": 720,
    "fps": 30,
    "durationSeconds": 15,
    "format": "mp4"
  },
  "intentSummary": "string",
  "style": {
    "tone": "modern",
    "primaryColor": "string",
    "backgroundStyle": "string"
  },
  "scenes": [
    {
      "id": "scene-1",
      "durationSeconds": 5,
      "headline": "string",
      "subtitle": "string",
      "body": "string",
      "visualHint": "string"
    }
  ],
  "props": {},
  "assetIds": []
}
```

生成前必须做 schema validation。校验失败时，可以让模型修复一次；仍失败则任务失败并返还额度。

MVP 不做自动 render retry。除 render plan schema 修复一次外，其他失败都进入 `failed`。用户点击重试时创建新的 job，并重新检查额度。

`scenes` 是 planner 的高层语义结构，用于解释视频内容和排障。MVP 渲染的唯一输入源是 `props` 和 `assetIds`；renderer 不直接消费 `scenes`。planner 必须把 `scenes` 中的内容转换为符合模板 props schema 的 `props`。

校验规则：

- `templateId` 必须来自白名单。
- `renderPlan.templateId` 必须等于 `generationJobs.templateId`。用户确认模板后，planner 不允许改成其他模板。
- `templateVersion` 必须等于 job 创建时锁定的 `generationJobs.templateVersion`。
- `propsSchemaVersion` 必须等于 job 创建时锁定的 `generationJobs.propsSchemaVersion`。
- `runtime` 在 MVP 中必须是 `remotion`。
- `output.aspectRatio` 必须是 `16:9`。
- `output.width` 必须是 `1280`。
- `output.height` 必须是 `720`。
- `output.fps` 必须是 `30`。
- `output.durationSeconds` 必须在 `10-30` 秒之间。
- `output.format` 必须是 `mp4`。
- `assetIds` 只能引用 catalog 白名单素材或模板自带素材。
- `props` 必须符合对应模板的 props schema。
- 不允许出现 `code`、`script`、`package`、`dependency`、`shellCommand` 等字段。

第一版模型 provider 应通过内部网关封装，避免前端直接接触 provider key。provider 选择、模型名称、限流策略和成本记录都在后端处理。

用户 prompt、模型输入和模型输出只做最小化保存，并做权限控制。普通用户只能查看自己的 prompt、任务状态、生成结果和下载链接。model input、model output、render plan、render logs 默认仅供后台排障使用。

用户 prompt 进入 job 创建前必须做基础内容安全检查。MVP 先做基础规则检查，例如空 prompt、明显违规关键词、超长输入、明显恶意输入。更完整的内容审核放到后续版本或独立 preflight/action。检查失败时不创建 generation job，也不消耗额度。

## 9. 渲染与存储

渲染链路应与网页请求解耦，避免长时间请求阻塞。

MVP 产品路径采用独立 render worker。Convex action 调用外部 render service 可以作为未来替代方案。GitHub Actions 或临时队列只适合内部试验，不作为 MVP 产品路径。

独立 render worker 是 MVP 推荐路径，因为 Remotion 渲染通常需要 Node 环境、浏览器依赖、字体和较明确的资源限制。

渲染结果上传到对象存储，Convex 保存 `storageKey`、metadata 和状态。前端播放和下载使用动态签名 URL 或仍有效的短期 URL。

MVP 不提供 Remotion 或 HyperFrames 源码下载。用户获得的是可播放、可下载的 MP4 artifact。

## 10. 免费额度与付费预留

第一版只需要实现免费额度账本和消耗规则，不需要完整支付。

规则建议：

- 新用户首次进入 Studio 或首次创建任务前，后端通过 `ensureInitialGrant` 幂等发放 2 次免费额度。
- 用户确认模板后，后端在同一事务中创建 `queued` job 并写入 `consume:{jobId}` 的 usage ledger 记录。
- 内容安全检查失败、登录失败、额度不足、并发限制失败时，不创建 job，也不消耗额度。
- 系统失败、模型服务异常、render plan schema 无法修复、worker 超时、渲染失败、上传失败时，自动返还 1 次额度。
- 同一个 job 最多只能返还一次。
- 用户在 `queued` 状态主动取消时返还额度。
- 用户在 `planning` 状态主动取消时，如果模型尚未开始调用则返还额度；如果模型已经开始调用则不返还额度。
- MVP 不支持取消 `rendering` 状态任务。
- MVP 不做自动 render retry。除 render plan schema 修复一次外，其他失败都进入 `failed`。用户点击重试时创建新的 job，并重新检查额度。
- 单用户最多同时运行 1 个生成任务。

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
- worker 不允许执行模型生成的任意代码。
- 模板、字体、图片和视频素材必须在白名单中管理。
- 模板和素材必须确认 license 可用于用户生成、在线播放和下载。
- 用户 prompt、模型输入、模型输出和 render plan 需要权限控制和最小化保存。

## 12. 验证计划

### 12.1 单元测试

- usage ledger 消耗和返还。
- usage ledger 返还幂等。
- `usageLedger.idempotencyKey` 唯一约束。
- `ensureInitialGrant` 幂等。
- 创建 `queued` job 和写入 `consume:{jobId}` ledger 在同一事务内完成。
- job 状态机合法流转。
- 基于当前 `status` 的条件状态更新。
- `durationSeconds` 从默认值到 render plan 再到 artifact 的覆盖规则。
- `progress` 阶段式映射。
- worker lock 和过期任务处理。
- worker `heartbeatAt` 悬挂检测。
- render plan schema validation。
- render plan `templateId`、`templateVersion`、`propsSchemaVersion` 必须匹配 job。
- template selection helper。
- 默认模板 priority 规则。
- modelRuns 记录脱敏快照引用、schema version、validation errors 和成本字段。
- renderRuns 记录 worker id、duration、exit code、logsRef 和 output storage key。
- studioTemplates 默认模板 priority 规则和 license 状态。

### 12.2 集成测试

- 创建 job 时额度不足会拒绝。
- 创建 job 后初始状态为 `queued`，并可推进到 `completed`。
- 失败任务会返还额度。
- `queued` 状态主动取消会返还额度。
- `planning` 状态主动取消按 `modelStartedAt` 判断是否返还额度。
- 同一个 job 最多产生一次 `refund`。
- 单用户同时只能运行 1 个生成任务。
- catalog 模板白名单只返回 `16:9` 且可用于 studio 的素材。
- worker 在进入 rendering 前会重新读取 job 状态，已取消任务不会继续渲染。
- 除 render plan schema 修复一次外，失败任务不会自动 render retry。
- artifact 访问按用户隔离，下载 URL 可过期后重新签发。
- 当前用户最近 10 条历史按 `createdAt desc` 返回，并且不会返回其他用户 job。
- 缩略图生成失败时使用模板预览图或默认占位图，不导致 MP4 job 失败。

### 12.3 浏览器验收

- `/studio` 首屏能输入 prompt。
- 模板卡片可注入 prompt。
- 未选择模板时，系统用默认模板规则选择模板并要求用户确认。
- 生成任务创建后能看到状态变化。
- 完成任务显示视频播放器和下载入口。
- 用户可以查看最近 10 条 generation job 历史。
- 无额度用户看到清晰的无额度提示，并说明当前 MVP 暂不支持在线购买额度。

## 13. 风险与缓解

模板覆盖不足是最大产品风险。缓解方式是 MVP 上线先挑 5-10 个高质量官网/产品演示模板，并为每个模板准备黄金 prompt。验证转化和稳定性后，再扩展到 20-30 个模板。

默认模板规则不准会影响体验。缓解方式是要求用户确认模板，并允许用户手动选择白名单模板。planner 输出前，`templateId` 必须作为硬约束。

产品演示预期过高会影响满意度。MVP 不支持上传 logo、截图或视频，因此只能生成基于文字、模板内置视觉和 catalog 素材的示意型产品演示；真实品牌素材上传放到后续版本。

渲染时间过长会影响转化。缓解方式是限制第一版视频时长，优先支持短视频段，例如 10-30 秒。

成本失控会影响免费策略。缓解方式是所有生成必须走 `usageLedger`，并记录 `modelRuns` 与 `renderRuns`，同时限制单用户并发、任务最长渲染时间、分辨率、fps 和时长。

任意代码生成会带来安全风险。第一版明确禁止模型生成可执行源码，只允许生成结构化 props。

worker 崩溃会导致任务悬挂。缓解方式是 worker 领取任务时写入 `workerId`、`lockedAt` 和心跳，超过阈值后标记失败并返还额度。

## 14. 迭代顺序

第一步：选定 1 个 Remotion 白名单模板。

- 从现有 catalog 中挑选一个可稳定 `16:9` 渲染的模板。
- 补齐该模板的 props schema、license 信息和黄金 prompt。

第二步：打通真实 Remotion 渲染和 MP4 上传。

- 在 worker 环境中用固定 props 渲染该模板。
- 产出 `1280x720`、`30fps`、`10-30` 秒 MP4。
- 上传 artifact 并确认可在线播放和下载。

第三步：实现 generation job、artifact、ledger、modelRuns、renderRuns 状态闭环，并接入 planner stub。

- 增加 job、event、artifact、ledger、modelRuns、renderRuns 数据结构。
- 实现创建任务、查任务、额度检查、并发限制、失败返还和返还幂等。
- 先用确定性规则或固定模板返回 render plan。
- 打通 `prompt -> render plan -> worker render -> MP4 playback/download`。

第四步：实现 `/studio` UI。

- 实现 prompt 输入、白名单模板列表、模板确认、任务状态和结果播放器。
- 实现无额度、失败、取消和下载状态。

第五步：接入真实模型和 schema validation。

- 接内部模型网关。
- 输出结构化 render plan。
- 加 schema validation 和一次修复。

第六步：扩大模板白名单到 MVP 上线标准。

- 从现有 catalog 中筛选 5-10 个官网/产品演示适用模板。
- 补齐 `agentPrompt`、标签和 props schema。

## 15. 验收标准

### 15.1 P0 技术验收

- 登录用户可以在 `/studio` 输入 prompt 并创建生成任务。
- 新用户首次进入 Studio 或首次创建任务前，通过 `ensureInitialGrant` 幂等获得 2 次免费额度。
- 用户选择或确认模板后，后端在同一事务中创建 `queued` job 并写入 `consume:{jobId}` ledger。
- 系统失败会自动返还额度，且同一个 job 最多产生一次 `refund`。
- 用户最多同时运行 1 个生成任务。
- 至少 1 个 Remotion 模板可以从 prompt 生成 `16:9` MP4。
- 用户确认的 `templateId` 必须作为硬约束，render plan 不允许切换到其他模板。
- 生成视频分辨率为 `1280x720`，FPS 为 `30`，时长在 `10-30` 秒内。
- 完成后用户可以在线播放和下载 MP4 视频。
- 所有 job 有状态记录、事件记录、artifact 记录、modelRuns 记录和 renderRuns 记录。
- 渲染失败、模型失败、超时都有清晰错误提示。
- worker 不允许执行模型生成的任意代码。

### 15.2 MVP 上线验收

- 至少 5 个白名单 Remotion 模板可以从 prompt 生成 `16:9` MP4。
- 每个上线模板都有稳定预览、props schema、license 信息和黄金 prompt。
- 无额度用户看到清晰的无额度提示，并说明 MVP 暂不支持在线购买额度。
- Prompt 信息不足或内容安全检查失败时，不创建 job，也不消耗额度。
- 用户只能访问自己的 generation job 和 artifact。
- 未登录用户或其他用户访问 artifact 下载链接时会被拒绝，或只能通过有效签名 URL 访问。
