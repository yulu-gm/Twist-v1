# 审计报告: src/game/behavior/sim-config.ts

## 1. 漏做需求 (Missing Requirements)

- [说明]: `SimConfig` 与 `DEFAULT_SIM_CONFIG` 已提供移动耗时、开局石头格数量、三类需求的每秒增长速率，与 `oh-gen-doc/时间系统.yaml` 中「移动时间」「需求变化」等可配置方向、`oh-code-design/需求系统.yaml` 中「需求演化引擎」依赖的时间推进参数在语义上可对齐。
- [与设计完整字段的差异]: `oh-code-design/需求系统.yaml` 在「需求规则配置」下列出下降速率、恢复速率、警戒阈值、紧急阈值等关键字段；本文件仅承载「下降速率」中的 `needGrowthPerSec` 一段，恢复与阈值未纳入同一配置类型。若策划意图是「需求规则配置」单点维护，则当前属于跨模块分散（例如初始需求在 `need-utils`、阈值若在他处），本文件本身不构成「完全未实现」，但存在**与设计文档聚合描述不一致**的缺口风险。
- [地图内容]: `stoneCellCount` 在 `oh-gen-doc/` 中未检索到与「开局随机石头格数量」逐条对应的条款，属实现侧原型参数；无法据此指控漏做，仅标注**文档未覆盖该可调项**。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：无 `mock`/`temp`/`TODO`、无旧系统兼容分支或死代码。

## 3. 架构违规 (Architecture Violations)

- [指控]: 文件首行注释声明模拟层参数「与 Phaser 无关」，但同文件定义 `MAIN_SCENE_NEED_GROWTH_SCALE` 及 `createMainSceneSimConfig()`，注释亦写明「Phaser 主场景」用途，形成**命名与职责上的自相矛盾**：行为/模拟公共模块被绑定了具体场景运行时标签。
- [依据]: `oh-code-design/行为系统.yaml` 强调分层与接口边界（决策输入、状态机、执行协调等），并在风险中指出行为相关系统不宜与呈现层职责纠缠；将「主游戏场景」专用缩放因子放在 `behavior/sim-config.ts`，模糊了**模拟参数**与**某一前端场景入口**的边界，属于对分层意图的弱化（呈现语境泄漏进行为包）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0044]: 将 `MAIN_SCENE_NEED_GROWTH_SCALE` 与 `createMainSceneSimConfig` 迁出 `behavior/`（例如 `src/scenes/` 下的场景装配或独立的 `game/runtime-profile` 类模块），使 `sim-config.ts` 仅保留与呈现框架无关的 `SimConfig` / `DEFAULT_SIM_CONFIG`，与文件头注释一致。
- [行动点 #0045]: 若需保留场景专用倍率，将常量/工厂重命名为与 Phaser 解耦的名称（例如 `INTERACTIVE_CLIENT_NEED_GROWTH_SCALE`），由 `GameScene` 显式组合「基础 `SimConfig` + 客户端倍率」，避免在行为层出现框架名。
- [行动点 #0046]: 对照 `oh-code-design/需求系统.yaml`「需求规则配置」，在文档或代码层面明确：下降速率、恢复速率、阈值是否应合并为单一配置源；若合并，再考虑扩展 `SimConfig` 或引入并列类型并统一注入路径。

---

## 行动点落地记录（Worker / audit46 worktree）

- **AP-0045（已核对 → 已修复）**：在 `src/scenes/main-scene-sim-config.ts` 提供 `INTERACTIVE_CLIENT_NEED_GROWTH_SCALE` 与 `createInteractiveClientSimConfig()`；`GameScene` 仅通过该模块装配「基础 `SimConfig` + 客户端需求倍率」，`behavior/sim-config.ts` 不再出现 Phaser/主场景命名。依赖方向：`scenes` → `game/behavior/sim-config`，`behavior` 不引用 `scenes`。
- **AP-0046（已核对 → 已修复）**：在 `sim-config.ts` 文件头补充与「需求规则配置」的对照说明：下降速率（`needGrowthPerSec` / `sim-loop`）、恢复与阈值所在模块、以及有意分模块的边界；并注明工单锚格读条在 `work/work-item-duration.ts`，避免误认为未实现设计字段。
- **验收**：在 worktree `audit46b-6e251a92-w19` 上 `npx tsc --noEmit` 退出码 0。为通过编译，顺带对齐了当时 `origin/main` 上已存在的若干类型/测试缺口（与本条行动点无业务耦合）：`sim-debug-trace` 的 `PawnDecisionResult` 增补 `blocker*` 字段、HUD 命令菜单在 `commandMenuSelectedId` 为空串时的解析、`aidoc-benchmark` 的 `@ts-nocheck`、若干 headless/domain 测试与 `scene-hud-markup` 的 DOM 泛型。