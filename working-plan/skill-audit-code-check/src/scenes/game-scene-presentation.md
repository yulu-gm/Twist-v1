# 审计报告: src/scenes/game-scene-presentation.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `syncHoverFromPointerState`（57–79 行）通过 `formatGridCellHoverText` 驱动「当前悬停信息」，与 `oh-gen-doc/地图系统.yaml` 中地图格属性「包含实体」（实体引用列表）对照，当前文案链未体现格内实体枚举或摘要；展示入口在本文件，具体缺口在 `src/data/grid-cell-info.ts` 的实现，但若策划以该 YAML 为验收口径，悬停信息仍属未对齐需求。

- [依据]: `oh-code-design/UI系统.yaml` 界面状态层关键字段含「当前悬停信息」；`oh-gen-doc/地图系统.yaml` 地图格「包含实体」字段描述当前格上所有实体。

- 补充说明: `applyTimeOfDayPaletteToScene` 将昼夜调色作用于网格、小人视图、交互标签与 HUD 悬停配色，与 `oh-code-design/时间系统.yaml`「时间投影层…输出面向 UI」及 UI 依赖时段反馈的方向一致；昼夜「日期/时段数字文案」若由其它 HUD 模块负责，则不属于本文件职责缺口。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：本文件无 `mock`/`TODO`/临时分支；`mergeMarkerOverlayIfChanged` 仅在合并结果相对输入变化时返回新 `Map`，属于合理防抖而非兼容层堆砌。

## 3. 架构违规 (Architecture Violations)

- [指控]: `mergeMarkerOverlayIfChanged`（81–87 行）形参类型为 `GameOrchestrator`，场景呈现模块在类型上绑定整颗编排器，而实际仅需其上的只读合并能力（工程内已存在经 `WorldPort.mergeTaskMarkerOverlayWithWorld` 的投影路径）。

- [依据]: `oh-code-design/UI系统.yaml` 写明「以读模型驱动展示，避免 UI 直接承担领域规则」「订阅领域系统只读数据并转成界面态」；`oh-code-design/实体系统.yaml`「读取投影层」职责为「为 UI…提供只读投影」。呈现层应对最小只读端口抽象，而非编排器具体类，以降低越层观感与编译期耦合。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0320]: 将 `mergeMarkerOverlayIfChanged` 的第一参改为满足 `mergeTaskMarkerOverlayWithWorld` 契约的只读接口（例如与 `src/player/world-port-types.ts` 对齐的 `WorldPort` 或更窄的 `{ mergeTaskMarkerOverlayWithWorld: … }`），调用方传入 `orchestrator.getPlayerWorldPort()` 或等价端口，使 `game-scene-presentation` 不再 `import type { GameOrchestrator }`。
- [行动点 #0321]: 若要以策划文档验收「格内实体」悬停信息，在保持本文件只做同步调用的前提下，扩展 `formatGridCellHoverText`（或为其注入只读格查询端口），使文案与 `oh-gen-doc/地图系统.yaml`「包含实体」一致；本文件仅需改用新签名或传入投影数据（若有 API 变更）。