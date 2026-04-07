# 审计报告: src/scenes/villager-tool-bar-config.ts

## 1. 漏做需求

- 本文件为 `@deprecated` 薄层：将 `../data/villager-tools` 中的 `VillagerTool`（以 `MockVillagerTool` 类型别名）、`VILLAGER_TOOLS`、`VILLAGER_TOOL_KEY_CODES`、`validateVillagerToolBarConfig` 分别以 `MOCK_*` / `validateMockVillagerToolBarConfig` 别名再导出；**不含**策划语义、热键绑定或 HUD 逻辑实现。
- 对照 `oh-gen-doc` 中与村民工具栏相关的条目，可执行内容均在 `src/data/villager-tools.ts` 与 Scene/Hud 其它模块；**在本文件范围内无法认定**相对策划 YAML 的「漏做」。

## 2. 无用兼容与 Mock

- 与 `src/scenes/mock-villager-tools.ts` **同构**：二者均自 `../data/villager-tools` 转发同一组符号；本文件以独立 `export type` + `export { … }` 书写，**职责与 mock 文件重复**，属双轨兼容层。
- 全仓库 `src/` 下 **未发现** 对本路径的 TypeScript import；组件测试等已可直接使用 `src/data/villager-tools`。文件名虽为 `villager-tool-bar-config`，实际**并非**配置实现，仅为 Re-export；`MOCK_*` 命名与 `@deprecated` 注释表明历史路径残留。
- `docs/ai/index/system-index.json` 及部分 aidoc 仍登记 `src/scenes/villager-tool-bar-config.ts`，与真源 `src/data/villager-tools.ts` 并存时易误导检索与新人阅读。

## 3. 架构违规

- 工具栏只读数据与校验函数的真源已在 `data/`，本文件**未**在 Scene 层改写领域状态或处理输入，**不构成**「场景越权写领域」类硬违规。
- **分层与单一出口**：`scenes/` 下并列两个等价转发文件（本文件与 `mock-villager-tools.ts`），且沿用 `MOCK_*` 别名，削弱「配置只从 `data/villager-tools` 引用」的可读性；对照 `oh-code-design/UI系统.yaml` 等对 UI 数据归属的期望，属于**出口重复、目录语义不清**的架构卫生问题，而非本文件单独引入的功能性越界。

## 4. 修复建议

- **收敛导入路径**：与 `mock-villager-tools.ts` 二选一删除或**一并删除**，全仓仅保留自 `src/data/villager-tools` 的 import；若需过渡期，只保留**一个** `@deprecated` shim 并写明唯一迁移目标，避免双文件同义导出。
- **同步文档与索引**：将 `docs/ai/index/system-index.json` 及仍指向本路径的 integration/system 文档改为 `src/data/villager-tools.ts`（或同时注明弃用 shim），避免 aidoc 长期双轨。
- **本任务范围**：未修改 `src/scenes/villager-tool-bar-config.ts`；上述为后续重构建议。
