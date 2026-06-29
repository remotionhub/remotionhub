# 移动端横向溢出问题设计方案 (Mobile Grid Overflow Design)

## 背景与问题 (Background & Problem)

在移动端 390px 视口下，RemotionHub 的分类页面宽度达到了 623px，导致严重的横向滚动。其核心卡片（`CatalogCard`）被撑宽至约 607px。

经排查，根本原因在于移动端（`max-width: 640px`）下，`.catalog-grid` 的列定义设置为了 `grid-template-columns: 1fr`：
```css
@media (max-width: 640px) {
  .catalog-grid {
    grid-template-columns: 1fr;
  }
}
```

在 CSS Grid 中，`1fr` 等同于 `minmax(auto, 1fr)`。这使得网格列无法收缩到小于其内容最小宽度（`min-content`）的大小。由于卡片内部的图片和视频具有较大的固有尺寸，网格列被强制拓宽，从而导致了布局溢出。

---

## 设计方案 (Proposed Design)

我们将采用最符合 CSS Grid 规范的方案，在移动端将网格列定义修改为 `minmax(0, 1fr)`，明确允许网格列收缩至零，从而使卡片宽度能够完美自适应视口。

### 修改文件 (Modified Files)

#### [MODIFY] [styles.css](file:///Users/tangwz/.gemini/antigravity/worktrees/remotionhub/fix-mobile-grid-overflow/src/styles.css)

修改第 350 行左右的 `.catalog-grid` 规则：

```diff
 @media (max-width: 640px) {
   .catalog-page {
     padding-block: 2.5rem;
   }
 
   .catalog-grid {
-    grid-template-columns: 1fr;
+    grid-template-columns: minmax(0, 1fr);
   }
 }
```

---

## 验证计划 (Verification Plan)

### 自动测试 (Automated Tests)
1. 运行静态代码检查与类型检查：
   ```bash
   npm run ci:types-build
   ```
2. 运行单元测试：
   ```bash
   npm run test
   ```

### 手动验证 (Manual Verification)
1. 启动本地开发服务器：
   ```bash
   npm run dev
   ```
2. 使用 Chrome DevTools 打开 `http://localhost:3000`。
3. 切换至移动端响应式视口（如 iPhone 12/13 Pro，宽度 390px）。
4. 确认页面没有出现横向滚动条，`.catalog-grid` 及其子卡片能够自适应收缩至屏幕宽度以内。
