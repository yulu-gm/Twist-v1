---
name: project-workflow
description: 项目开发工作流 — spec/plan 驱动、分支策略、中文注释
type: project
originSessionId: 9128ff6f-832f-4cad-81ec-c77ba43490ff
---
## 开发流程

1. 设计 spec 写入 `docs/superpowers/specs/YYYY-MM-DD-<name>-design.md`
2. 实施 plan 写入 `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
3. 在 feature 分支上按 plan 逐步实现，每步提交
4. 全量测试通过后合并

## 分支状态（2026-04-13）

- `main` — 主分支，当前活跃开发分支
- `blank-start` — 已合并到 main，不再活跃
- `code-read` — 本地分支
- Remote: `https://github.com/yulu-gm/Twist-v1`

## 代码风格

- 注释使用中文
- 文件头使用 `@file` / `@description` / `@dependencies` / `@part-of` JSDoc 格式
- 提交信息使用英文（conventional commits）

## 已知的预存问题（2026-04-13）

- `src/features/ai/toil-handlers/deliver.handler.ts` — 引用不存在的 `getBlueprintFootprintCells`，TypeScript 编译错误
- 这是 pre-existing 问题，不影响测试运行（Vitest 不检查非测试文件的类型）

**Why:** spec-driven 流程确保设计先行，减少返工。中文注释因为团队是中文母语。

**How to apply:** 大改动先写 spec，再写 plan，再实现。小改动可直接进行。提交前跑 `npx vitest run` 和 `npx tsc --noEmit`。
