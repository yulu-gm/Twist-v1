# 审计报告: src/game/map/world-grid.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `gridLineCells` 仅做 Bresenham 线段枚举，不校验格是否在地图边界内；若调用方传入网格外端点或笔刷路径越界，会产出非法坐标。设计侧要求选区结果需过滤超界格。
- [依据]: `oh-code-design/地图系统.yaml` 中「选区解析器」职责：把玩家拖拽框选转换为格坐标集合，**过滤超界格与不可用格**；本函数作为底层几何工具未内置裁剪，依赖调用链一致处理，否则构成需求链路上的薄弱点。

- [指控]: `oh-code-design/地图系统.yaml` 中「地图网格」职责包含**维护所有地图格的基础属性**；本文件以 `WorldGridConfig`（尺寸、阻挡键集、样板交互点等）为主，未表达单格上的「占用对象集合」「临时高亮」等数据。若将「地图网格」理解为仅此模块，则与蓝图中的格级状态模型不对齐（实际可能由占用管理器、投影层等分担，需在模块边界上显式化，否则易被误判为漏做）。
- [依据]: 同文件「地图网格」职责与「核心数据 · 地图格 · 关键字段」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `DEFAULT_WORLD_GRID` 内嵌固定 `interactionPoints`（食物/床/娱乐）及 `needDelta`，属于目标驱动原型数据；与 `oh-gen-doc/地图系统.yaml` 中「地图初始化」强调的物资散落、树木等叙事级初始内容不在同一抽象层，易形成「关卡数据写在几何模块」的双真相。
- [影响]: 正式流程若改由实体床铺、世界食物驱动，行为系统可能仍读网格样板，与实体世界状态漂移。

- [指控]: `cellAtWorldPixel`（网格外返回 `null`）与 `worldPointToCell`（网格外返回 `undefined`，且原点参数默认 `0`）语义重叠，返回值类型不一致，增加调用方分支与误用风险。
- [影响]: 同类世界坐标→格查询存在双 API，偏历史堆叠而非单一事实接口。

- [指控]: 第 224–226 行连续两段 JSDoc 位于 `pruneReservationSnapshot` 之上，其中「解析 `coordKey`」一段应对应下方的 `parseCoordKey`，当前位置导致文档挂错符号、可读性差。
- [影响]: 生成文档与 IDE 提示可能将错误说明关联到 `pruneReservationSnapshot`。

## 3. 架构违规 (Architecture Violations)

- [指控]: `isCellOccupiedByOthers` 在 `world-grid` 中根据 `logicalCellsByPawnId` 判断格是否被他人占用；设计将**实体占用、冲突判断**划归「占用管理器」，地图网格侧重格属性与邻接。
- [依据]: `oh-code-design/地图系统.yaml` 分层中「空间规则层 / 占用管理器」职责：记录实体占用并提供冲突判断；「地图网格」：坐标合法性、邻接查询。

- [指控]: `InteractionPoint.needDelta` 使用 `NeedKind`（自 `../pawn-state` 导入），使纯空间/配置向的 `world-grid` 依赖小人状态类型域，削弱「共享空间基础」与玩法状态之间的边界。
- [依据]: `oh-code-design/地图系统.yaml` 目标：作为交互、行为、放置的**共享空间基础**；类型上绑定具体需求枚举易与实体/需求子系统的权威模型交叉。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0124]: 在选区/笔刷调用链上统一对 `gridLineCells` 结果做 `isInsideGrid` 过滤，或在本函数内增加可选 `config` 裁剪模式并文档化契约。
- [行动点 #0125]: 将 `isCellOccupiedByOthers` 迁至 `occupancy-manager`（或规则层），`world-grid` 仅保留与格键、几何相关的纯函数。
- [行动点 #0126]: 合并或废弃 `cellAtWorldPixel` / `worldPointToCell` 之一，统一返回值约定（`null` 或 `undefined`）与原点参数风格。
- [行动点 #0127]: 将默认 `interactionPoints` 迁出至世界种子或关卡数据；`needDelta` 改为中性 id 或外置表，去掉对 `pawn-state` 的导入。
- [行动点 #0128]: 把「解析 `coordKey`」JSDoc 移到 `parseCoordKey` 声明紧上方，为 `pruneReservationSnapshot` 保留单独说明。