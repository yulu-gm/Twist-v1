# 集成说明：随机地图石头阻挡

## 主题

`2026-04-05-random-stone-obstacles`

## 玩家路径

1. 玩家打开游戏，`GameScene` 初始化默认网格布局与格线。
2. `world-grid` 语义：`pickRandomBlockedCells` 在排除默认 5 个出生格后，随机选取固定数量格写入 `blockedCellKeys`；`blockedKeysFromCells` 转为查询用集合。
3. 表现层在格心绘制石头矩形（仅视觉，坐标换算仍用 `cellCenterWorld`）。
4. `pawn-state` 仍出生在原默认出生点；每帧游荡前，`task-planning`（`wander-planning`）通过 `isWalkableCell` 过滤邻格，角色不会走入阻挡格。
5. 阻挡在单局内固定；重开场景会重新随机（当前使用 `Math.random()`）。

## 参与系统

- `world-grid`：阻挡配置、可走判断、随机采样工具函数。
- `task-planning`：合法游荡邻格过滤（不得包含阻挡）。
- `pawn-state`：移动状态机不变，仅合法目标集合变小。
- `GameScene`：组装带阻挡的 `worldGrid` 并绘制石头（表现层编排）。

## 当前 UI-first fake

- 石头数量为场景内常量（`STONE_CELL_COUNT`），非数据驱动；由 `docs/ai/systems/world-grid/2026-04-05-random-stone-obstacles.md` 记录。
- 随机源为 `Math.random()`，未接可复现种子或 `data/` 配置；若需确定性开局，将来注入 `GridRand` 并补测试。
- 美术为占位几何体，非正式素材。

## TDD 顺序

1. `world-grid` domain：`isWalkableCell` 对 `blockedCellKeys` 的行为；`pickRandomBlockedCells` 排除集合与数量上限。
2. `task-planning` domain：给定阻挡邻格时，`legalWanderNeighbors` 不得包含该格。
3. 场景层无专用 E2E；通过上述 domain 测试锁定规则。

## fake-to-real 反推顺序

1. 将阻挡生成迁移到 `data/` 地图定义或种子化 RNG，保留同一套 `blockedCellKeys` 契约。
2. 替换占位图形为正式地块/物件表现，规则层不变。
3. 若引入完整寻路，扩展规划输出格式并补 `world-grid` + `task-planning` 联合 domain 测试。

## 必跑回归组合

- `world-grid` + `task-planning`
- `pawn-state` + `task-planning`（游荡目标仍来自合法邻格）
