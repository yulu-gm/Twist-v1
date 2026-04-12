---
name: project-architecture
description: 项目目录结构与核心模块关系 — feature 模块、AI 系统、测试体系
type: project
originSessionId: 9128ff6f-832f-4cad-81ec-c77ba43490ff
---
## 目录结构

- `src/core` — 基础设施：types、tick-runner、logger、SeededRandom
- `src/world` — World、GameMap、Zone、Room、occupancy
- `src/defs` — 静态定义数据库（物品/建筑/植物等 def）
- `src/features` — 玩法模块（ai、pawn、item、building、construction、pathfinding、reservation、zone 等）
- `src/adapter` — 输入、渲染、UI bridge
- `src/presentation` — 展示态（activeTool、hoveredCell 等瞬时 UI 状态）
- `src/ui` — Preact UI 层（kernel/ui-types、snapshot-reader、domains/colonist|build|feedback）
- `docs/superpowers/specs` — 设计文档
- `docs/superpowers/plans` — 实施计划文档

## AI 子系统（src/features/ai）

- `job-selector.ts` — 工作选择编排器，调用 evaluator 管线
- `work-types.ts` — WorkOption、WorkEvaluation、PawnWorkDecisionSnapshot 类型
- `work-evaluator.types.ts` — WorkEvaluator 接口
- `work-evaluators/` — 9 个独立评估器（eat、sleep、mine、harvest、deliver_materials、construct、haul_to_stockpile、resolve_carrying、wander）
- `ai.types.ts` — Job 类型
- `jobs/` — 各类 job 工厂函数
- `toil-handlers/` — Toil 执行处理器

## 测试体系

- 单元/集成测试：`*.test.ts` 就近放置，Vitest
- 场景测试：`src/testing/headless/` 无头场景回归测试
- 可视化测试：`src/testing/visual-runner/` 浏览器内可视化场景
- 场景 DSL：`src/testing/scenario-dsl/` 场景构建器
- 测试 fixture：`src/testing/scenario-fixtures/world-fixtures.ts`

**How to apply:** 新功能参考同类模块的结构，测试遵循既有 pattern（createWorld → createGameMap → createPawn → execute system → assert）。
