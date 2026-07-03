# Cloudflare Workers Release Baseline Design

## 背景

RemotionHub 当前应用代码 gate 已经明显改善，但生产发布链路仍未闭环：仓库没有 `.github/workflows/deploy.yml`，GitHub repository 尚未配置 `Production` environment，域名和 TLS 状态仍需要后续验证。此前 `AGENTS.md` 中还残留 Vercel 假设，尤其是 `frontend` 目标等待 Vercel production deploy，以及配置段落中把前端生产环境描述为 Vercel 需求。

Terence 已决定 frontend production target 改为 Cloudflare Workers。TanStack Start 官方 hosting 文档把 Cloudflare Workers 列为 Official Partner，当前推荐路径是 `@cloudflare/vite-plugin`、`wrangler`、`wrangler.jsonc`、`nodejs_compat` 和 `@tanstack/react-start/server-entry`。Cloudflare 官方 TanStack Start guide 也支持 existing project 通过 Wrangler 部署。

本设计把原本的“替换 Vercel 假设”扩展为一个更实用的上线前置子项：建立 Cloudflare Workers 可部署基线，同时明确哪些发布链路仍然留到后续子项。

## 已验证事实

- `AGENTS.md` 当前仍包含 Vercel 发布假设：
  - `frontend` 等待 Vercel production deploy。
  - 配置段落写着 Vercel 只需要 `VITE_CONVEX_URL` 和 `VITE_CONVEX_SITE_URL`。
- `README.md` 没有明显 Vercel 发布指导，主要覆盖本地开发、catalog 和 verification。
- `package.json` 当前没有 Cloudflare 或 Wrangler scripts。
- `vite.config.ts` 当前没有 `@cloudflare/vite-plugin`。
- `.github/workflows/security-quality.yml` 只是 audit 和 coverage gate，不是 deploy workflow。
- `src/lib/convex.ts` 依赖 `import.meta.env.VITE_CONVEX_URL`，缺失时会直接抛错。
- `.env.local` 当前含有 `CONVEX_DEPLOYMENT` 和 `VITE_CONVEX_URL`。`CONVEX_DEPLOYMENT` 属于 Convex CLI 本地部署定位，不应改成 Cloudflare 相关值。
- `package-lock.json` 存在，依赖变更必须更新 lockfile。
- 当前 CI 使用 Node 22；`wrangler@4.107.0` 要求 Node `>=22.0.0`，与当前 CI baseline 匹配。
- `@cloudflare/vite-plugin@1.43.0` 支持 Vite 8，和当前 `vite@8.0.16` 匹配。

## 目标

- 删除 active guidance 中的 Vercel frontend production 假设。
- 把 Cloudflare Workers 固化为 RemotionHub frontend production target。
- 增加 Cloudflare Workers 可部署基线配置：
  - Cloudflare Vite plugin。
  - Wrangler CLI。
  - `wrangler.jsonc`。
  - npm scripts for Cloudflare deployment and type generation。
- 明确 `VITE_CONVEX_URL` 是 Cloudflare frontend build-time contract。
- 明确 Convex 相关变量的职责边界，避免把 public frontend env、Convex CLI local deployment 和 backend deploy secret 混在一起。
- 保留当前本地开发、unit coverage、typecheck 和 build gate 的可运行性。
- 为后续 deploy workflow、Cloudflare account setup、DNS/TLS 和 production smoke 提供稳定约束。

## 非目标

- 不创建 `.github/workflows/deploy.yml`。
- 不配置 GitHub `Production` environment。
- 不配置 Cloudflare API token、account id、custom domain、routes、DNS 或 TLS。
- 不执行真实远端 deploy。
- 不配置或轮换 production secrets。
- 不实现 Convex backend production deploy workflow。
- 不修改 Convex schema、functions、data import policy 或 catalog data。
- 不把 production smoke 纳入本子项。
- 不提交真实 `.env.local`、`.env.production`、`.dev.vars` 或任何 secret value。

## 设计

### 1. Active guidance 改为 Cloudflare Workers

`AGENTS.md` 的 Production Release 段落应继续保留“生产发布是手动流程，`deploy.yml` 尚未实现时不能把命令当成可执行事实”的边界，但 frontend target 需要从 Vercel 改为 Cloudflare Workers。

目标表述：

- Production deploys remain manual-only.
- `frontend` target means deploying the TanStack Start frontend to Cloudflare Workers.
- The deploy workflow command is only valid after `.github/workflows/deploy.yml` exists on `main`.
- Until the workflow exists, local Cloudflare deploy commands are implementation tools, not proof that the release chain is complete.

配置段落应删除 Vercel 语义，改为 Cloudflare/TanStack Start 的 env contract：

- Browser-visible Convex endpoint is `VITE_CONVEX_URL`.
- Cloudflare frontend build must provide `VITE_CONVEX_URL`.
- Convex JWT keys and backend-only secrets remain in Convex env or deploy-time secrets.

`VITE_CONVEX_SITE_URL` 当前没有代码使用，本子项不应把它作为新的 Cloudflare contract 引入。

### 2. Vite 配置加入 Cloudflare 插件

官方 TanStack Start Cloudflare Workers setup 要求将 Cloudflare Vite plugin 加到 Vite plugins 中，并位于 `tanstackStart()` 前面。仓库当前还使用 `@tanstack/devtools-vite`，其 Vite plugin guidance 要求 `devtools()` 保持第一位。因此目标插件顺序应优先满足两者约束：

```ts
plugins: [
  devtools(),
  cloudflare({ viteEnvironment: { name: 'ssr' } }),
  tailwindcss(),
  tanstackStart(),
  viteReact(),
]
```

由于当前 `vite.config.ts` 同时承载 Vitest 配置，实施时需要验证 Cloudflare plugin 是否影响 `vitest run`。如果测试环境出现 Workers runtime/plugin side effect，应将 Cloudflare plugin 限制为非 test mode，例如只在 `mode !== 'test'` 时启用。这个判断必须以实际测试结果为准，而不是提前复杂化配置。

### 3. Wrangler 配置只建立 Worker baseline

新增 `wrangler.jsonc`，只表达 Worker 可部署基线，不表达域名、routes、account、environment secrets 或 production smoke。

目标配置形状：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "remotionhub",
  "compatibility_date": "2026-07-03",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry"
}
```

`compatibility_date` 使用实施当天日期。后续如果 Cloudflare runtime 行为需要冻结或升级，另起小变更更新该日期并验证。

不在本文件中配置 secrets。Cloudflare 官方 guidance 明确 sensitive values 应使用 secrets 或 Secrets Store，而不是 `vars`。

### 4. npm scripts 保持显式命名

新增 Cloudflare scripts，但避免使用裸 `deploy`，因为当前完整生产发布链路还没有 GitHub workflow、Production environment、DNS/TLS 和 smoke gate。

目标 scripts：

```json
{
  "deploy:cloudflare": "npm run build && wrangler deploy",
  "cf-typegen": "wrangler types"
}
```

`deploy:cloudflare` 是手动 Cloudflare Workers deploy primitive，不代表生产发布链路完成。后续 `.github/workflows/deploy.yml` 可以复用这个 primitive，也可以按 GitHub Actions 需要内联 build/deploy steps。

### 5. 环境变量分层

本子项必须把 Convex 变量边界写清楚：

```bash
CONVEX_DEPLOYMENT=<local Convex CLI deployment id>
VITE_CONVEX_URL=https://<production-deployment>.convex.cloud
CONVEX_DEPLOY_KEY=<production deploy key>
```

- `CONVEX_DEPLOYMENT`：本地 Convex CLI/project deployment metadata，不改成 Cloudflare 值，不提交生产值。
- `VITE_CONVEX_URL`：前端 public build-time variable，Cloudflare frontend build 必须提供。它会进入 browser-visible bundle，因此不能包含 secret。
- `CONVEX_DEPLOY_KEY`：Convex backend deploy secret，只用于 deploy machine 或 GitHub environment，不给 browser bundle，不写入 `wrangler.jsonc` plaintext vars。

Cloudflare Workers 同时存在 build-time env 和 runtime env/bindings。RemotionHub 当前 Convex client 使用 `import.meta.env.VITE_CONVEX_URL`，所以本子项只要求 build-time 注入。未来如果 server-only code 需要 runtime bindings，应另行设计 `cloudflare:workers` env binding 或 request-scoped env access。

### 6. Git ignore 和 env templates

为了避免上线准备时误提交本地或生产 env 文件，应收紧 `.gitignore`：

```gitignore
.env*
!.env.example
.dev.vars*
```

可以新增 `.env.example`，只列 key names 和 placeholders，不放真实值：

```bash
VITE_CONVEX_URL=https://example.convex.cloud
```

本子项不需要新增 `.dev.vars.example`，因为当前应用没有 Worker runtime secret/binding contract。后续如果引入 runtime secrets，再补充对应 template。

### 7. Specs 更新

本 spec 是 Cloudflare Workers release baseline 的 source of truth。历史 specs 不需要大范围重写，除非它们是 active guidance。`AGENTS.md` 仍是 agent 操作入口，必须与本 spec 一致。

## 风险与权衡

- Cloudflare plugin 可能影响 Vitest 或 local dev behavior。缓解方式是先按官方推荐接入，再用 `npm run test`、`npm run ci:types-build` 和 build 验证；如发现 test mode side effect，再条件化启用 plugin。
- Cloudflare Workers runtime 不是 Node.js server。`nodejs_compat` 是必要 baseline，但不能保证所有 Node package 行为完全一致。当前应用主要通过 Convex browser/http client 访问后端，风险可控。
- `VITE_CONVEX_URL` 是 public build-time env。它可以指向 production Convex URL，但不能承载 secret；backend deploy key 和 JWT/secrets 仍需独立管理。
- 新增 `deploy:cloudflare` 会让手动 deploy 更容易，但不能替代完整 release chain。文档必须持续强调 workflow、environment、DNS/TLS 和 smoke 尚未完成。
- `wrangler deploy` 可能使用 Cloudflare account state 或 local login state。实施阶段不应把本地登录成功误写成生产发布链路完成。

## 验证计划

实施后运行：

```bash
npx @tanstack/intent@latest list
npm run test
npm run ci:types-build
```

如果依赖安装或 Cloudflare plugin 输出发生较大变化，再运行：

```bash
npx wrangler deploy --dry-run
```

如果只修改 docs/spec 而没有配置变更，则不需要运行重型 gate。实际 Cloudflare 配置实施时必须至少运行 build/typecheck，并确认 `VITE_CONVEX_URL` 缺失时的失败路径仍然清晰。

## 验收标准

- Active guidance 不再把 frontend production target 描述为 Vercel。
- `AGENTS.md` 与本 spec 都明确 Cloudflare Workers 是 frontend production target。
- `package.json` 包含 Cloudflare Workers deploy primitive，但不暗示完整 release chain 已完成。
- `vite.config.ts` 接入 Cloudflare plugin 且保留现有 TanStack Start/Tailwind/React/devtools 行为。
- `wrangler.jsonc` 存在并只包含 Worker baseline，不包含 secrets、custom domains、routes 或 account-specific values。
- `.gitignore` 覆盖 `.env*` 和 `.dev.vars*`，同时允许 committed `.env.example`。
- Convex env contract 清楚区分 `CONVEX_DEPLOYMENT`、`VITE_CONVEX_URL` 和 `CONVEX_DEPLOY_KEY`。
- TypeScript check 和 production build 通过。

## 后续子项

- GitHub Actions `deploy.yml`：定义 manual production deploy workflow、targets、permissions、Cloudflare deploy step 和 Convex deploy step。
- GitHub `Production` environment：配置 `CONVEX_DEPLOY_KEY`、Cloudflare API token/account id，以及需要的 optional smoke secrets。
- Cloudflare domain and TLS：配置 `remotionhub.ai` 和 `www.remotionhub.ai`，验证 TLS、redirect 和 canonical host。
- Production smoke：基于真实 RemotionHub instance、真实 browser 和可控 fixture state 验证上线结果。
- Convex backend release：明确 production Convex deployment、deploy key 使用方式、catalog import policy 和 rollback story。

## 参考

- TanStack Start Hosting: https://tanstack.com/start/v0/docs/framework/react/guide/hosting
- Cloudflare TanStack Start guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- Cloudflare environment variables: https://developers.cloudflare.com/workers/configuration/environment-variables/
