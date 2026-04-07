# PT006-场景树木与石块格写入实体登记簿

## 1. 计划目标

依据 `oh-code-design/实体系统.yaml` 中 **树木实体**、**岩石实体** 及 **实体目录** 的职责，以及 `oh-code-design/地图系统.yaml` **「初始地图快照」** 中与 **初始树木分布**、**初始岩石分布** 对应的意图：将 `GameScene` 在 `create()` 阶段已确定的 **树格集合**（`treeCellKeys`）与 **石块格集合**（生成 `worldGrid` / 绘制石块所用的 `stoneCells`）同步为 `EntityRegistry` 内的 `TreeEntity` / `RockEntity`，使登记簿与当前场景空间布局一致。

本计划话题单一：**只做「场景静态格 → 实体登记」的启动同步与稳定 ID 策略**，不接伐木/开采任务标记回调、不调用 `work-generation`、`EntityLifecycle`，不实现占用或路径模拟。

## 2. 工作内容

1. **纯函数或 `EntityRegistry` 方法（优先放 `src/game/`，与 Phaser 无关）**  
   - 输入：`EntityRegistry`、树格 `ReadonlySet<string>`（coord key）、岩石格 `ReadonlyArray<GridCoord>` 或等价 key 集合（与 `GameScene` 现有 `stoneCells` 数据来源一致）。  
   - **树木**：对每个树格注册一条 `TreeEntity`：`lumberMarked: false`、`occupied: false`，**id 稳定**（例如 `tree:${cellKey}`），`cell` 由 key 解析。  
   - **岩石**：对每个石块格注册一条 `RockEntity`：`miningMarked: false`、`occupied: false`，**id 稳定**（例如 `rock:${cellKey}`）。  

2. **与已有登记内容共存**  
   - `createSeededEntityRegistry()` 已含物资与小人档案；同步时 **仅增删改树/岩映射**，不清空物资与小人类别。  
   - 若树/岩集合相对上一轮发生变化（例如未来重.roll 世界）：先移除登记簿中不再出现在新集合内的树/岩（按 `listEntitiesByKind("tree" | "rock")` 与 cellKey 比对），再补齐新格；当前若仅在 `create` 调用一次，可实现为 **幂等全量对齐**（删旧迎新）以避免重复注册。

3. **场景接入**  
   - 在 `GameScene.create()` 中，在 `initTreeCellKeys()` 与 `stoneCells` / `worldGrid` 就绪之后，调用上述同步；保证 `drawGroundItemStacks`、hover 等与 registry 交叉的路径在首帧即能看到树/岩实体（若某渲染层仍只读 `treeCellKeys`，本计划 **不要求** 删除 `treeCellKeys`，仅追加登记簿真源）。  

4. **禁止范围**  
   - 不修改 `applyTaskMarkersForSelection`、不在此计划内根据标记调用 `generateFellingWork` / `generateMiningWork`。  
   - 不改变石块格是否阻挡行走的规则（仍由 `worldGrid` 表达）。

## 3. 验收标准

- `EntityRegistry.listEntitiesByKind("tree")` / `("rock")` 的数量与格集合一致，且每条 `cell` 与场景树格/石块格一一对应；id 稳定可预测（便于后续计划从格或 id 接单）。  
- `npm run build` 编译通过。  
- 与 PT005 分工清晰：PT005 负责「已标记实体 → 工单」；本计划保证「场景里有哪些树/岩实体」在登记簿中存在。
