# PT013：基于实体的需求交互（下）—— 交互执行接入与旧系统清理

## 需求依据（oh-gen-doc）

- `oh-gen-doc/行为系统.yaml`：小人与实体交互后，应正确改变实体状态（如消耗物资）并恢复自身需求。
- `oh-gen-doc/地图系统.yaml`：地图网格仅负责空间坐标与寻路阻挡，不应耦合具体的业务交互逻辑。

## 现状（代码）

- `src/game/sim-loop.ts` 中的预占逻辑使用的是 `reserveInteractionPoint` 和 `releaseInteractionPoint`。
- 交互完成后的需求恢复逻辑依赖于 `InteractionPoint` 上的静态配置。
- `src/game/world-grid.ts` 仍残留 `InteractionPoint` 的类型定义和硬编码数组。
- `src/scenes/GameScene.ts` 和 `src/scenes/renderers/grid-renderer.ts` 仍在渲染这些 Mock 的交互点方块。

## 目标话题（单一）

**在主循环中接入基于实体的预占、消耗与需求恢复逻辑，并彻底清理移除旧的 `InteractionPoint` 系统及其渲染代码。**

## 实现要点

1. **重构模拟主循环与交互执行 (`src/game/sim-loop.ts`)**
   - **预占逻辑**：废弃 `reserveInteractionPoint` / `releaseInteractionPoint`。当小人确定目标后，调用 `EntityRegistry` 锁定该实体（如更新实体的 `reservedByPawnId`）。
   - **交互结算 (`processPawnAction`)**：
     - **吃完食物**：恢复小人饥饿值，调用 `registry.updateMaterial` 将该食物的 `quantity` 减 1。若归零则调用 `registry.removeMaterial` 销毁实体。
     - **睡醒/玩完**：恢复对应的需求值，并解除对建筑实体的预占。
   - **异常打断**：若小人寻路途中目标实体被销毁（如食物被别人吃光），需打断当前 Action，重新触发规划。

2. **清理旧系统 (`src/game/world-grid.ts`)**
   - 彻底删除 `InteractionPoint`、`InteractionPointKind` 类型定义。
   - 从 `WorldGridConfig` 和 `DEFAULT_WORLD_GRID` 中移除 `interactionPoints` 数组。
   - 删除相关的辅助函数（如 `findInteractionPointById` 等）。

3. **清理渲染层 (`src/scenes/GameScene.ts` & `grid-renderer.ts`)**
   - 删除 `drawInteractionPoints` 相关的绘制逻辑。
   - 确保新生成的实体（床、娱乐设施、食物）能被现有的实体渲染器（如 `ground-items-renderer.ts` 和建筑渲染逻辑）正确接管显示。

## 非范围

- 本计划不涉及将需求交互包装为通用的 `Work` 任务（可选的进阶重构），仅聚焦于打通实体交互闭环并清理旧代码。

## 验收标准

- 小人能够走到实体处，正确消耗食物物资（数量减少/消失），并在床/娱乐设施处正确恢复需求。
- `InteractionPoint` 相关代码和类型被彻底从项目中移除。
- 画面中不再有旧版的 Mock 交互点方块，所有交互对象均作为真实实体渲染。
