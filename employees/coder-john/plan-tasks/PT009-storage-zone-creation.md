# PT009: 存储区划定与实体注册

## 目标
实现玩家通过指令菜单划定“存储区”的功能，将玩家在 UI 上的框选操作转化为实体系统中的 `ZoneEntity`，并在地图上提供对应的视觉反馈。

## 现状与背景
- 在 `command-menu.ts` 中已经定义了 `"zone.storage.create"` 指令。
- `EntityRegistry` 中已经定义了 `ZoneEntity` 及对应的注册/移除方法。
- 目前 `GameScene` 中 `applyTaskMarkersForSelection` 主要处理任务标记，尚未处理区域（Zone）的创建逻辑。
- 存储区是资源搬运循环（Hauling）的终点，必须先有存储区，小人才能将拾取的物资搬运过去。

## 执行计划
1. **扩展选区处理逻辑**：
   - 在 `GameScene.ts` 或专门的区域处理模块中，拦截 `"zone.storage.create"` 的选区操作。
   - 校验玩家框选的格子（`cellKeys`）：过滤掉已被占用（如树木、岩石、建筑物）的格子，仅保留合法的空地。
2. **注册 ZoneEntity**：
   - 将合法的 `cellKeys` 聚合成一个或多个 `ZoneEntity`（`zoneType` 使用代码中的 **`ZONE_TYPE_STORAGE`（`"storage"`）**，与 PT015 投放寻址一致）。
   - 调用 `EntityRegistry.registerZone` 将其注册到实体系统中。
   - （可选）如果玩家框选的区域与已有存储区相邻，可以考虑合并，或简单处理为独立的 Zone。
3. **区域的视觉反馈**：
   - 在 `GameScene.ts` 中新增区域渲染层（如 `zoneGraphics`）。
   - 遍历 `EntityRegistry.listEntitiesByKind("zone")`，为每个存储区的格子绘制半透明的背景色或边框（如半透明的蓝色），以便玩家直观地看到存储区的位置和范围。
4. **区域的取消/删除（可选但建议）**：
   - 如果指令菜单中有取消区域的工具，实现对应的 `removeZone` 逻辑（可根据当前格子反查 ZoneId 并移除）。

## 验收标准
- [ ] 玩家选择“区域-存储区-新建”并在地图上框选空地后，能够成功创建存储区。
- [ ] 包含树木、岩石等障碍物的格子不会被纳入存储区。
- [ ] 划定的存储区在地图上有清晰的视觉反馈（如半透明色块）。
- [ ] 实体系统中能正确查看到新增的 `ZoneEntity` 数据。
- [ ] 运行 `npm run build` 无编译错误。
