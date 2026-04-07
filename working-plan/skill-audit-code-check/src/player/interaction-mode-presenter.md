# 审计报告: src/player/interaction-mode-presenter.ts

## 1. 漏做需求 (Missing Requirements)
- [指控]: `oh-code-design/交互系统.yaml`「目标」要求选区、笔刷、单点确认具备**统一反馈与撤销边界」；本文件仅在 `modeLine` 中用「Esc 取消」等短语提示，未体现撤销范围、批量取消、重做等与「扩展点」中「批量取消、重做、预览成本」等能力相关的玩家可见说明（若产品已规划此类能力，则提示层尚未跟上设计）。
- [依据]: 同文档「目标」第 12 行、「反馈协调层 / 反馈状态仓」第 26–28、44–46 行、「扩展点」第 95–97 行。
- [指控]: `oh-gen-doc/交互系统.yaml`「家具放置模式」写明操作在**地图（通常是房间内）点击放置**；`presentationForCommandMenuCommand` 对 `inputShape === "single-cell"` 的通用文案（约第 31–32 行）仅为「单击地格放置」，未反映「优先/通常在房间内」等策划倾向，与感性需求不一致。
- [依据]: `oh-gen-doc/交互系统.yaml`「家具放置模式」第 66–69 行。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)
- [指控]: 返回类型中的 `usesBrushStroke` 在 `src/scenes/game-scene-hud-sync.ts` 的 `syncPlayerChannelHintLines` 中未被使用（仅解构 `modeLine`），生产路径上该字段目前**无消费者**，却仍在 `src/game/interaction/index.ts` 再导出类型，形成「API 表面已预留、主界面未接线」的半孤岛状态。
- [影响]: 读者易误以为 HUD 或输入层已按笔刷与会话一致性分支处理；实际行为以别处逻辑为准，增加维护误判风险。（`tests/headless/ui-menu-mode-switch.test.ts` 仍断言该字段，说明其价值目前主要在测试而非运行时反馈链路。）
- [指控]: 第 22–26 行对 `command.id === "storage-zone"` 的特判与 `inputShape === "rect-selection"` 分支文案高度同质（均为框选 + Shift/Ctrl/Esc），属于**重复模板**，非 Mock，但增加后续新增矩形类指令时的复制粘贴风险。

## 3. 架构违规 (Architecture Violations)
- 未发现明显问题：模块仅依赖 `../data/command-menu` 的只读查询函数拼装展示文案，不写入领域状态、不做法域裁决，与文件头注释及 `oh-code-design/UI系统.yaml`「以读模型驱动展示，避免 UI 直接承担领域规则」的分层意图一致（同文档「目标」第 12 行）。

## 4. 修复建议 (Refactor Suggestions)
- [行动点 #0265]: 在 HUD 或工具输入协调处**显式消费** `usesBrushStroke`（例如与笔刷会话 UI 一致化），或收缩公开 API、避免再导出未使用字段，使代码与 `oh-code-design/交互系统.yaml`「笔刷会话管理器 / 反馈协调层」的职责边界在调用链上一致可辨。
- [行动点 #0266]: 将 `storage-zone` 与通用矩形文案的差异收束到 `command-menu` 数据（例如可选 `hintLine` / `modeLineSuffix`），去掉 `id === "storage-zone"` 特判，降低分支膨胀。
- [行动点 #0267]: 与策划确认后，为 `place-bed`（及未来 `single-cell` 家具）增加**房间约束或中性提示**（若规则未定，可与 `oh-code-design/交互系统.yaml`「待确认问题」第 103 行对齐，采用「放置位置以游戏规则为准」类表述）。