# 审计报告: src/player/s0-contract.ts

## 1. 漏做需求 (Missing Requirements)
- 未发现明显问题。本文件无运行时代码，仅将 `../game/interaction/domain-command-types` 中的类型再导出；`DomainCommand` 与 `oh-code-design/交互系统.yaml` 中「核心数据 → 交互命令 → 关键字段」所述的**目标格集合**、**目标实体集合**、**来源模式**在结构上对应（`targetCellKeys`、`targetEntityIds`、`sourceMode`）；`verb` 可视为**命令类型**的字符串载体。更细的动词全集、校验规则由 `build-domain-command` / 网关实现承担，不在本门面文件范围内。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)
- [指控]: 再导出列表包含 `MockLineAPort`、`MockWorldSubmitResult`，名称带 `Mock`，与 `world-core-world-port.ts` 等生产路径共用同一契约入口，易让读者误判提交结果仍为桩实现。
- [影响]: 命名技术债沿玩家线公共 import 扩散（如 `apply-domain-command`、`commit-player-intent`、`world-port-types`），与「Mock 网关」过渡注释（见 `domain-command-types.ts`）形成长期耦合。

## 3. 架构违规 (Architecture Violations)
- 未发现明显问题。本文件为薄聚合层，无业务逻辑、无越层写核心状态。类型真源在 `game/interaction`，`player` 侧通过 `s0-contract` 统一入口，与 `oh-code-design/交互系统.yaml`「交互意图层把输入结果转为领域命令」的分工叙述相容（契约形状由交互/意图相关模块持有，玩家管线消费）。
- [补充观察]（非本文件独有）: `src/headless/scenario-types.ts` 等若仅从本文件取 `DomainCommand`，会形成 `headless → player → game` 依赖链；属依赖图选型问题，源头仍是「Mock 命名 + player 聚合」策略，而非本文件新增逻辑。

## 4. 修复建议 (Refactor Suggestions)
- [行动点 #0275]: 在 `domain-command-types.ts` 将 `MockWorldSubmitResult` / `MockLineAPort` 重命名为中性名（如 `WorldSubmitResult`、`LineASnapshotPort`），本文件同步再导出新名；必要时用 `/** @deprecated */` 类型别名保留过渡期。
- [行动点 #0276]: 评估将文件名 `s0-contract.ts` 改为与职责一致的名称（如 `domain-command-contract.ts`），并批量更新 import；或保留文件名但在模块注释中明确「S0 = 线间里程碑代号，非 Mock 语义」以降低误读。
- [行动点 #0277]（已落实）: headless `scenario-types`、各 `scenarios/*.scenario.ts` 与仅类型的 domain/headless 测试已改为从 `src/game/interaction/domain-command-types` 引用 `DomainCommand` 等；`src/player/*` 仍经 `s0-contract` 聚合。`s0-contract.ts` 顶部注释标明分工。