# 床位所有权睡眠规则与建筑 Inspector 设计

**日期：** 2026-04-12  
**主题：** 将睡眠系统收敛为“床位所有权驱动”的行为规则，并正式建立建筑 Inspector 分发体系，以床为第一种专属建筑面板。

---

## 1. 背景

项目当前已经具备睡眠相关的基础能力：

- `rest` 需求与阈值已经存在于 Pawn needs 系统中。
- `job_sleep`、sleep evaluator、sleep job、睡眠中的 `rest` 恢复逻辑已经接入。
- `bed_wood`、`Building.bed` 组件、owner/occupant 字段与床位占用逻辑已经存在。
- 已有 `sleep-bed-occupancy` 与 `bed-blueprint-sleep` 场景测试，说明“建床”和“睡觉”两条链路已经部分跑通。

但当前设计仍存在两个核心问题：

1. 睡眠规则仍带有“自动认领可用床位”的思路，和本项目希望的“玩家明确管理床位归属”不一致。
2. 建筑还没有正式的 Inspector 分发体系，床位 owner/occupant 这类建筑专属信息无法以稳定、可扩展的方式暴露给玩家操作。

本次设计的目标不是重写整套 needs 系统，而是将现有睡眠实现收敛成一个可管理、可观察、可测试的玩法闭环：

- 玩家可以给床分配 owner。
- Pawn 困了以后优先睡自己的床。
- 没有分配床位时允许打地铺，但恢复更慢。
- 玩家可以通过建筑 Inspector 查看和修改床位所有权。

---

## 2. 设计目标

### 2.1 主要目标

1. 将床的可睡性规则改为“owner 驱动”，不再依赖自动分配。
2. 明确区分 `ownerPawnId` 与 `occupantPawnId` 的语义：
   - `ownerPawnId` 是长期归属。
   - `occupantPawnId` 是当前占用。
3. 保留未分配床位时的 `floor sleep` 兜底行为，但恢复速率低于床睡眠。
4. 建立通用建筑 Inspector 入口，并支持按建筑类型分发专属面板。
5. 让床作为第一种专属 Inspector，展示 owner/occupant，并提供 owner 分配与清除操作。
6. 所有写入都继续走 command bus，不允许 UI 直接修改 simulation 对象。
7. 用单元测试、UI selector/component 测试、scenario test 共同覆盖本次行为。

### 2.2 非目标

- 本阶段不重做完整需求系统。
- 本阶段不新增新的家具对象类别，床仍然是 `Building`。
- 本阶段不实现病床、囚犯床、双人床等更复杂床位规则。
- 本阶段不做建筑 Inspector 的复杂筛选、搜索、批量编辑。
- 本阶段不做床位优先级、睡眠时间表、房间舒适度等扩展玩法。

---

## 3. 现有架构约束

本设计必须遵守项目已定下的几个边界：

1. gameplay 规则继续落在 simulation 层，UI 只通过 snapshot 读取状态。
2. 建筑 owner 变更必须通过 command handler 写入 world。
3. 建筑 Inspector 是 UI 展示层，不承担业务规则裁决。
4. `sleep` 继续复用现有 `work evaluator -> job -> toil handler` 主链，不另起平行系统。
5. 床仍通过现有 `building + construction` 主链接入，不引入新的建造对象模型。

---

## 4. 核心规则设计

### 4.1 床位语义

床继续存放在 `Building.bed` 组件中，并保持这两个字段为核心状态：

- `ownerPawnId`
  - 表示该床长期属于哪位 Pawn。
  - 可以为空，表示未分配。
- `occupantPawnId`
  - 表示当前谁正在该床上睡觉。
  - 醒来后必须释放。

建议继续保留 `role` 字段，以便后续扩展病床、囚犯床等用途；但本阶段不赋予额外玩法意义。

### 4.2 Sleep evaluator 规则

当 Pawn 的 `rest < sleepSeekThreshold` 时，睡眠评估按如下顺序进行：

1. 查找 `ownerPawnId === pawn.name` 的床。
2. 如果存在自己的床，并且床当前可用，则创建“去自己的床睡觉”的 `job_sleep`。
3. 如果自己的床不存在，或存在但当前不可睡，则退化为 `floor sleep`。
4. 不再尝试寻找“最近可用公共床”或“自动认领空床”。

这意味着：

- Pawn 不会去睡别人的床。
- Pawn 不会因为地图上有空床就自动占为己有。
- “没有床”与“自己的床不可用”都会统一退化到地铺逻辑。

### 4.3 什么叫“自己的床可用”

下列情况任一成立，都应视为“自己的床不可用”：

- 床对象不存在或已销毁。
- 对象没有 `bed` 组件。
- 床当前被其他 Pawn 占用。
- 床当前不可达。
- 床尚未是可睡的完成态建筑。

### 4.4 Floor sleep 规则

Floor sleep 始终是合法兜底方案，但应满足：

- 恢复速率低于床睡眠。
- 不写入任何床位 owner 信息。
- 不写入任何床位 occupant 信息。
- 当 Pawn 后续被分配床位时，下一次进入睡眠评估即可切换到 owner 床逻辑。

### 4.5 醒来后的状态

当 `rest >= wakeTargetRest` 时，Pawn 醒来并结束当前睡眠 job。

醒来后的状态处理规则：

- 若为床睡眠：释放对应床的 `occupantPawnId`。
- 若为地铺：无床位状态需要清理。
- 无论哪种睡眠方式，都不清除 `ownerPawnId`。

### 4.6 一人一床规则

本阶段明确规定：**同一时间，一个 Pawn 最多只能拥有一张床。**

因此，当玩家将某张床分配给某个 Pawn 时：

- 如果该 Pawn 之前已经拥有另一张床，则旧床的 `ownerPawnId` 会被自动清除。
- 新床获得该 Pawn 的 owner 身份。

这样可以避免“一人多床”导致的 evaluator 歧义，也更符合 colony sim 的管理直觉。

---

## 5. 建筑 Inspector 结构

### 5.1 总体结构

建筑 Inspector 拆为两层：

1. **通用建筑 Inspector**
   - 所有建筑都显示。
   - 负责基础字段，如名称、类型、位置、尺寸、分类。

2. **建筑类型专属 Inspector**
   - 根据建筑类型追加专属显示与交互区块。
   - 床是第一种专属 Inspector。

这意味着 selector 不应只返回单一的 `stats[]` 列表，而应返回更清晰的结构：

- `base`
- `kind`
- `detail`

其中：

- `base` 用于通用建筑信息。
- `kind` 用于决定渲染哪种专属 Inspector。
- `detail` 用于承载具体类型的数据。

### 5.2 Bed Inspector

当选中的建筑是床时，Inspector 额外显示床专属区块，至少包括：

- `role`
- 当前 `ownerPawnId`
- 当前 `occupantPawnId`
- 可分配 owner 的 Pawn 列表
- `assign owner` 操作
- `clear owner` 操作

显示语义建议如下：

- `ownerPawnId` 为空时显示 `Unassigned`
- `occupantPawnId` 为空时显示 `Empty`

### 5.3 UI 组件结构建议

建议 UI 组件拆分为：

- `BuildingInspectorPanel`
  - 负责渲染通用 building info
  - 根据 `kind` 分发专属 section

- `BedInspectorSection`
  - 负责 owner / occupant 的展示
  - 负责 owner 分配与清除操作

这样可以避免将床位逻辑硬塞进通用 building 面板，也为未来的 storage、workbench 等 Inspector 留下清晰扩展位。

---

## 6. 命令与数据流

### 6.1 命令接口

本阶段建议新增两条明确命令：

- `assign_bed_owner`
- `clear_bed_owner`

之所以不合并成一个“多态 set 命令”，是为了保持语义清晰、测试直接、日志可读。

### 6.2 assign_bed_owner

该命令负责将某张床分配给一个 Pawn，handler 至少应做以下校验：

- 目标对象必须存在且为床。
- 目标 Pawn 必须存在。

执行逻辑：

1. 查找该 Pawn 当前是否已经拥有其他床。
2. 若已拥有旧床，则自动清除旧床的 `ownerPawnId`。
3. 将目标床的 `ownerPawnId` 设置为该 Pawn。
4. 不主动修改 `occupantPawnId`，除非未来需要处理更复杂冲突。

### 6.3 clear_bed_owner

该命令负责清空某张床的 owner：

- 目标对象必须存在且为床。
- 执行后将 `ownerPawnId` 设为 `undefined/null`。

本阶段不要求在 clear owner 时强制打断当前 occupant；该问题仅在“清空正在使用的床”成为真实玩法冲突时再处理。

### 6.4 UI 到 simulation 的数据流

1. 玩家选中建筑。
2. selector 生成通用 building inspector + 类型专属 detail。
3. bed inspector 渲染 owner/occupant 与操作入口。
4. 玩家触发分配或清除操作。
5. UI 发 command。
6. command handler 修改 world 中的床位 owner 状态。
7. snapshot 更新。
8. Inspector 与后续 sleep evaluator 自动反映新状态。

---

## 7. 测试设计

### 7.1 单元测试

至少覆盖以下规则：

- Pawn 有 owner 床且床可用时，会生成目标为自己床的 `job_sleep`。
- Pawn 不会选择别人拥有的床。
- Pawn 没有 owner 床时，会退化为 `floor sleep`。
- Pawn 的 owner 床不可用时，会退化为 `floor sleep`。
- `assign_bed_owner` 会自动清理该 Pawn 之前拥有的旧床。
- `clear_bed_owner` 会正确清空 owner。

### 7.2 UI selector / component 测试

至少覆盖以下内容：

- 选中普通建筑时，返回 generic building inspector。
- 选中床时，返回 bed inspector。
- bed inspector 正确显示 owner / occupant。
- bed inspector 能产出正确的 assign / clear action。

### 7.3 Scenario test

至少保留一条完整场景验证：

- 地图上存在两张床和三名 Pawn。
- 两名 Pawn 被分配 owner 床，第三名没有床。
- 三名 Pawn 进入疲劳状态。
- 两名有床 Pawn 分别前往自己的床睡觉。
- 未分配床位的 Pawn 打地铺。
- 醒来后两张床的 `occupantPawnId` 已释放，但 `ownerPawnId` 仍保留。

### 7.4 预存问题收口

本次实现期间应顺手修复已知的 TypeScript 预存问题：

- `src/testing/scenarios/bed-blueprint-sleep.scenario.ts` 的 `.id` 属性错误

如果实现过程中仍发现与本设计直接冲突的旧逻辑，也应一起清理，避免 owner 制设计与 auto-assign 设计同时存在。

---

## 8. 验收标准

本次里程碑完成时，应满足以下条件：

1. 游戏内床位所有权可由玩家明确分配。
2. Pawn 困倦时只会睡自己的床；没有床位时打地铺。
3. 床睡眠恢复速度高于地铺。
4. 醒来后床位 owner 保留，occupant 释放。
5. 建筑 Inspector 具备通用入口，并能按类型分发到 bed inspector。
6. bed inspector 能展示 owner/occupant，并提供 owner 分配与清除操作。
7. 相关单元测试、UI 测试、scenario test 通过。

---

## 9. 实施范围建议

本设计对应的实现范围建议集中在以下模块：

- `src/features/ai/*`
  - sleep evaluator
  - sleep job / cleanup
- `src/features/building/*`
  - bed owner 查询与写入辅助
- `src/features/.../*.commands.ts`
  - bed owner 命令入口与 handler
- `src/ui/domains/building/*`
  - building inspector selector / types / component
- `src/testing/*`
  - 单元测试
  - 场景测试

不建议在这次里程碑中顺手扩展到更大的 needs 重构、房间系统或复杂床位玩法，否则会稀释主目标。

---

## 10. 结论

这次设计将“睡觉”从一个已经能运行、但规则仍松散的子系统，收敛为一个明确由玩家管理的 colony 玩法切片：

- owner 决定睡眠归属
- floor sleep 作为稳定兜底
- Inspector 作为玩家观察与控制床位状态的正式入口

这既补齐了当前睡眠闭环，也为后续更多建筑类型的 Inspector 和更复杂的居住规则建立了稳定框架。
