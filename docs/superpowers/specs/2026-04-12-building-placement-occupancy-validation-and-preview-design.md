# 建筑放置占地冲突校验与预览反馈设计

**日期：** 2026-04-12  
**主题：** 为建筑蓝图放置补齐占地冲突校验，并让放置预览在悬停阶段复用同一套规则给出即时反馈。

---

## 1. 背景

当前项目中的 `place_blueprint` 已经可以把建筑蓝图放到地图上，但前置校验还不完整。

现状是：

- `place_blueprint.validate()` 只检查地图存在、建筑定义存在、footprint 是否越界。
- 它不会检查目标 footprint 上是否已经存在蓝图、工地或已建建筑。
- 蓝图转工地、工地转成品建筑时，后续阶段会检查 `physical occupant`，但这套检查并不等价于“建造占地冲突”。
- 因此当前允许把新蓝图放到已有蓝图 / 工地 / 建筑的占地区域上，只要不越界。

这带来两个问题：

1. **后端正确性缺口**  
   command 层没有阻止非法重叠放置，任何绕过 UI 的入口都可能写入脏状态。

2. **前端体验缺口**  
   玩家在预览阶段无法立即知道某个位置因为已有蓝图、工地或建筑而不可放置，只能在命令执行结果或后续行为中间接发现问题。

本次设计的目标不是重做整个建造系统，而是收敛一个更小、更明确的子问题：

- 用一套共享规则定义“某个 footprint 是否允许放蓝图”
- command validate 和 UI 预览都复用这套规则
- 让放置冲突在悬停阶段就能被看见，在命令阶段也绝不能被绕过

---

## 2. 设计目标

### 2.1 主要目标

1. 在 `place_blueprint` 的 validate 阶段阻止重叠放置。
2. 让 UI 建造预览在悬停阶段就能反映“该位置不可放置”。
3. command 校验与 UI 预览必须复用同一套占地判定逻辑，避免规则漂移。
4. 冲突对象范围明确限定为：
   - `Blueprint`
   - `ConstructionSite`
   - `Building`
5. 明确不把以下对象视为本次的放置冲突：
   - `Pawn`
   - `Item`
6. 正确处理多格建筑 footprint，只要任一格命中冲突对象，就整体判定为不可放置。

### 2.2 非目标

- 本阶段不重做整个建造预览系统。
- 本阶段不做 tooltip、对象名列表、冲突原因解释面板等复杂提示。
- 本阶段不做“自动寻找最近可放位置”。
- 本阶段不把 Pawn 临时站位视为禁止放置条件。
- 本阶段不改动蓝图转工地、工地转建筑时的 `physical occupant` 规则。

---

## 3. 规则定义

### 3.1 什么叫“放置占地冲突”

当玩家尝试在某个 `cell + footprint` 上放置建筑蓝图时，如果该 footprint 覆盖到的任意格子上存在下列任一种对象，则视为占地冲突：

- `Blueprint`
- `ConstructionSite`
- `Building`

只要 footprint 中任意一格命中上述对象之一，就整体判定为 **不可放置**。

### 3.2 什么不算冲突

下列对象即使位于 footprint 内，也 **不构成本次的放置冲突**：

- `Pawn`
- `Item`

原因是：

- Pawn 属于动态临时占位，不应阻止玩家规划建造。
- Item 已由现有搬运、施工等主链处理，不适合在这次子项目里升级为放置阻塞条件。

### 3.3 多格 footprint 规则

对于任意宽高大于 `1x1` 的建筑：

- 必须逐格检查 footprint 覆盖的所有格子。
- 只要有一个格子与冲突对象重叠，就整体返回 blocked。
- 不允许出现“部分可放、部分不可放但仍放置”的状态。

---

## 4. 模块边界与职责

### 4.1 分层原则

本次设计应遵守以下分层：

- `world/occupancy`
  - 提供底层 footprint 命中对象查询。
  - 不直接决定“哪些对象算建造冲突”。

- `features/construction`
  - 解释 footprint 命中结果。
  - 定义“哪些对象属于建造占地冲突”。
  - 输出 command 和 UI 都能复用的 placement 判定结果。

- `adapter/input` / UI 预览层
  - 只消费 construction 提供的 placement 判定结果。
  - 不自行复制一份建造冲突规则。

### 4.2 为什么不把规则直接塞进 `world/occupancy`

`world/occupancy` 目前更适合作为通用基础查询层：

- 它回答的是“这个 footprint 里有哪些对象”
- 它不应该直接内嵌具体业务规则

“Blueprint / ConstructionSite / Building 算不算放置冲突”属于 construction 业务规则，因此应放在 construction feature 内解释，而不是下沉到 world 基础层。

---

## 5. 共享放置判定设计

### 5.1 新增共享查询

建议在 `features/construction` 内新增一个共享 placement query / helper，用于判断某个目标位置是否允许放置蓝图。

输入至少包括：

- `map`
- `cell`
- `footprint`

输出至少包括：

- `blocked: boolean`
- `blockingObjects: MapObjectBase[]`
- `reason: 'occupied_by_construction_or_building' | null`

### 5.2 查询规则

共享查询的逻辑应为：

1. 根据 `cell + footprint` 取出 footprint 范围内命中的对象。
2. 过滤掉已销毁对象。
3. 只保留以下 kind：
   - `Blueprint`
   - `ConstructionSite`
   - `Building`
4. 若过滤后结果非空，则：
   - `blocked = true`
   - `blockingObjects = 这些冲突对象`
   - `reason = 'occupied_by_construction_or_building'`
5. 若过滤后结果为空，则：
   - `blocked = false`
   - `blockingObjects = []`
   - `reason = null`

### 5.3 为什么返回对象列表而不是只返回布尔值

虽然 command validate 当前只需要 `blocked`，但 UI 预览和未来扩展会受益于更完整的返回值：

- UI 可以直接使用 `blocked` 切换预览样式
- 若未来需要 tooltip、冲突对象高亮、debug 面板，已可直接复用 `blockingObjects`
- 避免后续因为“只返回 boolean 信息不够”而再次拆改接口

因此本设计建议一次把查询结果设计成可复用结构，而不是只做最短命的 `boolean` helper。

---

## 6. Command 校验接入

### 6.1 `place_blueprint.validate()` 的职责

`place_blueprint.validate()` 应继续保留现有检查：

- 地图存在
- building def 存在
- footprint 不越界

然后在此基础上新增共享 placement 查询：

- 如果 placement query 返回 `blocked = true`
- 则 command validate 返回 `valid: false`
- reason 应明确表达为 footprint 已被已有蓝图 / 工地 / 建筑占用

### 6.2 设计原则

即使 UI 预览已经能显示 blocked，command validate 仍必须保留完整校验。

原因是：

- scenario harness
- 测试代码
- 未来的 debug / tool / automation 调用

都可能绕过 UI 直接发命令。  
command 层必须是最终正确性的守门人。

---

## 7. UI 预览反馈接入

### 7.1 预览阶段的目标

当玩家在建造模式下移动鼠标或拖拽预览位置时，UI 应立即反映当前位置是否允许放置：

- 可放置：显示正常 build preview
- 不可放置：显示 blocked preview

### 7.2 预览层的规则来源

UI 预览不得自己维护一套独立规则。

它必须复用与 `place_blueprint.validate()` 同源的 placement query 结果。  
这意味着：

- command 和 UI 的 blocked / placeable 判定来自同一逻辑
- 不会出现“UI 看起来能放，但命令失败”或“UI 看起来不能放，但命令能过”的规则漂移

### 7.3 本阶段的最小反馈形式

本阶段只要求实现最小但完整的预览反馈：

- preview 进入 blocked 状态
- footprint 区域显示不可放置的视觉样式

本阶段不要求实现：

- 列出具体是哪一个对象阻挡
- 弹出解释 tooltip
- 显示更复杂的差异化颜色层级

原因是这次的重点是：

- 先让玩家在预览阶段立刻知道“这里不能放”
- 同时让 command 层和 UI 层规则统一

而不是顺手重构整个建造预览体验。

---

## 8. 测试设计

### 8.1 Construction 共享查询测试

至少覆盖以下情况：

- footprint 命中 `Blueprint` 时返回 blocked
- footprint 命中 `ConstructionSite` 时返回 blocked
- footprint 命中 `Building` 时返回 blocked
- footprint 只命中 `Pawn` 时返回 placeable
- footprint 只命中 `Item` 时返回 placeable
- 多格 footprint 只要任一格命中冲突对象就返回 blocked

### 8.2 Command 测试

至少覆盖以下情况：

- `place_blueprint` 放在已有蓝图上时 validate 失败
- `place_blueprint` 放在已有工地上时 validate 失败
- `place_blueprint` 放在已有建筑上时 validate 失败
- `place_blueprint` 放在只包含 Pawn / Item 的格子上时 validate 通过
- 多格建筑与冲突对象部分重叠时 validate 失败

### 8.3 UI / 预览测试

至少覆盖以下情况：

- placement query 返回 placeable 时，预览状态为可放置
- placement query 返回 blocked 时，预览状态为 blocked
- blocked 状态来自共享 placement query，而不是单独写死的 UI 条件

---

## 9. 验收标准

本次功能完成时，应满足以下条件：

1. 新蓝图不能放到已有蓝图的 footprint 上。
2. 新蓝图不能放到已有工地的 footprint 上。
3. 新蓝图不能放到已有建筑的 footprint 上。
4. Pawn 和 Item 不会阻止蓝图放置。
5. 多格建筑 footprint 任意一格冲突时整体拒绝放置。
6. `place_blueprint.validate()` 使用共享 placement 判定。
7. UI 建造预览使用同一套共享 placement 判定。
8. 玩家在悬停预览阶段就能看见 blocked 反馈。
9. command 和 UI 不存在规则不一致的情况。

---

## 10. 实施范围建议

本设计建议集中修改以下区域：

- `src/features/construction/*`
  - placement query / helper
  - `construction.commands.ts`
  - 相关测试
- `src/world/occupancy.ts`
  - 如有必要，仅复用现有底层 footprint 命中查询
- `src/adapter/input/*`
  - 建造预览状态接入 blocked 判定
  - 相关测试

本次不建议顺手扩展到：

- 施工占位更复杂的动态交互
- 预览 tooltip 系统
- 放置自动修正或自动吸附

保持范围聚焦，优先把“规则统一 + 即时反馈”这两个核心收益落地。

---

## 11. 结论

这次设计解决的是一个很具体但价值很高的建造问题：

- 后端上，阻止非法重叠蓝图进入 world
- 前端上，让玩家在预览阶段立刻看见不可放置的位置

通过把“放置占地冲突”抽成 construction 侧共享规则，并同时接入 command validate 与 UI 预览，可以在不重做整个建造系统的前提下，补齐正确性与体验这两个关键缺口。
