# 审计报告: src/scenes/mock-villager-tools.ts

## 1. 漏做需求

- 本文件仅为 `@deprecated` 的 Re-export，将 `../data/villager-tools` 中的 `VILLAGER_TOOLS`、`VILLAGER_TOOL_KEY_CODES`、`validateVillagerToolBarConfig` 与 `VillagerTool` 分别以 `MOCK_*` / `MockVillagerTool` 别名导出；**不**包含任何策划语义或 UI 行为实现。
- 对照 `oh-gen-doc` 中与工具栏相关的条目，可核验内容均在 `src/data/villager-tools.ts` 与本文件**无关**；**无法**在本文件范围内认定「相对策划 YAML 的漏做」。

## 2. 无用兼容与 Mock

- 与 `src/scenes/villager-tool-bar-config.ts` **同构**：二者均自 `../data/villager-tools` 转发同一组符号，仅 `mock-villager-tools.ts` 将 `type` 与值写在同一 `export { … }` 语句中，属**重复兼容层**。
- 全仓库 `src/` 下**未发现**对本文件的 TypeScript import；`tests/component/villager-tool-bar-model.test.ts` 已直接从 `src/data/villager-tools` 导入并以 `MOCK_*` 别名断言，本文件对运行时与当前测试**无必需依赖**。
- 名称含 `mock` 与注释「兼容转发」表明历史路径残留；在数据源已迁至 `data/` 的前提下，本层**可归类为可删除的薄 shim**（删除前需统一文档索引与外部引用，见第 4 节）。

## 3. 架构违规

- 对照 `oh-code-design/UI系统.yaml` 等：工具栏只读配置归属 `data/` 与当前事实一致；本文件**未**在 Scene 层改写领域状态或承担输入逻辑，**不构成**典型的「UI/场景越权写领域」违规。
- **分层可读性**：Scene 目录下并列两个等价转发文件，且沿用 `MOCK_*` 命名，易让读者误以为「模拟数据仍挂在场景层」或与 `villager-tool-bar-config` 存在职责分工；从「单一真相来源」与目录语义一致性看，属于**架构卫生与命名误导风险**，而非硬性禁令下的功能违规。

## 4. 修复建议

- **收敛出口**：与 `villager-tool-bar-config.ts` 二选一删除或**一并删除**，全仓仅保留自 `src/data/villager-tools` 的导入路径；若需过渡期，可只保留**一个** `@deprecated` shim 并注明唯一迁移目标。
- **同步索引与文档**：`docs/ai/index/system-index.json` 等仍登记本路径时，在删文件或改导出策略后更新为 `src/data/villager-tools.ts`，避免 aidoc/集成文档继续指向双轨旧路径。
- **本任务范围**：未修改 `src/`；上述动作为后续重构任务建议。
