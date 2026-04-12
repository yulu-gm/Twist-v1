---
name: project-overview
description: Twist-v1 项目概况 — RimWorld-like 殖民地模拟游戏，TypeScript+Vite+Phaser+Preact 技术栈
type: project
originSessionId: 9128ff6f-832f-4cad-81ec-c77ba43490ff
---
Twist-v1 是一个 RimWorld 风格的殖民地模拟游戏，初创阶段，无线上环境。

**技术栈：** TypeScript + Vite + Phaser 3（渲染） + Preact（UI）+ Vitest（测试）

**核心架构：** 确定性模拟 / 渲染-UI 分离
- Simulation 层：World、GameMap、Pawn、Item、Building 等实体，通过 8 阶段固定 tick 顺序更新
- 渲染层：Phaser 读取 simulation 状态渲染
- UI 层：Preact 通过 snapshot-reader 读取 EngineSnapshot，不直接触碰 World/GameMap

**8 阶段 tick 顺序：** COMMAND_PROCESSING → WORK_GENERATION → AI_DECISION → RESERVATION → EXECUTION → WORLD_UPDATE → CLEANUP → EVENT_DISPATCH

**Why:** 确定性模拟保证可重放、可测试；UI 分离保证关注点隔离。

**How to apply:** 所有 gameplay 逻辑写在 simulation 层，UI 只读取 snapshot。新增 feature 按 tick phase 注册 system。
