# Preact UI 业务系统设计

**日期：** 2026-04-10
**主题：** 在现有 Phaser 项目中引入 Preact，并以数据驱动、函数式风格建立游戏 UI 业务系统架构

---

## 1. 背景与问题

当前项目已经具备较清晰的 `Simulation / Presentation / Adapter` 分层，但 UI 仍处在早期阶段：

- 现有 HUD 由 [dom-ui-manager.ts](D:/CC/Twist-v1/src/adapter/ui/dom-ui-manager.ts) 及其子组件直接拼装。
- 多个面板各自直接读取 `World`、`GameMap`、`PresentationState`，缺少统一的 UI 业务边界。
- UI 的表现层、查询层、交互层、副作用层没有清楚拆分，不利于后续扩展角色管理、建造工作流和反馈系统。
- 当前 UI 更像调试面板集合，而不是一个可持续扩展的游戏前端应用。

这次改造的目标不是单纯“把手写 DOM 换成 Preact”，而是借引入 `Preact` 的机会，把 UI 从零散面板升级为一个有明确数据流和领域边界的业务系统。

---

## 2. 设计目标

### 2.1 主要目标

1. 在现有 Phaser 架构上引入 `Preact`，作为屏幕空间 UI 的主渲染层。
2. 建立一套以“数据驱动 + 函数式”为核心的 UI 架构。
3. 让 UI 组件只消费 plain data，不直接依赖 `World`、`GameMap` 或具体游戏对象实例。
4. 将 UI 状态拆为“引擎派生状态”和“UI 本地状态”，避免业务状态重复存储。
5. 按业务域优先级建立 UI 系统：
   - 第一优先：角色管理 `C`
   - 第二优先：建造规划 `B`
   - 第三优先：指令反馈 `A`

### 2.2 非目标

- 本次设计不重写 Phaser 世界渲染与世界空间输入命中。
- 本次设计不把整个 `Simulation` 层改造成不可变架构。
- 本次设计不在第一阶段引入完整插件化窗口系统。
- 本次设计不要求一次性迁完所有旧 DOM 面板。

---

## 3. 设计原则

### 3.1 数据驱动优先

以下内容优先通过 schema 或配置驱动，而不是散落在组件里的条件分支：

- 角色面板 section 定义
- roster 列定义
- 状态徽章与属性显示规则
- 建造菜单分类
- 工具模式定义
- 反馈事件到 UI 展示的映射规则

### 3.2 函数式优先

UI 的核心业务逻辑优先写成纯函数：

- selector：从引擎状态派生 UI 模型
- reducer：从旧 UI 状态和 action 计算新 UI 状态
- formatter：将业务值转换为 UI 展示值
- matcher：将事件映射到通知、警报、摘要

副作用必须隔离，不能混入 selector 或 reducer。

### 3.3 边界清晰

- Phaser 负责世界空间渲染和世界命中。
- Preact 负责屏幕空间 UI。
- `PresentationState` 负责轻量即时交互状态。
- 命令、副作用、模式切换必须通过统一 port/intents 入口。

### 3.4 渐进迁移

允许新旧 UI 共存一段时间，但新增业务能力优先进入新架构，不再继续扩展旧 `adapter/ui/*` 的直接耦合模式。

---

## 4. 架构总览

目标架构分为五层：

### 4.1 Simulation Core

现有 `World`、`GameMap`、`features/*`、`command-bus` 仍是权威数据源。

职责：

- 保存真实游戏状态
- 执行 Tick、AI、命令、建造、移动等逻辑
- 作为 UI 的只读源头

约束：

- UI 不直接修改 Simulation 对象
- UI 对世界的写操作仍通过 `commandQueue` 或明确的 adapter port 触发

### 4.2 Presentation Runtime

保留现有 [presentation-state.ts](D:/CC/Twist-v1/src/presentation/presentation-state.ts) 作为展示运行态，但职责收紧为：

- 当前选中对象
- 当前工具与子模式
- 悬停格子
- placement/designation preview
- camera 位置与缩放
- debug panel 开关
- drag rect 等短生命周期交互状态

约束：

- `PresentationState` 不承载长期 UI 业务状态
- `PresentationState` 不承载角色管理排序、通知中心开关、inspector tab 等前端应用状态

### 4.3 UI Query Layer

新增纯函数查询层，将引擎态转换为 UI 可消费的视图模型。

职责：

- 从 `World + GameMap + PresentationState` 派生 `EngineSnapshot`
- 再从 `EngineSnapshot + UiState` 派生领域 view model

典型输出：

- `ColonistRosterRow[]`
- `ColonistInspectorViewModel`
- `BuildPaletteViewModel`
- `NotificationFeedViewModel`

约束：

- 只读
- 无副作用
- 输出 plain data，不返回游戏对象实例

### 4.4 UI Application Layer

新增 UI 业务层，负责应用自身状态与意图编排。

职责：

- 管理 `UiState`
- 通过 reducer 演化 UI 本地状态
- 通过 intents/effects/ports 触发副作用
- 协调多业务域之间的 UI 交互

### 4.5 Preact View Layer

`Preact` 作为主 UI 渲染层，负责屏幕空间布局与组件声明。

职责：

- 渲染 App Shell、roster、inspector、build panel、feedback center
- 仅依赖 selector 输出和 dispatcher/intents

约束：

- 组件不得直接读取 `World`、`GameMap`、`Pawn`
- 组件不直接写 `PresentationState`
- 组件不直接向 `commandQueue` 塞命令

---

## 5. 核心数据模型

第一阶段定义四个核心模型：

### 5.1 `EngineSnapshot`

用于承接引擎态到 UI 的只读快照。

建议结构：

```ts
type EngineSnapshot = {
  tick: number
  speed: number
  presentation: PresentationSnapshot
  selection: SelectionSnapshot
  colonists: Record<string, ColonistNode>
  build: BuildSnapshot
  feedback: FeedbackSnapshot
}
```

原则：

- 只保留 UI 需要的数据
- 尽量扁平、可序列化
- 不暴露活对象引用给 Preact 组件

### 5.2 `UiState`

用于承载纯 UI 本地状态。

建议包含：

- 当前主面板
- roster 排序、筛选、搜索词
- inspector 当前 tab
- build palette 当前分类和搜索词
- feedback 面板开关与过滤器
- modal / drawer / overlay 的展开状态

原则：

- 可 reducer 化
- 可序列化
- 不重复存储引擎已存在的业务事实

### 5.3 `UiAction`

用于驱动 `UiState` 更新。

典型 action：

- `open_panel`
- `set_colonist_sort`
- `set_colonist_filter`
- `select_inspector_tab`
- `toggle_notification_center`

### 5.4 `UiIntent`

用于描述“需要触发副作用”的意图。

典型 intent：

- `focus_colonist`
- `set_active_tool`
- `issue_build_command`
- `issue_designation_command`
- `jump_camera_to_object`
- `dismiss_notification`

约束：

- `action` 只改变 UI 本地状态
- `intent` 只表达副作用请求
- 两者不混用

---

## 6. Shared UI Kernel

新增一个横切层，作为各 UI 业务域的共享基座。

建议职责如下：

### 6.1 Store

统一持有：

- 当前 `EngineSnapshot`
- 当前 `UiState`
- action dispatcher
- intent dispatcher

### 6.2 Bridge

负责从现有引擎对象生成 UI 快照，并提供订阅接口。

输入：

- `World`
- `GameMap`
- `PresentationState`
- 关键事件流

输出：

- `EngineSnapshot`

Bridge 本身不做 UI 决策，只做读取、投影和通知。

### 6.3 Ports

统一封装 UI 到引擎的写入口。

例如：

- `enqueueCommand`
- `setTool`
- `setSelectedObjects`
- `setBuildDef`
- `setDesignationType`
- `jumpCameraTo`

约束：

- 组件和领域模块不直接碰底层对象
- 副作用只通过 port 发出

### 6.4 Shared Components

封装所有跨业务域的基础组件：

- `Panel`
- `Section`
- `Tabs`
- `Badge`
- `ProgressBar`
- `StatRow`
- `KeyHint`

这些组件不包含具体领域逻辑。

---

## 7. UI 业务域设计

### 7.1 Colonist UI Domain

这是第一阶段主域，交互形态采用“轻 roster + 深 inspector”的混合模式。

#### 目标

- 提供常驻角色列表，支持快速比较与切换
- 提供单角色详情 inspector
- 清晰表达 needs、mood、health、job、toil
- 为未来的工作优先级与角色动作预留结构

#### 内部结构

`schemas`

- roster 列定义
- inspector section 定义
- status badge 映射
- 角色快捷动作定义

`selectors`

- `selectColonistRosterRows(snapshot, uiState)`
- `selectColonistInspector(snapshot, uiState, colonistId)`
- `selectColonistStatusSummary(snapshot)`
- `selectColonistAlerts(snapshot, colonistId)`

`reducer`

- roster 排序字段
- roster 搜索词
- 当前 pin 的 colonist
- inspector 当前 tab

`intents/effects`

- 选中角色
- 镜头跳转到角色
- 打开 inspector
- 触发角色动作

#### 第一阶段交付

- 常驻 roster
- 单 colonist inspector
- needs / mood / health / current job / current toil 展示
- roster 与 selection 联动

### 7.2 Build UI Domain

这是第二阶段主域，但在第一阶段会先搭骨架。

#### 目标

- 用统一方式表达“当前建造/指派模式”
- 提供更清晰的 build/designation palette
- 为后续建造工作流、批量操作、撤销、材料提示预留结构

#### 内部结构

`schemas`

- 建造分类定义
- palette 条目定义
- designation 工具定义
- 文案与热键元数据

`selectors`

- `selectBuildPalette(snapshot, uiState)`
- `selectBuildModeSummary(snapshot)`
- `selectDesignationModeSummary(snapshot)`

`reducer`

- build palette 当前分类
- 搜索词
- 最近使用项

`intents/effects`

- 切工具
- 设置 `activeBuildDefId`
- 设置 `activeDesignationType`
- 取消当前模式

#### 第一阶段交付

- 新 build/tool mode bar 骨架
- build/designation palette 初版
- 当前模式说明区域

### 7.3 Feedback UI Domain

这是第三优先域，但会在第一阶段先替换最关键的反馈入口。

#### 目标

- 把分散的事件反馈组织成产品化 UI
- 让命令失败、关键事件、状态警报变得可见
- 为未来通知中心、日志和告警系统提供稳定边界

#### 内部结构

`schemas`

- 事件到 UI 展示类型的映射
- 优先级规则
- 聚合规则

`selectors`

- `selectCommandFeedback(snapshot)`
- `selectRecentNotifications(snapshot, uiState)`
- `selectActiveAlerts(snapshot)`

`reducer`

- 通知中心开关
- 已读/未读状态
- 过滤器

`effects`

- 订阅事件流
- 去重
- 聚合
- 自动过期

#### 第一阶段交付

- `command_rejected` 的可见反馈
- 关键事件摘要
- 通知入口或轻量事件流

---

## 8. 数据流与副作用流

### 8.1 读取链路

UI 主链路应固定为：

`World / GameMap / PresentationState -> EngineSnapshot -> Selectors -> ViewModel -> Preact Components`

组件只位于链路末端。

### 8.2 写入链路

交互写入链路应固定为：

`User Event -> UiAction / UiIntent -> Reducer or Port -> commandQueue / presentation mutator / camera control`

### 8.3 副作用边界

以下行为属于副作用，必须从纯函数中剥离：

- 压入 `commandQueue`
- 切换工具
- 修改选中集
- 跳转镜头
- 订阅 Tick 或事件流
- 处理定时过期 toast

---

## 9. Preact 接入策略

### 9.1 接管范围

`Preact` 只接管屏幕空间 UI，不接管 Phaser 世界空间层。

Phaser 继续负责：

- 世界渲染
- 相机
- 世界命中
- 世界空间预览
- 拖拽框选输入采样

Preact 负责：

- App Shell
- 顶部状态栏
- 角色 roster
- inspector
- build/tool panel
- feedback/notification UI

### 9.2 与现有结构的关系

当前 [dom-ui-manager.ts](D:/CC/Twist-v1/src/adapter/ui/dom-ui-manager.ts) 是旧 UI 装配点。

迁移后建议新增 `Preact AppShell` 作为主 UI 根，旧 `dom-ui-manager` 在过渡期只承接尚未迁移的 legacy 面板，直到全部替换完成。

### 9.3 状态订阅策略

优先采用“快照订阅 + reducer”的架构，不把 `@preact/signals` 作为第一阶段主状态方案。

原因：

- reducer 模型更贴合函数式偏好
- `EngineSnapshot` 更适合通过订阅统一刷新
- 可以避免在早期把响应式可变状态扩散到整个 UI 层

必要时，未来可在局部高频交互中引入 signals，但不作为架构核心。

---

## 10. 迁移策略

迁移采用四步走：

### Phase 1：接入基础设施

- 安装 `Preact`
- 建立 `src/ui/*` 目录
- 搭建 `AppShell`
- 建立 `Bridge / Store / Ports / Reducer` 骨架

### Phase 2：优先落地 Colonist Domain

- 先做 roster
- 再做 inspector
- 完成 selection 联动与镜头聚焦等核心交互

### Phase 3：接入 Build Domain 骨架

- 迁移工具栏到新架构
- 接入 build/designation palette
- 建立统一模式表达

### Phase 4：接入 Feedback Domain

- 替换命令失败反馈
- 建立通知入口
- 逐步替换调试式文本反馈

---

## 11. 错误处理与退化策略

### 11.1 Snapshot 不完整

如果某个 selector 依赖的对象丢失或状态不一致：

- selector 返回可渲染的空状态
- UI 使用空态、缺省态或占位提示
- 不允许组件因对象缺失直接崩溃

### 11.2 Intent 无法执行

如果 intent 对应的 command 验证失败：

- 通过 Feedback Domain 显示可见反馈
- 不在组件中吞掉失败

### 11.3 渐进迁移期冲突

在新旧 UI 共存阶段：

- 新增功能优先进入新 Preact 架构
- legacy UI 不继续扩展新业务逻辑
- 对同一功能只保留一个主入口，避免双向写状态

---

## 12. 测试策略

### 12.1 单元测试

重点测试纯函数：

- selectors
- reducers
- schema formatter
- feedback 映射规则

### 12.2 集成测试

重点验证：

- Bridge 生成的 `EngineSnapshot` 是否稳定
- UI intent 是否正确翻译到 ports
- roster、inspector、build panel 是否按状态正确联动

### 12.3 手工回归

重点回归以下场景：

- 点击角色列表与地图选中联动
- inspector 在角色切换时展示稳定
- build/designation 模式切换不破坏现有输入链路
- 命令失败能被用户可见地感知
- 新 UI 不影响 Phaser 世界渲染和输入

---

## 13. 第一阶段验收标准

第一阶段完成后，应满足：

1. `Preact` 成为屏幕空间 UI 的主渲染层。
2. 新 UI 有 `AppShell + Kernel + Domain` 的基础结构。
3. 组件不再直接依赖 `World`、`GameMap`、`Pawn` 实例。
4. 至少 `Colonist Domain v1` 可用。
5. Build 与 Feedback 至少建立可扩展骨架。
6. 旧 `adapter/ui/*` 不再承担新增 UI 业务的主入口。

---

## 14. 结论

本次 UI 改造采用“`Preact App Shell + Engine Snapshot + Reducer + Selectors + Ports`”的总体方向，在现有 Phaser 项目上建立一个数据驱动、函数式优先的 UI 业务系统。

它不是对旧 DOM UI 的表层替换，而是一次边界重构：

- 让 UI 从散装面板升级为前端应用
- 让角色管理成为第一阶段核心体验
- 为建造与反馈系统预留一致的数据流和业务扩展方式

这条路线能最大限度复用现有 `Simulation / Presentation / Command` 架构，同时把后续 UI 复杂度收拢到稳定、可测试、可迁移的前端层次中。
