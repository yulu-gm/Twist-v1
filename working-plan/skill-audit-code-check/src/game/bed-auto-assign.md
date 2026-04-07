# 审计报告: src/game/bed-auto-assign.ts

## 1. 漏做需求

- [指控]: 自动分配仅写入 `restSpots[].ownerPawnId` 与床建筑的 `ownership.ownerPawnId`，**未**同步更新对应小人实体上的 `bedBuildingId`。
- [依据]: `oh-code-design/实体系统.yaml` 在关系与数据职责中要求维护「小人与床铺」等归属关系；`oh-gen-doc/建筑系统.yaml`「床铺分配机制」描述的是小人与床的归属关系，应可被行为/需求侧消费。仓库内 `src/game/entity/relationship-rules.ts` 中 `assignBedToPawn` 的契约明确为「更新建筑 `ownership` 与 `pawn.bedBuildingId`」，且 `validateBedOwnership` 校验二者双向一致；`src/game/flows/night-rest-flow.ts` 依赖 `pawn.bedBuildingId` 判断夜间是否进入归宿。当前 `completeBlueprintWork`（`work-operations.ts`）落成木床后依赖本文件在每 tick 补分配，会造成「床已记 owner、小人未记床」的中间态，与上述设计/校验/流程不一致，属于归属数据未写全。

- [指控]: 「尚未拥有床铺的小人」的判定仅基于已有 `restSpot.ownerPawnId` 集合，**未**以实体注册表中 `pawn.bedBuildingId` 为权威来源；若未来出现 restSpot 与建筑 ownership 不同步，可能与 `归属规则器`/「一张床一名小人」规则产生分歧。
- [依据]: `oh-code-design/建筑系统.yaml` 模块「归属规则器」职责为管理木床与小人的分配关系；`oh-gen-doc/建筑系统.yaml` 约定每张床最多归属一名小人。与 `assignBedToPawn` 以 registry 为准的选人与冲突消解相比，本实现仅用 sim 传入的 `PawnState` 列表与 restSpot 扫描，缺少与设计文档中实体层归属模型对齐的单一事实来源。

- [指控]: 策划文档写明的触发时机为「新的床铺建造完成时」，本实现为 orchestrator 在每帧进度结算后**全量扫描**所有无主床位；功能上可兜底落成路径，但与文档表述的**事件驱动**时机不一致（见下节架构）。

- [依据]: `oh-gen-doc/建筑系统.yaml` 床铺分配机制 · 自动分配 · `触发时机: 新的床铺建造完成时`。`oh-code-design/建筑系统.yaml` 关键流程「建成后床铺分配」步骤为木床建造完成 → 归属规则器筛选 → 生成归属结果。

## 2. 无用兼容与 Mock

- 未发现文件内 `mock`、`temp`、`TODO` 或明显测试桩代码。
- [说明]: 本模块与 `build-flow` 中已调用的 `assignBedToPawn` 形成**并行分配路径**——主模拟链路通过「落成无 owner 床 + 每帧 `assignUnownedBeds`」修补，而非统一走实体关系层的同一入口；易形成双轨维护，符合技能所描述的「新/旧路径并存、旁路未收口」类技术债特征（虽非字面 Mock）。

## 3. 架构违规

- [指控]: 床铺归属变更未走实体系统已提供的 `assignBedToPawn`（含解除旧床、清理冲突等），而在本文件内直接 `upsertEntityMutable` 改写床体，**旁路化**了 `relationship-rules` 与 `EntityRegistry` 上的归属契约。
- [依据]: `oh-code-design/建筑系统.yaml` 将「归属规则器」置于建筑系统模块边界；`oh-code-design/实体系统.yaml` 强调关系变化与防不一致。现有代码在 `game-orchestrator` 的 tick 中调用本函数（见 `game-orchestrator.ts` 对 `assignUnownedBeds` 的引用），把**归属规则器**职责挂在了编排层每帧扫尾，而非「建成结算 / 工作完成回报」输入驱动的建筑结果层，违反设计文档中的分层与接口边界描述（输入应包含来自工作系统的建造完成回报）。

- [指控]: `assignmentReason` 在建筑实体侧被**写死**为 `"unassigned"`（第 63 行），未利用设计文档对「记录分配原因」的风险提示做可扩展区分（例如建成自动分配 vs 其他来源）；`restSpot` 上虽保留 `spot.assignmentReason`，但与建筑侧恒为 `unassigned` 的组合语义未在设计层闭环。

- [依据]: `oh-code-design/建筑系统.yaml` 风险条款：「若自动分配床铺不记录原因，后续玩家手动调整会难以兼容」。

## 4. 修复建议

- [行动点 #0018]: 将「无主床 → 选人 → 写归属」收敛为调用 `assignBedToPawn`（或抽取与其共享的核心实现），确保每次分配同时更新 `ownership` 与 `pawn.bedBuildingId`，并与 `validateBedOwnership` 预期一致。
- [行动点 #0019]: 在 `completeBlueprintWork`（或唯一木床落成出口）触发分配，使触发时机与 `oh-gen-doc`「新床建成」一致；每帧全量扫描仅作为可选兜底或调试路径，避免长期双轨。
- [行动点 #0020]: 「无床小人」筛选改为以实体注册表 `pawn.bedBuildingId`（及/或 `assignBedToPawn` 所用规则）为准，与 `build-flow` 中 `pickPawnWithoutBed` 策略对齐，避免 restSpot 与实体字段两套判定。
- [行动点 #0021]: 若需保留 `assignmentReason` 供后续手动调整，为「系统自动首配」定义独立枚举值或元数据，使建筑实体与 `restSpot` 快照语义一致，回应 `oh-code-design/建筑系统.yaml` 中的可维护性风险。