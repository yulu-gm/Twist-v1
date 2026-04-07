# 审计报告: src/scenes/renderers/grid-renderer.ts

（T-117）

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题。`drawGridLines` 使用 `TimeOfDayPalette` 绘制网格线与外框，与 `oh-code-design/地图系统.yaml` 中「空间投影层」为 UI 输出高亮与边界展示的职责一致；石头格与交互点绘制对应占用/交互配置的可视化，未在 `oh-gen-doc/地图系统.yaml`、`oh-gen-doc/交互系统.yaml` 中找到要求必须由本文件单独承担的、尚未实现的条目（例如选区半透明、物资/树木标记图标等由其他 renderer 或反馈层承担更符合分层）。
- 若后续策划将「地图格临时高亮」「不可用格样式」统一收口到网格层，需在文档中显式约定后再对照实现；当前不属于已文档化的缺口。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `drawStoneCells`（约 42–56 行）在 `src/` 内无任何引用；实际路径为 `GameScene` 与 `game-scene-presentation` 使用的 `drawStoneCellsToGraphics`。该 API 为早期「每帧 `scene.add.rectangle`」方案遗留，属于死代码与双轨风险（维护者误以为仍在用）。
- [影响]: 不运行则无泄漏；保留会误导后续改动、增加重复实现认知成本。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。文件头声明「不含任何游戏逻辑」，实现上仅依赖 `WorldGridConfig`、`ReservationSnapshot` 等只读输入与 Phaser 绘制 API，未直接修改领域状态或越层调用行为/占用管理器，与 `oh-code-design/地图系统.yaml`「空间投影层」及 `oh-code-design/交互系统.yaml` 中反馈与呈现分离的方向一致。`drawInteractionPoints` 对 `labelMap` 的增删属于视图对象生命周期管理，仍属渲染侧。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0334]: 删除未使用的 `drawStoneCells`，或明确标注废弃并配套静态检查/文档说明，避免与 `drawStoneCellsToGraphics` 长期并存。
- [行动点 #0335]: 将交互点标签 `point.kind.toUpperCase()` 与硬编码字体（如 `Segoe UI`）、形状尺寸若需与 `oh-gen-doc/UI系统.yaml` 文案/无障碍规范对齐，可外置为文案表或样式常量，与昼夜调色板策略统一。
- [行动点 #0336]: 石头格与三类交互点的填充/描边色号为魔法数；若 UI 主题扩展，宜迁入与 `TimeOfDayPalette` 同级的主题配置，减少散落十六进制字面量。