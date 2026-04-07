# 审计报告: src/scenes/renderers/pawn-renderer.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `oh-gen-doc/UI系统.yaml`「状态反馈」中规定小人状态含「小人动画表现（如工作、进食、睡觉）」与「状态图标（伐木中、搬运中、建造中等）」；本文件仅用 `Arc` 圆圈占位、`Text` 显示姓名与 `debugLabel`（约 41–64、99 行），**无**动画与图标化状态表达，与策划「显示方式」列表相比明显不完整。

- [指控]: `oh-code-design/UI系统.yaml`「状态展示模型」职责含「展示小人当前行为、**需求提示**、时间信息」；当前标签未展示饱食度/精力等面向玩家的需求提示字段（`PawnState` 中已有 `satiety`/`energy`），仅间接通过 `debugLabel`（goal/action 技术串）呈现行为线索，**未**落实文档中的需求提示维度。

- [指控]: `oh-gen-doc/UI系统.yaml`「进度条」写明应用场景含伐木/建造读条，且「显示位置: **目标实体上方**」；本实现将工作条锚在**小人头顶**（`barY` 相对 `pos` 与 `radius`，约 43–52、95–97 行）。若产品语义要求条在树/蓝图等工作目标格上方，则与文案存在偏差（需策划确认是否接受「执行者头顶」等价表述）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `createPawnViews` / `syncPawnViews` 将 `pawn.debugLabel` 与姓名一并作为常驻 HUD 文本（约 57–59、99 行）。`debugLabel` 在 `pawn-state` 中由 `formatPawnDebugLabel` 生成，属 goal/action/target 的调试串，**非**面向玩家的状态展示模型输出；相当于把调试读模型长期挂在正式地图上，易与 `oh-code-design/UI系统.yaml`「以读模型驱动展示」所指的**玩家可读**反馈混淆。

- [影响]: 后续若引入正式行为标签或本地化文案，容易形成「双轨」：HUD 仍显示 debug 串，或需额外分支兼容，增加清理成本。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本文件仅创建/更新 Phaser 图形对象，读取 `PawnState`、`WorldGridConfig`、`WorkItemSnapshot` 与 `TimeOfDayPalette`，不修改领域状态；与 `oh-code-design/实体系统.yaml`「读取投影层为 UI、交互反馈、调试视图提供只读投影」的方向一致，未出现 UI 直接写领域数据的越权。

- [轻微观察]: `applyPaletteToViews` 仅同步标签颜色（约 121–128 行），圆圈描边与工作条配色为固定色值；不属于设计文档硬性违规，但与昼夜调色板的统一性可后续纳入 UI 规范。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0340]: 用行为/UI 读模型提供的**玩家可读**行为标签（含可选图标资源）替换或隐藏 `debugLabel`；调试串仅通过开发开关或单独调试层显示。
- [行动点 #0341]: 按 `oh-code-design/UI系统.yaml`「小人行为展示」流程，将「状态展示模型」输出的字段（行为 + 需求提示摘要）接到标签或邻近 HUD，避免仅依赖 `debugLabel`。
- [行动点 #0342]: 与策划确认进度条锚点：保持小人头顶或改为目标实体格中心上方；若改锚点，需在呈现层增加目标格世界坐标解析，而非在 renderer 内臆造规则。