# 审计：`src/game/map/`

对照文档：`oh-gen-doc/地图系统.yaml`、`oh-acceptance/地图系统.yaml`（本文下方逐条引用其章节语义，不展开全文）。

---

## 一句结论

`src/game/map` 把「格子几何 + 可走性 + 选区矩形工具函数 + 占用表 + 存储区分组与校验」收在领域层，并与 `world-seed*.ts` 一起负责**障碍实体播种**与**树木/地面食物资源实体播种**；同时 `world-grid.ts` 内嵌的 **`DEFAULT_WORLD_GRID.interactionPoints`（食物单点、双床样板、双娱乐点）是目标驱动原型数据**，在文档化的「地图系统」里**没有同级描述**，且与 `seedInitialTreesAndResources` 播下的地面食物（默认不可拾取）、以及 `world-sim-bridge.simulationInteractionPoints` 里对「可拾取地面食物」的合成逻辑形成**多条并行线索**。与 `oh-gen-doc/地图系统.yaml` 的「地图初始化」相比：**树木与散落式资源实体**有落点，**小人醒来**不在本目录；与 `oh-acceptance/地图系统.yaml` 的 **MAP-002～004** 在占用/区域校验、格集合裁剪上**大体可支撑**，**MAP-001** 的本目录仅覆盖网格与种子子集，完整验收还依赖编排与世界核。

---

## 要解决什么问题（审计视角）

从 `oh-gen-doc/地图系统.yaml` 出发，策划侧关心的是：地图格与可走性、存储区与选区、初始化时小人/物资/树木的安排与占用表达。从 `oh-acceptance/地图系统.yaml` 出发，验收关心的是：开局网格与实体分布（**MAP-001**）、存储区创建（**MAP-002**）、建筑占格冲突（**MAP-003**）、越界选区裁剪（**MAP-004**）。

本目录代码**直接服务**前几项中的「格与集合」「占用」「存储区实体侧工具」；**未完整覆盖**「小人生成/醒来」及「仅文档层面的选区 UI 全流程」。另外，任务要求重点看的**种子实体、床与 mock 食物/娱乐点**：在实现上分裂为（a）配置里的固定 `interactionPoints`、（b）世界里的 `resource`（地面食物）、（c）同步层把部分资源提升为「食物交互点」——这与**单一事实来源**的地图叙述之间存在张力，需要在问题清单里拆开。

---

## 设计上怎么应对（文档应然 vs 代码现状）

### 对照 `oh-gen-doc/地图系统.yaml`

- **「地图格 / 可通行」**（文档字段：坐标、包含实体、状态可通行等）：`world-grid.ts` 的 `WorldGridConfig`、`isWalkableCell`、`blockedCellKeys` 与 `coordKey` 等对应「可走性由阻挡集合决定」；实体是否在某格由 `WorldCore`/注册表侧维护，本目录不直接维护「格内实体列表」——与文档「地图格包含实体」的**数据模型粒度**不完全同构，但可通过查询实体注册表达到类似效果。
- **「区域系统 · 存储区」**（名称、覆盖格、存储物资等）：`zone-manager.ts` 的 `createZone` / `validateZoneCells`、`storage-zones.ts` 的存储区分组与空位查找，与文档中存储区「一组格 + 物资约束」的方向一致；**物资在区内的堆叠/过滤**在 `storage-zones` 里用 `resource` + `containerKind: "zone"` 表达。
- **「选区工具」**（框选矩形、`oh-gen-doc` 中应用场景含存储区、拾取标记、伐木等）：本目录提供 `rectCellsInclusive` / `rectCellKeysInclusive` / `gridLineCells` 等**几何级**工具；业务语义（标记可拾取等）不在 `map/` 内闭环。
- **「地图初始化 · 物资分布 / 树木分布」**（文档：**初始物资散落、未标记可拾取**；树木正常）：`world-seed-entities.ts` 的 `seedInitialTreesAndResources` 用 `createGameplayTreeDraft` 种树，并向可行走格播种 `kind: "resource"`、`materialKind: "food"`、`containerKind: "ground"`、**`pickupAllowed: false`**，与文档「散落且未标记可拾取」**在字面上对齐**。**小人从地图醒来、白天**等不在本目录实现。

### 对照 `oh-acceptance/地图系统.yaml`

- **MAP-001**（网格可走、小人落在有效格、物资与树木占用、渲染）：本目录提供默认网格与种子函数；**小人落位与渲染**不在 `src/game/map`。
- **MAP-002**（合法选区 → 存储区对象、格列表、初始空存储）：`validateZoneCells` + `createZone` 提供领域侧基础；是否与 UI 模式严格串起来属场景/玩家层。
- **MAP-003**（阻挡占用上不可放置建筑）：`occupancy-manager.checkPlacement` / `findBlockingOccupant` 与验收语义一致；树/墙等是否一律写入占用由调用方约定（`world-sim-bridge` 还把树/蓝图算进不可走集合，见交叉线索）。
- **MAP-004**（越界选区过滤）：`rectCellsInclusive` 对每个候选格调用 `isInsideGrid`，**越界格不会进入结果集**，与验收「剔除无效坐标」一致。

---

## 代码里大致怎么走（入口与协作）

- **`world-grid.ts`**：`DEFAULT_WORLD_GRID` 含默认尺寸、出生格、`interactionPoints`（注释写明**固定交互点样板，用于目标驱动原型**）。提供邻格、像素↔格、`interactionPointsByKind`、交互点预订 `reserveInteractionPoint` 等。
- **`world-seed.ts`**：`seedBlockedCellsAsObstacles` 按 `blockedCellKeys` 生成 `obstacle` 实体（如石料 `label: "stone"`）。
- **`world-seed-entities.ts`**：在已播种障碍后追加随机数量的树与地面食物 `resource`（不可拾取），注释写明与障碍播种顺序衔接。
- **`occupancy-manager.ts`**：格键占用表、`occupy`/`release`、`checkPlacement`。
- **`zone-manager.ts` / `storage-zones.ts`**：区域创建校验、按正交邻接合并存储区组、查找可存放格等。
- **与目录外交互（任务关心的「床 + mock 食物/娱乐」）**：`src/game/world-sim-bridge.ts` 的 `simulationInteractionPoints` 将模板中非床点、**模板床**、世界中 **`restSpots` 床**、以及 **`pickupAllowed === true` 的地面食物资源** 拼成寻路/AI 使用的交互点列表；因此 **地图配置里的 `food-1` 与种子播下的地面食物** 并不是同一套 id 与启用条件。`GameScene.cleanupRuntimeBeforeNextScenario` 会把 `interactionPoints` 重置为 `DEFAULT_WORLD_GRID` 的拷贝（注释解释与 YAML 场景切换、随机石格冲突相关），随后由 `syncWorldGridForSimulation` 再与世界对齐。

---

## 尚不明确或需要产品/策划拍板

1. **`oh-gen-doc/地图系统.yaml` 是否应增加「交互点 / 休息点 / 进食点」条目**：当前策划地图文档强调格、区、选区与初始化物资/树，**未描述** `InteractionPointKind`（`food` | `bed` | `recreation`）及默认样板坐标；若长期保留，宜迁入文档或标为**纯开发原型**并限制使用场景。
2. **「地面食物」究竟是资源实体、交互点、还是二者组合态**：现在存在模板食物点、不可拾取播种物、可拾取才生成的动态食物点三条路径，**玩家可见文案与验收用例**需在 `oh-acceptance/地图系统.yaml` 或后续行为验收中写清期望。
3. **模板床与建筑床是否长期并存**：`simulationInteractionPoints` 同时保留 `templateBeds` 与 `world-rest-*`，若产品上只有「建成的床」可睡，模板床是否应退场需拍板。
4. **`src/data/ground-items.ts`（`MOCK_SCATTERED_GROUND_ITEMS`）与 `WorldCore` 地面 `resource` 的关系**：地面物品渲染走实体（`ground-items-renderer`），而格子信息里仍可查静态 mock（`grid-cell-info` 使用 `groundItemAt`）——**是否允许两套散落物叙事长期并行**，不由本目录单独决定，但与「地图初始化」文档叙事强相关。

---

## 问题清单

| # | 摘要 | 类型（见 `working-plan/remain-old-code-check/README.md`） | 说明与文档对照 |
|---|------|----------------|---------------|
| P1 | `DEFAULT_WORLD_GRID.interactionPoints` 含食物/双床/双娱乐固定坐标 | **孤立需求** | `oh-gen-doc/地图系统.yaml` 未定义该类「样板点」；`world-grid.ts` 注释已承认目标驱动原型用途。 |
| P2 | 食物需求相关存在「模板交互点 / 播种 ground resource / 仅 pickupAllowed 为 true 才进入 simulation 列表」三条路径 | **多套并行** | 对照 `oh-gen-doc/地图系统.yaml`「物资分布」仅描述散落与可拾取标记，代码拆分细于文档；易与 `oh-acceptance/地图系统.yaml` **MAP-001** 的「物资」展示与行为预期产生歧义。 |
| P3 | 床位：`templateBeds` 与 `restSpots` 动态床 id 同时存在 | **多套并行 / 待策划** | 与 `oh-gen-doc/地图系统.yaml` 未写「床位来源」有关；若仅保留建筑床，模板床属历史样板。 |
| P4 | 娱乐点仅在模板 `interactionPoints` 中出现 | **孤立需求** | `oh-gen-doc/地图系统.yaml` 无「娱乐设施/点」；若玩法依赖，应补文档与验收。 |
| P5 | `world-bootstrap` 石格用 `Math.random()`、装饰用固定 `terrainDecorationSeed` | **设计一致性** | 与「同局可复现」诉求是否一致需产品确认；不直接违背 `oh-gen-doc/地图系统.yaml`，但影响 **MAP-001** 的可重复性期望。 |
| P6 | 静态 `MOCK_SCATTERED_GROUND_ITEMS` 与领域 `resource` 播种并存 | **多套并行**（跨 `src/data`，场景侧展示策略） | `oh-gen-doc/地图系统.yaml` 的初始化物资应以哪套为准未在本文档层写清。 |

---

*本报告仅审计 `src/game/map/`，交叉引用 `src/game/world-sim-bridge.ts`、`src/game/world-bootstrap.ts`、`src/scenes/GameScene.ts`、`src/data/ground-items.ts` 用于说明重复线索；未修改任何源码。*
