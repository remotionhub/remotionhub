# RemotionHub Batch 2 Assets Migration Spec

## 1. 目标

本阶段的目标是在新的 worktree 分支中迁移 `/tmp/remotionlab/案例` 中的下一批次共 31 个 Remotion 素材。这 31 个素材涵盖：倒数计时器（5个）、地图与轨迹（5个）、字幕与CC（5个）和文字特效（16个）。

为了向原作者致敬并清晰标注出处，本阶段所有素材的发布人/所有者（owner/publisher）统一设为 `remotionlab`，且在生成的交付物（LICENSE, README.md, manifest）以及主仓库的 catalog 数据中，均进行明确的出处标注与链接指引。

---

## 2. 范围

本阶段仅包含以下 31 个指定的 slug。执行 Agent 不得超出此范围：

### 2.1 倒数计时器 (5个)
- `countdown-blast`
- `countdown-circle`
- `countdown-digital`
- `countdown-firework`
- `countdown-flip-clock`

### 2.2 地图与轨迹 (5个)
- `map-area-reveal`
- `map-path-trace`
- `map-pin-drop`
- `map-radar-scan`
- `map-route-progress`

### 2.3 字幕与 CC (5个)
- `subtitle-cinematic`
- `subtitle-dual-lang`
- `subtitle-fade`
- `subtitle-karaoke`
- `subtitle-slide`

### 2.4 文字特效 (16个)
- `title-3d-rotate`
- `title-blur-focus`
- `title-glitch-text`
- `title-gradient-wipe`
- `title-handwriting`
- `title-kinetic-bounce`
- `title-neon-glow`
- `title-scramble`
- `title-shimmer`
- `title-slot-reel`
- `title-split-reveal`
- `title-stagger-lines`
- `title-typewriter`
- `title-wave-text`
- `title-word-fade`
- `title-zoom-punch`

---

## 3. 关键仓库边界

* **素材源码仓库** (`/Users/tangwz/workspace/git/remotionhub-assets`):
  每个素材源码必须以独立的 npm workspace 结构落在 `remotion/<slug>/` 下。
* **产品站与 Catalog 仓库** (`/Users/tangwz/workspace/git/remotionhub`):
  每个可发布素材在主仓库对应的路径为 `catalog/components/<slug>.json`。主仓库 catalog 不保存素材的完整源码，仅保存其元数据、演示链接、OSS 媒体镜像 URL 及指向资产仓库特定 commit 的 GitHub Source Pointer。

---

## 4. 批次划分与提交策略 (Batch Partitioning)

为保证 PR 的可读性与可审阅性，执行 Agent 必须在新 worktree 分支中按以下 4 个 Batch 循序渐进地完成迁移与 Commit：

### Batch 1: Countdown Timers (5 slugs)
* **包含素材**：`countdown-blast`, `countdown-circle`, `countdown-digital`, `countdown-firework`, `countdown-flip-clock`
* **Commit 信息**：`feat: migrate countdown assets`
* **技术要点**：验证倒数秒数参数化、圆弧 stroke-dashoffset 动画、抖动效果、弹出 spring 效果等。

### Batch 2: Maps and Tracks (5 slugs)
* **包含素材**：`map-area-reveal`, `map-path-trace`, `map-pin-drop`, `map-radar-scan`, `map-route-progress`
* **Commit 信息**：`feat: migrate map and track assets`
* **技术要点**：SVG 路径追踪绘制动画、大头针定位弹出、雷达动态扫描渲染。

### Batch 3: Subtitles & Closed Captions (5 slugs)
* **包含素材**：`subtitle-cinematic`, `subtitle-dual-lang`, `subtitle-fade`, `subtitle-karaoke`, `subtitle-slide`
* **Commit 信息**：`feat: migrate subtitle and cc assets`
* **技术要点**：双语对齐渲染、卡拉OK歌词按字符逐词高亮（通过当前帧/时间百分比驱动）、时间序列文本平滑出场。

### Batch 4: Text Effects (16 slugs)
文字特效数量较多，必须细分为两个子提交：
* **Batch 4A (Simple Text Effects - 8 slugs)**:
  `title-blur-focus`, `title-gradient-wipe`, `title-handwriting`, `title-neon-glow`, `title-scramble`, `title-shimmer`, `title-typewriter`, `title-word-fade`
  * **Commit 信息**：`feat: migrate simple text effects`
  * **技术要点**：打字机打字速度、霓虹发光强度、模糊聚焦平滑度、渐变擦除方向。
* **Batch 4B (Advanced Text Effects - 8 slugs)**:
  `title-3d-rotate`, `title-glitch-text`, `title-kinetic-bounce`, `title-slot-reel`, `title-split-reveal`, `title-stagger-lines`, `title-wave-text`, `title-zoom-punch`
  * **Commit 信息**：`feat: migrate advanced text effects`
  * **技术要点**：3D 空间翻转、Glitch 故障抖动滤镜、字块多行弹性跳跃、轮播卡槽（slot reel）滚动效果。

---

## 5. 出处标注与版权规范 (Attribution Rules)

根据要求，本阶段所有迁移素材的版权拥有者（owner）归为 `remotionlab`。各个交付物必须遵循以下具体标注规则：

### 5.1 `LICENSE` 版权声明
各组件子目录中的 `LICENSE` 文件版权行修改为：
```text
Copyright (c) 2026 remotionlab (https://remotionlab.com)
```

### 5.2 `README.md` 引用声明
组件 `README.md` 的头部前三行统一为：
```markdown
# [Component Name]

> **Attribution Note**: This component is migrated from the original template on [remotionlab.com](https://remotionlab.com/showcase/[slug]). Credit goes to the original creator at remotionlab.

![Preview]([OSS-Thumbnail-URL])
```
并在 README 的 `Links` 小节中列出原始演示链接：
```markdown
- Original Showcase: https://remotionlab.com/showcase/[slug]
```

### 5.3 `remotionhub.asset.json` Manifest 规范
- `"sourceUrl"` 属性值设为：`https://remotionlab.com/showcase/[slug]`。
- `"license"` 属性值设为：`"MIT"`。

### 5.4 主仓库 Catalog Component JSON 规范
- 顶层 `"publisher"` 设为 `"remotionlab"`。
- 对应版本的 `"preview"` 小节中，`"demoUrl"` 设为 `"https://remotionlab.com/showcase/[slug]"`。

---

## 6. 单个素材交付物

每个素材在资产仓库 `remotionhub-assets` 中必须包含：
```text
remotion/<slug>/
  LICENSE
  README.md
  package.json
  remotion.config.ts
  remotionhub.asset.draft.json
  remotionhub.asset.json
  source.raw.tsx
  src/
    <ComponentName>.tsx
    Root.tsx
    index.ts
```
在产品站仓库 `remotionhub` 中必须包含：
```text
catalog/components/<slug>.json
```

---

## 7. 媒体镜像规范

原始 Markdown 中预览媒体的外链（R2 域名：`pub-1cc20f8a898349ab9b2823b040fcd0b8.r2.dev`）必须镜像上传至 RemotionHub 控制的阿里云 OSS。

* **OSS Preview URL 路径格式**：
  ```text
  https://remotionhub.oss-cn-shenzhen.aliyuncs.com/showcase/<slug>/<hash>-preview.mp4
  ```
* **OSS Thumbnail URL 路径格式**：
  ```text
  https://remotionhub.oss-cn-shenzhen.aliyuncs.com/showcase/<slug>/<hash>-thumb.(jpg|png)
  ```

执行 Agent 应在注入 `.env.local` 环境变量后，调用 assets 仓库的媒体镜像命令，不允许人工猜测 hash 或手写 OSS 地址：
```bash
npm run media:mirror -- --slug=<slug>
```

---

## 8. 执行 Agent 契约与质量校验

### 8.1 状态机
每个素材在 `manifest/remotionlab-showcase.json` 中的状态流转为：
`pending` -> `extracted` -> `media-mirrored` -> `sanitized` -> `validated` -> `published`。如果迁移失败，状态写为 `blocked`，并在报告中提供出错命令和 stderr 摘要。

### 8.2 校验命令
每个迁移的组件必须通过以下全套脚本检验：
```bash
# 资产校验
npm run extract -- --slug=<slug>
npm run sanitize -- --slug=<slug>
npm run validate -- --slug=<slug>
npm run readme:generate -- --slug=<slug>

# 根目录全局校验
npm run test
npm run typecheck
npm run format:check

# 主仓库 Catalog 校验
npm run catalog:validate
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

---

## 9. 页面验收与最终标准

最终的验收工作由主 Agent 执行。页面验收步骤包括：
1. 本地运行产品站主程序，运行 catalog 导入脚本。
2. 在真实浏览器中打开详情页：
   ```text
   http://localhost:3000/remotion/remotionlab/<slug>
   ```
3. 检查视频及缩略图正常播放（指向 OSS 镜像地址），GitHub 源码链接指向正确的 Commit 节点，且 Props Schema 的各个自定义项默认表现正确。

### 9.1 最终验收门槛
```text
targetSlugs: 31
missing: 0
published + blocked = 31
```
其中，每一个 `published` 的组件必须通过真实的浏览器页面验收，每一个 `blocked` 的组件必须包含明确的受阻原因及后续处理排期建议。
