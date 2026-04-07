# 审计报告: src/scenes/renderers/building-renderer.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 施工中蓝图的「进度」未映射到视觉。`WorldEntitySnapshot` 含 `buildProgress01`、`buildState`（见 `src/game/entity/entity-types.ts` 中快照定义），本文件仅按 `kind === "blueprint"` 使用固定半透明/描边样式（71–79、88–104 行），未根据进度区分施工阶段反馈。
- [依据]: `oh-gen-doc/UI系统.yaml` 中「进度条」约定建造场景需显示工作进行进度（含建造读条）；`oh-code-design/建筑系统.yaml`「蓝图记录」含「当前进度」「当前状态」。若验收期望在地图叠加层直接体现施工进度，本渲染器尚未覆盖。

- [说明]: 当前领域类型 `BuildingKind` 仅为 `wall` | `bed`，与 `oh-gen-doc/UI系统.yaml`（木墙、木床）及 `oh-code-design/建筑系统.yaml`（墙体、木床）范围一致，对既有 kind 的筛选与绘制与策划范围对齐。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题（无 mock/temp/TODO，无兼容旧系统的冗余分支）。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本模块仅消费 `WorldEntitySnapshot` 与 `WorldGridConfig` 做 Phaser `Graphics` 绘制，不修改领域状态，符合 `oh-code-design/UI系统.yaml`「界面呈现层」与「以读模型驱动展示，避免 UI 直接承担领域规则」的分层意图。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0332]: 若产品确认需在格子上表现施工进度，可在 `drawWallCell`/`drawBedCell` 或循环内根据 `buildProgress01`（及 `buildState`）叠加局部填充、细进度条或色调插值，并与 `GameScene` 中其它叠加层（选区、标记）统一层级策略（对照 `oh-code-design/UI系统.yaml` 风险项「地图叠加反馈缺少统一层级」）。
- [行动点 #0333]: 未来若 `BuildingKind` 扩展，宜改为按 kind 注册绘制策略，避免在核心循环内继续堆叠 `wall`/`bed` 分支（与 `oh-code-design/建筑系统.yaml`「建筑规格目录」扩展方向一致）。
- **0333 核对（已修复）**: `building-renderer.ts` 使用 `BUILDING_CELL_DRAWERS: Record<BuildingKind, BuildingCellDrawer>` 注册 `wall`/`bed` 绘制函数；主循环仅解析 `kind` 后查表调用。扩展 `BuildingKind` 时 TypeScript 会要求补全表中键。