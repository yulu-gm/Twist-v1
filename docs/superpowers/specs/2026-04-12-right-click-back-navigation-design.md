# 右键返回导航设计

## 背景

当前项目是一个基于 `TypeScript + Vite + Phaser + Preact` 的 HTML 游戏。地图交互由 `src/adapter/input/input-handler.ts` 统一处理，玩家的交互模式和瞬时展示状态由 `src/presentation/presentation-state.ts` 承载，右侧 inspector 不是独立弹层，而是由 `selectedObjectIds` 驱动显示。

浏览器默认右键会弹出上下文菜单，这与游戏交互冲突。当前项目也缺少统一的“取消/返回”机制，导致玩家在建造蓝图预览、指派预览、区域划定、取消模式、对象选中与 inspector 显示之间切换时，只能依赖左键重新点选工具，缺少符合游戏直觉的退回路径。

本设计目标是为地图交互提供一个统一的右键“返回”能力：拦截浏览器菜单，并按进入顺序逐层退出当前交互状态。

## 目标

- 阻止地图交互区域的浏览器右键菜单。
- 将鼠标右键定义为统一的“返回/取消”输入。
- 使用返回栈按进入顺序逐层回退稳定交互状态。
- 支持以下交互层级的回退：
  - 建造模式
  - 指派模式
  - 区域模式
  - 取消模式
  - `select` 模式下的对象选中与 inspector 显示
- 在右键返回时清理当前拖拽和临时预览，避免残留脏状态。

## 非目标

- 不处理 inspector 内部 tab 的返回。
- 不处理未来可能出现的 modal、弹窗、浮层栈。
- 不在本次设计中扩展到键盘 `Esc`，但实现应允许后续复用同一返回动作。
- 不改变现有左键交互逻辑。

## 术语

### 稳定交互状态

指真正代表玩家当前意图、值得进入返回栈并支持逐层恢复的状态。包括：

- `activeTool`
- `activeDesignationType`
- `activeZoneType`
- `activeBuildDefId`
- `selectedObjectIds`

### 派生预览状态

指根据稳定交互状态、鼠标悬停位置和拖拽过程临时计算出来的展示结果，不单独进入返回栈。包括：

- `hoveredCell`
- `placementPreview`
- `designationPreview`
- `zonePreview`
- `dragRect`

这些状态在右键返回时只需要被清理，不需要作为历史层级恢复。

## 用户体验

### 基础规则

- 在地图交互区域点击右键时，不再弹出浏览器菜单。
- 右键被解释为“返回上一层交互状态”。
- 如果当前正在拖拽，则右键优先取消本次拖拽，不直接跨层跳回更早状态。
- 如果返回栈为空，则右键只拦截浏览器菜单，不执行其他动作。

### 典型路径

#### 选择对象并打开 inspector

状态路径：

`select` -> 选中对象 -> inspector 显示

右键行为：

- 第一次右键：清空选中，关闭 inspector

#### 从选择进入建造模式

状态路径：

`select` -> `build`

右键行为：

- 第一次右键：回到 `select`

#### 先选中对象，再进入建造模式

状态路径：

`select` -> 选中对象 -> `build`

右键行为：

- 第一次右键：回到“已选中对象的 `select`”
- 第二次右键：清空选中，关闭 inspector

#### 工具之间连续切换

状态路径：

`select` -> `designate(mine)` -> `zone(stockpile)`

右键行为：

- 第一次右键：回到 `designate(mine)`
- 第二次右键：回到 `select`

#### 同一工具下切换子模式

状态路径：

`designate(mine)` -> `designate(harvest)`

右键行为：

- 第一次右键：回到 `designate(mine)`

## 设计方案

本设计采用“稳定状态入栈，派生预览即时清理”的混合方案。

原因如下：

- 真正需要按次序退回的是工具模式和选中态，而不是每一帧 hover 计算出来的预览矩形。
- 如果把预览也入栈，会让栈包含大量无意义节点，破坏右键的可预期性。
- 如果完全不维护栈，而是每次按一组固定 if/else 推导下一步状态，后续扩展更复杂交互时会迅速失控。

因此：

- 稳定交互状态进入返回栈。
- 拖拽与预览不入栈。
- 右键时先清理拖拽和预览，再恢复上一份稳定状态快照。

## 架构与改动范围

### `src/presentation/presentation-state.ts`

职责扩展为：

- 定义返回栈节点类型。
- 在 `PresentationState` 中新增返回栈字段。
- 提供压栈、弹栈、快照比较、恢复状态、清理临时预览的统一辅助函数。

建议新增内容：

- `PresentationBackEntry`
- `captureBackEntry(presentation)`
- `pushBackEntryIfNeeded(presentation)`
- `restoreBackEntry(presentation, entry)`
- `clearTransientInteractionState(presentation)`
- `popBackEntry(presentation)`

### `src/adapter/input/input-handler.ts`

职责扩展为：

- 注册右键输入监听。
- 阻止地图交互区域的 `contextmenu` 默认行为。
- 在右键触发时调用统一的 `handleBackAction()`。
- 当右键发生时，优先取消当前拖拽，再执行返回栈恢复。

### `src/main.ts`

当前 `createLazyPorts()` 中的 `setTool()`、`selectObjects()`、`selectColonist()` 会直接改写 `presentation`。这些入口需要改为走统一的“状态切换 API”，以确保：

- 从 UI 工具栏切换模式时能正确压栈。
- 从 UI 列表选择 colonist 时能正确建立 inspector 返回层。
- 不会出现输入层和 UI 层一部分走栈、一部分绕过栈的状态不一致问题。

## 数据模型

### `PresentationState` 新增字段

新增：

- `backStack: PresentationBackEntry[]`

### `PresentationBackEntry`

字段包含：

- `activeTool`
- `activeDesignationType`
- `activeZoneType`
- `activeBuildDefId`
- `selectedObjectIds`

约束：

- `selectedObjectIds` 在快照中必须是独立拷贝，不能复用原 `Set` 引用。
- 节点不保存 `hoveredCell`、预览和拖拽字段。

## 压栈规则

### 触发压栈的场景

以下场景需要压入当前稳定状态：

1. 从 `select` 进入任一非 `select` 工具：
   - `build`
   - `designate`
   - `zone`
   - `cancel`

2. 非 `select` 工具之间切换：
   - `build -> designate`
   - `designate -> zone`
   - `zone -> cancel`
   等等

3. 同一工具下切换子模式：
   - `designate(mine) -> designate(harvest)`
   - `build(wall_wood) -> build(bed_wood)`
   - `zone(stockpile) -> zone(growing)`

4. `select` 模式下，`selectedObjectIds` 从空变为非空：
   - 即第一次打开 inspector 时

### 不触发压栈的场景

以下场景不压栈：

- 鼠标悬停变化
- 预览刷新
- 拖拽矩形变化
- 在已有选中状态下切换为另一个选中对象
- 连续设置与当前状态完全相同的工具和子模式

### 去重规则

压栈前需要比较“当前状态快照”与栈顶节点：

- 如果完全相同，则不重复压栈。
- 比较范围仅限稳定交互状态字段。

这样可以避免频繁切换同一模式时产生重复节点。

## 右键执行顺序

右键统一执行以下顺序：

1. 阻止浏览器 `contextmenu`
2. 如果当前存在进行中的左键拖拽：
   - 清空 `dragState`
   - 清空 `dragRect`
   - 清空相关预览
   - 本次右键到此结束，不继续弹栈
3. 如果没有拖拽：
   - 清理临时预览状态
   - 如果 `backStack` 非空，则弹出栈顶并恢复
   - 如果 `backStack` 为空，则结束

该顺序保证：

- 玩家右键时优先终止“正在发生的输入动作”
- 然后才回到“上一层稳定交互状态”

## 恢复规则

恢复栈顶节点时：

- 还原 `activeTool`
- 还原 `activeDesignationType`
- 还原 `activeZoneType`
- 还原 `activeBuildDefId`
- 还原 `selectedObjectIds`
- 清空所有临时预览和拖拽态

恢复后不应保留旧的 `placementPreview`、`designationPreview`、`zonePreview` 或 `dragRect`，以免显示与恢复后的主状态不一致。

## Inspector 规则

本设计明确将 inspector 视为一层稳定交互状态，而不是单纯的派生视觉结果。

具体定义：

- inspector 的显示由 `selectedObjectIds` 非空驱动。
- 因此“打开 inspector”对应的是从“无选中”进入“有选中”的稳定状态变化。
- 该变化应进入返回栈。
- 右键返回到这一层之前的状态时，应通过恢复空选中集合来关闭 inspector。

在已有选中状态下切换目标对象不进入返回栈，因为用户期待的是“退出 inspector”，而不是“回看上一个被选中的对象”。

## 输入边界

### 浏览器菜单拦截范围

第一版应至少确保 Phaser 游戏交互区域内右键不会弹出浏览器菜单。

实现上优先选择以下策略之一：

- 对 Phaser canvas 绑定 `contextmenu` 并 `preventDefault()`
- 或对场景输入根节点绑定同等效果的事件处理

不建议直接对整个 `window` 全局禁用右键，因为后续可能影响调试面板、浏览器原生交互或输入控件。

### UI 与输入的一致性

地图输入和 UI 工具栏都能修改 `presentation`。为了保证返回栈正确，所有会改变稳定交互状态的入口必须走同一套状态变更 API，而不是各自手写字段赋值。

## 测试策略

### 单元测试

为 `presentation-state` 增加测试，覆盖：

- 从 `select` 进入工具模式时压栈
- 工具之间切换时压栈
- 同一工具子模式切换时压栈
- `select` 下首次选中对象时压栈
- 已有选中时改选对象不压栈
- 重复设置相同状态不压栈
- 弹栈恢复后状态正确

### 输入层测试

为 `input-handler` 增加测试，覆盖：

- 右键时调用返回动作
- 正在拖拽时右键只取消拖拽，不弹栈
- 非拖拽状态下右键会恢复上一层工具/选中状态
- 栈空时右键不报错、不执行额外逻辑

### 回归关注点

- 左键建造、指派、区域划定、取消逻辑不应受影响
- inspector 显示逻辑不应被破坏
- 预览应在状态恢复后正常重新计算，而不是残留旧内容

## 风险与约束

### 风险 1：多入口绕过栈逻辑

如果某些代码路径继续直接写 `presentation.activeTool` 或 `selectedObjectIds`，返回栈将出现断层，导致右键行为不一致。

应对方式：

- 将稳定状态变更收敛到统一辅助函数
- 优先替换 `main.ts` 中 UI 入口的直接赋值

### 风险 2：恢复时残留临时预览

如果恢复稳定状态后没有清理预览，画面会出现“已经回到 select，但还显示旧蓝图框”的错误。

应对方式：

- 恢复函数内部统一清理临时状态

### 风险 3：重复压栈导致右键过深

如果未做去重，用户反复点击同一工具可能让右键返回层数异常增多。

应对方式：

- 压栈前比较当前快照与栈顶

## 实施边界

本设计第一版只覆盖：

- `build`
- `designate`
- `zone`
- `cancel`
- `select + selection/inspector`
- 拖拽取消
- 浏览器右键菜单拦截

明确不在本次实施中覆盖：

- inspector tab 层级返回
- modal / popup 返回
- `Esc` 复用

## 结果预期

完成后，玩家在地图上的核心体验应为：

- 右键不再弹出浏览器菜单
- 右键始终表现为游戏内“返回/取消”
- 返回顺序与玩家进入交互层级的顺序一致
- inspector 也能通过右键自然关闭
- 拖拽中右键能稳定中断当前操作
