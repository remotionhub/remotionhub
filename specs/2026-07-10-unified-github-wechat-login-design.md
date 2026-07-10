# GitHub 与微信统一登录设计

## 背景

`main` 已包含 GitHub OAuth 登录，`codex/wechat-web-login` 同时实现了微信开放平台 Website App 登录。两条开发线修改了相同的认证、用户初始化和 Header 组件，不能通过简单拼接代码完成合流。

本设计定义最终统一行为：Header 只提供一个中性登录入口，弹窗内提供 GitHub 和微信两种 OAuth 方式。两种身份共享认证基础设施和用户初始化流程，但不会自动合并为同一个 RemotionHub 用户。

## 决策摘要

- 在现有 `codex/wechat-web-login` 分支 merge `origin/main`，不重写历史或替换现有 PR。
- 冲突处理以 `main` 的 GitHub 登录实现为基线，再补入微信 Provider、安全回跳和统一弹窗。
- Header 未登录状态只显示一个中性登录入口，不直接展示 GitHub 或微信品牌。
- 登录弹窗通过 React Portal 挂载到 `document.body`，避免 sticky Header 的 `backdrop-filter` 改变 fixed 定位包含块。
- 弹窗参考少数派的结构：视口居中卡片、全屏遮罩、标题、右上关闭、“其他方式”分隔区和并列 Provider 按钮。
- GitHub 与微信 Auth Account 保持独立，不按邮箱、昵称或头像自动合并。

## 目标

- 一个稳定、可访问、桌面和移动端一致的登录入口。
- 在同一弹窗中明确提供 GitHub 和微信登录。
- 保留 GitHub 已有身份校验、用户初始化和 Personal Publisher 行为。
- 保留微信 Website App 身份稳定性和安全回跳约束。
- 修复登录弹窗受 Header `backdrop-filter` 影响而贴近页面顶部的问题。

## 非目标

- 不实现 GitHub 与微信账号绑定、解绑或合并。
- 不基于相同邮箱推断两个 OAuth 身份属于同一用户。
- 不增加手机号、邮箱或密码登录。
- 不新增用户协议和隐私政策页面；对应文案保持纯文本，避免死链。
- 不修改登录后的用户资料和退出登录信息架构。

## 合流策略

1. Merge `origin/main` 到 `codex/wechat-web-login`。
2. 对认证冲突保留主干 GitHub Provider、GitHub numeric profile ID 校验和 Publisher 调度方式。
3. 将微信 Provider、微信 profile 归一化和安全 redirect callback 合入同一个 `convexAuth` 配置。
4. 对前端冲突保留主干登录后 Header 行为，将未登录入口替换为中性按钮和统一弹窗。
5. 保留两边已有测试意图，并增加统一入口、Portal 和双 Provider 的回归测试。

## 后端架构

`convex/auth.ts` 是唯一认证配置入口：

- `providers` 同时注册 `createGitHubAuthProvider()` 和 `createWeChatAuthProvider()`。
- GitHub profile ID 只接受安全整数或纯数字字符串。
- GitHub 保持 `allowDangerousEmailAccountLinking: false`。
- 微信使用 Website App `openid` 作为首选账号 ID，并按微信应用 ID 命名空间存储。
- 仅当微信 profile 不含 `openid` 时才使用 `unionid`，避免同一 Website App 账号在后续授权中因新增 `unionid` 而改变身份。
- 两个 Provider 共用 `createOrUpdateUser` 回调和 Personal Publisher 初始化调度。
- OAuth profile 中的 Provider 原始 ID 不写入 `users` 表。
- 只有 profile 明确标记验证状态时才写入邮箱或手机号验证时间。

Auth Account 的唯一性继续由 `provider` 和 `providerAccountId` 共同决定。因此 GitHub 和微信即使具有相同邮箱或显示名称，也会产生独立身份。

## 安全回跳

前端调用 `signIn` 时只传递当前页面的相对路径、查询参数和 hash。后端 redirect callback 必须：

- 接受 `/path` 和 `?query` 形式的站内目标。
- 拒绝绝对 URL、协议相对 URL、反斜杠、控制字符和编码后的路径绕过。
- 对无效值回退到 `/`。
- 使用 Convex 环境中的 `SITE_URL` 构建最终绝对地址。

`AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`、`AUTH_WECHAT_ID`、`AUTH_WECHAT_SECRET`、`JWT_PRIVATE_KEY`、`JWKS` 和 `SITE_URL` 仅存在于 Convex 环境，不能进入浏览器 bundle 或提交到仓库。

## 前端组件边界

### `HeaderAuth`

- 读取认证状态和当前用户。
- 未登录时显示一个中性账户图标按钮。
- 管理登录弹窗开关状态和登录入口焦点恢复。
- 已登录时沿用主干头像、handle 和退出登录行为。

### `AuthDialog`

- 使用 `createPortal` 挂载到 `document.body`。
- 渲染全屏遮罩和视口居中卡片。
- 渲染 GitHub、微信两个等权 Provider 按钮。
- 处理关闭按钮、点击遮罩、`Escape` 和焦点管理。
- 维护 `pendingProvider`，OAuth 启动期间禁用两个 Provider 按钮，防止重复提交。
- OAuth 启动失败时清除 pending 状态并显示统一错误 Toast。

Provider 按钮可以在 `AuthDialog` 内以小型静态配置描述，不创建可动态扩展的 Provider 注册系统。当前只有两个 Provider，额外抽象没有收益。

## 用户交互

1. 未登录用户点击 Header 中唯一的登录入口。
2. 页面保持原位，打开居中的登录弹窗。
3. 用户选择 GitHub 或微信。
4. 两个 Provider 按钮进入不可重复提交状态。
5. 浏览器进入相应 OAuth 流程。
6. 登录成功后返回发起登录前的站内页面。
7. 登录失败时保留未登录状态，并通过 Toast 告知用户重试。

用户也可以通过右上关闭按钮、点击遮罩或按 `Escape` 关闭弹窗。关闭后焦点返回 Header 登录入口。

## 视觉约束

- 遮罩覆盖整个视口，而不是 Header 的包含块。
- 卡片在桌面与移动端均相对视口居中。
- 卡片宽度受移动端安全边距限制，不产生横向滚动。
- GitHub 与微信按钮具有相同尺寸、视觉权重和交互状态。
- 图标按钮必须具备明确的 accessible name，不能只依赖品牌图形表达用途。
- 弹窗不复制少数派的手机号或邮箱表单，只借鉴第三方登录区域的布局层次。

## 错误处理

- `signIn` Promise rejection：清除 pending 状态并显示本地化错误 Toast。
- Provider 配置缺失或 OAuth 服务拒绝请求：保持用户未登录，不创建不完整用户。
- redirect target 非法：回退到站点根路径。
- 微信 profile 缺少稳定标识：拒绝创建 Auth Account。
- Personal Publisher 初始化失败：保留认证用户，由现有 ensure 流程重试，不创建重复 Publisher。

## 测试设计

### 单元与组件测试

- Header 未登录状态只存在一个中性登录入口。
- 点击入口打开一个包含 GitHub、微信按钮的 dialog。
- dialog 通过 Portal 渲染到 `document.body`，不成为 Header 的 fixed 后代。
- 两个 Provider 分别调用 `signIn('github', ...)` 和 `signIn('wechat', ...)`。
- 两个 Provider 都保留当前相对 URL。
- pending 状态阻止重复 OAuth 提交。
- OAuth 启动失败恢复按钮并显示错误 Toast。
- 关闭按钮、遮罩和 `Escape` 关闭 dialog，焦点回到登录入口。
- 已登录用户和退出登录行为保持主干现有测试。
- GitHub numeric ID、微信稳定 ID、profile 清洗、安全回跳和 Publisher 初始化测试全部保留。

### 浏览器测试

- 桌面与 `390x844` 移动视口下弹窗相对视口居中。
- 页面和弹窗不存在横向溢出。
- 控制台没有相关 error 或 warning。
- GitHub 和微信按钮均能启动对应 OAuth 导航。
- 真实环境分别完成一次 GitHub 回调和微信扫码回调，并确认返回原始页面。

## 发布标准

- `make check` 通过。
- `npm run ci:unit` 通过且覆盖率达到仓库阈值。
- 认证相关目标测试通过。
- 可用的 Playwright smoke 通过；若 catalog seed 基础设施阻塞，必须作为独立问题明确记录，不能宣称 E2E 通过。
- GitHub PR checks 已实际运行且通过。
- 测试或预发布环境已配置全部 OAuth 与 Convex Auth 环境变量。
- GitHub 和微信各完成一次真实回调验收。
