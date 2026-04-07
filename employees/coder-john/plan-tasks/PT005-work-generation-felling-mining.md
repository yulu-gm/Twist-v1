# PT005-伐木与开采工作生成（工作生成器切片）

## 1. 计划目标

依据 `oh-code-design/工作系统.yaml` 模块 **「工作生成器」** 及关键流程 **「伐木链路」「开采链路」** 的前半段（树木/岩石被标记后 **生成对应工作**、并与目标实体建立关联），在 `src/game/` 内实现 **仅针对伐木与开采** 的生成逻辑：根据 `EntityRegistry` 中树木/岩石实体状态，向现有 `WorkRegistry` 登记 **待处理** 工作单。

本计划话题单一：**只做「伐木 / 开采」两类工单的生成与去重规则**，不实现拾取/搬运后续链、不实现工作领取器/结算器、不改变 `GameScene` 或任务标记 UI（接线由后续计划负责）。

## 2. 工作内容

1. **工作类型约定**  
   - 使用稳定字符串常量区分工单类型（例如 `felling` / `mining`，或中英命名与项目现有 `workType` 用法一致即可），与 YAML「工作类型」语义对应，并在生成函数处集中定义，避免魔法字符串散落。

2. **生成入口（纯领域逻辑）**  
   - **伐木**：给定 `treeId`，校验 `EntityRegistry.getTree` 存在，且满足「可生成工作」的条件（至少包含 **伐木标记** `lumberMarked === true`，若树木已被占用则与 YAML「锁定目标」精神一致：**可不生成或生成前抛错**，在计划中选定一种策略并写清）。  
   - **开采**：对称处理 `rockId` 与 `miningMarked`。  
   - 工单字段：`targetEntityId` 为树/岩 id，`targetCell` 为该实体所在格，`priority` / `reason` 使用合理默认值或枚举原因码（字符串），`status` 为 `pending`。  
   - `steps` 可省略，或填入与 YAML「工作步骤」结构一致的最小占位（仅当能明确对应成功/失败语义时再加，避免空洞模板）。

3. **去重（对齐 YAML「去重并合并重复工作」的最小实现）**  
   - 对同一 `targetEntityId` 与同一 `workType`，若已存在 `pending`（可同时约定 `in_progress` 是否也算占用），则 **不再新增** 第二条工单，或 **幂等返回已有 work id**——在实现中固定一种行为并文档化于代码注释仅限必要处的类型/常量说明（禁止过程性「为什么要改」注释）。

4. **文件与依赖**  
   - 新增 `src/game/work-generation.ts`（或等价命名），仅依赖 `entity-system`、`work-system`、`world-grid`；**禁止**依赖 Phaser / `GameScene`。

## 3. 验收标准

- 对合法已标记树/岩调用生成函数后，`WorkRegistry` 出现对应 `pending` 工单且 `targetEntityId`、`targetCell` 正确；重复调用不产生重复 `pending`（符合 §2 选定策略）。  
- 对不合法目标（不存在、未标记等）行为明确：抛错或静默跳过——任选其一但在实现内统一。  
- `npm run build` 编译通过。  
- 与 PT001～PT004、PT003 无重复：PT003 已提供目录；本计划只补生成层切片，不修改 `EntityLifecycle`。
