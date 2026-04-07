# 审计报告: src/player/brush-stroke.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `endBrushStroke` 对外暴露的是 `ReadonlySet<string>`（`coordKey` 结果），而 `oh-gen-doc/交互系统.yaml` 在「蓝图笔刷」一节写明输出为「地图格坐标列表」。当前实现语义上等价于「去重后的格集合」，但与文档字面类型不一致，若验收或 headless 测试按「`GridCoord[]`」编写用例，易产生口径争议。
- [依据]: `oh-gen-doc/交互系统.yaml`「蓝图笔刷」→ `输出` → `类型: 地图格坐标列表`。
- [补充]: `oh-code-design/交互系统.yaml`「笔刷会话管理器」要求「管理连续拖拽路径」「输出路径覆盖格与去重结果」——本文件通过 `gridLineCells` 补全相邻采样点之间的栅格线段，并用 `Set` 去重，核心行为与上述两条一致；`pointerId` 约束与「连续输入会话」相符，未发现缺失多指隔离类需求。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：无 `mock`/`TODO`/`temp` 分支，无未接入的旧笔刷并行逻辑；状态机为纯函数，与 `src/scenes/game-scene-floor-interaction.ts` 中的调用链匹配。

## 3. 架构违规 (Architecture Violations)

- [指控]: `oh-code-design/交互系统.yaml` 将「笔刷会话管理器」列为**交互系统**下的模块，而实现落在 `src/player/brush-stroke.ts`，并由 `src/game/interaction/index.ts` 从 `../../player/brush-stroke` 再导出。职责上仍是「输入会话 → 格集合」的纯逻辑、未直接改世界状态，不构成设计中的越权写模型；但**物理目录与文档子系统命名不对齐**，增加「玩家包是否等于交互核心」的认知成本，属于边界清晰度问题而非面条式越层调用。
- [依据]: `oh-code-design/交互系统.yaml`「模块」→「笔刷会话管理器」；对比本文件仅依赖 `../game/map/world-grid` 的坐标与线段工具，符合地图作为空间基础的 `oh-code-design/地图系统.yaml` 导向，未见 UI 直改核心数据的违规。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0256]: 在 `oh-gen-doc` 或接口契约中明确：笔刷会话输出允许为「规范化的格键集合」或补充 `endBrushStrokeAsCoords` 一类封装，使文档与 `ReadonlySet<string>` 一致。
- [行动点 #0257]: 若团队以 `src/game/interaction` 为交互系统唯一落点，可将本模块迁入该目录（或抽至共享 `interaction` 子路径）并调整导出，消除 `player` 命名与「交互子系统」文档模块名的错位；改动前需统一 import 路径与 barrel 导出。
- [行动点 #0258]: `oh-code-design/地图系统.yaml`「选区解析器」强调「过滤超界格与不可用格」——笔刷层当前仅做 `isInsideGrid`。若策划要求笔刷路径与选区同一套「不可用格」过滤口径，应在设计文档中写明是否由笔刷会话承担，再决定是否在本文件或提交前的意图层补过滤。
- [行动点 #0258 · 已核对（Worker bundle #27）]: **无需改累积逻辑**。若在笔刷会话内按 `blockedCellKeys` 剔除不可用格，会破坏 MAP-003 / `scenarios/map-blocked-placement.scenario.ts` 与 `tests/headless/map-blocked-placement.test.ts` 所依赖的「笔刷格键含阻挡格 → 提交层 `conflictCellKeys` + 可见拒绝」路径。超界已由 `isInsideGrid` 与 `gridLineCells` 调用方网格约束处理；不可用过滤与 `floor-selection.ts` 模块注释（草稿不含不可用过滤、完整语义由提交前上层叠加）同构：**笔刷会话 = 几何路径 + 去重，不可用由意图/领域提交校验承担**。