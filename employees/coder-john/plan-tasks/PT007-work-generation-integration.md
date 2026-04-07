# PT007: 将玩家标记操作接入工作生成系统

## 目标
将玩家在 UI 上框选的“伐木”、“开采”、“拾取”标记，同步至实体系统，并自动在工作目录中生成对应的待处理工单（WorkOrder）。

## 现状与背景
- 目前 `GameScene` 中已经能通过 `applyTaskMarkersForSelection` 记录玩家的框选标记（`taskMarkersByCell`）。
- `EntityRegistry` 中定义了树木和岩石的 `lumberMarked` / `miningMarked` 状态。
- `work-generation.ts` 已经实现了 `generateFellingWork` 和 `generateMiningWork`，但尚未被调用。
- 尚未实现拾取（Pickup）的工单生成逻辑。

## 执行计划
1. **扩展实体定义**：
   - 在 `MaterialEntity` 中新增 `pickupMarked?: boolean` 字段（或复用已有机制），用于记录该物资是否被玩家标记为需要拾取/搬运。
2. **完善工作生成逻辑**：
   - 在 `work-generation.ts` 中新增 `generatePickupWork` 方法，为被标记的地面物资生成 `WORK_TYPE_PICKUP` 工单。
3. **实现标记同步层**：
   - 新增逻辑（如 `sync-task-markers.ts` 或在 `work-generation.ts` 中扩展），负责遍历 `taskMarkersByCell`，将标记状态（伐木、开采、拾取）同步更新到 `EntityRegistry` 中对应的实体上（`TreeEntity`, `RockEntity`, `MaterialEntity`）。
   - 同步完成后，对被标记且未被占用的实体，调用对应的 `generateXxxWork` 函数，将工单注册到 `WorkRegistry`。
   - 当玩家取消标记时，如果有对应的 pending 工单，应将其取消（或在后续领取时校验标记失效）。
4. **接入场景**：
   - 在 `GameScene.ts` 中，当玩家完成选区操作并更新 `taskMarkersByCell` 后，触发上述同步与工作生成逻辑。

## 验收标准
- [ ] 玩家在地图上框选树木/岩石/物资后，`EntityRegistry` 中对应实体的标记状态能正确更新。
- [ ] 标记后，`WorkRegistry` 中能查看到新生成的 `pending` 状态的伐木/开采/拾取工单。
- [ ] 玩家取消标记时，实体的标记状态能正确清除（对应未领取的工单应被移除或失效）。
- [ ] 运行 `npm run build` 无编译错误。
