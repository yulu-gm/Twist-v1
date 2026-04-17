---
name: project-workflow
description: 项目开发工作流 — spec/plan 驱动、分支策略、中文注释
type: project
---

## 开发流程

1. 设计 spec 写入 `docs/superpowers/specs/YYYY-MM-DD-<name>-design.md`
2. 实施 plan 写入 `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
3. 在 feature 分支上按 plan 逐步实现，每步提交
4. 全量测试通过后合并

## 分支状态（2026-04-17）

- `main` — 当前活跃主分支，最新提交包含 dead code 清理与游戏方向/内容总设三份设计文档
- 本地另有 `code-read` 分支
- Remote: `https://github.com/yulu-gm/Twist-v1`（含 `archived`、`if线`、`codex/blueprint-haul-carry-overflow` 等历史分支）

## 代码风格

- 注释使用中文
- 文件头使用 `@file` / `@description` / `@dependencies` / `@part-of` JSDoc 格式
- 提交信息使用英文（conventional commits）

**Why:** spec-driven 流程确保设计先行，减少返工。中文注释因为团队是中文母语。

**How to apply:** 大改动先写 spec，再写 plan，再实现。小改动可直接进行。提交前跑 `npx vitest run` 和 `npx tsc --noEmit`。
