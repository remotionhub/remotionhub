# RemotionHub Final Batch Assets Migration Spec

## 1. 目标 (Goal)

本阶段的目标是在新的 worktree 分支中迁移 `/tmp/remotionlab/案例` 中剩余的共 113 个以 `yt-` 开头的 YouTube/视频 Remotion 素材。

为了分类清晰与多语言支持：
1. 本批次组件将注册于全新的分类 **`animation`**（中文：`动画`；英文：`Animation`）。
2. 在迁移中，所有资产的正文、提示词、源码及视频内渲染文字均**保持原始的繁体中文不进行繁简转换**。
3. 所有素材的来源统一标注为 [remotionlab](https://remotionlab.com/)，并在 `LICENSE`、`README.md` 以及 Catalog 数据中进行严格的出处和链接指引（指向 `https://remotionlab.com/showcase/[slug]`）。

---

## 2. 范围 (Scope)

本阶段共包含 113 个以 `yt-` 开头的 slug。

这份早期 spec 的批次划分仅保留为迁移背景，不再作为可执行清单使用。后续修复发现旧批次列表存在重复与遗漏，因此 canonical 清单必须以当前修复 spec 中的 113 slug 集合以及 `catalog/components/yt-*.json` 为准：

- `specs/2026-06-25-remotionhub-yt-assets-migration-repair.md`
- `catalog/components/yt-*.json`

执行新的生成、校验或回滚时，不要从本文件重建 slug 列表；应从 canonical 清单或已生成 catalog 文件派生。

---

## 3. 分类与 i18n 设计配置

在 `remotionhub` 主仓库中进行以下修改以注册并使用全新分类：

### 3.1 i18n 字典更新 (`src/lib/i18n.ts`)
* 在 `zhDictionary` 中添加：
  ```typescript
  'category.animation': '动画',
  ```
* 在 `enDictionary` 中添加：
  ```typescript
  'category.animation': 'Animation',
  ```

### 3.2 目录生成逻辑更新 (`scripts/generate-catalog.ts`)
* 扩展分类决定函数 `getCategory`，支持 `yt-` 开头的 slug：
  ```typescript
  function getCategory(slug: string): string {
    // ...
    if (slug.startsWith('yt-')) return 'animation'
    return 'other'
  }
  ```

---

## 4. 资产清单 (Manifest) 与出处规范

### 4.1 Schema 扩展与资产提取 (`remotionhub-assets` 仓库)
1. **清单结构适配 (`scripts/lib/assetManifest.ts`)**：
   * 在 `assetManifestSchema` 和 `draftAssetManifestSchema` 中新增 `displayNameZh: z.string().min(1).optional()` 以存储繁体中文名。
2. **提取脚本 (`scripts/extract-case.ts`)**：
   * 提取 Markdown 中的 `title`（繁体中文）并赋给 Manifest 中的 `displayNameZh` 字段。
   * 提取的 TSX 源码（`source.raw.tsx`）、`prompt` 等均**不进行繁简转换**，保持原始繁体字符。

### 4.2 版权声明与 README 生成
1. **LICENSE 文件**：
   * 所有组件子目录中的 `LICENSE` 版权行设置为：
     ```text
     Copyright (c) 2026 remotionlab (https://remotionlab.com)
     ```
2. **README.md 结构 (`scripts/generate-readme.ts`)**：
   * 每个组件生成 `# ${manifest.displayNameZh} (${manifest.displayName})` 标题。
   * 新增出处声明块：
     ```markdown
     > **Attribution Note**: This component is migrated from the original template on [remotionlab.com](https://remotionlab.com/showcase/[slug]). Credit goes to the original creator at remotionlab.
     ```

### 4.3 Catalog 字段指引
主仓库生成的 `catalog/components/[slug].json` 将通过 `generate-catalog.ts` 同步以下值：
* `"displayNameZh"`：取 manifest 中的 `displayNameZh`（原始繁体标题）。
* `"summaryZh"`：设为 `适用于 Remotion 的${displayNameZh}组件。`
* `"publisher"`：固定为 `"remotionlab"`。

---

## 5. 质量保障与验证

每个批次迁移后，必须分别通过两端仓库的检验：

1. **资产仓库验证** (`remotionhub-assets`)
   ```bash
   npm run manifest:validate -- --slug=<slug>
   npm run sanitize -- --slug=<slug>
   npm run validate -- --slug=<slug>
   npm run readme:generate -- --slug=<slug>
   
   # 根目录全局校验
   npm run test
   npm run typecheck
   npm run format:check
   ```
2. **主仓库验证** (`remotionhub`)
   ```bash
   npm run catalog:validate
   npm run test -- --run shared/catalog.test.ts src/components/catalog/DetailPage.test.tsx
   ```
3. **手动页面审查**：
   * 确认 OSS 镜像视频及缩略图显示正常，不直接引用源站 R2 URL。
   * 本地启动详情页 `http://localhost:3000/remotion/remotionlab/[slug]`。
   * 确认分类切换、出处链接正确。
