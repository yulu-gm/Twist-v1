# 审计报告: src/scenes/mock-task-marker-selection.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题。本文件仅为类型与函数的再导出，任务标记的合并/切换/清理规则在 `src/data/task-markers.ts` 中实现；与 `oh-code-design/UI系统.yaml` 中「地图叠加反馈层」展示标记类反馈的职责相比，本 shim 本身不承担业务缺失，但若长期保留会掩盖「真实入口在 data 层」这一事实。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 1–3 行使用 `@deprecated` 与 `Mock*` 别名，将 `TaskMarkerSelectionInput`、`applyTaskMarkersForSelection` 从 `../data/task-markers` 转发出去，属于技能所述「临时/Mock 命名空间兼容层」。
- [影响]: `src/` 内已无 `mock-task-marker-selection` 的 import（组件测已直接引用 `src/data/task-markers.ts`），该文件对主程序路径可能已成为死导出，却仍占用 `scenes` 路径与文档索引，增加「仍应从场景层取 Mock API」的误导。

## 3. 架构违规 (Architecture Violations)

- [指控]: 在 `src/scenes/` 下暴露本属于数据/领域侧辅助 API（纯函数与输入类型），与 `oh-code-design/UI系统.yaml` 分层中「界面结构/状态/呈现/动作转发」及目标「以读模型驱动展示，避免 UI 直接承担领域规则」的边界不一致——任务标记计算应归集到稳定的数据或交互子模块入口，而非挂在场景模块名下并以 mock 前缀命名。
- [依据]: `oh-code-design/UI系统.yaml`「分层」各层职责与「目标」第 12 行；同类交互数据流亦见 `oh-code-design/交互系统.yaml`「交互意图层 / 反馈协调层」职责划分（本文件既不采集输入也不协调反馈，仅为跨路径转发）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0330]: 全仓确认无引用后删除 `src/scenes/mock-task-marker-selection.ts`，统一从 `src/data/task-markers` 导入；同步更新 `docs/ai/index/system-index.json` 等仍列出该路径的索引文档（若团队要求索引与代码一致）。
- [行动点 #0331]: 若短期内需保留兼容，在 package/ barrel 层用单一 re-export 并设明确弃用周期，避免继续放在 `scenes` 目录下强化错误分层印象。