# 审计报告：`src/game/entity/`

**任务**：T-04（遗留 mock / 双轨 / 未文档化能力审计）  
**范围**：`src/game/entity/`（类型、注册表、生命周期、关系规则、world-core 投影、树木草案工厂）  
**对照文档**：`oh-gen-doc/实体系统.yaml`、`oh-acceptance/实体系统.yaml`  
**说明**：本文件只记录事实与差距，不改变任何源码。

---

## 一句结论

`src/game/entity/` 把「领域实体模型 + 确定性生命周期/关系规则」收拢在一处，并通过 `createGameplayTreeDraft` 与 `entity-projection` 分别对接 **WorldCore 的 `spawnWorldEntity`/草案** 与 **legacy `WorldEntitySnapshot` 消费方**；与策划 YAML 相比，类型与状态粒度更偏工程化，且 **`EntityRegistry` 主链路目前主要被领域单测与 `work-settler`/flow 辅助路径使用，场景与无头主路径仍以 WorldCore 实体图为事实源**，形成明显的双轨并存风险。

---

## 要解决什么问题（审计视角）

- **业务侧**：游戏中需要统一描述小人、物资、树、蓝图、建筑等实体，并在伐木落成木头、蓝图落成建筑、拾取/放下、床铺归属等事件上保持状态可预测、可验收。
- **工程侧**：还要兼顾仍消费 `WorldEntitySnapshot` 的占格/渲染链路，以及与世界核心的 `EntityDraft` spawn 约定一致（尤其是树）。
- **若不梳理**：容易出现「文档与验收写一套、WorldCore 里一套、Registry 里又一套」的重复实现；mock/场景数据与领域规则也会在树木生成等位置分叉。

---

## 设计上怎么应对（应然与现状偏差）

### 模块分工（现状简述）

| 文件 | 职责 |
|------|------|
| `entity-types.ts` | `GameEntity` 联合类型、`WorldEntitySnapshot`（与 world-core 对齐的只读条）、物资/区域等细分枚举 |
| `entity-registry.ts` | 内存注册表：`create`/`remove`/`replace`、按 kind/cell 查询、`snapshot()` 深拷贝领域快照 |
| `lifecycle-rules.ts` | 树→木头、蓝图→建筑、拾取、放下（均带失败分支 outcome） |
| `relationship-rules.ts` | 床铺双向一致、物资容器字段自洽、携带双向引用；`assignBedToPawn` / `unassignBed` |
| `entity-projection.ts` | `GameEntity` → `WorldEntitySnapshot`（注释写明 legacy / world-core 四类 kind 映射） |
| `gameplay-tree-spawn.ts` | `createGameplayTreeDraft`：`EntityDraft` 统一树的几何与 `occupiedCells` |
| `index.ts` | 对外再导出 |

### 对照 `oh-gen-doc/实体系统.yaml`

以下按策划文档中的实体类型与关系，逐条对照**本目录代码承载情况**（✓ 有对应 / ≈ 部分对应 / ✗ 缺口或明显不一致）。

| 策划条目 | 代码侧对应 | 备注 |
|----------|------------|------|
| **小人**：位置、状态（漫无目的散步 / 执行工作 / 满足需求）、携带物、饱食度、精力值、所属床铺 | `PawnEntity`：`cell`、`behavior`/`currentGoal`（来自 `pawn-state`，非策划枚举名）、`carriedResourceId`、`satiety`/`energy`、`bedBuildingId` | ≈ 状态命名与分层与 YAML 不完全同构 |
| **小人行为能力**（移动、各类工作、拾取搬运、进食、休息等） | 本目录**不**承载行为树，仅类型与携带/床铺字段 | ✓ 边界合理；策划「行为能力」在别模块 |
| **物资**：类型（初始物资/木头/包装食品）、位置、所属存储区、可拾取状态；散落/存储/携带状态 | `ResourceEntity`：`materialKind`（`wood`/`food`/`stone`/`generic`）、`cell`、`containerKind`+`containerEntityId`、`pickupAllowed`；**无**与策划一一对应的「初始物资」枚举名 | ≈ 语义接近，枚举与容器模型是工程化超集 |
| **树木**：位置、伐木状态（正常/已标记/伐木中） | `TreeEntity`：`loggingMarked`、`occupied` 布尔 | ✗ 未建模三态枚举，信息与策划不对称 |
| **建筑蓝图**：类型（墙/床）、位置、进度、状态（等待建造/建造中） | `BlueprintEntity`：`blueprintKind`、`buildProgress01`、`buildState`（`planned`/`in-progress`/`completed`） | ≈ 英文状态机命名 |
| **建筑实体（墙/木床）**：木床所有者 | `BuildingEntity`：`buildingKind`、`ownership` | ✓ 与「木床—小人引用」一致 |
| **实体关系**：小人—物资、小人—树、小人—蓝图、小人—木床、物资—存储区 | `lifecycle-rules` + `relationship-rules` 覆盖拾取/携带/床归属；**放下到存储区并绑定存储区引用**不在 `dropResource` 内完成（仅 `ground`） | ≈ 与「关系」相关的**部分**在本目录，存储区绑定在上层/WorldCore 侧 |
| （策划未写）**区域 Zone**、**障碍 obstacle**、**miningMarked** 等 | `ZoneEntity`、`WorldEntitySnapshot` 字段扩展 | 孤立/扩展能力相对 `实体系统.yaml`：属**未在本文档记载的工程扩展** |

### 对照 `oh-acceptance/实体系统.yaml`

| 场景 ID | 验收摘要 | 本目录规则是否直接覆盖 | 差距说明 |
|---------|----------|------------------------|----------|
| **ENTITY-001** 树伐木完成→木头，散落且**未**标记可拾取 | `transformTreeToResource` 移除树并创建 `materialKind: wood`、`containerKind: ground` 的资源 | 部分 | 代码创建资源时 **`pickupAllowed: true`**，与验收「未被标记可拾取」**冲突**（策划 gen-doc 里木头生成是否默认可拾取表述亦需统一口径） |
| **ENTITY-002** 拾取→携带→放下到存储区，领域状态含存储区引用与存储状态 | `pickUpResource` / `dropResource` | 部分 | `pickUpResource` 与「携带」一致；**`dropResource` 仅落到 `ground`，不写入 `zone`/`building` 容器或存储区引用**，与验收「放下到存储区」不全在同一函数内完成 |
| **ENTITY-003** 蓝图 100%→建筑，并更新占用阻挡 | `transformBlueprintToBuilding` | 部分 | 注册表内替换实体完成；**占用管理器阻挡更新**不在本目录（验收表述靠其它模块） |
| **ENTITY-004** 关系一致性拦截非法变更 | `validateCarrying`、`validateResourceLocation`、`validateBedOwnership` 及 lifecycle 前置检查 | 规则存在 | 若运行时主路径不经过 `EntityRegistry`，这些校验是否总在生产路径执行，需与 WorldCore 主流程对照（属**双轨**风险，见下节） |

### 多套并行（与场景 / mock 相关的重复链路）

1. **WorldCore `EntityDraft` ↔ 领域 `GameEntity`**  
   场景载入、随机播种、无头 hydrates 使用 `spawnWorldEntity(world, draft)`；树统一经 `createGameplayTreeDraft`（`world-seed-entities.ts`、`scenario-loader.ts`、`scenario-runner.ts`）——**树木生成未重复实现三份逻辑，这是正向去重**。  
   但 **WorldCore 内实体图**与 **`EntityRegistry` 内实体图**仍是两套容器；`entity-projection` 注释即承认 **legacy `WorldEntitySnapshot`** 形状，属于显式桥接层。

2. **`settleWorkSuccess` / `lifecycle-rules` 与主游戏路径**  
   `work-settler` 消费 `EntityRegistry`；`runChopFlowScenario` / `runBuildFlowScenario` 仅见于 **domain 测试**引用。无头 `src/headless` 不引用 `EntityRegistry`。  
   结论：**同一批验收意图（伐木、建造结算）在「Registry 纯函数路径」与「WorldCore 场景路径」上可能分岔**，属于 README 所述「多套并行」高风险项，而非 `src/game/entity/` 单目录能单独消除。

3. **同名概念不同快照**  
   `entity-registry.ts` 内部有 `toReadonlySnapshot` → `ReadonlyEntitySnapshot`（领域快照）；`entity-projection.ts` 导出 `toReadonlySnapshot` → `WorldEntitySnapshot`。命名并列但含义不同，阅读与检索时易混淆（叠加 **`WorldEntitySnapshot` 声明在 `entity-types`、与 world-core 声明强绑定**）。

---

## 代码里大致怎么走

- **入口**：对外 API 见 `index.ts`；渲染与任务标记等多处仅引用 `entity-types` 中的 `WorldEntitySnapshot` 等类型。  
- **生成树**：统一工厂 `createGameplayTreeDraft` → 仅供 `spawnWorldEntity` 使用，保证 `occupiedCells` 与「领域认树」一致（文件头注释目标）。  
- **状态变更**：业务上「安全写注册表」走 `lifecycle-rules` / `relationship-rules`；失败用 outcome，成功用 `replace`/`create`/`remove`。  
- **一致性**：`relationship-rules` 提供批量 `validate*`，供测试或编排层调用（**否在每帧自动调用需看调用方**）。  
- **投影**：`entity-projection` 将 `resource`/`tree`/`zone` 压成 world-core 的 `obstacle` 等，与 gen-doc 的「六种原型」叙述不完全同构。

---

## 尚不明确或需要产品/策划拍板的地方

- **ENTITY-001 与 `transformTreeToResource` 的 `pickupAllowed` 默认值**：验收写「不可拾取」，实现写 `true`；需统一策划口径（伐木掉落物是否默认需玩家再标记才可拾取）。  
- **树木「伐木三态」是否必须进入领域模型**：当前布尔组合能否覆盖验收叙事，或是否应显式枚举以满足档期与 QA 表述一致。  
- **单一事实源**：`EntityRegistry` 与 `WorldCore.entities` 长期并存的策略——是否以 WorldCore 为唯一真理、Registry 仅测试/过渡，或逐步双向同步，需要架构层面定稿（超出本目录但能解释大量「规则写了却未必在主线执行」的疑虑）。  
- **物资类型命名**：`generic`/`stone` 等与 gen-doc「初始物资」等命名映射是否在策划表中维护。

---

## 问题清单（按 README 三类打标）

| # | 类型 | 简述 |
|---|------|------|
| P-1 | **多套并行** | WorldCore 实体状态与 `EntityRegistry` 并行；`settleWorkSuccess` 等 Registry 路径与无头/场景主路径不对齐，易导致「规则实现了但主线不走」或双向漂移。 |
| P-2 | **多套并行**（较弱） | `GameEntity` 与 `WorldEntitySnapshot` / `EntityDraft` 三套形状；`entity-projection` 为桥但增加心智负担。 |
| P-3 | **无用兼容 / 历史包袱 倾向** | `entity-projection` 标明 legacy；若 startup-ideal-state 要求收敛，需规划删除条件与调用方迁移（当前仍被类型系统广泛依赖）。 |
| P-4 | **孤立需求 倾向** | `WorldEntitySnapshot`/`WorldEntityKind` 上的 `miningMarked`、`obstacle`、多种 `zoneKind` 等，在 `oh-gen-doc/实体系统.yaml` 中未逐条展开，属工程扩展，建议补文档或标为 out-of-scope。 |
| P-5 | **文档/验收 vs 实现 不一致** | ENTITY-001 可拾取预期与 `transformTreeToResource`；ENTITY-002「存储区绑定」与 `dropResource` 职责切分——需产品确认是改文档、改实现分层，还是验收拆步骤。 |
| P-6 | **命名 / 可维护性** | 两处 `toReadonlySnapshot` 不同返回类型；检索与 onboarding 成本高。 |

---

## 构建校验备注

- 截至本次审计，执行 `npx tsc --noEmit` 时仓库基线仍存在若干与 `src/game/entity/` **无关**的既有报错（如 `sim-loop`、`hud-manager`、tests 等）。**本次任务未修改源码，未引入针对 entity 目录的新报错。**
