# 审计报告: src/headless/scenario-types.ts

## 1. 漏做需求

- [指控]: `ScenarioZoneSpawn` 仅包含 `cells` 与可选 `zoneKind`，未覆盖设计文档中「区域实体」对**名称**与**接受物资类型规则**的建模；场景作者无法在类型层声明与 `ZoneEntity` 对齐的 `name`、`acceptedMaterialKinds` 等字段（运行时在 `scenario-runner` 内写死 `acceptedMaterialKinds: []` 与生成型 `label`）。
- [依据]: `oh-code-design/实体系统.yaml`「核心数据 → 区域实体 → 关键字段」列有：区域类型、覆盖格集合、**名称**、**接受物资类型规则**。

- [指控]: `ScenarioExpectation` 使用单一 `type` 字符串联合配合 `params: Record<string, unknown>`，未为各期望类型提供判别联合（discriminated union）下的结构化 `params`；与 `oh-code-design/行为系统.yaml` 目标中「保持行为选择可解释、**可重放、可测试**」相比，类型层面对验收参数的约束偏弱，易在 YAML/手写场景中出现错键、漏键且编译期无法发现。
- [依据]: `oh-code-design/行为系统.yaml`「目标」一节（可解释、可重放、可测试）。

- [说明]: `oh-gen-doc` / `oh-code-design` **未**单独定义「无头场景 DSL」或 `ScenarioDefinition` 字段清单；除上述可对齐条目外，其余字段（如 `tickScheduleAfterHydrate`、`worldPortConfig` 等）无法从现有 YAML 中逐条核对为「需求漏做」，仅能视为实现侧扩展能力。

- [说明/一致性风险]: `ScenarioDefinition` 在类型上是单一形状，但 `zones` / `resources` 仅在 `headless/scenario-runner` 的 `hydrateScenario` 中写入世界，`player/scenario-loader.ts` 的 `loadScenarioIntoGame` **未消费**这两项；若策划期望「同一份 YAML 场景」在浏览器热切换与无头验收中等价，则缺口在装载实现而非本类型文件本身，但本文件也未用类型区分「仅 headless 生效字段」，易误导调用方。

## 2. 无用兼容与 Mock

- [指控]: `ScenarioResourceSpawn.materialKind` 与 `ScenarioZoneSpawn.zoneKind` 在类型上为 `string` / `string | undefined`，而领域层已存在 `ResourceMaterialKind`、`ZoneKind`（见 `entity-types`）；实际校验推迟到 `scenario-runner` 内 `parseScenarioResourceMaterialKind` / `parseScenarioZoneKind` 运行时抛错。类型层为 YAML/松字符串输入保留兼容，导致**编译期无法与实体原型枚举对齐**，属于典型的 stringly-typed 兼容写法。
- [影响]: 错误配置延迟到运行时才暴露；重构枚举时无法靠类型检查联动修正场景文件。

- [指控]: `ScenarioWorldPortConfig`（`alwaysAccept`、`rejectIfTouchesCellKeys`）描述的是无头侧对世界提交端口的**可配置桩行为**，与 `game/interaction/domain-command-types.ts` 中「Mock 世界/工作网关」语义同族；在**类型定义文件**中将其与正经领域字段并列，强化了「验收场景依赖 Mock 开关」这一临时形态在契约层的长期存在。
- [影响]: 若真实网关接入后仍保留该配置，容易形成双轨：实机路径与 headless 路径对世界提交语义不一致。

- [指控]: `ScenarioUiObservation.layers` 使用 `readonly string[]`，未与 `oh-code-design/UI系统.yaml` 中「地图叠加反馈层 / 地图反馈项」等结构化反馈类型对齐，任意字符串均可通过类型检查。
- [影响]: 观测层命名仅靠约定，易出现拼写错误且静态类型无法兜底。

## 3. 架构违规

- [指控]: 本文件从 `../player/s0-contract` 引入 `DomainCommand`，而 `s0-contract` 再 re-export `game/interaction/domain-command-types`（该文件注释写明供 **mock 网关与命令通道** 使用）。`headless` 目录下的**场景类型** thus 在模块依赖上指向 `player` 适配层，而非直接指向交互/领域契约定义处，形成 `headless → player → game` 的依赖链。
- [依据]: 与 `oh-code-design/交互系统.yaml`「交互意图层 → 把输入结果转为**领域命令**」的职责一致，领域命令类型应作为交互/游戏边界的共享契约；当前落点经 `player` 中转，目录层级上弱化「无头设施仅依赖领域层」的边界清晰度。

- [指控]: 同文件从 `../data/command-menu` 引入 `CommandMenuCommandId`，将**数据/菜单注册表**与无头场景中的 `playerSelectionAfterHydrate` 绑定；若设计期望 headless 仅依赖 `game/`，则引入 `data/` 与 `player/` 会加宽无头类型的扇出依赖面（本项为分层洁净度问题，非运行时错误）。
- [依据]: `oh-code-design/UI系统.yaml`「菜单模型」与 `oh-code-design/交互系统.yaml` 输入来源描述；场景回放应对齐菜单命令 id，但类型归属是否应在 `data/` 由项目约定，`headless` 直接依赖会加深横切耦合。

## 4. 修复建议

- [行动点 #0232]: 将 `ScenarioResourceSpawn.materialKind` 改为 `ResourceMaterialKind`（或 `string` 与字面量联合并在文档中说明仅允许 YAML 中的合法枚举），将 `ScenarioZoneSpawn.zoneKind` 改为 `ZoneKind | undefined` 并默认语义与 runner 一致；删除或内联 runner 中重复的 Set 校验逻辑，使**单一事实来源**落在类型或共享 schema。
- [行动点 #0233]: 扩展 `ScenarioZoneSpawn`（及 `scenario-runner` / `scenario-loader` 消费侧）以支持可选 `name`、`acceptedMaterialKinds` 等与 `oh-code-design/实体系统.yaml`「区域实体」对齐的字段，避免区域场景只能依赖实现硬编码。
- [行动点 #0234]: 将 `ScenarioExpectation` 拆为按 `type` 分条的判别联合，各分支使用显式 `params` 形状；或为每种 `type` 导出独立接口并在联合上收窄，以满足可测试/可重放下的静态约束。
- [行动点 #0235]: `scenario-types.ts` 中 `DomainCommand` 改为从 `../game/interaction/domain-command-types`（或未来抽出的 `contracts/`）直接 import，保留 `player/s0-contract` 仅作 player 侧聚合 re-export，从而去掉 `headless → player` 依赖边。
- [行动点 #0236]: 评估 `ScenarioWorldPortConfig`：真实世界端口稳定后，将该配置限制在测试专用类型、或迁移至 reporter/fixture 层，避免与长期 `ScenarioDefinition` 核心形状混放。
- [行动点 #0237]: 为 `ScenarioUiObservation.layers` 引入字面量联合或枚举（与 HUD/叠加层实际常量表同源），或与 UI 只读快照类型共享定义，减少自由字符串。
- [行动点 #0238]: 在 `loadScenarioIntoGame` 与 `hydrateScenario` 之间对齐 `zones` / `resources`（及相关字段）的装载语义，或拆分为 `HeadlessScenarioDefinition` 与共享子类型，避免单一 `ScenarioDefinition` 在不同入口下「部分字段静默忽略」。