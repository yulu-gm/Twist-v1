# 审计报告: src/player/build-domain-command.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `buildDomainCommand` 无条件调用 `commandMenuDomainSemantics(input.commandId)`（见 `src/data/command-menu.ts` 中 `getCommandMenuCommand(commandId) ?? getCommandMenuCommand(defaultCommandMenuCommandId())`）。当传入的 `commandId` 在配置中不存在时，会**静默回落到默认菜单项**并生成对应领域命令，玩家意图与真实打包结果可能不一致，且本文件未再做显式校验或返回 `null`。
- [依据]: `oh-code-design/UI系统.yaml` 中「菜单模型」职责包含「定义菜单项与对应交互模式的映射关系」；`oh-code-design/交互系统.yaml` 中「交互意图层」职责包含「把输入结果转为领域命令」——映射应确定、可预期，异常输入宜可观测而非静默替换。

- [指控]: 设计文档要求交互意图层在提交前做「基础校验与过滤」（`oh-code-design/交互系统.yaml`「交互意图层」）。本模块注释声明「纯函数，不含规则裁决」，对格合法性、模式与 `inputShape` 一致性等**不做校验**；若上游未承担，则与设计分层期望存在缺口（本文件自身符合「仅打包」定位，但整条意图链是否补足需在调用方核对）。
- [依据]: 同上，`oh-code-design/交互系统.yaml` 分层中「交互意图层」职责。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `taskMarkerToolIdForDomainCommand`（112–131 行）在 `getCommandMenuCommand` 未命中时，对 `menuId === "interaction-mode"` 按 `itemId` 硬编码映射（117–121 行）。**并非死代码**：`src/game/interaction/mode-registry.ts` 仍通过 `interactionModeSource` 写入 `menuId: "interaction-mode"`，与命令菜单 `CommandMenuCommandId`（如 `storage-zone` vs 模式侧 `zone-create`）形成**双轨命名**；此处属于桥接层，但新增/重命名模式时需与 `command-menu`、本硬编码表**人工同步**，否则易出现标记工具 id 与 `task-markers` / `VILLAGER_TOOLS` 不一致。
- [影响]: 维护成本高；若未来某路径产生的 `DomainCommand` 使用 `assign_tool_task:chop` 等动词后缀与工具栏 id（`lumber`）不一致，且未命中 `interaction-mode` 分支，则后续 `verb.slice("assign_tool_task:".length)` 可能得到非 `VILLAGER_TOOLS` 中的 id（见 125–126 行），与 `oh-gen-doc/UI系统.yaml` 中「蓝图笔刷 / 工具与反馈一致」的体验目标相悖。

- [指控]: 模块级 `commandSeq` 与 `resetDomainCommandIdSequence`（14–18、134–137 行）为全局可变序号；注释已说明供测试隔离，**合理**；若运行环境出现多世界并行实例，存在 id 交叉风险（当前单实例假设下影响低）。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：注释明确「UI/交互层不判断可行性，裁决由世界网关完成」，与 `oh-code-design/UI系统.yaml`「以读模型驱动展示，避免 UI 直接承担领域规则」及 `oh-code-design/交互系统.yaml` 中输入经「交互命令生成器」再向外提交的分工一致；本文件仅拼装 `DomainCommand`，不直接改世界状态。类型经 `s0-contract` 对齐 `domain-command-types`，未在本文件内越层写核心数据。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0259]: 在 `buildDomainCommand` 调用链上消除「非法 `commandId` → 默认命令」：例如在 `command-menu` 层对未知 id 返回显式失败，或由本函数在 `getCommandMenuCommand` 未定义时直接返回 `null`，以满足菜单映射可预期性（对应 `oh-code-design/UI系统.yaml` / `交互系统.yaml`）。
- [行动点 #0260]: 收敛 `taskMarkerToolIdForDomainCommand` 的双轨逻辑：优先用 `cmd.verb` 与 `command-menu` / `task-markers` 的**单一映射表**推导 `markerToolId`（必要时将 `chop`→`lumber` 等别名收入数据配置），减少 `interaction-mode` 下 `itemId` 硬编码分支。
- [行动点 #0261]: 若需支持多实例或确定性回放，将 `nextCommandId` 改为调用方注入的单调 id 工厂（接口传入或参数），替代模块全局 `commandSeq`。