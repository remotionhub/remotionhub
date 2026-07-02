# Security workflow rename note

## 变更时间
- 2026-07-02

## 变更内容
- 将 GitHub Actions 工作流文件重命名为：
  - `/.github/workflows/issue-5-security-quality.yml`
  - `/.github/workflows/security-quality.yml`
- 在工作流文件内同步更新展示名称：
  - `name: Issue 5 Security and Quality` -> `name: Security & Quality Gates`
  - `name: Issue 5 / Production audit` -> `name: Security / Production audit`
  - `name: Issue 5 / Unit coverage` -> `name: Quality / Unit coverage`

## 影响范围
- 行为不变：该工作流仍在 `pull_request` 和 `push` 到 `main` 时执行。
- 仅重命名元数据，CI 触发逻辑与执行步骤保持不变。

## 说明
- 历史文档保留，不做回填修改，以保留当时的设计/实施记录：
  - `specs/` 下先前版本的设计与实现说明文件。
- 本文件用于记录本次“当前命名更新”的最新状态。
