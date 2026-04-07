# 审计报告: src/game/interaction/floor-selection.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 设计中的「选区解析器」要求同时过滤超界格与不可用格（`oh-code-design/地图系统.yaml` 模块「选区解析器」职责）。本文件仅负责基于 `modifier` 合并/切换矩形内的格键集合，**未实现「不可用格」语义**（如可通行、占用等），若最终提交领域命令时未在其他层过滤，则与「解析器产出已校验格集合」的流程存在缺口（对照同文件关键流程「创建存储区」中「选区解析器校验格集合合法性」）。
- [依据]: `oh-code-design/地图系统.yaml` 中「选区解析器」职责（过滤超界格与不可用格）及关键流程「创建存储区」步骤。
- [补充说明]: **超界格**已由本文件所调用的 `rectCellKeysInclusive` 间接处理：`src/game/map/world-grid.ts` 中 `rectCellsInclusive` 对每格调用 `isInsideGrid`，故矩形几何结果不含地图外坐标；该职责落在地图网格工具而非本文件正文，审计本文件时不宜笼统写「未做超界过滤」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。无 mock、无 TODO、无仅为兼容旧系统的分支；`clearFloorSelection` 的 `_state` 仅为未使用形参，属 API 形态问题而非临时兼容层。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。本模块为纯函数式选区状态与草稿计算，依赖 `world-grid` 的矩形格键解析，不直接修改地图或实体数据，与 `oh-code-design/交互系统.yaml` 中「选区会话管理器」输出框选命中格集合的方向一致；与 `oh-code-design/地图系统.yaml` 中「空间模型层 / 空间规则层」的分工相比，本文件定位为交互侧状态组合，未出现 UI 越权写核心领域数据之类违规。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0104]: 在模块注释或类型契约中写明：本文件产出为「网格内矩形格键 + 修饰键合并结果」；**不可用格过滤**应由地图侧选区解析器或 `oh-code-design/交互系统.yaml`「交互意图层」在提交前完成，避免调用方误以为 `commitFloorSelection` 结果已等价策划文档中的完整解析器输出。
- [行动点 #0105]: 若产品要求选区阶段即隐藏不可选格，可扩展为接受可选 `filterCellKey(key: string): boolean`（或注入轻量查询接口），在 `buildSelectionDraft` 遍历 `cellKeys` 时统一裁剪，使职责边界与文档中的「选区解析器」对齐。