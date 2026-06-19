# RemotionHub 首页 Catalog 重设计

## 背景

当前首页已经具备 catalog 浏览、category 过滤、无限滚动、i18n、Light/Dark 切换和 Remotion/HyperFrames 路由能力。但视觉结构仍偏“通用卡片列表”：标题区、筛选区、网格和 Header 的层级不够接近参考对象 Remotion Lab 的作品展示页。

本次重设计的目标不是简单让卡片居中，而是让整页形成一个稳定、可扫读的素材库展示界面：顶部导航轻量，主体内容居中成栏，标题、筛选和三列作品流在同一内容边界内左对齐。

## 目标

- 首页参考 Remotion Lab 作品展示页的信息架构和视觉密度。
- 保留 RemotionHub 的产品能力：Remotion/HyperFrames 分流、GitHub 入口、语言切换、Light/Dark 切换。
- 首页主体采用居中内容栏，栏内元素左对齐。
- 筛选区显示两层：category 和 tag。一期只有 category 参与过滤，tag 只作为浏览提示。
- 列表继续使用无限滚动，不改为手动加载按钮。
- Light/Dark 只支持手动两态，不再跟随系统主题。

## 非目标

- 不做全文搜索。
- 不做 tag 过滤。
- 不改变 catalog 数据模型。
- 不引入新的视觉装饰系统、营销 hero 或复杂动效。
- 不重做详情页内容结构，除非复用组件需要小范围适配。

## 页面结构

首页采用从上到下的结构：

1. 轻量 Header。
2. 居中内容栏内的 Hero 标题区。
3. 分隔线。
4. 两层筛选区。
5. 分隔线。
6. 三列 catalog card 流。
7. 无限滚动 sentinel 和加载/到底状态。

内容栏整体水平居中，推荐宽度约为 1180 到 1200 像素；移动端使用安全的左右间距。栏内文本、筛选 chip、卡片网格都左对齐。大屏下卡片应稳定三列铺满内容栏；中屏自然降为两列；移动端单列。

## Header 设计

Header 采用“轻量降噪”的折中方案：

- 保留 RemotionHub 品牌，但减少胶囊、阴影和强按钮感。
- 中间导航保留目录、Remotion、HyperFrames。
- 右侧保留 GitHub、中文/EN、Light/Dark。
- Header 仍有细边框，用于和页面主体建立清晰分隔。
- 不引入登录入口，除非后续上传/发布流程需要。

Header 的目标是接近参考图的安静顶部栏，同时保留 RemotionHub 的必要操作。

## Hero 设计

Hero 不做营销大图，不使用渐变背景或大卡片包装。

内容包括：

- 小号产品名或 eyebrow。
- 主标题，中文默认可使用“动画模板库”或“动态组件目录”。
- 副标题强调浏览预览、下载源文件、复制给 coding agent 使用的提示词。

Hero 位于内容栏内左对齐，和筛选区、卡片流共享同一左边界。

## 筛选区设计

筛选区分两层：

- 第一层是 category chip，显示 category 名称和数量；可点击并触发列表过滤。
- 第二层是 tag chip 或轻量文本标签；只展示，不触发过滤。

默认选中“全部”。选择 category 后，只改变当前页数据查询条件，不引入全文搜索，不改变 tag 行状态。tag 行需要避免误导，可以使用更轻的样式，或者不使用按钮语义。

数量来源在 MVP 阶段可以从当前查询结果聚合。后续如果需要全库精确数量，再由 Convex 查询单独返回 facet 数据。

## Card 设计

Catalog card 更贴近参考图：

- 预览图占据主要面积。
- 卡片内信息保持短：标题和少量标签。
- 首页摘要可以弱化或隐藏，避免卡片过高、信息噪声过大。
- 标签留在正文底部，不使用贴边 footer。
- 卡片圆角保持克制，边框轻，hover 反馈轻。

卡片的职责是帮助用户快速判断素材视觉形态和类别；完整说明、版本、artifact 和 agent prompt 仍由详情页承载。

## 组件边界

建议在实现中把职责拆清楚：

- `CatalogPageShell`：页面内容栏、标题区、分隔线和纵向节奏。
- `CatalogFilters`：两层筛选展示，category 可交互，tag 只展示。
- `CatalogGrid`：列表渲染、空状态、加载状态和无限滚动 sentinel。
- `CatalogCard`：单个素材卡片的预览和短信息。
- `Header`：全站导航和全局操作。
- `ThemeToggle`：只处理 Light/Dark 两态和本地偏好。

如果现有 `CatalogGrid` 同时负责查询、筛选和列表，实施时可以小步拆分，避免一次性重构过大。

## 数据流

- `components.listCatalog` 仍然是列表数据来源。
- category filter 继续传给 Convex query。
- 前端从当前结果中聚合 category 和 tag 展示数据。
- tag 不写入 URL，不改变 query，不改变列表。
- 无限滚动继续使用 IntersectionObserver。
- 语言使用 localStorage，本地默认中文。
- 主题使用 localStorage，本地默认 Light；用户选择 Dark 后刷新保持 Dark。

## Light/Dark 策略

主题只支持两个状态：

- Light。
- Dark。

移除自动跟随系统主题的行为。默认主题为 Light。切换结果写入 localStorage。页面初始渲染应尽量避免明显闪烁；如果当前实现已有早期脚本或 provider，应同步简化为两态逻辑。

## 路由范围

本次设计至少影响三个列表页：

- `/`
- `/remotion`
- `/hyperframes`

首页 `/` 使用完整 catalog 视图。`/remotion` 和 `/hyperframes` 可以复用同一 shell，只在标题、副标题和 runtime filter 上区分。

## 响应式要求

- 大屏：内容栏居中，三列卡片铺满内容栏。
- 中屏：两列卡片，筛选自然换行。
- 移动端：单列卡片，Header 可换行但不能遮挡内容，筛选 chip 不横向溢出。
- 所有按钮、chip 和标题文本不能互相覆盖。

## 测试与验证

实现完成后需要验证：

- Chrome 中实际打开 `/`、`/remotion`、`/hyperframes`。
- 大屏、中屏、移动端布局符合响应式要求。
- category 过滤仍能改变列表。
- tag 行不触发过滤，也不使用误导性的激活态。
- 无限滚动仍能加载后续数据。
- Light/Dark 手动切换后刷新保持选择。
- 默认主题为 Light，不跟随系统主题。
- i18n 默认中文，语言切换仍能本地持久化。

建议运行：

- 相关组件测试。
- TypeScript typecheck。
- production build。
- 现有 e2e 或 smoke 测试。

## 风险与约束

- 当前 catalog 数量可能较少，category/tag 数量从当前结果聚合会不等于全库 facet。MVP 可接受，但文案和交互不要暗示全库精确统计。
- 如果隐藏首页摘要，现有测试可能需要更新断言。
- Header 降噪时必须保留可访问名称，尤其是 GitHub、语言切换和主题切换。
- 移除 auto theme 时，要确认 SSR 和客户端 hydration 不出现主题不一致。

