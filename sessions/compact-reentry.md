# Twist-v1 极简续命 Memo

一句话：这是一个 `TypeScript + Vite + Phaser + Preact` 的类 RimWorld 项目，最核心规则是 `确定性 simulation` 和 `render/UI` 严格分离。

## 最重要心智模型

`main -> bootstrap -> core/world/defs/features -> adapter/ui`

`presentation` 只是 UI 瞬时状态桥，不是 simulation 状态。

## 只需要记住的文件

- `src/main.ts`：总装配入口。建 `defs/world/map`、生成初始内容、注册 commands/systems、启动 Phaser 和 Preact UI。
- `src/bootstrap/default-registrations.ts`：哪些 command/system 真正在跑，看这里。
- `src/bootstrap/world-step.ts`：每 tick 的真实推进入口；运行时和测试共用。
- `src/world/world.ts`：全局状态根，真正的世界状态在这里。
- `src/world/game-map.ts`：单地图容器，`terrain/objects/spatial/zones/rooms/reservations/pathGrid` 都在这里。
- `src/core/tick-runner.ts`：固定 tick phase 顺序，是重要不变量。
- `src/presentation/presentation-state.ts`：只放选中、hover、tool、preview 这类 UI 状态。
- `src/ui/app/app-root.tsx`：当前真实 UI 入口是 Preact 快照 UI，不是只有 Phaser adapter。

## 固定 Tick 顺序

1. `COMMAND_PROCESSING`
2. `WORK_GENERATION`
3. `AI_DECISION`
4. `RESERVATION`
5. `EXECUTION`
6. `WORLD_UPDATE`
7. `CLEANUP`
8. `EVENT_DISPATCH`

## 开工时别忘的硬规则

- 外部写入一律走 `command`，先看各 feature 的 `*.commands.ts`
- gameplay 规则在 `src/features/*`
- simulation 不要依赖 Phaser / DOM
- `presentation` 不进存档，不要往里塞 simulation 数据
- 行为“代码明明有但没生效”时，先查 `default-registrations.ts`
- 项目导航先看 `project-map/project-module-map.json`，不要上来全仓库乱搜
- 改代码时保留已有注释

## 常见定位

- 输入/交互：`src/adapter/input/input-handler.ts`
- AI 选工：`src/features/ai/job-selector.ts`、`job-lifecycle.ts`、`toil-executor.ts`
- 建造/指派：`src/features/construction/*`、`src/features/designation/*`
- 寻路/移动：`src/features/pathfinding/path.service.ts`、`src/features/movement/movement.system.ts`

## 最小开工路径

1. 先看 `src/main.ts`
2. 再看 `src/bootstrap/default-registrations.ts`
3. 再看目标 feature
4. 如果要追玩家动作链路，就按：
   `adapter input -> commandQueue -> commandBus -> feature systems -> eventBuffer/eventBus -> render/UI`

## 最后提醒

这是一个“`Phaser 运行时 + Preact 快照 UI`”的双层结构，不要只盯 adapter。

如果又失忆了，就只按这条线重建上下文：

`main -> bootstrap -> world -> 目标 feature`
