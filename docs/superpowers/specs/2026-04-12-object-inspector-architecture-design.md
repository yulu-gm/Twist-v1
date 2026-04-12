# Object Inspector 架构设计

**日期：** 2026-04-12  
**主题：** 为 Twist-v1 设计统一的 Object Inspector 架构，覆盖几乎所有非空地对象的查看与操作入口，并支持同格对象切换与类型专属 Inspector 扩展。

---

## 1. 背景

项目当前已经开始为建筑添加选中与 Inspector 逻辑，这证明了 Inspector 方向本身是对的，但现有做法还停留在“为某一个对象类型临时做一个面板”的阶段。

在实际体验后，可以确认一个更大的事实：

- 需要 Inspector 的并不只有 Colonist 或 Building。
- Blueprint、ConstructionSite、地上 Item、Plant、石头/矿物对象等，几乎所有非空地对象都需要稳定的 Inspector 入口。
- 如果继续按“每新增一种对象就往 `app-shell` 里再接一个 selector 和一个组件”的方式扩展，很快会演变成不可维护的分支堆叠。

因此当前问题已经不是“要不要再给某类对象加一个面板”，而是：

**项目需要一套统一的 Object Inspector 架构。**

这套架构需要解决几个现实问题：

1. 同一格上可能存在多个对象，玩家需要在它们之间切换查看。
2. 不同对象的 detail 和 actions 完全不同，不能硬塞进一个大而平的通用结构。
3. 仍然需要一个 generic fallback，保证所有对象都有兜底查看入口。
4. 但这个 generic fallback 必须明确告诉用户：**这里只是降级态，项目缺少该对象的专门 Inspector。**

---

## 2. 设计目标

### 2.1 主要目标

1. 建立统一的 `Object Inspector` 架构，替代当前分散的对象面板入口。
2. Inspector 必须支持“同格对象切换”。
3. Inspector 必须支持按对象类型分发 detail 与 actions。
4. 为未实现专属 Inspector 的对象提供 generic fallback。
5. generic fallback 必须明确表达“当前对象尚未实现专门 Inspector，只是在兜底显示基础信息”。
6. 第一批专用 Inspector 至少覆盖：
   - `Pawn`
   - `Blueprint`
   - `ConstructionSite`
   - `Building`
   - `Item`
   - `Plant`
   - `Rock / 矿物类自然对象`
7. Inspector 内的高价值操作应逐步集中到 Inspector 中，而不是散落在别的临时 UI 入口里。

### 2.2 非目标

- 本阶段不重做整个世界选择系统。
- 本阶段不实现空地 Inspector。
- 本阶段不要求所有对象类型第一天就拥有复杂专属 UI。
- 本阶段不要求一次性把所有游戏操作都搬进 Inspector。
- 本阶段不追求视觉上完全差异化的对象面板风格，重点先是架构与信息组织。

---

## 3. 核心交互模型

### 3.1 主选中对象与 Inspector 目标分离

本设计明确区分两种状态：

1. **游戏主选中对象**
   - 来自 engine snapshot 的 `selection.primaryId`
   - 表示当前真正被选中的对象

2. **Inspector 当前查看目标**
   - 属于 UI 本地状态
   - 表示 Inspector 当前正在显示同格对象栈中的哪一个对象

这两者不能混为一谈。

如果玩家只是想查看同格中的另一个对象，不应因此直接改掉真正的世界选中对象，否则会导致：

- 选择语义被破坏
- 后续依赖 selection 的系统收到意外变化
- 用户只是想“看一下”，结果触发了真正的选中切换

因此本设计要求：

- 继续保留 `selection.primaryId` 作为主选中对象
- 新增 UI 本地的 `inspectorTargetId`
- Inspector 切换同格对象时，只修改 `inspectorTargetId`

### 3.2 同格对象栈

当存在 `primaryId` 时，Inspector 应：

1. 找到 `primaryId` 对应对象
2. 取出它所在格的对象列表
3. 过滤出可 inspect 的对象
4. 生成同格对象栈导航
5. 默认将 `primaryId` 作为当前 Inspector target
6. 用户切换对象时，仅修改 `inspectorTargetId`

### 3.3 同格对象默认排序

建议默认优先级如下：

1. `Pawn`
2. `Blueprint`
3. `ConstructionSite`
4. `Building`
5. `Item`
6. `Plant`
7. `Rock / 矿物类对象`

理由：

- Pawn 最常被直接关注
- Blueprint / 工地是当前施工主链中的高频交互对象
- Building 与 Item 次之
- Plant / Rock 通常更偏资源查看与 designation 操作

---

## 4. Inspector 总体结构

统一的 Object Inspector 建议分成四层：

### 4.1 Inspector 容器层

职责：

- 处理空状态
- 读取当前 Inspector target
- 渲染同格对象切换条
- 挂载通用头部
- 挂载 detail sections
- 挂载 action sections

### 4.2 对象导航层

职责：

- 展示同格对象栈
- 高亮当前 Inspector target
- 允许在同格对象之间切换

### 4.3 通用对象头部

所有对象共享的头部信息建议包括：

- 对象名称
- 对象类型
- 所在坐标
- 若适合，可显示对象状态标签

例如：

- `Sleeping`
- `Drafted`
- `Blueprint`
- `Reserved`
- `Blocked`

### 4.4 类型专属区块

每个对象类型通过专属 adapter 提供：

- detail sections
- actions

Inspector 容器只负责渲染统一结构，不直接内嵌每种对象的业务逻辑。

---

## 5. 通用信息与专属信息

### 5.1 所有对象共享的通用信息

无论对象类型如何，Inspector 至少应能展示这些基础字段中的一部分：

- `id`
- `kind`
- `defId`
- `cell`
- `footprint`
- `mapId`
- `factionId`（若适用）
- `destroyed`
- 若存在，可展示 tags 概览

### 5.2 第一批专用 Inspector 的建议内容

#### Pawn

详情：

- 当前 job
- needs
- health
- 当前工作决策快照

操作：

- `draft / undraft`
- 可能的高价值调试/控制入口

#### Blueprint

详情：

- 目标建筑
- 材料需求
- 已运送材料
- footprint

操作：

- `cancel_construction`

#### ConstructionSite

详情：

- 目标建筑
- 当前建造进度
- footprint

操作：

- `cancel_construction`

#### Building

详情：

- 通用建筑信息
- 若建筑类型有专属数据，则显示专属 detail

操作：

- 按具体建筑类型扩展  
  例如床：
  - `assign owner`
  - `clear owner`

#### Item

详情：

- 名称
- 数量 / stackCount
- 位置
- 若有相关状态，可显示是否被 reservation / 搬运占用

操作：

- 本阶段可以只提供少量高价值操作，或暂时无专属 action

#### Plant

详情：

- 植物类型
- 生长进度
- 是否可 harvest / cut

操作：

- `designate_harvest`
- `designate_cut`
- `cancel_designation`

#### Rock / 矿物类对象

详情：

- 类型
- 位置
- 是否 mineable

操作：

- `designate_mine`
- `cancel_designation`

---

## 6. Generic Fallback 的定位

### 6.1 Generic 不是正式类型支持，而是降级态

本设计明确规定：

**generic object inspector 不是“通用正式面板”，而是“对象缺少专用 Inspector 时的降级兜底”。**

因此 generic fallback 必须具备两个特点：

1. **明确提示当前对象尚未实现专用 Inspector**
2. **只展示最小基础信息，不伪装成完整对象支持**

### 6.2 Generic Fallback 必须展示的提示

建议在 generic Inspector 头部或概览区显式展示类似文案：

- `该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。`

或语义等价的英文/双语提示。

目的不是提醒用户“这里也能凑合用”，而是清楚表达：

- 当前对象已经被框架接住
- 但项目仍缺失该对象的专门信息架构

### 6.3 Generic Fallback 展示内容

建议只展示：

- 对象名称
- `kind`
- `defId`
- 坐标
- footprint
- tags
- destroyed / faction / mapId 等基础状态

不建议在 generic fallback 里堆很多看似全面、实则未被精心设计的字段，否则它会掩盖“缺少专用 Inspector”的事实。

---

## 7. 代码结构设计

### 7.1 新增统一 Inspector 领域

建议新增 `ui/domains/inspector/` 作为统一领域，负责：

- Inspector 容器
- 同格对象栈导航
- Inspector 目标解析
- 通用 ViewModel 结构
- adapter 注册与分发

### 7.2 对象专属 Adapter

建议每类对象通过专属 adapter 接入 Inspector，而不是继续在 `app-shell` 里手写分支。

例如：

- `colonist-inspector.adapter.ts`
- `building-inspector.adapter.ts`
- `blueprint-inspector.adapter.ts`
- `construction-site-inspector.adapter.ts`
- `item-inspector.adapter.ts`
- `plant-inspector.adapter.ts`

每个 adapter 的职责应为：

- 判断自己是否支持某个对象
- 从 snapshot 中提取该对象的专属 view model
- 声明该对象的 detail sections
- 声明该对象的 actions

### 7.3 注册表模式

Inspector 容器建议通过“已注册 adapter 列表”来匹配对象，而不是写成巨大的 if / else 链：

1. 拿到当前 Inspector target object
2. 遍历已注册 adapter
3. 找到第一个支持该对象类型的 adapter
4. 生成专属 view model
5. 若无匹配，则回落到 generic fallback

这样做可以：

- 避免 `app-shell` 和 selector 爆炸
- 新增对象类型时改动边界清晰
- 允许分阶段逐步接入对象

---

## 8. Action 体系设计

### 8.1 统一 Action 描述

Inspector 内的操作不应由组件层直接散写业务按钮，而应通过统一 action 描述结构暴露。

建议每个 action 至少包含：

- `id`
- `label`
- `enabled`
- `intent` / `command` 信息

### 8.2 渲染与业务分层

- **Inspector 容器 / 通用 action 区块**
  - 负责渲染按钮、菜单、禁用态

- **对象专属 adapter**
  - 负责声明该对象有哪些 action
  - 负责决定 action 何时可用

- **UiPorts / command bus**
  - 负责执行最终写入或操作

这样可以避免：

- 业务规则散在组件里
- 同类型 action 在不同面板表现不一致
- 后续难以统一处理确认框、禁用逻辑、日志与埋点

---

## 9. 分阶段落地策略

### 9.1 阶段 1：先建立统一框架

第一阶段优先完成：

- 统一 Object Inspector 容器
- 同格对象切换
- `inspectorTargetId`
- adapter 注册机制
- generic fallback

这一步完成后，即使不是所有对象都已实现专用 Inspector，框架也已经稳定。

### 9.2 阶段 2：接入第一批高价值对象

建议第一批接入：

- `Pawn`
- `Blueprint`
- `ConstructionSite`
- `Building`
- `Item`
- `Plant`
- `Rock / 矿物类对象`

### 9.3 阶段 3：逐步替换 Generic

后续对象类型再逐步从 generic fallback 升级为专属 Inspector。

generic fallback 应长期存在，但其目标是：

- 保证所有对象都能被查看
- 同时明确提醒“该对象尚未完成专用 Inspector”

而不是承担长期主力展示职责。

---

## 10. 验收标准

本次架构落地后，应满足以下条件：

1. Inspector 成为统一的 Object Inspector 入口，而不是多个平行对象面板拼接。
2. 同格对象可以在 Inspector 内切换查看。
3. Inspector 切换不会直接改掉世界主选中对象，而是通过独立的 `inspectorTargetId` 工作。
4. 所有接入对象都能通过统一容器显示。
5. 第一批对象类型具备专用 Inspector：
   - Pawn
   - Blueprint
   - ConstructionSite
   - Building
   - Item
   - Plant
   - Rock / 矿物类对象
6. 若对象尚未实现专用 Inspector，generic fallback 会接住它。
7. generic fallback 必须明确显示“当前对象缺少专门 Inspector，只是在兜底显示基础信息”。
8. 对象操作通过统一 action 体系与 UiPorts / command bus 发出，而不是散落在各组件中。

---

## 11. 结论

这次设计的重点，不是再多做几个对象面板，而是把 Inspector 从“局部功能”升级为“统一架构”。

它解决的是一组系统性问题：

- 几乎所有非空地对象都需要稳定查看入口
- 同格对象需要切换查看
- 不同对象需要不同 detail 与 action
- generic fallback 必须存在，但必须明确表明自己只是降级态

通过统一 Object Inspector 容器、对象 adapter 注册机制、同格对象切换模型与明确的 generic fallback 语义，这套架构可以让后续对象类型逐步接入，而不会继续把 Inspector 演变成一组难以维护的临时分支。
