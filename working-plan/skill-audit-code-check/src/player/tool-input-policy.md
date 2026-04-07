# 审计报告: src/player/tool-input-policy.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 函数返回类型仅为 `"rect-selection" | "brush-stroke"`，未纳入设计文档与实现中已广泛使用的第三种输入形态 **`single-cell`**（家具点击放置）。`oh-gen-doc/交互系统.yaml` 在 **家具放置模式** 中明确为「在地图……点击放置」，与 **蓝图绘制模式** 的「蓝图笔刷……拖拽勾勒」是不同输入语义；`oh-code-design/交互系统.yaml` 亦要求交互模式层区分多种模式的输入解释规则，且 **核心数据 · 交互模式** 含「是否允许单点确认」等与单格放置相关的维度。
- [依据]: `oh-gen-doc/交互系统.yaml` 中「蓝图绘制模式」与「家具放置模式」并列定义；`oh-code-design/交互系统.yaml` 中 **交互模式层**、**笔刷会话管理器** 与 **选区会话管理器** 分工；对照 `src/data/command-menu.ts` 中 `place-bed` 的 `inputShape: "single-cell"` 与 `build-wall` 的 `inputShape: "brush-stroke"`。
- [指控]: 策略仅以 `toolId === "build"` 区分笔刷与框选，而菜单数据中 **`build-wall` 与 `place-bed` 的 `markerToolId` 均为 `"build"`**。若调用方误用本函数、仅凭 `markerToolId` 推断输入形态，会把木墙笔刷与木床单格放置**混为同一形态**，与策划/菜单单一事实来源不一致。
- [依据]: `src/data/command-menu.ts` 中 `STRUCTURE_COMMANDS` / `FURNITURE_COMMANDS` 对 `markerToolId` 与 `inputShape` 的配置；本文件 `interactionInputShapeForToolId` 无法按命令维度区分二者。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 仓库内除 `src/game/interaction/index.ts` 再导出外，**未发现对 `interactionInputShapeForToolId` 的实际调用**。在已有 `command-menu` 命令定义与 `mode-registry` 模式上 `inputShape` 的前提下，本函数构成**平行、更粗且易误导的第三套规则**，存在「写了策略但业务线未接入」的孤岛倾向。
- [影响]: 维护者可能误以为此处已与 YAML/菜单对齐；未来若接入而未同步 `single-cell` 与 `CommandMenuCommandId` 粒度，易引入错误交互分支。

## 3. 架构违规 (Architecture Violations)

- [指控]: 注释声称与「交互系统 YAML」对齐，但实现维度是**模糊的 `toolId` 字符串**，而非设计中的 **模式注册 / 菜单命令 id**；与 `oh-code-design/交互系统.yaml` **模式注册表**「定义每个交互模式的进入条件、退出条件、输入规则」相比，本层缺少与 `CommandMenuCommandId` 或 `modeId` 的稳定映射，职责边界模糊。
- [依据]: `oh-code-design/交互系统.yaml` **模块 · 模式注册表** 与 **扩展点**（新工具通过新增模式注册接入）；对比 `src/game/interaction/mode-registry.ts` 已按 `modeId` 绑定 `inputShape`。
- 说明: 文件本身为无副作用的纯函数，**未发现直接越权写世界状态或绕过交互意图层**的违规；问题主要在语义与分层一致性，而非典型的「面条式跨层写状态」。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0285]: 若需保留「工具/标记 id → 输入形态」入口，应改为以 **`CommandMenuCommandId` 或 `modeId` 查表**（数据源与 `command-menu` / `mode-registry` 合一），并令返回类型与领域一致：包含 **`"single-cell"`**，且对 `markerToolId === "build"` 的多种命令**不得**用单分支概括。
- [行动点 #0286]: 若确认无任何调用路径，可删除本函数及 `game/interaction` 上的再导出，避免与菜单/模式注册 **双处定义** 漂移；或将其明确标注为仅供某条遗留路径使用并在接入侧强制传入完整 `inputShape`。
- [行动点 #0287]: 新增或调整自动化测试/验收场景时，覆盖「同一 `markerToolId`、不同 `inputShape`」的提交路径（参见 `oh-gen-doc/交互系统.yaml` 中墙与床的流程差异），防止回归为「一律 brush 或一律 rect」。
- **核对（落地）**: `src/player/tool-input-policy.ts` 已改为按 `CommandMenuCommandId` / `modeKey` 查 `command-menu`，不再提供粗粒度 `interactionInputShapeForToolId`。测试覆盖：`tests/domain/tool-input-policy.test.ts`（同 `markerToolId`「build」下 `build-wall`↔`place-bed` 与 `build-wall`↔`build-bed` 形态）；`tests/domain/mode-registry.test.ts` 中 `build-bed commit` 断言 `sourceMode.inputShape === "single-cell"`，与 `build-wall` 的 brush 提交并列。