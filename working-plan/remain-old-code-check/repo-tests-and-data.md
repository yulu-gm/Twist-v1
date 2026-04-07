# 审计：仓库根目录 `tests/` 与 `data/`

对照文档：九份验收 YAML 位于 `oh-acceptance/`（例如 [`oh-acceptance/地图系统.yaml`](../../oh-acceptance/地图系统.yaml)、[`oh-acceptance/工作系统.yaml`](../../oh-acceptance/工作系统.yaml)）。下文在「设计上怎么应对」一节逐条对齐其场景语义；与地图种子、交互点、mock  world 等**实现细节**的交叉线索见同目录下的 `src-game-map.md`、`src-player.md`、`src-game-work.md` 等子报告（本任务不展开源码）。

---

## 一句结论

根目录 **`tests/`** 已按 headless 集成、领域单测、组件/UI、aidoc 与路由文档测试分层组织，**主线玩法回归**集中在 `tests/headless/` 与 `scenarios/` 驱动的编排（如 Story-1 注释里手工对齐 **MAP-*** / **WORK-*** 编号）；**根目录 `data/`** 仅含示例 JSON 与占位，**未被测试或运行时加载**。与 `oh-acceptance` 相比：验收 YAML **没有**被测试套件解析或逐条断言，存在「文档场景 ID 与注释/常量双轨维护」的张力；部分 headless 期望（英文时间标签、具体数量门槛）与 YAML 里中文叙述**粒度与表述不完全同构**。本次审计**只记录、不改测试与业务代码**。

---

## 要解决什么问题（审计视角）

从 **`oh-acceptance/`** 出发，策划关心的是各系统 `scenarios` 下的 **given / when / then**（领域态与呈现）是否可被重复验收。从 **`tests/`** 出发，现状是用 Vitest 锁住实现行为：领域逻辑多直接构造 `WorldCore` 等；集成路径用 `createHeadlessSim`、`scenario-runner` 与 `scenarios/*.scenario.ts` 里的常量。需要回答：

1. 测试数据与 mock 是否**固化**了已废弃或不入文档的行为？
2. 静态资源 **`data/example-pawn.json`** 是否与真实实体模型一致，避免误导工具链或文档读者？
3. **验收文件存在性**（如 `route-demand-docs.test.ts`）与 **验收语义覆盖** 之间缺口有多大？

根目录 `data/` 不参与上述运行路径，但要单独写清「示例价值 vs 一致性风险」。

---

## 设计上怎么应对（文档应然 vs 测试/数据现状）

### 对照 `oh-acceptance/地图系统.yaml`

- **MAP-001**（[`oh-acceptance/地图系统.yaml`](../../oh-acceptance/地图系统.yaml)：`scenario_id: "MAP-001"`，网格可走、初始小人/物资/树木分布）：`tests/headless/map-initial-state.test.ts`、`tests/headless/story-1-day-one.test.ts` 等用**固定 seed 与 grid** 断言树与地面食物 `resource` 等，方向与验收「初始散落与占用」一致；**完整「渲染」与所有呈现 bullet** 不在无头断言内闭环。
- **MAP-002～MAP-004**（存储区、占格冲突、越界裁剪）：`headless` 与 `domain` 中 zone/occupancy/rect 相关用例覆盖领域侧行为，与 YAML 的 domain_state 描述**大体可对齐**；是否与 UI 模式严格一致依赖场景层（参见 `src-scenes.md` 类报告）。

### 对照 `oh-acceptance/工作系统.yaml`

- **WORK-001 / WORK-002**（伐木全链、拾取与搬运）：`tests/headless/chop-tree-full-flow.test.ts`、`chop-haul-full-chain.test.ts`、`haul-work-complete.test.ts`、`pickup-work-complete.test.ts` 等与 [`oh-acceptance/工作系统.yaml`](../../oh-acceptance/工作系统.yaml) 中「工作单生成 → 完成后派生后续工作」的叙事一致；**具体 UI 读条文案**多依赖实现字符串，YAML 用中文描述，测试侧常见英文 key 或 HUD 片段——属于**呈现层对齐**问题，不是逻辑必然冲突。

### 对照其它系统与元数据测试

- **行为 / 需求 / 时间** 等在 `tests/domain`、`tests/headless` 中有大量细粒度用例，但同样**未自动读取** `oh-acceptance/行为系统.yaml`、`oh-acceptance/需求系统.yaml`、`oh-acceptance/时间系统.yaml` 的条目生成测试。
- **`tests/route-demand-docs.test.ts`**、**`tests/aidoc-docs.test.ts`** 校验 skill、registry、索引与工作流字符串，其中要求九个系统均在表内且 `oh-acceptance/<系统名>.yaml` **文件存在**；这保证文档链路「有文件」，**不保证** scenario 内容与测试一一对应。

### 根目录 `data/`

- **`data/example-pawn.json`** 标明为字段约定示例、非运行时加载；字段命名（如 `currentJob`、扁平 `needs`）与领域内实际 pawn 结构可能不完全一致——属于**文档示例漂移**风险，而非测试 mock。

---

## 代码里大致怎么走（入口与协作）

- **运行方式**：`package.json` 中 `npm test` 对应 `vitest run`；`test:headless` 仅跑 `tests/headless/`；`test:docs` 跑 aidoc 校验加 `route-demand-docs` / `aidoc-docs`。
- **`tests/headless/`**：无头模拟与编排最重；常引用 `src/headless`、`scenarios/`，注释中手写 **MAP-001**、**WORK-001** 等与 `oh-acceptance` 的对应关系（例如 `story-1-day-one.test.ts` 文件头注释）。
- **`tests/domain/`**：世界核、工作、时间、行为、选区等单测；普遍用**内存内世界**而非读盘数据。
- **`tests/component/`、`tests/ui/`、`tests/player/`、`tests/scenes/`**：菜单、工具条、任务标记、渲染器等；多从 **`src/data/*`**（配置数据模块）导入，**不是**仓库根 `data/`。
- **`tests/` 根下杂项**：`smoke.test.ts` 仅为占位真值断言；`runtime-log-*.test.ts`、`aidoc-*.test.ts` 偏工具与工程化。
- **`tests/data/task-markers-merge.test.ts`**：路径名是测试子目录 `tests/data/`，测的是 `src/data/task-markers`，与根目录 `data/` 无关。
- **根目录 `data/`**：`example-pawn.json` + `.gitkeep`；当前检索**无**测试 `import` 或 `readFileSync` 指向该目录。

---

## 尚不明确或需要产品/策划拍板

1. **是否要建立「acceptance → 测试」的可追溯矩阵**（例如 scenario_id 列表驱动 CI），还是长期依赖注释与 Code Review 对齐 `oh-acceptance`？
2. **`data/example-pawn.json` 是否应升格为 JSON Schema 或与 TS 类型同源生成**，避免示例与实现分裂？
3. **呈现层验收**（中文文案、`oh-acceptance` 的 `presentation` bullet）在无头测试中普遍较弱：产品是否接受「领域断言为主、UI/i18n 另套快照或 E2E」？
4. 当前工程 **`npx tsc --noEmit` 在 `src/` 与 `tests/` 中均存在既有类型报错**（与本任务无关、未改代码）：若门禁要求全绿，需要先单独安排修复；本报告不展开逐条。

---

## 问题清单

| # | 摘要 | 类型（见 [`README.md`](./README.md)） | 说明与文档对照 |
|---|------|----------------|----------------|
| P1 | `oh-acceptance` 场景未 machine-可读地对齐测试断言 | **多套并行**（文档语义的维护轨 vs 代码注释/常量轨） | 存在文件校验（如 `oh-acceptance/<系统>.yaml`），但无解析 YAML `scenario_id` 的通用测试；与 **MAP-001**、**WORK-001** 等条目同步靠人工。 |
| P2 | Story-1 等集成测试手写场景 ID 注释 | **孤立需求** / 待流程 | 注释与 [`oh-acceptance/地图系统.yaml`](../../oh-acceptance/地图系统.yaml)、[`oh-acceptance/工作系统.yaml`](../../oh-acceptance/工作系统.yaml) 对应，**易与文档改版脱钩**。 |
| P3 | Headless 期望常为英文/实现细节字符串 | **设计一致性**（相对 YAML 中文叙述） | 例如 HUD 时间格式与具体 `expect` 文案；领域语义可与 **WORK-001** 等对齐，**呈现 bullet** 覆盖不完整。 |
| P4 | `MockWorldPort`、提交结果桩在 domain 测试中大量使用 | **多套并行**（与真实 `WorldPort` 路径并存） | 与玩家/场景层「真实提交」关系见 `src-player.md`；测试**固化**了契约形状，若与生产 path 长期分叉会产生假绿。 |
| P5 | 根目录 `data/example-pawn.json` 与运行时 pawn 模型未挂钩 | **孤立需求** / 文档 drift | 注释已说明非运行时加载；若读者误当作 API 真值，会与实体注册表字段不一致。 |
| P6 | `tests/data/` 子目录命名易与根 `data/` 混淆 | **设计一致性**（工程可维护性） | 实际测的是 `src/data` 合并逻辑；新人易误解为仓库根静态数据。 |
| P7 | `smoke.test.ts` 不验证任何领域命题 | **设计一致性** | 不违背 `oh-acceptance`，但对「最小可发表征」帮助有限。 |
| P8 | 部分 `tests/` 文件与当前类型定义不一致（tsc 报错） | **历史包袱** / 待修复 | 属基线债务；本任务不改测试，仅在范围外记录。 |

---

*本报告仅审计仓库根 `tests/` 与 `data/`，对照 `oh-acceptance/*.yaml`；未修改任何测试、业务代码或数据文件。*
