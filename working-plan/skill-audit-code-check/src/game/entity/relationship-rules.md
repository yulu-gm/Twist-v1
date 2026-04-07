# 审计报告: src/game/entity/relationship-rules.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `assignBedToPawn` 在成功写入归属时通过 `ownershipAssigned` 将 `assignmentReason` 固定为 `"unassigned"`（见约第 330–331、405–410 行），无法在数据上区分「自动建成分配」「玩家手动指派」等来源；与 `ownershipUnassigned()` 在语义上同样落在 `assignmentReason: "unassigned"`，未体现「已分配」与「未分配」在原因字段上的差异。
- [依据]: `oh-code-design/建筑系统.yaml` 扩展点「床铺归属规则未来可替换为手动指派或优先级指派」及风险「若自动分配床铺不记录原因，后续玩家手动调整会难以兼容」（约第 96–101 行）。

- [指控]: 本文件仅校验床铺双向引用、物资 `containerKind`/`containerEntityId` 与携带 `carriedResourceId` 的闭环，未对 `ResourceEntity.reservedByPawnId`（`entity-types` 中「当前占用/预占」语义）与携带关系、容器关系做任何交叉校验；若存在预占与真实位置不同步，仅靠现有三个 `validate*` 无法暴露。
- [依据]: `oh-code-design/实体系统.yaml` 模块「关系一致性规则」职责（约第 47–50 行）及核心数据「物资实体」中与占用相关的字段设计意图；同文档风险「若实体关系与地图占用分别维护，容易出现位置与归属不一致」（约第 131 行）——占用/预占属关系维度的延伸。

- [指控]: `validateResourceLocation` 在 `containerKind` 为 `"zone"` 时只校验目标实体 `kind === "zone"`，未校验该区域是否为策划意义上的存储区（例如 `zoneKind` 等），与 `oh-gen-doc/实体系统.yaml` 中「物资-存储区」关系（约第 145–147 行）相比，容器类型与区域用途的约束未在设计层完全落地到规则代码（若业务上禁止非存储区当容器，则此处为缺口）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：文件中无 `mock`/`temp`/`TODO` 式临时分支；`validate*` 与 `assign*`/`unassign*` 均为当前领域语义下的实逻辑。多处对建筑/小人做浅拷贝再 `registry.replace` 属于不可变更新模式，不宜归类为「兼容旧系统的死代码」。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本文件仅依赖 `./entity-types` 与 `./entity-registry` 的类型与替换接口，未出现 UI、地图或直接绕过注册表的越权写路径。`oh-code-design/实体系统.yaml` 将「关系一致性规则」列为独立模块职责（约第 47–50 行），在此集中实现校验与床铺分配写回与模块命名一致。
- [备注（非罪证）]: 同一文件内并存「纯校验函数」与「多实体 `registry.replace` 编排」；若团队将 `oh-code-design/实体系统.yaml` 中「领域规则层」与「应用编排层」（约第 14–28 行）机械拆分为不同文件，可再讨论是否将 `assignBedToPawn`/`unassignBed` 上移至编排层——属风格/边界偏好，不构成已违反条文的铁证。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0083]: 扩展 `AssignmentReason`（或等价枚举）以区分「自动分配」「手动指派」「未分配」等，并在 `assignBedToPawn`、建筑系统建成回调、交互指派路径中写入一致的原因值，满足 `oh-code-design/建筑系统.yaml` 对可追溯归属来源的表述。
- [行动点 #0084]: 在关系一致性规则中增加针对 `reservedByPawnId` 的校验（及与工作队列/拾取路径协同的更新契约），使预占与 `containerKind`/`carriedResourceId` 不致长期分叉。
- [行动点 #0085]: 若策划确认只有存储类区域可作为物资容器，在 `validateResourceLocation`（或区域准入规则）中增加对 `zoneKind`（或存储能力标签）的校验，与 `oh-gen-doc/实体系统.yaml` 的「物资-存储区」语义对齐。
- [行动点 #0086]: 可选：将多实体 `replace` 编排与纯校验拆分为两个模块或命名空间，便于与 `oh-code-design/实体系统.yaml` 分层描述一一对应，便于测试与复用。

## 5. AP-0083～0086 核对结论（worktree `audit74-86-rel-dbf74597`）

- **AP-0083（已修复）**：`AssignmentReason` 扩展为 `"unassigned" | "auto-assigned" | "manual-assigned"`；`assignBedToPawn` 增加第四参数 `assignmentReason`（默认 `"manual-assigned"`）；建成自动分配在 `build-flow` 传 `"auto-assigned"`；`bed-auto-assign` 写入 `"auto-assigned"`；`unassign` / 空床仍为 `"unassigned"`。涉及：`entity-types.ts`、`relationship-rules.ts`、`build-flow.ts`、`bed-auto-assign.ts`、`entity/index.ts`、相关测试。
- **AP-0084（已修复）**：新增 `validateResourceReservation` 与违规类型，校验 `reservedByPawnId` 指向存在的小人，且在 `containerKind === "pawn"` 时与 `containerEntityId` 一致。涉及：`relationship-rules.ts`、`entity/index.ts`、`tests/domain/relationship-rules.test.ts`。
- **AP-0085（已修复）**：`validateResourceLocation` 在 `containerKind === "zone"` 且容器为 zone 时要求 `zoneKind === "storage"`，否则报 `resource-zone-container-not-storage`。涉及：`relationship-rules.ts`、测试同上。
- **AP-0086（已核对，无需改代码）**：报告原列为可选架构拆分；当前仍保持单文件集中校验与编排，与现有导出/测试习惯一致，不做仅为对齐 YAML 分层的文件拆分。
- **验证**：上述 worktree 上 `npx tsc --noEmit` 退出码 0；`vitest run` 已跑 `relationship-rules`、`build-flow`、`need-interrupt-during-work`、`apply-domain-command-lumber-selection` 相关用例通过。

**说明**：无单独「code-audit-4.6」Cursor SKILL 文件时，以 `.agent/tasks/code-audit-46-fix-all-action-points.yml` 中 AP 条目与本文第 4 节原文为准执行。