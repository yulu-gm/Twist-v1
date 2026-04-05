## 主题

`2026-04-05-gamescene-runtime-refactor`

## 玩家路径

1. 玩家打开游戏，`GameScene` 仍然作为入口启动。
2. `src/game/time-of-day.ts` 推进世界时间，并输出同一套昼夜调色板。
3. `src/ui/hud-manager.ts` 读取格式化时间，继续同步 HUD 文案和相关显示状态。
4. `src/game/world-grid.ts` 继续提供网格几何、边界、占用和格键语义。
5. `src/scenes/renderers/grid-renderer.ts`、`src/scenes/renderers/ground-items-renderer.ts` 和 `src/scenes/renderers/selection-renderer.ts` 分别绘制格线、地表物件和选区。
6. `src/data/grid-cell-info.ts` 与 `src/data/ground-items.ts` 按格键消费网格数据，支撑相关场景表现。
7. 玩家看到的时间、背景、格线、物件和选区表现保持原样，没有预期的可见变化。

## 参与系统

- `time-of-day`：世界时间、跨天归一化、调色板采样的权威。
- `hud-manager`：时间文案与 HUD 绑定消费端。
- `world-grid`：地图几何、占用、边界和格键语义的权威。
- `grid-renderer`：网格视觉消费端。
- `ground-items-renderer`：地表物件视觉消费端。
- `selection-renderer`：选区与交互视觉消费端。
- `grid-cell-info` / `ground-items`：按格键组织的数据消费端。
- `GameScene`：只保留运行时编排，不再集中承接所有时间与网格细节。

## 当前 UI-first fake

- 这次重构不引入玩家可见新功能。
- 昼夜调色板继续由 `time-of-day` 驱动，DOM/HUD 同步从 `GameScene` 外移。
- 网格几何仍然以 `world-grid` 为单一事实来源，渲染器和数据模块只是消费它。
- 如果某段逻辑看起来像“重复”，默认应优先收敛到权威模块，而不是在 `GameScene` 里继续堆接线代码。

## TDD 顺序

1. `time-of-day` / `world-grid` 的 domain 回归，确认时间推进、调色板和网格语义没有变化。
2. 消费端回归，确认 `hud-manager`、三个 renderer 和两个 data 模块仍然读取同一套权威输出。
3. 场景层回归，确认 `GameScene` 只负责编排，且不会引入玩家可见偏差。

## fake-to-real 反推顺序

1. 若后续还要继续拆分场景层，把新的视觉职责优先下放到独立 renderer。
2. 若后续要让更多 UI 或面板显示时间与网格信息，继续消费同一套权威模块，不复制状态。
3. 若后续引入数据驱动地图或调色板，保持对外契约稳定，只替换权威数据源。

## 必跑回归组合

- `time-of-day` + `hud-manager`
- `time-of-day` + `GameScene`
- `world-grid` + `grid-renderer`
- `world-grid` + `ground-items-renderer`
- `world-grid` + `selection-renderer`
- `world-grid` + `GameScene`
