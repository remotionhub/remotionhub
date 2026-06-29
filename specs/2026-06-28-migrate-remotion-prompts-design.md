# RemotionHub Prompts Migration Design (极简方案)

## 目标

从 `https://www.remotion.dev/prompts` 抓取 AI 生成视频的 Prompt 数据，并按照 RemotionHub 的标准规范，重新存储到 `remotionhub` 主仓库中。

为了保持 `remotionhub-assets` 源码仓库的纯净性，本方案**完全不触碰 assets 仓库**。通过放宽 Convex 数据库 Schema 约束，允许 Catalog 存在“无源码、仅展示”的 Prompt 类型资产。前端详情页会自适应隐藏代码相关的卡片和选项卡，为用户提供极其纯粹的“视频预览 + 一键复制 Prompt”体验。

---

## 推荐架构与设计

### 1. 资产数据流与目录结构

所有改动均在 `remotionhub` 主仓库中完成，不影响 `remotionhub-assets`。

#### 目录结构：
```text
remotionhub/
  catalog/
    components/
      prompt-travel-route-on-map-with-3d-landmarks.json
      prompt-news-article-headline-highlight.json
      ...
  scripts/
    scrape-prompts.ts
```

---

### 2. 抓取与媒体镜像设计 (`scripts/scrape-prompts.ts`)

在主仓库中编写 `scripts/scrape-prompts.ts` 脚本：
1.  **数据抓取**：
    *   请求 `https://www.remotion.dev/prompts`，循环解析分页链接，提取所有 Prompt 详情页。
    *   解析并提取：`slug`（加 `prompt-` 前缀）、`title`、`prompt` 文本、`author`、`model`、`tool`、Mux 视频及缩略图 URL。
2.  **媒体转码与上传**：
    *   调用本地 `ffmpeg` 将 Mux HLS `.m3u8` 视频流无损拼接转码为 `.mp4`：
        ```bash
        ffmpeg -i https://stream.mux.com/<mux-id>.m3u8 -c copy /tmp/<slug>-preview.mp4
        ```
    *   下载 Mux 缩略图 `https://image.mux.com/<mux-id>/thumbnail.png`。
    *   计算 MD5 并上传至阿里云 OSS：
        *   `showcase/prompt-<slug>/<hash>-preview.mp4`
        *   `showcase/prompt-<slug>/<hash>-thumb.png`
3.  **直接生成 Catalog JSON**：
    *   脚本直接在 `catalog/components/prompt-<slug>.json` 下生成索引文件，其格式符合微调后的 Schema：
        *   `runtime` 设为 `"remotion"`。
        *   `categories` 设为 `["prompt"]`。
        *   `versions[0].metadata.entryPoint` 留空 (Omit)。
        *   `versions[0].artifact.kind` 设为 `"none"`。
        *   `versions[0].artifact.githubSource` 留空 (Omit)。
        *   `versions[0].artifact.agentPrompt` 填入抓取到的提示词。

---

### 3. Convex Schema 变更设计

修改 [[schema.ts](file:///Users/tangwz/.gemini/antigravity/worktrees/remotionhub/migrate-remotion-prompts-data/convex/schema.ts)]，放宽对无源码资产的约束：

*   **`metadata` 结构**：
    将 `entryPoint` 设为可选：
    ```typescript
    const metadata = v.object({
      runtime,
      entryPoint: v.optional(v.string()), // 设为可选
      aspectRatios: v.array(v.string()),
      durationFrames: v.optional(v.number()),
      fps: v.optional(v.number()),
    })
    ```
*   **`artifacts` 结构**：
    允许 `kind` 为 `"none"`，且将 `githubSource` 设为可选：
    ```typescript
    artifacts: defineTable({
      componentVersionId: v.id('componentVersions'),
      kind: v.union(v.literal('github-source'), v.literal('none')), // 新增 'none'
      githubSource: v.optional(githubSource), // 设为可选
      license: v.string(),
      usageMarkdown: v.string(),
      agentPrompt: v.string(),
      createdAt: v.number(),
    })
    ```

---

### 4. 前端详情页自适应微调

修改 [[DetailPage.tsx](file:///Users/tangwz/.gemini/antigravity/worktrees/remotionhub/migrate-remotion-prompts-data/src/components/catalog/DetailPage.tsx)]：

1.  **卡片自适应**：
    检测 `detail.artifact.kind === 'none'` 或没有 `detail.artifact.githubSource`：
    *   在顶部元数据卡片区域中，**不渲染 `Entry Point` 和 `Source` 卡片**。
2.  **选项卡自适应**：
    *   隐藏 `GitHub Source` 和 `Usage` 选项卡。
    *   仅保留 **`Agent Prompt`** 选项卡（且默认选中并提供一键复制）。

---

## 验证计划

### 1. 编译与 Schema 校验
```bash
# 验证 TypeScript 编译
npm run build
# 验证 Catalog JSON 格式
npm run catalog:validate
```

### 2. 单元测试
```bash
# 运行组件与导入测试
npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
```

### 3. 浏览器真机验收
1.  运行本地 Convex 并导入生成的 `prompt-*.json` 资产。
2.  启动网页端服务，在 Chrome 浏览器中打开任一 `/remotion/remotionlab/prompt-<slug>`。
3.  确认：
    *   视频预览正常播放（来自阿里云 OSS 的 `.mp4` 资源）。
    *   页面排版美观，没有多余的 `Entry Point` 和 `Source` 空卡片。
    *   选项卡仅显示 `Agent Prompt` 且复制功能完好。
