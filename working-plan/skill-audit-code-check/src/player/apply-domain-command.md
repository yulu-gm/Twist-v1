# 审计报告: src/player/apply-domain-command.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `assign_tool_task:build` 分支（约 353–386 行）对 `safePlaceBlueprint` 仅使用 `buildingKind: "bed"`，与策划侧「建造墙」与「家具木床」分模式不一致；玩家若从「建造」路径得到 `build` 工具动词，会错误落地为床铺蓝图而非墙体蓝图。
- [依据]: `oh-gen-doc/交互系统.yaml` 中「蓝图绘制模式」写明触发为「建造-墙-木墙」、结果为墙体蓝图与建造任务；「家具放置模式」触发为「家具-木床」、结果为木床蓝图（约第 61–69 行）。`oh-code-design/建筑系统.yaml`「绘制墙体蓝图」流程亦指向墙体批量创建（约第 70–75 行）。

- [指控]: `oh-code-design/交互系统.yaml`「交互意图层」职责包含「在提交前执行基础校验与过滤」（约第 22–25 行）。对已知 `assign_tool_task:*` 但工具 id 不在白名单内的分支（约 492–510 行）返回 `accepted: true` 且**不修改世界**，与「过滤后明确可执行/不可执行」的意图层语义不一致，易造成 UI/回放认为命令已生效。
- [依据]: 同上「交互意图层」职责条目。

- [指控]: `build_wall_blueprint` / `place_furniture:bed` / `assign_tool_task:build` 在全部目标格解析失败或放置失败时仍统一 `accepted: true`（仅消息区分，例如约 244–246、279–282、373–378 行）。若验收或上层将 `accepted` 视为「至少有一条有效领域效果」，则合理；若策划期望「零格成功应拒绝提交」，则当前行为未体现该规则。（文档未写死，标为与「提交前校验」表述的潜在缺口。）
- [依据]: `oh-code-design/交互系统.yaml`「交互意图层」；`oh-code-design/地图系统.yaml`「选区解析器」对超界与不可用格的过滤（约第 41–44、69–73 行）——本实现将部分过滤推迟到应用阶段并以「全接受+跳过计数」表达，是否与统一拒绝策略对齐待产品确认。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 返回类型使用 `MockWorldSubmitResult`（约第 121 行及多处 `result`），而实际路径为真实 `WorldCore` 变更；命名来自线间契约历史，易让人误判仍为桩实现。
- [影响]: 代码审阅与联调文档容易与「Mock 网关」语义混淆，增加删除/收紧占位逻辑的心理成本。

- [指控]: 注释明确写「尚未映射到工单的工具类动词仍接受但不改世界」（约第 117 行），与约 492–510 行行为一致，属于显式长期占位。
- [影响]: 未接入工具与已接入工具对外均为「接受」，不利于区分「队列无变化」与「已生成工单」，与严格领域语义不兼容。

- [指控]: `place_furniture:bed` 与 `assign_tool_task:build` 中放置床铺蓝图的循环与消息构造高度重复（约 257–291 行与 353–386 行）。
- [影响]: 非 Mock，但重复路径易在单侧修正规则时产生行为漂移（属维护债，常与「无用兼容」同期累积）。

## 3. 架构违规 (Architecture Violations)

- [指控]: 本文件位于 `src/player/`，却被 `src/game/interaction/index.ts` 再导出（`export { applyDomainCommandToWorldCore } from "../../player/apply-domain-command"`），使 **`game` 子系统依赖 `player` 包路径**，与常见分层（玩家/表现依赖游戏核心，而非相反）相反。
- [依据]: `oh-code-design/交互系统.yaml` 接口边界描述为向地图、实体、建筑等系统输出请求（约第 86–94 行），未要求「领域应用实现」放在玩家目录；当前 placement 加剧模块归属模糊。

- [指控]: 单文件内串联存储区创建（对应地图/区域）、蓝图放置（建筑）、多种工单登记（工作）与任务标记，相当于在应用层聚合多条 `oh-code-design` 中的子系统链路；在 S0 中通过 `WorldCore` 收口可运行，但与「建筑规划层 / 区域管理器 / 工作生成层」分模块叙述（见 `oh-code-design/建筑系统.yaml`、`地图系统.yaml`、`工作系统.yaml` 分层职责）存在集中式偏离。
- [依据]: 上述三份子系统中「蓝图管理器」「区域管理器」「工作生成器」模块职责（各文档「模块」小节）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0252]: 将 `assign_tool_task:build` 的语义与菜单/模式对齐：若动词表示「建造墙」，应生成墙体蓝图（与 `build_wall_blueprint` 一致）；木床仅应由家具模式或专用动词触发，避免与 `oh-gen-doc/交互系统.yaml` 两套模式冲突。
- [行动点 #0253]: 对未接入的 `assign_tool_task:*` 改为 `accepted: false` 并附稳定错误码/文案，或引入显式 `deferred`/`noop` 结果形态，禁止与「已提交且生效」共用同一 `accepted: true` 形状。
- [行动点 #0254]: 将 `applyDomainCommandToWorldCore` 移入 `src/game/interaction/`（或 `src/game/` 下独立应用服务模块），由 `player` 仅调用 `game`，消除 `game` → `player` 依赖；顺带将 `MockWorldSubmitResult` 重命名为中性名称（如 `DomainCommandApplyResult`）并在全仓替换。
- [行动点 #0255]: 抽取共用的「多格 `safePlaceBlueprint` 批处理 + 汇总消息」辅助函数，合并 `place_furniture:bed` 与 `assign_tool_task:build` 的重复逻辑；与产品确认后，统一「零格成功」时 `accepted` 与 `messages` 的契约。

---

## 行动点核对（Worker bundle #7 · 2026-04-07）

### AP-0254

- **已核对 / 已落地**：领域应用主体已置于 `src/game/interaction/apply-domain-command.ts`；与之耦合的格解析与阻挡合并已迁至 `src/game/interaction/toolbar-task-target-resolution.ts`，避免 `game` 实现反向依赖 `player` 模块。`src/player/apply-domain-command.ts` 仅再导出 `applyDomainCommandToWorldCore`，供既有导入路径与玩家网关使用；`src/game/interaction/index.ts` 亦导出该函数。审计原文中的 `MockWorldSubmitResult` 与当前代码不一致——提交结果类型已为 `WorldSubmitResult`（定义于 `src/game/contracts/domain-command-types.ts`）。

### AP-0255

- **已核对 / 已落地**：已抽取 `batchSafePlaceBlueprint` 与 `blueprintBatchSummaryMessage`，统一 `build_wall_blueprint`、`place_furniture:bed` 以及 `assign_tool_task:build`（`toolId === "build"`）的多格 `safePlaceBlueprint` 循环与汇总文案。「零格成功仍 `accepted: true`」契约未改，与产品确认仍待审计原文所述。

### 本次改动文件列表

| 操作 | 路径 |
|------|------|
| 新增 | `src/game/interaction/apply-domain-command.ts` |
| 新增 | `src/game/interaction/toolbar-task-target-resolution.ts` |
| 修改 | `src/game/interaction/index.ts` |
| 修改 | `src/player/apply-domain-command.ts` |
| 修改 | `src/player/task-marker-target-cells.ts` |
| 删除 | `src/player/toolbar-task-target-resolution.ts` |

### 类型检查

- 仓库根目录执行 `npx tsc --noEmit`：退出码 **0**。