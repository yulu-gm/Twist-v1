# 审计报告: src/game/world-bootstrap.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题：`bootstrapWorldForScene` 承担网格初值、`WorldCore` 创建、阻挡格采样与 `seedInitialTreesAndResources` 装饰，与 `oh-code-design/地图系统.yaml` 中「地图网格」「初始地图快照」里与**格级阻挡、初始树木/物资分布**相关的意图一致；**初始小人位置**若以实体系统在其它模块落位为准，则不在本单文件内构成可单独定性的漏做（需与实体/编排入口交叉核对，本报告不扩大范围）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 36–41 行石格 `pickRandomBlockedCells` 使用 `() => Math.random()`，而同函数内第 47–58 行树木与资源使用 `createSeededRng(terrainDecorationSeed)`；同一初始化路径上随机源分裂。
- [依据]: `oh-gen-doc/地图系统.yaml`「地图初始化」描述初始物资与树木等世界初态；结合源码注释（第 31–32 行）对 `terrainDecorationSeed`「可复现」的说明，障碍格布局未纳入同一种子叙事，与设计文档强调的**稳定初态**意图存在张力。
- [影响]: 相同 `terrainDecorationSeed` 下仍可能因石格布局非确定导致路径、工作与验收用例不稳定。
- [指控]: 第 61 行默认装配 `WorldCoreWorldPort`；该类型在 `src/player/world-core-world-port.ts` 文档语义中含「A 线 / B 线验收」「Mock」类配置，却在 `game` 层场景引导中作为默认出口，存在将**验收/模拟适配器**当作常态组装默认实现的倾向。
- [影响]: 正式游玩与测试线边界模糊，后续替换为纯领域端口时易产生双轨兼容代码。

## 3. 架构违规 (Architecture Violations)

- [指控]: `game` 包内 `import { WorldCoreWorldPort } from "../player/world-core-world-port"`（第 8 行）并在第 61 行直接 `new WorldCoreWorldPort(worldCore)`，形成 **game → player** 的具体类型依赖。
- [依据]: `oh-code-design/交互系统.yaml` 分层将「输入采集—模式—意图—反馈」与向地图/实体/建筑等领域提交命令的边界划清；`oh-code-design/UI系统.yaml`「界面动作转发层」职责为将界面操作转发给交互系统，隐含 **玩家侧适配与领域核心** 宜由更外层组合而非由 `game` 核心反向依赖 `player` 实现类。当前组装方式使领域初始化与玩家线具体适配器耦合，违背文档所暗示的**依赖自外向内、领域不依赖呈现/玩家壳层**的分层方向。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0191]: 将石格采样的 `rng` 与 `terrainDecorationSeed` 统一（例如对石格使用派生子种子或同一 `createSeededRng` 链），使「世界初值」在单一种子下可复现。
- [行动点 #0192]: 由场景/应用入口注入实现 `OrchestratorWorldBridge`（或领域侧工厂）的实例，`bootstrapWorldForScene` 仅返回 `WorldCore` 与 `worldGrid`（或纯领域端口接口），避免 `game` 直接 `new WorldCoreWorldPort`。
- [行动点 #0193]: 若 `WorldCoreWorldPort` 仅服务测试，将其从默认场景路径剥离，或重命名/拆分「生产用 WorldPort」与「Mock/验收用 WorldPort」，消除 Mock 语义进入主路径。