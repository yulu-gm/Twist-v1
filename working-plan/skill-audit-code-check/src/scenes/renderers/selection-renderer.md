# 审计报告: src/scenes/renderers/selection-renderer.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 策划对「框选过程」与「选区视觉」有明确要求；本文件已覆盖核心路径，与文档一致。
- [依据]: `oh-gen-doc/交互系统.yaml` 中「框选过程: 鼠标拖拽显示选区范围」「选区显示: 框选时显示半透明的选区范围」——`redrawFloorSelection` 对已定选集调用 `drawSelectionOverlay`（半透明填充+描边，见 `selection-renderer.ts` L128–156），草稿阶段用 `drawSelectionBoundsWireframe` 画矩形包络、`drawDraftTargetHighlights` 画有效目标预览环，与「显示选区范围」一致。
- [指控]: 若产品期望在拖拽中**对称**反馈「不可选/被过滤」的格，当前实现未体现；仅通过 `draftEligibleCellKeys` 对**有效**格画环，矩形包络仍覆盖完整拖拽范围，文档未单独规定否定性高亮，属**待产品确认**的潜在缺口，而非文档已写死的漏项。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：无 `mock`/`temp`/`TODO` 占位，任务标记通过 `syncTaskMarkerView` 与 `taskMarkersByCell` 同步，无未接入的旧分支。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本文件仅使用 Phaser `Graphics`/`Text` 做绘制，输入为 `FloorSelectionState`、`WorldGridConfig` 与可选 `draftEligibleCellKeys`，不写入领域状态；与 `oh-code-design/交互系统.yaml` 中「反馈协调层」维护反馈状态、「向 UI 系统提供…预览」的分工一致，呈现侧不越权修改交互意图或命令。
- [备注]: `syncTaskMarkerView` 内 `text.setDepth(41)` 为场景内写死深度，与 `oh-code-design/UI系统.yaml` 风险项「地图叠加反馈缺少统一层级」相关，属**可维护性/一致性**关注点，而非本文件单独违反分层边界。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0343]: `drawSelectionOverlay`（L143–155）对整张图 `rows×columns` 二重循环，选中格较多时仍为 O(地图格数)；可改为仅遍历 `cellKeys` 绘制，降低大地图成本。
- [行动点 #0344]: ~~任务标记文字深度固定为 `41`~~ **已落地**：`src/scenes/map-overlay-depths.ts` 中 `MAP_OVERLAY_DEPTH` 集中定义框选/草稿/任务标记圆环与标签 depth，`GameScene` 与 `syncTaskMarkerView` 共用，避免分散魔法数。
- [行动点 #0345]（可选）: 若策划确认需要「拖拽矩形内被规则排除的格」的视觉区分，再在 `FloorSelectionRedrawOptions` 或调用侧传入排除集，由本渲染器增加否定性样式（需与 `oh-gen-doc` 增补条款对齐后再实现）。**当前状态**：无策划确认与文档增补，**不实现代码**（与审计「可选」一致）。

## 5. 行动点落地记录（Worker bundle #21）

- **AP-0344**：已实现集中 depth 配置（见上）。
- **AP-0345**：无需代码变更；待 `oh-gen-doc` 与策划确认后再开发否定性高亮。