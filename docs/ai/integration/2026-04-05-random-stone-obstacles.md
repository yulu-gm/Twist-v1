# 集成说明：随机地图石头阻挡

## 主题

`2026-04-05-random-stone-obstacles`

## 玩家路径

1. 玩家打开游戏，`GameScene` 初始化默认网格布局与格子线。
2. `world-grid` 语义：`pickRandomBlockedCells` 在排除默认的五个出生格子之后，随机选取固定数量的格子写入 `blockedCellKeys`；`blockedKeysFromCells` 转换为查询使用的集合。
3. 表现层在格子中心绘制石头矩形（仅为视觉效果，坐标换算仍然使用 `cellCenterWorld`）。
4. `pawn-state` 仍然出生在原有的默认出生点；每一帧游荡之前，`task-planning`（`wander-planning`）通过 `isWalkableCell` 过滤相邻格子，角色不会走入阻挡格子。
5. 阻挡在单局游戏内固定；重新开始场景会重新随机（当前使用 `Math.random()`）。

## 参与系统

- `world-grid`：阻挡配置、可走判断、随机采样工具函数。
- `task-planning`：合法游荡相邻格子过滤（不得包含阻挡）。
- `pawn-state`：移动状态机保持不变，仅仅是合法目标集合变小。
- `GameScene`：组装带有阻挡的 `worldGrid` 并且绘制石头（表现层编排）。

## 当前 UI-first fake

- 石头数量为场景内部常量（`STONE_CELL_COUNT`），并非数据驱动；由 `docs/ai/systems/world-grid/2026-04-05-random-stone-obstacles.md` 记录。
- 随机源为 `Math.random()`，尚未接入可复现的种子或者 `data/` 配置；如果需要确定性的开局，将来注入 `GridRand` 并且补充测试。
- 美术为占位几何体，并非正式素材。

## TDD 顺序

1. `world-grid` domain：`isWalkableCell` 对于 `blockedCellKeys` 的行为；`pickRandomBlockedCells` 排除集合与数量上限。
2. `task-planning` domain：给定阻挡的相邻格子时，`legalWanderNeighbors` 不得包含该格子。
3. 场景层没有专用的 E2E 测试；通过上述的 domain 测试锁定规则。

## fake-to-real 反推顺序

1. 将阻挡生成迁移到 `data/` 地图定义或者种子化的随机数生成器，保留同一套 `blockedCellKeys` 契约。
2. 替换占位图形为正式地块或者物件表现，规则层保持不变。
3. 如果引入完整的寻路，扩展规划输出格式并且补充 `world-grid` 加上 `task-planning` 的联合 domain 测试。

## 必跑回归组合

- `world-grid` + `task-planning`
- `pawn-state` + `task-planning`（游荡目标仍然来自合法的相邻格子）
