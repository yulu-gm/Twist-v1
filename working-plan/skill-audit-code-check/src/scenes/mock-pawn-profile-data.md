# 审计报告: src/scenes/mock-pawn-profile-data.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题。本文件无业务实现，仅将 `../data/pawn-profiles` 的类型与符号再导出；小人档案内容与 `pawnProfileForId` 逻辑均在 `src/data/pawn-profiles.ts`。
- 在 `oh-gen-doc/` 中未检索到与「PawnProfile / 小人档案」逐字对应的专条；`oh-code-design/UI系统.yaml` 中「状态展示模型」要求聚合多系统只读字段用于展示（约第 41–44 行、第 75–79 行）。当前 `src/ui/hud-manager.ts` 已直接自 `../data/pawn-profiles` 调用 `pawnProfileForId`，与「读模型驱动展示、界面不承担领域规则」的方向一致，不依赖本转发文件。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 1–3 行为 `@deprecated` 兼容转发（`MockPawnProfile`、`MOCK_PAWN_PROFILES`、`mockPawnProfileForId`）。
- [影响]: 全仓库 `src/` 内无任何 import 指向 `scenes/mock-pawn-profile-data`；唯一使用方为 `hud-manager` 对 `data/pawn-profiles` 的直接引用。该转发层对运行时无消费者，属于**死代码桥接**，保留只会增加「档案数据从哪进」的认知成本。
- [旁注]: 工作区个别文档仍写旧路径（例如 `docs/ai/systems/scene-hud/2026-04-05-pawn-roster-detail-panel.md` 提及 `mockPawnProfileForId` 与 `src/scenes/mock-pawn-profile-data.ts`），易误导后续改动从 `scenes` 再挂一层；此条非 `oh-code-design` 条款，但会放大上述兼容层的「看似仍有用」错觉。

## 3. 架构违规 (Architecture Violations)

- [指控]: 在 `scenes/` 目录下以 `mock-*` 命名保留数据再导出入口，与 `oh-code-design/UI系统.yaml`「分层」中界面层、读模型来源应清晰可辨的意图不一致（第 13–28 行各层职责、第 81–85 行接口边界强调多系统只读输入）。真实数据源已在 `data/pawn-profiles.ts`，场景层重复出口属于**模块归属噪音**，并非运行时越权调用，但削弱了分层可读性。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0327]: 在允许修改 `src/` 时，删除 `src/scenes/mock-pawn-profile-data.ts`，并全库检索 `mock-pawn-profile-data`、`MockPawnProfile`、`mockPawnProfileForId`，确保无残留引用（当前 `src` 内已为零引用）。
- [行动点 #0328]: 将仍描述旧路径的文档改为指向 `src/data/pawn-profiles.ts` 与 `pawnProfileForId` / `PawnProfile`，避免新代码重新依赖 `scenes` 转发。