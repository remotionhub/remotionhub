# Production Deploy Workflow Design

## 背景

RemotionHub 的 Cloudflare Workers frontend baseline 已经存在，但生产发布链路之前仍缺少 `.github/workflows/deploy.yml`。这个 workflow 的第一版目标不是一次性解决所有生产发布问题，而是把手动发布入口、环境边界、preflight、backend/frontend deploy 顺序和轻量 production smoke 固化下来。

## 目标

- 生产发布必须是 manual-only，通过 `workflow_dispatch` 触发。
- `main` merge 不自动 deploy。
- workflow 可以从 GitHub UI 选择 ref，但不带 `Production` environment 的 source guard 必须在任何生产环境 job 之前拒绝非 `refs/heads/main` 的发布。
- 支持 `target=full|backend|frontend|smoke`。
- 支持 `dry_run`，默认值必须是 `true`。
- 使用 GitHub `Production` environment 读取生产 secrets 和 vars。
- backend deploy 使用 Convex deploy key。
- frontend deploy 使用 Wrangler 和 Cloudflare API token/account id。
- `CLOUDFLARE_ACCOUNT_ID` 按 secret 管理，不放在 vars。
- 第一版 production smoke 是轻量 URL probe，完整 Playwright production smoke 后续单独实现。

## 非目标

- 不配置 GitHub `Production` environment。
- 不配置 Cloudflare DNS、custom domain、routes 或 TLS。
- 不实现完整 `ci:production-smoke` Playwright 套件。
- 不定义 Convex production import policy。
- 不定义 rollback automation。
- 不触发真实 production deploy。

## Workflow 结构

`.github/workflows/deploy.yml` 使用以下 job：

- `release_source_guard`：不进入 `Production` environment，先拒绝非 `refs/heads/main` 的发布。
- `preflight`：安装依赖，验证 release configuration，运行 audit、unit coverage 和 TypeScript/build gate。
- `backend_deploy`：当 `target=backend|full` 时执行 Convex dry-run 或真实 deploy。
- `frontend_deploy`：当 `target=frontend|full` 时执行 Cloudflare dry-run 或真实 deploy。
- `production_smoke`：当 `target=smoke` 或真实 `target=full` 发布后执行轻量 URL probe。
- `release_summary`：始终写入 GitHub step summary，避免失败时缺少发布状态说明。

`full` 的发布顺序是：

```text
release_source_guard -> preflight -> backend_deploy -> frontend_deploy -> production_smoke -> release_summary
```

`frontend` 可以独立执行，不要求 backend deploy。`smoke` 可以独立执行，用于验证当前生产 URL。

## Environment contract

`Production` environment required secrets：

```text
CONVEX_DEPLOY_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

`Production` environment required vars：

```text
VITE_CONVEX_URL
PRODUCTION_URL
```

`Production` environment optional secrets：

```text
PLAYWRIGHT_AUTH_STORAGE_STATE_JSON
```

`VITE_CONVEX_URL` 是 browser-visible build-time variable，不能包含 secret。`CONVEX_DEPLOY_KEY`、`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 不进入 browser bundle。

## Permissions and concurrency

Workflow permissions：

```yaml
permissions:
  contents: read
  deployments: write
```

`deployments: write` 用于生产 environment deployment 记录。`contents: read` 足够 checkout 代码。

Production deploy 使用固定 concurrency group：

```yaml
concurrency:
  group: production-deploy
  cancel-in-progress: false
```

这保证两个生产发布不会并发互相覆盖，并且不会取消已经开始的发布。

## 后续子项

- 配置 GitHub `Production` environment 及其 secrets/vars。
- 修复并验证 `https://remotionhub.ai` 和 `https://www.remotionhub.ai` 的 DNS/TLS。
- 增加独立 `ci:production-smoke` 或 Playwright production smoke target。
- 明确 production fixture/auth storage 管理方式。
- 明确 Convex production catalog import policy。
- 设计 rollback runbook 或 automation。
