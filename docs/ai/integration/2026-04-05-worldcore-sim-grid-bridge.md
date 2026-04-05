## 主题

`2026-04-05-worldcore-sim-grid-bridge`

## 玩家路径

1. 玩家在场景中下达拆除、建造等意图，`WorldCoreWorldPort` 将领域命令写入 `WorldCore`。
2. 障碍实体增减或蓝图落成建筑并产生 `restSpots` 后，`GameScene` 每帧调用 `syncWorldGridForSimulation`，把与 `WorldCore` **共用的** `WorldGridConfig` 更新为模拟层可消费的形态。
3. `tickSimulation` 与 `goal-driven-planning` 读到的障碍格与床位交互点与当前世界快照一致；表现层石头格与交互点标签随 id 集合变化清理、重绘。

## 参与系统

- `world-core`：障碍实体、`restSpots` 真相源
- `world-grid`：`blockedCellKeys`、交互点列表、`pruneReservationSnapshot`
- `world-sim-bridge`（`src/game/world-sim-bridge.ts`）：从快照推导模拟用障碍集合与「模板床 + 世界床位」交互点
- `task-planning`：`sim-loop` 消费同步后的网格
- `scene-hud` / `selection-ui`：玩家通道与选区仍经网关，不直接改世界

## TDD / 回归

- `tests/game/world-sim-bridge.test.ts`
- `npm run test`、`npm run test:docs`
