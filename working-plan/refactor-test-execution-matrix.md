# refactor-test 执行矩阵

本文以执行映射为主；**T-14** 已补充落地路径、测试绑定与一次 Vitest 验证结果。矩阵目标是把 9 个模块、36 个 `scenario_id`、现有场景文件、现有测试文件、新增场景需求、保留回归测试和降级旧测试一次性对齐，便于后续按场景级任务树分发。

## 判定口径

- `复用场景`：继续沿用现有 `.scenario.ts` 作为主骨架。
- `新增场景`：必须新建对应的 `.scenario.ts`。
- `复用测试`：现有测试继续保留，但只做回归守门。
- `新增或重写测试`：需要新增场景级 E2E，或重写现有断言方向。
- `仅保留为 domain/local regression`：旧测试不再作为主验收，只作为底层保护。

## T-14 验证结果（2026-04-06）

以下命令在本仓库通过（退出码 0）：

- `npm run test:headless` → **41** 个文件、**71** 条用例 PASS（含 `tests/headless/scenario-runner.test.ts` 对 `ALL_SCENARIOS` 全量冒烟）。
- `npx vitest run tests/scene-hud-markup.test.ts` → **1** 文件、**8** 条用例 PASS（happy-dom，UI 局部回归）。
- `npx vitest run tests/domain/time-of-day.test.ts tests/domain/time-event-bus.test.ts tests/domain/floor-selection.test.ts tests/domain/occupancy-manager.test.ts tests/domain/lifecycle-rules.test.ts` → **5** 文件、**42** 条用例 PASS（矩阵所列 domain 降级守门）。

**约定**：下列「T-14」列均为 **PASS**（归属上述套件之一）。各 headless/domain/UI 文件顶部已加 `refactor-test` 注释，标明「主验收入口 / 仅回归 / 域守门」职责；以注释与下表为准。

## T-14：`scenario_id` 落地路径与测试绑定（36）

| `scenario_id` | 场景文件 | Headless / UI 测试文件 | T-14 | 降级与边界（摘要） |
|---|---|---|---|---|
| `NEED-001` | `scenarios/pawn-eats-when-hungry.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/pawn-eats-when-hungry.test.ts` | PASS | 直连 `createHeadlessSim` 文件为回归补充；主基线为场景 expectations + 全量冒烟。 |
| `NEED-002` | `scenarios/night-forces-sleep.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/night-forces-sleep.test.ts`；毗邻 `tests/headless/pawn-sleeps-when-tired.test.ts` | PASS | `pawn-sleeps-when-tired` 覆盖昼间疲劳睡径，不替代「夜间强制睡」主语义。 |
| `NEED-003` | `scenarios/need-interrupt-during-work.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/need-interrupt-during-work.test.ts` | PASS | 直连文件细化饥饿中断时序；与 `BEHAVIOR-003` 共享场景骨架。 |
| `NEED-004` | `scenarios/need-zero-floor.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/need-zero-floor.test.ts` | PASS | 触底主入口为 `need-zero-floor.test.ts`；其它需求用例不可替代。 |
| `TIME-001` | `scenarios/night-forces-sleep.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/night-forces-sleep.test.ts` | PASS | 与 `NEED-002` 同场景文件；本 id 强调跨夜/时段 HUD 语义。 |
| `TIME-002` | `scenarios/time-day-rollover.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/time-day-rollover.test.ts`；`tests/domain/time-of-day.test.ts`；`tests/domain/time-event-bus.test.ts` | PASS | 两 domain 文件仅纯函数/总线回归，主证据为 `time-day-rollover` 场景用例。 |
| `TIME-003` | `scenarios/time-pause-freeze.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/time-pause-freeze.test.ts` | PASS | 暂停冻结以 `runScenarioHeadless` 段为主。 |
| `TIME-004` | `scenarios/time-frame-gap-guard.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/time-frame-gap-guard.test.ts`；`tests/headless/headless-sim-basic.test.ts` | PASS | `headless-sim-basic` 为模拟器/帧步进底层守门，不替代 gap-guard 场景语义。 |
| `BEHAVIOR-001` | `scenarios/behavior-001-wander.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/behavior-wander.test.ts` | PASS | `multi-pawn-colony.test.ts` 仅为多小人邻近回归，非散步专用主场景。 |
| `BEHAVIOR-002` | `scenarios/multi-pawn-colony.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/multi-pawn-colony.test.ts`；`tests/headless/auto-claim-work.test.ts` | PASS | `auto-claim-work` 为认领链回归，主冒烟为场景 expectations。 |
| `BEHAVIOR-003` | `scenarios/need-interrupt-during-work.scenario.ts` | 同 `NEED-003` | PASS | 与 `NEED-003` 同源场景；describe 语义侧重行为打断。 |
| `BEHAVIOR-004` | `scenarios/behavior-004-no-resource-downgrade.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/behavior-no-resource-downgrade.test.ts` | PASS | 无床降级为可见 wander；非「正常 sleep」路径。 |
| `WORK-001` | `scenarios/chop-haul-full-chain.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/chop-haul-full-chain.test.ts` | PASS | 直连文件为全链细粒度回归；主基线为场景 + 冒烟。 |
| `WORK-002` | `scenarios/haul-mark-pickup.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/haul-mark-pickup.test.ts` | PASS | 与 `INTERACT-001` 共享场景；交互语义须对齐 rect-selection。 |
| `WORK-003` | `scenarios/chop-tree-command.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/stale-work-cleanup.test.ts`；`tests/headless/chop-tree-command.test.ts` | PASS | `stale-work-cleanup` / `chop-tree-command` 为工单/命令直连回归。 |
| `WORK-004` | `scenarios/build-bed-flow.scenario.ts`、`scenarios/bed-auto-assign.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/build-bed-flow.test.ts`；`tests/headless/bed-auto-assign.test.ts`；`tests/headless/work-blueprint-race.test.ts`；`tests/headless/auto-claim-work.test.ts` | PASS | 多文件分工：建造流、床位分配、抢蓝图竞态、认领邻近；主基线仍为场景 expectations + 冒烟。 |
| `ENTITY-001` | `scenarios/chop-tree-full-flow.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/chop-tree-full-flow.test.ts`；`tests/headless/ui-progress-visibility.test.ts`（UI-002 进度条读模型） | PASS | `chop-work-complete.test.ts` 为 WorldCore 直调回归，非玩家路径主证据。 |
| `ENTITY-002` | `scenarios/chop-haul-full-chain.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/chop-haul-full-chain.test.ts`；`tests/headless/haul-work-complete.test.ts`；`tests/headless/pickup-work-complete.test.ts` | PASS | 两 `*-work-complete` 为工单完成直调回归。 |
| `ENTITY-003` | `scenarios/build-wall-flow.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/build-wall-flow.test.ts`；`tests/headless/ui-menu-mode-switch.test.ts`（与 BUILD/UI 重叠） | PASS | `build-wall-flow.test.ts` 内兼有 `createHeadlessSim` 段与 `runScenarioHeadless` 段，文件头已写清分层。 |
| `ENTITY-004` | `scenarios/entity-resource-conflict.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/entity-conflict-guard.test.ts` | PASS | `tests/domain/lifecycle-rules.test.ts` 等不可替代冲突场景玩家路径。 |
| `MAP-001` | `scenarios/map-initial-state.scenario.ts`、`scenarios/story-1-day-one.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/map-initial-state.test.ts`；`tests/headless/story-1-day-one.test.ts` | PASS | `map-initial-state.scenario.ts` 无 expectations，主可见 bootstrap 由 `story-1-day-one` 与专用用例承担。 |
| `MAP-002` | `scenarios/zone-create.scenario.ts`（+ 毗邻 `story-1-day-one` 基线） | `tests/headless/scenario-runner.test.ts`；`tests/headless/zone-create.test.ts` | PASS | 直连 `zone-create` 为回归补充。 |
| `MAP-003` | `scenarios/map-blocked-placement.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/map-blocked-placement.test.ts`；`tests/domain/occupancy-manager.test.ts`；`tests/domain/lifecycle-rules.test.ts` | PASS | domain 为几何/生命周期守门，主证据为 blocked-placement 场景。 |
| `MAP-004` | `scenarios/map-out-of-bounds-selection.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/map-out-of-bounds-selection.test.ts`；`tests/domain/floor-selection.test.ts` | PASS | `floor-selection` 为框选纯函数回归，主证据为场景用例。 |
| `BUILD-001` | `scenarios/build-wall-flow.scenario.ts` | 同 `ENTITY-003` / `INTERACT-002` / `UI-001` 中 `build-wall` 相关用例 | PASS | 建造强交互与可见拒绝由 `runScenarioHeadless` + UI headless 分担。 |
| `BUILD-002` | `scenarios/build-bed-flow.scenario.ts`、`scenarios/bed-auto-assign.scenario.ts` | 同 `WORK-004` 中床链用例 | PASS | 与工单/床位分配共用场景骨架。 |
| `BUILD-003` | `scenarios/build-invalid-placement.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/build-invalid-placement.test.ts` | PASS | domain `build-flow` 等规则测不可替代本场景拒绝反馈。 |
| `BUILD-004` | `scenarios/bed-overflow-unassigned.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/bed-overflow-unassigned.test.ts`；毗邻 `bed-auto-assign.test.ts`、`auto-claim-work.test.ts` | PASS | 溢出未分配主入口为 `bed-overflow-unassigned.test.ts`。 |
| `INTERACT-001` | `scenarios/haul-mark-pickup.scenario.ts` | 同 `WORK-002` | PASS | 语义须落在选区/搬运交互，而非仅工具副作用。 |
| `INTERACT-002` | `scenarios/build-wall-flow.scenario.ts` | `tests/headless/build-wall-flow.test.ts`；`tests/headless/ui-menu-mode-switch.test.ts` | PASS | 笔刷/单格建造输入与模式行可见性。 |
| `INTERACT-003` | `scenarios/build-bed-flow.scenario.ts` | `tests/headless/build-bed-flow.test.ts` | PASS | 单格建造提交与可见状态。 |
| `INTERACT-004` | `scenarios/interaction-no-tool.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/interaction-no-tool.test.ts` | PASS | 无工具点击/拖拽不产生世界副作用。 |
| `UI-001` | `scenarios/build-wall-flow.scenario.ts` | `tests/headless/ui-menu-mode-switch.test.ts`；`tests/scene-hud-markup.test.ts`（DOM/槽位局部）；`tests/headless/build-wall-flow.test.ts`（重叠回归） | PASS | DOM 结构非场景主证据；主证据为 headless 读模型 + 场景。 |
| `UI-002` | `scenarios/chop-tree-full-flow.scenario.ts` | `tests/headless/ui-progress-visibility.test.ts`；`tests/headless/chop-tree-full-flow.test.ts` | PASS | 进度条规则以读模型为主；全链文件为 ENTITY/UI 邻近断言。 |
| `UI-003` | `scenarios/multi-pawn-colony.scenario.ts` | `tests/headless/ui-pawn-panel-sync.test.ts`；`tests/scene-hud-markup.test.ts`（HudManager 局部）；`tests/headless/multi-pawn-colony.test.ts` | PASS | 多小人场景冒烟 + 面板读模型；HUD 同步测不替代场景。 |
| `UI-004` | `scenarios/ui-layer-clarity.scenario.ts` | `tests/headless/scenario-runner.test.ts`；`tests/headless/ui-layer-clarity.test.ts` | PASS | 分层清晰度主入口为 `ui-layer-clarity.test.ts`。 |

## 模块总览

| 模块 | 主验收入口 | 现有可复用资源 | 需新增场景文件 | 旧测试处理 |
|---|---|---|---|---|
| 需求系统 | `manualAcceptance` + `runScenarioHeadless` | `pawn-eats-when-hungry.scenario.ts`, `night-forces-sleep.scenario.ts`, `need-interrupt-during-work.scenario.ts` | `scenarios/need-zero-floor.scenario.ts` | `pawn-eats-when-hungry.test.ts`, `night-forces-sleep.test.ts`, `need-interrupt-during-work.test.ts` 只保留回归 |
| 时间系统 | `runScenarioHeadless` + `createHeadlessSim` + `manualAcceptance` | `night-forces-sleep.scenario.ts`, `pawn-sleeps-when-tired.scenario.ts`, `tests/domain/time-of-day.test.ts`, `tests/domain/time-event-bus.test.ts` | `scenarios/time-day-rollover.scenario.ts`, `scenarios/time-pause-freeze.scenario.ts`, `scenarios/time-frame-gap-guard.scenario.ts` | 现有时间域/无头用例降级为底层回归 |
| 行为系统 | `runScenarioHeadless` + `createHeadlessSim` | `multi-pawn-colony.scenario.ts`, `need-interrupt-during-work.scenario.ts`, `tests/headless/auto-claim-work.test.ts` | `scenarios/behavior-001-wander.scenario.ts`, `scenarios/behavior-004-no-resource-downgrade.scenario.ts` | `multi-pawn-colony.test.ts`, `need-interrupt-during-work.test.ts` 只做回归 |
| 工作系统 | `commitPlayerSelection` + `runScenarioHeadless` + `manualAcceptance` | `chop-haul-full-chain.scenario.ts`, `haul-mark-pickup.scenario.ts`, `build-bed-flow.scenario.ts`, `bed-auto-assign.scenario.ts` | 无新增必需场景文件；`WORK-003`/`WORK-004` 仅补设计侧边界 | `chop-haul-full-chain.test.ts`, `haul-mark-pickup.test.ts`, `stale-work-cleanup.test.ts`, `auto-claim-work.test.ts`, `bed-auto-assign.test.ts` 仅保留回归 |
| 实体系统 | `commitPlayerSelection` + `runScenarioHeadless` | `chop-tree-full-flow.scenario.ts`, `chop-haul-full-chain.scenario.ts`, `build-wall-flow.scenario.ts` | `scenarios/entity-resource-conflict.scenario.ts` | 旧 headless / domain 直连用例只保留回归 |
| 地图系统 | `commitPlayerSelection` + `runScenarioHeadless` + `manualAcceptance` | `map-initial-state.scenario.ts`, `story-1-day-one.scenario.ts`, `zone-create.scenario.ts` | `scenarios/map-blocked-placement.scenario.ts`, `scenarios/map-out-of-bounds-selection.scenario.ts` | `story-1-day-one.test.ts`, `zone-create.test.ts`, `floor-selection.test.ts` 仅保留回归 |
| 建筑系统 | `commitPlayerSelection` + `runScenarioHeadless` + `manualAcceptance` | `build-wall-flow.scenario.ts`, `build-bed-flow.scenario.ts`, `bed-auto-assign.scenario.ts` | `scenarios/build-invalid-placement.scenario.ts`, `scenarios/bed-overflow-unassigned.scenario.ts` | `build-wall-flow.test.ts`, `build-bed-flow.test.ts`, `bed-auto-assign.test.ts`, `auto-claim-work.test.ts` 仅保留回归 |
| 交互系统 | `commitPlayerSelection` + `runScenarioHeadless` | `haul-mark-pickup.scenario.ts`, `build-wall-flow.scenario.ts`, `build-bed-flow.scenario.ts` | `scenarios/interaction-no-tool.scenario.ts` | `haul-mark-pickup.test.ts`, `build-wall-flow.test.ts`, `build-bed-flow.test.ts` 仅保留回归 |
| UI系统 | `manualAcceptance` + `runScenarioHeadless` | `scene-hud-markup.test.ts`, `build-wall-flow.scenario.ts`, `chop-tree-full-flow.scenario.ts`, `multi-pawn-colony.scenario.ts` | `scenarios/ui-layer-clarity.scenario.ts` | `scene-hud-markup.test.ts`, `chop-tree-full-flow.test.ts` 仅保留局部回归 |

## 需求系统

主验收入口：`manualAcceptance` + `runScenarioHeadless`。现有 3 个旧 headless 场景继续保留，但都降级为回归，不再承担主证据职责；`NEED-004` 必须新建触底边界场景。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `NEED-001` | `scenarios/pawn-eats-when-hungry.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/pawn-eats-when-hungry.test.ts` 仅保留 regression |
| `NEED-002` | `scenarios/night-forces-sleep.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/night-forces-sleep.test.ts`、`tests/headless/pawn-sleeps-when-tired.test.ts` 仅保留 regression |
| `NEED-003` | `scenarios/need-interrupt-during-work.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/need-interrupt-during-work.test.ts` 仅保留 regression |
| `NEED-004` | `scenarios/need-zero-floor.scenario.ts` | 新增场景 | 新增或重写测试 | 旧检查只作为邻近 regression，不可替代主验收 |

## 时间系统

主验收入口：`runScenarioHeadless` + `createHeadlessSim` + `manualAcceptance`。时间模块里旧的纯函数/域测试只保留守门，新的主证据必须来自可玩的场景推进。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `TIME-001` | `scenarios/night-forces-sleep.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/night-forces-sleep.test.ts` 降级为回归 |
| `TIME-002` | `scenarios/time-day-rollover.scenario.ts` | 新增场景 | 新增或重写测试 | `tests/domain/time-of-day.test.ts`、`tests/domain/time-event-bus.test.ts` 只做底层回归 |
| `TIME-003` | `scenarios/time-pause-freeze.scenario.ts` | 新增场景 | 新增或重写测试 | 现有暂停相关域/无头检查仅保留回归 |
| `TIME-004` | `scenarios/time-frame-gap-guard.scenario.ts` | 新增场景 | 新增或重写测试 | `tests/headless/headless-sim-basic.test.ts` 仅保留底层保护 |

## 行为系统

主验收入口：`runScenarioHeadless` + `createHeadlessSim`。行为模块要把散步、工作转执行、需求打断、无资源降级都落到真实场景推进上；`BEHAVIOR-001` 和 `BEHAVIOR-004` 必须补专用场景。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `BEHAVIOR-001` | `scenarios/behavior-001-wander.scenario.ts` | 新增场景 | 新增或重写测试 | `tests/headless/multi-pawn-colony.test.ts` 仅保留回归 |
| `BEHAVIOR-002` | `scenarios/multi-pawn-colony.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/auto-claim-work.test.ts` 仅保留回归 |
| `BEHAVIOR-003` | `scenarios/need-interrupt-during-work.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/need-interrupt-during-work.test.ts` 仅保留回归 |
| `BEHAVIOR-004` | `scenarios/behavior-004-no-resource-downgrade.scenario.ts` | 新增场景 | 新增或重写测试 | 正向 sleep 场景只保留邻近回归 |

## 工作系统

主验收入口：`commitPlayerSelection` + `runScenarioHeadless` + `manualAcceptance`。工单系统里的旧直连测试不再充当主证据，只保留稳定性回归。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `WORK-001` | `scenarios/chop-haul-full-chain.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/chop-haul-full-chain.test.ts` 仅保留 regression |
| `WORK-002` | `scenarios/haul-mark-pickup.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/haul-mark-pickup.test.ts` 仅保留 regression |
| `WORK-003` | `scenarios/chop-tree-command.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/stale-work-cleanup.test.ts` 仅保留底层回归 |
| `WORK-004` | `scenarios/build-bed-flow.scenario.ts` + `scenarios/bed-auto-assign.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/build-bed-flow.test.ts`, `tests/headless/bed-auto-assign.test.ts`, `tests/headless/auto-claim-work.test.ts` 仅保留回归 |

## 实体系统

主验收入口：`commitPlayerSelection` + `runScenarioHeadless`。实体模块把树木、资源携带、蓝图建造与冲突保护都收敛到玩家可见链路，而不是 `domain` 直调。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `ENTITY-001` | `scenarios/chop-tree-full-flow.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/chop-tree-full-flow.test.ts` 仅保留回归 |
| `ENTITY-002` | `scenarios/chop-haul-full-chain.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/chop-haul-full-chain.test.ts`、`tests/headless/haul-work-complete.test.ts`、`tests/headless/pickup-work-complete.test.ts` 仅保留回归 |
| `ENTITY-003` | `scenarios/build-wall-flow.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/build-wall-flow.test.ts` 仅保留回归 |
| `ENTITY-004` | `scenarios/entity-resource-conflict.scenario.ts` | 新增场景 | 新增或重写测试 | `tests/domain/lifecycle-rules.test.ts` 等只保留守门，不可替代冲突场景（主入口 `entity-conflict-guard.test.ts`，见 T-14 总表） |

## 地图系统

主验收入口：`commitPlayerSelection` + `runScenarioHeadless` + `manualAcceptance`。地图模块的旧几何/占用回归保留，但主证据必须来自玩家框选与场景反馈。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `MAP-001` | `scenarios/map-initial-state.scenario.ts` + `scenarios/story-1-day-one.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/story-1-day-one.test.ts` 仅保留 bootstrap regression |
| `MAP-002` | `scenarios/zone-create.scenario.ts` + `scenarios/story-1-day-one.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/zone-create.test.ts` 仅保留回归 |
| `MAP-003` | `scenarios/map-blocked-placement.scenario.ts` | 新增场景 | 新增或重写测试 | `tests/domain/occupancy-manager.test.ts`、`tests/domain/lifecycle-rules.test.ts` 仅保留几何回归 |
| `MAP-004` | `scenarios/map-out-of-bounds-selection.scenario.ts` | 新增场景 | 新增或重写测试 | `tests/domain/floor-selection.test.ts` 仅保留规则回归 |

## 建筑系统

主验收入口：`commitPlayerSelection` + `runScenarioHeadless` + `manualAcceptance`。建筑模块必须保留选区、蓝图落成、归属变化和失败反馈的完整链路。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `BUILD-001` | `scenarios/build-wall-flow.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/build-wall-flow.test.ts` 仅保留回归 |
| `BUILD-002` | `scenarios/build-bed-flow.scenario.ts` + `scenarios/bed-auto-assign.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/build-bed-flow.test.ts`, `tests/headless/bed-auto-assign.test.ts` 仅保留回归 |
| `BUILD-003` | `scenarios/build-invalid-placement.scenario.ts` | 新增场景 | 新增或重写测试 | 仅保留 `placeBlueprint` / 规则级回归，不可替代场景 |
| `BUILD-004` | `scenarios/bed-overflow-unassigned.scenario.ts` | 新增场景 | 新增或重写测试 | `tests/headless/bed-auto-assign.test.ts`、`tests/headless/auto-claim-work.test.ts` 仅保留回归 |

## 交互系统

主验收入口：`commitPlayerSelection` + `runScenarioHeadless`。交互模块要把四种输入模式的玩家动作、预览和拒绝反馈都落到真实场景里。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `INTERACT-001` | `scenarios/haul-mark-pickup.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/haul-mark-pickup.test.ts` 仅保留回归 |
| `INTERACT-002` | `scenarios/build-wall-flow.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/build-wall-flow.test.ts` 仅保留回归 |
| `INTERACT-003` | `scenarios/build-bed-flow.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/build-bed-flow.test.ts` 仅保留回归 |
| `INTERACT-004` | `scenarios/interaction-no-tool.scenario.ts` | 新增场景 | 新增或重写测试 | 无工具状态相关旧检查仅保留回归 |

## UI系统

主验收入口：`manualAcceptance` + `runScenarioHeadless`。UI 模块必须把层级菜单、进度条、状态面板和分层清晰度都放到玩家可见验收上，组件/DOM 测试只做局部守门。

| scenario_id | 现有/拟定场景文件 | 场景策略 | 测试策略 | 旧测试处理 |
|---|---|---|---|---|
| `UI-001` | `scenarios/build-wall-flow.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/scene-hud-markup.test.ts`、`tests/headless/build-wall-flow.test.ts` 仅保留局部回归 |
| `UI-002` | `scenarios/chop-tree-full-flow.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/headless/chop-tree-full-flow.test.ts` 仅保留局部回归 |
| `UI-003` | `scenarios/multi-pawn-colony.scenario.ts` | 复用场景 | 新增或重写测试 | `tests/scene-hud-markup.test.ts` 仅保留局部回归 |
| `UI-004` | `scenarios/ui-layer-clarity.scenario.ts` | 新增场景 | 新增或重写测试 | 主入口 `tests/headless/ui-layer-clarity.test.ts`；`scene-hud-markup.test.ts` 仍仅局部 DOM 守门（见 T-14 总表） |

## 覆盖清单

已覆盖的 36 个 `scenario_id` 如下：

`NEED-001`, `NEED-002`, `NEED-003`, `NEED-004`,
`TIME-001`, `TIME-002`, `TIME-003`, `TIME-004`,
`BEHAVIOR-001`, `BEHAVIOR-002`, `BEHAVIOR-003`, `BEHAVIOR-004`,
`WORK-001`, `WORK-002`, `WORK-003`, `WORK-004`,
`ENTITY-001`, `ENTITY-002`, `ENTITY-003`, `ENTITY-004`,
`MAP-001`, `MAP-002`, `MAP-003`, `MAP-004`,
`BUILD-001`, `BUILD-002`, `BUILD-003`, `BUILD-004`,
`INTERACT-001`, `INTERACT-002`, `INTERACT-003`, `INTERACT-004`,
`UI-001`, `UI-002`, `UI-003`, `UI-004`.

## 需要重点留意的映射风险

- `BEHAVIOR-002` 和 `WORK-003` 目前先复用现有场景基座，验收时要确认它们没有退化成单纯的内部状态回归。
- `MAP-001` 采用 `map-initial-state.scenario.ts` + `story-1-day-one.scenario.ts` 双基线，主证据必须是玩家可见的初始地图，而不是 bootstrap 断言。
- `UI-003` 当前先以 `multi-pawn-colony.scenario.ts` 作为复用基座，若状态面板信号不足，后续可能需要再拆一条更纯的点选场景。
- `INTERACT-001` 复用 `haul-mark-pickup.scenario.ts` 作为交互骨架时，要确认矩阵里主语义确实落在 `rect-selection`，而不是工具命令结果。
