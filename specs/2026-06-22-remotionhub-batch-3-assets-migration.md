# RemotionHub Batch 3 Assets Migration Spec

## 1. 目标

本阶段的目标是在新的 worktree 分支中迁移 `/tmp/remotionlab/案例` 中剩余的共 96 个 Remotion 素材。这 96 个素材涵盖：音频视觉化（5个）、Logo动画（16个）、转场（17个）、片头/片尾（18个）、数据可视化（20个）和社交媒体（20个）。

为了提升多语言用户体验，本设计正式在数据库、数据模型、导入脚本和前端页面中引入 **i18n (多语言) 机制**。迁移后的组件名称与描述将同时保存中文与英文，并在网页中根据用户所选的 Locale 自动切换呈现。

所有素材的发布人/所有者统一设为 `remotionlab`，并在 LICENSE、README.md 以及 Catalog 数据中进行出处与链接指引（指向 [remotionlab.com](https://remotionlab.com)）。

---

## 2. 范围

本阶段共包含 96 个 slug，按 6 个执行 Batch 进行划分与 Commit：

### Batch 1: Audio & Logo Animations (21 slugs)
* **音频视觉化 (5个)**:
  `audio-bar-spectrum`, `audio-circle-viz`, `audio-pulse-ring`, `audio-vinyl-record`, `audio-waveform`
* **Logo动画 (16个)**:
  `logo-badge-unfold`, `logo-block-build`, `logo-brand-kit`, `logo-emblem`, `logo-glow-pulse`, `logo-hologram`, `logo-icon-reveal`, `logo-line-draw`, `logo-minimal-dot`, `logo-negative-reveal`, `logo-orbit-reveal`, `logo-pin-drop`, `logo-ring-focus`, `logo-shield-crest`, `logo-stamp-reveal`, `logo-triangle-form`
* **Commit 信息**: `feat: migrate audio and logo animation assets`

### Batch 2: Transitions (17 slugs)
* **视频转场 (17个)**:
  `transition-blinds`, `transition-curtain`, `transition-diagonal-wipe`, `transition-diamond-reveal`, `transition-fade-cross`, `transition-film-burn`, `transition-flash-white`, `transition-ink-spread`, `transition-morph-circle`, `transition-page-flip`, `transition-pixelate`, `transition-slide-push`, `transition-spin-zoom`, `transition-split-doors`, `transition-wipe-clock`, `transition-zoom-out-in`, `transition-zoom-through`
* **Commit 信息**: `feat: migrate transition assets`

### Batch 3: Intros & Outros (18 slugs)
* **片头 (11个)**:
  `intro-cinematic-bars`, `intro-cinematic-text`, `intro-countdown-3`, `intro-geometric`, `intro-logo-morph`, `intro-minimal-fade`, `intro-news-broadcast`, `intro-particle-burst`, `intro-split-screen`, `intro-typewriter`, `intro-vhs-retro`
* **片尾 (7个)**:
  `outro-comment-cta`, `outro-credits-roll`, `outro-end-screen`, `outro-playlist`, `outro-social-links`, `outro-sponsor`, `outro-subscribe-cta`
* **Commit 信息**: `feat: migrate intro and outro assets`

### Batch 4: Basic Data Visualizations (10 slugs)
* **基础数据图表 (10个)**:
  `dataviz-bar-chart`, `dataviz-horizontal-bar`, `dataviz-stacked-bar`, `dataviz-line-draw`, `dataviz-area-chart`, `dataviz-pie-donut`, `dataviz-progress-ring`, `dataviz-counter-card`, `dataviz-bubble`, `dataviz-scatter-plot`
* **Commit 信息**: `feat: migrate basic dataviz assets`

### Batch 5: Advanced Data Visualizations (10 slugs)
* **高级与行业图表 (10个)**:
  `dataviz-bullet`, `dataviz-candlestick`, `dataviz-comparison-split`, `dataviz-funnel`, `dataviz-gantt`, `dataviz-heatmap`, `dataviz-radar`, `dataviz-sankey`, `dataviz-treemap`, `dataviz-waterfall`
* **Commit 信息**: `feat: migrate advanced dataviz assets`

### Batch 6: Social Media Elements (20 slugs)
* **社交媒体动态组件 (20个)**:
  `social-app-store`, `social-comment-wall`, `social-facebook`, `social-github`, `social-ig-masonry`, `social-ig-post`, `social-linkedin`, `social-notifications`, `social-producthunt`, `social-reddit-feed`, `social-reddit`, `social-stats-wall`, `social-stories-row`, `social-testimonial-wall`, `social-tiktok`, `social-trending`, `social-twitter-feed`, `social-twitter-quote`, `social-youtube-feed`, `social-yt-video`
* **Commit 信息**: `feat: migrate social media assets`

---

## 3. 多语言 i18n 设计规约

主仓库将进行以下修改，以支持同时存储与展示中英文组件信息：

### 3.1 数据库 Schema 修改 (`convex/schema.ts`)
* 在 `components` 和 `componentSearchDigest` 表定义中新增可选的多语言字段：
  ```typescript
  displayNameZh: v.optional(v.string()),
  summaryZh: v.optional(v.string()),
  ```

### 3.2 Zod 数据校验修改 (`shared/catalog.ts`)
* `catalogComponentSchema` 对象中新增多语言可选属性：
  ```typescript
  displayNameZh: z.string().min(1).optional(),
  summaryZh: z.string().min(1).optional(),
  ```

### 3.3 Convex 变动函数更新 (`convex/components.ts` / `convex/lib/catalog.ts`)
* 变动函数 `importCatalogComponent` 的参数校验（`args`）增加可选的 `displayNameZh` 和 `summaryZh` 校验。
* 在插入组件（`db.insert('components', ...)`）和更新组件（`db.patch(...)`）时，同时写入这二者。
* 在 `buildDigestDoc` 辅助函数中透传 `displayNameZh` 和 `summaryZh` 至搜索摘要对象中。
* Catalog 导入是高权限写入口，即使保留为公开 Convex mutation，也必须在服务端校验 `CATALOG_IMPORT_SECRET`。未配置服务端密钥或调用方密钥不匹配时，必须在任何写入前失败关闭。

### 3.4 导入脚本适配 (`scripts/import-catalog.ts`)
* `toImportPayload` 处理函数中读取 Catalog JSON 并附加多语言数据：
  ```typescript
  displayNameZh: component.displayNameZh,
  summaryZh: component.summaryZh,
  ```
* `--apply` 实际写入 Convex 时，脚本必须从环境变量读取 `CATALOG_IMPORT_SECRET` 并随 payload 发送。Dry-run 和 local-only 校验不能要求该密钥。

### 3.5 前端多语言展示 (`src/components/catalog/`)
* **`CatalogCard.tsx`**: 引入 `useI18n()`，判断 `locale`。
  如果 `locale === 'zh'`，则展示 `item.displayNameZh ?? item.displayName`，否则直接显示英文 `item.displayName`。
* **`DetailPage.tsx`**: 同样判断 `locale`。
  对于标题，展示 `detail.component.displayNameZh ?? detail.component.displayName`。
  对于简介，展示 `detail.component.summaryZh ?? detail.component.summary`。

---

## 4. 出处标注与版权规范 (Attribution Rules)

由于这些案例全部来自 `remotionlab.com`，每个交付物都必须严密遵循以下出处标注规则：

### 4.1 LICENSE 版权行
所有组件子目录中的 `LICENSE` 文件版权持有者及链接修改为：
```text
Copyright (c) 2026 remotionlab (https://remotionlab.com)
```

### 4.2 README.md 声明
组件 `README.md` 的前几行必须按照以下结构生成：
```markdown
# [中文名] ([英文名])

> **Attribution Note**: This component is migrated from the original template on [remotionlab.com](https://remotionlab.com/showcase/[slug]). Credit goes to the original creator at remotionlab.

![Preview]([OSS-Thumbnail-URL])
```
并在 README 底部追加原始 showcase 链接：
```markdown
- Original Showcase: https://remotionlab.com/showcase/[slug]
```

### 4.3 Manifest & Catalog
* **remotionhub.asset.json**:
  * `"sourceUrl"` 属性值设为 `https://remotionlab.com/showcase/[slug]`
  * `"license"` 属性值设为 `"MIT"`
* **主仓库 Catalog Component JSON**:
  * 顶层 `"publisher"` 设为 `"remotionlab"`
  * `versions[0].preview.demoUrl` 设为 `"https://remotionlab.com/showcase/[slug]"`
  * 顶层追加多语言翻译：
    `"displayNameZh"` 填入 Markdown Frontmatter 中的 `title` 中文名。
    `"summaryZh"` 填入中文的摘要内容。
    `"displayName"` 填入由 Slug 转换后的英文名称（如 `"Blinds Transition"`）。
    `"summary"` 填入对应的英文摘要。

---

## 5. 媒体镜像规范

原始 Markdown 中引用的远程 R2 预览媒体，必须通过镜像命令上传至 RemotionHub 阿里云 OSS，去除对原站域名的直接引用。

* **OSS Preview URL 路径格式**：
  `https://remotionhub.oss-cn-shenzhen.aliyuncs.com/showcase/<slug>/<hash>-preview.mp4`
* **OSS Thumbnail URL 路径格式**：
  `https://remotionhub.oss-cn-shenzhen.aliyuncs.com/showcase/<slug>/<hash>-thumb.(jpg|png)`

执行命令：
```bash
set -a
source /Users/tangwz/workspace/git/remotionhub/.env.local
set +a
npm run media:mirror -- --slug=<slug>
```

---

## 6. 验证与质量控制

### 6.1 资产验证命令 (`remotionhub-assets` 目录)
```bash
npm run extract -- --slug=<slug>
npm run sanitize -- --slug=<slug>
npm run validate -- --slug=<slug>
npm run readme:generate -- --slug=<slug>

# 根目录全局校验
npm run test
npm run typecheck
npm run format:check
```

### 6.2 主仓库校验命令 (`remotionhub` 目录)
```bash
# 验证 catalog JSON
npm run catalog:validate

# 运行 catalog 单元测试与详情页测试
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

### 6.3 页面手动验收
启动开发服务器后，在浏览器中打开：
`http://localhost:3000/remotion/remotionlab/<slug>`
核对：视频及缩略图正常播放（指向 OSS 镜像地址），中英文 Locale 切换后展示名称与简介能无缝切换，GitHub Source 指向准确的 Commit 节点。
