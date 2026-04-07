# Mock 表现层重构计划

在当前阶段，项目中为了快速验证表现层逻辑，引入了大量 mock 数据和兼容前向的文件。当正式系统（地图、实体、物品、AI 行为等）接入时，需要对以下模块进行重构和替换。

## 1. 废弃的兼容前向文件 (Deprecated Forward Compatibility)
**涉及文件**：
- `src/scenes/villager-tool-bar-config.ts`
- `src/scenes/mock-villager-tools.ts`
- `src/scenes/mock-ground-items.ts`
- `src/scenes/mock-grid-cell-info.ts`
- `src/scenes/mock-task-marker-commands.ts`
- `src/scenes/mock-task-marker-selection.ts`
- `src/scenes/mock-pawn-profile-data.ts`
- `tests/component/mock-task-marker-commands.test.ts`
- `tests/component/mock-task-marker-selection.test.ts`

**当前现状**：这些文件作为 `scene-hud` 系统的临时兼容层存在，用于在真实系统未接入前提供 mock 数据和逻辑。
**重构目标**：
- 当真实数据源接入并替换 `src/data/*.ts` 的实现后，安全地移除这些废弃的兼容前向文件。
- 移除对应的 mock 测试文件。

## 2. 地图与格子信息 (Map & Grid Info)
**涉及文件**：`src/data/grid-cell-info.ts`
**当前现状**：使用硬编码的 `MOCK_BIOME_BY_KEY` 和 `MOCK_BIOME_ROTATE` 来模拟生物群系和地形名字，以及简单的障碍物判断（`障碍（mock 石块）`）。
**重构目标**：
- 接入真实的地图系统数据源。
- 根据真实的格子坐标获取对应的地形、地貌、通行状态等数据。
- 移除 mock 相关的硬编码字典和轮询逻辑。

## 3. 物品与库存系统 (Items & Inventory)
**涉及文件**：`src/data/ground-items.ts`
**当前现状**：使用固定的 `MOCK_SCATTERED_GROUND_ITEMS` 数组在地图左上角生成测试用的掉落物堆。
**重构目标**：
- 接入真实的物品/库存系统。
- 动态读取地图上各个坐标真实的掉落物数据（种类、数量等）。
- 移除临时固定的散落物配置。

## 4. 角色档案系统 (Pawn Profiles)
**涉及文件**：`src/data/pawn-profiles.ts`
**当前现状**：使用 `MOCK_PAWN_PROFILES` 字典为 `pawn-0` 到 `pawn-4` 提供虚构的称号（epithet）、简介（bio）、备注（notes）和标签（mockTags）。
**重构目标**：
- 接入真实的实体/角色系统。
- 角色的背景故事、性格标签、称号等应由角色的真实属性和经历动态生成或读取。
- 移除硬编码的 mock 档案字典。

## 5. UI 展示层 (HUD Manager)
**涉及文件**：`src/ui/hud-manager.ts`
**当前现状**：在渲染人物详情面板时，UI 文本中硬编码了带有 `（mock）` 字样的标签，如 `简介（mock）`、`备注（mock）`、`标签（mock）`。
**重构目标**：
- 配合角色档案系统的接入，移除 UI 模板中的 `（mock）` 字样。
- 确保 UI 组件能够正确绑定并响应真实角色数据的变化。

## 6. 指令与任务系统 (Tools & Tasks)
**涉及文件**：`src/data/task-markers.ts`, `src/data/villager-tools.ts`
**当前现状**：目前的工具栏和任务标记（如开采、伐木等）仅为纯视觉标记，未接入 AI 决策层。`mockIssuedTaskLabelForVillagerToolId` 将所有工具视为派发工作，但不向 `src/game/` 写入。
**重构目标**：
- 接入真实的工作/行为系统。
- 玩家下达的指令需要真正生成任务实体，并派发给 AI 决策层进行调度和执行，而不仅仅是在格子上显示一个视觉标记。
- 移除或收窄 `mockIssuedTaskLabelForVillagerToolId` 的逻辑，由领域层任务或工单列表驱动格子上标记。

## 7. 选区与区域系统 (Selection & Zone System)
**涉及文件**：`src/scenes/GameScene.ts` (选区逻辑部分), `docs/ai/systems/selection-ui/2026-04-05-floor-area-selection-foundation.md`
**当前现状**：目前的框选功能产生的 `selectedCellKeys` 仅存在于场景内存中，并直接被 `scene-hud` 的 mock 任务标记逻辑消费，尚未接入真实的区域类型系统（如存储区、种植区等）。
**重构目标**：
- 接入真实的区域/划区系统。
- 选区操作完成后，应根据当前激活的工具将 `selectedCellKeys` 转化为真实的区域数据或批量任务指令写入领域层。
- 保持 `selectedCellKeys` 的数据结构不变，平滑过渡到真实系统的消费逻辑。