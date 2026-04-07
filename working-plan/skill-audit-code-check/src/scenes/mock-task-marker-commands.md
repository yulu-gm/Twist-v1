# 审计报告: src/scenes/mock-task-marker-commands.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题（任务标记文案逻辑在 `src/data/task-markers.ts`）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [事实]: 全文件仅 `@deprecated` 注释 + 单行 re-export；`src/` 内未发现对本模块的 import，`tests/component/mock-task-marker-commands.test.ts` 已从 `src/data/task-markers` 直连 `issuedTaskLabelForToolId`。
- [指控]: 该转发层在运行时代码侧已实质闲置；仍保留 `mockIssuedTaskLabelForVillagerToolId` 命名，与领域化数据源路径不一致，易误导后续维护者。

## 3. 架构违规 (Architecture Violations)

- [指控]: 任务标记属于交互/工作意图的展示辅助，应仅从 `data/task-markers` 或领域端口读取；经 `scenes` 路径导出易造成「场景层即数据源」错觉，与 `oh-code-design/交互系统.yaml` 模块划分不符。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0329]: 删除 `src/scenes/mock-task-marker-commands.ts`（或先全局确认无外部包/脚本路径引用后删除）；文档与索引中若仍点名该路径，改为 `src/data/task-markers.ts`。