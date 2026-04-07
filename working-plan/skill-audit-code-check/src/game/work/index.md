# 审计报告: src/game/work/index.ts

## 1. 漏做需求 (Missing Requirements)
- [指控]: 本文件作为 `work` 子目录的聚合出口，未再导出 `work-item-duration.ts` 中与读条/锚格时长相关的公共符号（如 `workItemAnchorDurationSeconds`、`WORK_ITEM_ANCHOR_DURATION_SEC`）。
- [依据]: `oh-code-design/工作系统.yaml` 在「接口边界 · 输出」中明确工作系统需「提供给 UI 系统的工作状态与进度来源」；`oh-gen-doc/工作系统.yaml` 在伐木、建造等工作类型中定义了「读条机制」与「进度显示」。读条时长与表现层一致属于进度来源的一部分，当前能力已实现于子模块，但未经本入口统一暴露，与「单一路径对外交付工作子系统公共能力」的预期存在缺口。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)
- 未发现明显问题。

## 3. 架构违规 (Architecture Violations)
- [指控]: 对 `./work-operations` 采用不对称再导出：对外导出 `completeBlueprintWork`、`completeDeconstructWork`，却未再导出同文件中的 `completeChopWork`、`completePickUpWork`、`completeHaulWork`、`completeMineStoneWork` 等分类型完成函数。
- [依据]: `oh-code-design/工作系统.yaml` 中「工作结算层」职责强调根据行为执行结果更新工作状态；运行时主路径通过 `completeWorkItem` 内部分派（见 `work-operations.ts`）更符合统一结算入口。本 barrel 在入口层同时暴露部分分类型 `complete*` 与聚合 `completeWorkItem`，易使调用方误判「是否应直接调用分类型完成函数」，与子系统边界清晰度目标不一致。
- [补充观察]: 仓库内业务代码多从 `work-operations`、`work-types` 等子路径直接导入（如 `world-core.ts`、`world-work-tick.ts`），`src/game/README.md` 虽提及可从 `./work` 引入，但实际与深层路径混用；本文件作为统一入口未被一致采用，加剧了模块边界的分散（本项与仓库内其它文件的导入习惯相关，但与本 barrel 的聚合策略直接相关）。

## 4. 修复建议 (Refactor Suggestions)
- [行动点 #0164]: 若希望 `index.ts` 成为工作子系统唯一对外 API，应补全与 UI/表现一致的再导出（至少包含读条时长相关符号），并逐步将 `src` 内对 `game/work/*.ts` 的引用迁移到 `game/work` 入口，与 `oh-code-design/工作系统.yaml` 的接口边界表述对齐。
- [行动点 #0165]: 若坚持仅暴露「调度 + 注册表 + 生成器 + 聚合结算」等稳定面，建议从 barrel 中移除 `completeBlueprintWork`、`completeDeconstructWork` 的再导出，仅保留 `completeWorkItem` / `failWorkItem` / `claimWorkItem` 等统一入口，或改为对称地再导出全部分类型 `complete*`（需评估是否对外泄露实现细节）。