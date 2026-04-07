# 审计报告: src/game/world-construct-tick.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `WORK_WALK_KINDS` 未包含 `WorkItemKind` 中的 `deconstruct-obstacle`，导致已认领的拆除工单不会进入 `buildWorkWalkTargets` 的走向目标映射；`sim-loop` 中 `findClaimedWalkWorkIdForPawn` 同样依赖该集合，拆除工单的「认领后优先走向锚格邻格」与饥饿等场景下的「走向类工单」判定均与建造/伐木等不一致，易形成认领后无法按统一 sim 路径靠向操作站立格的行为缺口（与 `completeWorkItem` 对 `deconstruct-obstacle` 的正式分支并存，闭环不对称）。
- [依据]: `oh-gen-doc/工作系统.yaml` 中伐木、建造均要求「小人移动到目标旁边的地图格」再读条；`oh-code-design/工作系统.yaml`「工作模型层」— 定义工作类型与执行要求；「关键流程」建造/伐木链路均隐含锚格与邻格站位关系；`oh-code-design/行为系统.yaml`「行为执行层」— 将已选行动拆为移动、读条、结算等阶段，且「空闲转工作」需进入移动状态并锁定目标。拆除障碍作为已实现工单 kind，应在走向与锁定目标上与上述邻格站位语义对齐（是否还需在 `work-item-duration` 配置读条属另一缺口，见 `world-work-tick` 审计，但本文件对走向类的排除本身即漏对齐）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：无 `mock`/`temp`/`TODO` 残留，无仅为兼容旧接口而存在的死分支。

## 3. 架构违规 (Architecture Violations)

- [指控]: 文件名 `world-construct-tick.ts` 与导出内容不符：模块仅提供操作站立格选取与 `buildWorkWalkTargets` 纯函数，并无 `tick*` 帧逻辑，易误导维护者将「建造 tick」与其它 `world-*-tick` 混排时找错入口。
- [依据]: `oh-code-design/工作系统.yaml`「工作调度层 / 工作结算层」与行为侧 tick 的职责边界依赖清晰模块命名；当前命名弱化「全类锚格工单共用的走向映射」这一事实。

- [指控]: `WORK_WALK_KINDS` 与 `work-item-duration.ts` 中的 `WORK_ITEM_ANCHOR_DURATION_SEC` 各自维护一份「参与锚格邻接工作流」的 kind 列表，易出现一侧增 kind、另一侧未跟进的漂移（`deconstruct-obstacle` 即为跨文件不一致信号）。
- [依据]: `oh-code-design/工作系统.yaml`「扩展点」— 工作类型可通过声明式步骤模板扩展；多处以硬编码集合并行维护时，与「单一事实来源」方向相悖。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0194]: 在确认拆除工单锚格语义与建造一致（邻格操作、不占锚格）后，将 `deconstruct-obstacle` 纳入 `WORK_WALK_KINDS`，并同步校验 `sim-loop` / `GameOrchestrator` 注入的 `workWalkTargets` 是否覆盖拆除认领后的走向；若拆除不需要邻格走向，应在 `oh-gen-doc`/`oh-code-design` 明确差异，并避免 `completeWorkItem` 与走向逻辑语义分裂。
- [行动点 #0195]: 将「需走向操作站立格的 kind」与读条时长配置合并为单一导出或生成源（例如由 `work-types` 或工作元数据表驱动），减少 `WORK_WALK_KINDS` 与 `WORK_ITEM_ANCHOR_DURATION_SEC` 双轨漂移。
- [行动点 #0196]: 重命名文件为与职责一致的名称（如 `work-operator-stand.ts` 或 `work-walk-targets.ts`），并更新 `game-orchestrator.ts`、`sim-loop.ts`、`world-work-tick.ts` 等 import 路径（属重构，需在单独任务中执行）。